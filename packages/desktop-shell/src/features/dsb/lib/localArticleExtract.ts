/**
 * localArticleExtract — 記事本文を「本人の端末・本人のWebView Cookie」で抽出する。
 *
 * Cloud Functions(mode:'read') はサーバーからの匿名アクセスなので、ArchDaily 等で
 * ユーザーがログインしていても常に「未ログインの本文」しか取れない。
 * ここでは S.Model カタログ巡回と同じ隠し WebView 基盤（open_crawl_webview →
 * ローカルブリッジ 127.0.0.1:14207 /crawl → `crawl-page-received`）を使い、
 * アプリ本体と Cookie を共有する WebView2 で記事ページを開いて DOM から本文を抜く。
 * ユーザーが一度「原文をアプリ内ウィンドウで開く」等でログインしていれば、
 * 以後この抽出はログイン状態の本文を返す。
 *
 * 通信は fetch ではなくトップレベル GET 遷移（CSP connect-src / PNA 回避、
 * webCrawlConfig.buildExtractorScript と同じ方式）。Tauri(デスクトップ)専用。
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ReaderBlock } from '../SourceArticleReader';
import { BRIDGE_URL } from '../../dsk/catalog/webCrawlConfig';

let _seq = 0;

/** 抽出結果の最低品質ライン（これ未満は「失敗」としてCFフォールバックさせる）。 */
const MIN_BLOCKS = 3;
const MIN_TEXT_CHARS = 300;

interface ReaderCrawlPayload {
  crawlId?: string;
  reader?: boolean;
  blocks?: unknown[];
  diag?: { root?: string; blockCount?: number; textChars?: number; ready?: string };
}

/**
 * 記事URLを隠しWebViewで開き、本文ブロック（p/h/img/video）を抽出して返す。
 * 失敗・低品質・タイムアウトは null（呼び出し側で従来のCF取得へフォールバック）。
 */
export async function extractArticleLocally(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<ReaderBlock[] | null> {
  const timeoutMs = opts.timeoutMs ?? 18000;
  const crawlId = `rd${Date.now().toString(36)}x${_seq++}`;
  const initScript = buildReaderExtractScript(crawlId);

  return new Promise<ReaderBlock[] | null>((resolve) => {
    let done = false;
    let unlisten: (() => void) | null = null;
    const finish = (blocks: ReaderBlock[] | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unlisten?.();
      resolve(blocks);
    };
    const timer = setTimeout(() => {
      void invoke('close_crawl_webview', { crawlId }).catch(() => {});
      finish(null);
    }, timeoutMs);

    void (async () => {
      try {
        unlisten = await listen<ReaderCrawlPayload>('crawl-page-received', (e) => {
          const p = e.payload;
          if (!p || p.crawlId !== crawlId) return; // カタログ巡回など他の受信は素通し
          const blocks = sanitizeBlocks(p.blocks);
          console.log('[localArticleExtract]', url, 'diag=', p.diag, 'blocks=', blocks.length);
          finish(isGoodEnough(blocks) ? blocks : null);
        });
        if (done) { unlisten?.(); return; } // listen 完了前にタイムアウト済み
        await invoke('open_crawl_webview', { url, crawlId, initScript, visible: false });
      } catch (err) {
        console.warn('[localArticleExtract] open failed for', url, err);
        finish(null);
      }
    })();
  });
}

/** 受信ペイロードを ReaderBlock[] へ検証・整形（不正要素は捨てる）。 */
function sanitizeBlocks(raw: unknown[] | undefined): ReaderBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: ReaderBlock[] = [];
  for (const b of raw) {
    const t = (b as any)?.t;
    if (t === 'p' || t === 'h') {
      const text = String((b as any).text || '').trim();
      if (text) out.push({ t, text });
    } else if (t === 'img' || t === 'video') {
      const src = String((b as any).src || '');
      if (/^https:\/\//.test(src)) out.push({ t, src });
    }
  }
  return out;
}

function isGoodEnough(blocks: ReaderBlock[]): boolean {
  const textChars = blocks.reduce((n, b) => n + (b.t === 'p' || b.t === 'h' ? b.text.length : 0), 0);
  return blocks.length >= MIN_BLOCKS && textChars >= MIN_TEXT_CHARS;
}

/** 本文テキストが日本語主体か（翻訳が不要か）の判定。 */
export function blocksLookJapanese(blocks: ReaderBlock[]): boolean {
  const text = blocks
    .filter((b): b is { t: 'p' | 'h'; text: string } => b.t === 'p' || b.t === 'h')
    .map((b) => b.text)
    .join('')
    .slice(0, 2000);
  if (!text) return false;
  let jp = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff)) jp++;
  }
  return jp / text.length > 0.15;
}

/**
 * 隠し WebView に注入する本文抽出スクリプトを組み立てる。
 * レンダリング完了（本文テキスト量が安定）を待ってから、記事コンテナを推定し
 * 見出し・段落・画像・埋め込み動画を出現順に収集 → ブリッジへ GET 遷移で送る。
 * 注意: テンプレートリテラルは使わず文字列連結（注入先での衝突回避、既存巡回と同流儀）。
 */
function buildReaderExtractScript(crawlId: string): string {
  return '(function(){' +
    'if(location.hostname==="127.0.0.1")return;' + // ブリッジ遷移後は何もしない
    'var CRAWL_ID=' + JSON.stringify(crawlId) + ';' +
    'var BRIDGE=' + JSON.stringify(BRIDGE_URL) + ';' +
    'var MAX_TEXT=26000,MAX_BLOCKS=160,MAX_IMGS=40,MAX_WAIT=12000;' +
    'var sent=false;' +
    'function abs(h){try{return new URL(h,location.href).href;}catch(e){return null;}}' +
    // ── 記事コンテナ推定: 候補のうちテキスト量が最大のもの（無ければ body）──
    'function pickRoot(){' +
      'var sels=["article","[itemprop~=articleBody]","[class*=article-body]","[class*=post-content]","[class*=entry-content]","main"];' +
      'var best=null,bestLen=0,rootSel="body";' +
      'for(var i=0;i<sels.length;i++){var els=document.querySelectorAll(sels[i]);' +
        'for(var j=0;j<els.length;j++){var len=(els[j].textContent||"").length;' +
          'if(len>bestLen){bestLen=len;best=els[j];rootSel=sels[i];}}}' +
      'return{el:best||document.body,sel:best?rootSel:"body"};' +
    '}' +
    'function extract(){' +
      'var root=pickRoot();' +
      'var blocks=[],textChars=0,imgCount=0,seenText={},seenSrc={};' +
      'var nodes=root.el.querySelectorAll("h1,h2,h3,h4,h5,p,li,img,iframe");' +
      'for(var i=0;i<nodes.length;i++){' +
        'if(blocks.length>=MAX_BLOCKS||textChars>=MAX_TEXT)break;' +
        'var el=nodes[i],tag=el.tagName.toLowerCase();' +
        'if(el.closest("nav,aside,footer,form,header:not(article header)"))continue;' + // 記事外のチローム除外
        'if(tag==="img"){' +
          'if(imgCount>=MAX_IMGS)continue;' +
          // 画質: 狭い抽出用WebViewでは currentSrc が小さい変種に解決されぼやける。
          // srcset（や data-srcset）から最大幅の変種を選び、無ければ遅延読み込みの実体URLを優先する。
          'var ss=el.getAttribute("srcset")||el.getAttribute("data-srcset")||"";' +
          'var src="";' +
          'if(ss){var _p=ss.split(","),_bw=0;for(var _k=0;_k<_p.length;_k++){' +
            'var _s=_p[_k].trim();if(!_s)continue;var _sp=_s.split(/\\s+/),_u=_sp[0],_d=_sp[1]||"";' +
            'var _w=/w$/.test(_d)?(parseInt(_d,10)||0):(/x$/.test(_d)?Math.round((parseFloat(_d)||1)*1000):1);' +
            'if(_u&&_w>=_bw){_bw=_w;src=_u;}' +
          '}}' +
          'if(!src)src=el.getAttribute("data-src")||el.getAttribute("data-lazy-src")||el.getAttribute("data-original")||el.src||el.currentSrc||"";' +
          'src=src?abs(src):null;' +
          'if(!src||src.indexOf("https://")!==0)continue;' +
          'if(/logo|icon|avatar|sprite|spacer|blank|badge|button/i.test(src))continue;' +
          'var w=parseInt(el.getAttribute("width")||"0",10);' +
          'if(w&&w<150)continue;' +                                  // 明示的に小さい画像はアイコン扱い
          'if(seenSrc[src])continue;seenSrc[src]=1;' +
          'blocks.push({t:"img",src:src});imgCount++;continue;' +
        '}' +
        'if(tag==="iframe"){' +
          'var fsrc=abs(el.src||"");' +
          'if(fsrc&&/youtube\\.com\\/embed|youtube-nocookie\\.com\\/embed|player\\.vimeo\\.com/.test(fsrc)&&!seenSrc[fsrc]){' +
            'seenSrc[fsrc]=1;blocks.push({t:"video",src:fsrc});}' +
          'continue;' +
        '}' +
        // li 内の p / 入れ子 li は親側で拾えるので、内側は飛ばして二重取りを防ぐ
        'if(el.parentElement&&el.parentElement.closest("p,li"))continue;' +
        'var text=(el.textContent||"").replace(/\\s+/g," ").trim();' +
        'if(tag.charAt(0)==="h"){' +
          'if(text.length<2||text.length>300)continue;' +
          'if(seenText[text])continue;seenText[text]=1;' +
          'blocks.push({t:"h",text:text});textChars+=text.length;' +
        '}else{' +
          'if(text.length<25)continue;' +                             // ボタン/キャプション等の短片除外
          'if(seenText[text])continue;seenText[text]=1;' +
          'blocks.push({t:"p",text:text});textChars+=text.length;' +
        '}' +
      '}' +
      'return{blocks:blocks,diag:{root:root.sel,blockCount:blocks.length,textChars:textChars,ready:document.readyState}};' +
    '}' +
    // 送信: GET 遷移。URL が長すぎる場合は末尾ブロックを削って収める（ブリッジ側の安全弁 1MB 未満に）。
    'function send(){if(sent)return;sent=true;var d=extract();' +
      'try{' +
        'var payload={crawlId:CRAWL_ID,reader:true,blocks:d.blocks,diag:d.diag};' +
        'var enc=encodeURIComponent(JSON.stringify(payload));' +
        'while(enc.length>600000&&payload.blocks.length>1){' +
          'payload.blocks=payload.blocks.slice(0,Math.floor(payload.blocks.length*0.8));' +
          'enc=encodeURIComponent(JSON.stringify(payload));' +
        '}' +
        'location.href=BRIDGE+"?crawlId="+encodeURIComponent(CRAWL_ID)+"&d="+enc;' +
      '}catch(e){}' +
    '}' +
    // レンダリング待ち: 本文テキスト量が2回連続で変わらなくなったら安定とみなす。
    'var tries=0,maxTries=Math.ceil(MAX_WAIT/500),last=-1,stable=0;' +
    'var iv=setInterval(function(){tries++;' +
      'var len=(document.body&&document.body.textContent||"").length;' +
      'if(len===last&&len>0){stable++;}else{stable=0;last=len;}' +
      'if((document.readyState!=="loading"&&stable>=2)||tries>=maxTries){clearInterval(iv);send();}' +
    '},500);' +
  '})();';
}
