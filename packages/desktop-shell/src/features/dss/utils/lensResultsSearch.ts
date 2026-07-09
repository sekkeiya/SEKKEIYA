// ──────────────────────────────────────────────────────────────────────────────
// Google レンズの逆画像検索「結果一覧」をアプリ内で取得する。
//
// 方針: 既存の隠し WebView クローラ基盤（webcrawler.rs / ローカルブリッジ 14207）を
// 再利用する。Lens の結果ページ(lens.google.com/uploadbyurl?url=...)を不可視 WebView で
// 開き、Lens 専用の抽出スクリプトを注入。レンダリング後に「外部サイトへの商品リンク」を
// DOM から拾ってブリッジへ POST → `crawl-page-received` でフロントに返す。
//
// 得られた結果は LensResultsDialog で一覧表示し、ユーザーが選んだものを 3D モデルの
// RELATED URLs (relatedLinks) として登録する。
//
// 注意: Lens の DOM は難読化・非公開で変化しうるため抽出はベストエフォート。
//       取得できない場合はダイアログから「ブラウザで開く」へフォールバックする。
//       隠し WebView はデスクトップ専用。Web では利用不可（呼び出し側でガードする）。
// ──────────────────────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { BRIDGE_TOKEN, BRIDGE_URL } from '../../dsk/catalog/webCrawlConfig';
import { ensurePublicImageUrl } from './productImageSearch';
import { WorkspaceItemRepository } from '../../workspace/WorkspaceItemRepository';
import { storage } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';

/** カタログサムネ（data URL）を Firebase Storage にアップロードして公開 URL を返す。失敗時 null。 */
async function uploadCatalogThumb(dataUrl: string, uid: string, modelId: string, idx: number): Promise<string | null> {
  try {
    const mime = (/^data:([a-z0-9.+/-]+);base64,/i.exec(dataUrl)?.[1] || 'image/jpeg').toLowerCase();
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const safeId = String(modelId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
    const path = `imageSearch/${uid}/catalog-${safeId}-${idx}-${Date.now()}.${ext}`;
    const r = ref(storage, path);
    await uploadString(r, dataUrl, 'data_url');
    return await getDownloadURL(r);
  } catch (e) {
    console.warn('[uploadCatalogThumb] failed', e);
    return null;
  }
}

export interface LensResult {
  /** 外部商品/出所ページの URL */
  url: string;
  /** 表示用タイトル（商品名など） */
  title: string;
  /** サムネイル画像 URL（data: または gstatic 等。<img> に直接表示できる） */
  thumbnail: string;
  /** 出所ドメイン（例: store.example.com） */
  source: string;
}

export interface LensDiagImg { t: 'img' | 'bg'; src: string; alt?: string; nw?: number; rw?: number; }
export interface LensDiag {
  anchors: number;
  external: number;
  withImage: number;
  ready: string;
  photos?: { src: string; dim: number; href: string }[];
  sample?: { href: string; imgs: LensDiagImg[] }[];
}

interface LensCrawlPayload {
  crawlId: string;
  url: string;
  lensResults?: LensResult[];
  diag?: LensDiag;
}

export interface RelatedLink { title: string; url: string; thumbnail?: string; source?: string; }
export interface CatalogLink { title: string; url: string; price?: string; thumbnail?: string; source?: string; }

let _lensSeq = 0;

/** Lens の逆画像検索 URL を組み立てる（公開画像 URL を渡す）。 */
export function buildLensUrl(imageUrl: string): string {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
}

/**
 * 隠し WebView へ注入する Lens 結果抽出スクリプトを文字列で組み立てる。
 * document-start で走り、外部サイトへの商品リンクが現れる or タイムアウトするまで
 * 待ってから抽出してローカルブリッジへ POST する。
 * 注意: テンプレートリテラルは使わず文字列連結で組む（注入先での衝突回避）。
 */
function buildLensExtractorScript(crawlId: string, maxWaitMs: number, maxItems: number): string {
  return '(function(){' +
    'var TOKEN=' + JSON.stringify(BRIDGE_TOKEN) + ';' +
    'var CRAWL_ID=' + JSON.stringify(crawlId) + ';' +
    'var BRIDGE=' + JSON.stringify(BRIDGE_URL) + ';' +
    'var MAX_WAIT=' + JSON.stringify(maxWaitMs) + ';' +
    'var MAX_ITEMS=' + JSON.stringify(maxItems) + ';' +
    'var sent=false;' +
    // Google 内部ドメインは検索結果ではないため除外する。
    'var GOOG=/(^|\\.)(google\\.|gstatic\\.com|googleusercontent\\.com|youtube\\.com|youtu\\.be|ggpht\\.com|googleapis\\.com|schema\\.org|gmail\\.com|googleadservices)/i;' +
    'function abs(h){try{return new URL(h,location.href).href;}catch(e){return null;}}' +
    // google.com/url?q=... や ?url=... のリダイレクトラッパを剥がす。
    'function unwrap(h){try{var u=new URL(h,location.href);' +
      'if(/(^|\\.)google\\./i.test(u.host)&&/\\/url$/.test(u.pathname)){' +
        'var q=u.searchParams.get("q")||u.searchParams.get("url");if(q)return q;}' +
      'return u.href;}catch(e){return h;}}' +
    'function host(h){try{return new URL(h).host;}catch(e){return "";}}' +
    // ファビコン/ロゴ/スプライト類は商品画像ではないので除外する。
    'function isFavicon(s){return /favicon|s2\\/favicons|sprite|\\/logo|gstatic\\.com\\/faviconV2/i.test(s||"");}' +
    'function imgSrc(img){var s=img.getAttribute("src")||img.src||img.getAttribute("data-src")||img.getAttribute("data-lazy-src")||img.getAttribute("data-original")||img.getAttribute("data-iml")||img.getAttribute("data-deferred")||"";' +
      'if((!s||/^data:image\\/(gif|svg)/i.test(s))&&img.getAttribute("srcset")){s=(img.getAttribute("srcset").split(",").pop()||"").trim().split(" ")[0]||s;}return s||"";}' +
    'function bgUrl(el){try{var bg=getComputedStyle(el).backgroundImage;if(bg&&bg.indexOf("url(")>-1){var m=bg.match(/url\\([\\"\\\']?([^\\"\\\')]+)[\\"\\\']?\\)/);if(m&&m[1])return m[1];}}catch(e){}return "";}' +
    // 要素の最大寸法（描画 or 自然サイズ）。ファビコン(32px等)と商品写真(100px+)の判別に使う。
    'function maxDim(el){var w=0,h=0;if(el.tagName==="IMG"){w=el.naturalWidth||0;h=el.naturalHeight||0;}' +
      'try{var r=el.getBoundingClientRect();w=Math.max(w,r.width||0);h=Math.max(h,r.height||0);}catch(e){}return Math.max(w,h);}' +
    'function imgUrlOf(el){var s=(el.tagName==="IMG")?imgSrc(el):"";if(!s)s=bgUrl(el);return s||"";}' +
    // 商品写真らしい URL（gstatic サムネ/CDN/拡張子付き）。data:image/png はファビコンが多いので除外。
    'var PHOTOURL=/encrypted-tbn|gstatic\\.com\\/images|googleusercontent|lh\\d+\\.google|ggpht|bing\\.net\\/th|\\.(jpe?g|webp)(\\?|#|$)|^data:image\\/(jpe?g|webp)/i;' +
    // 商品写真候補のスコア。ファビコン相当(小さい)は除外。寸法不明は写真URLのみ許可。
    'function photoScore(el){var s=imgUrlOf(el);if(!s||isFavicon(s))return null;' +
      'var d=maxDim(el);var strong=PHOTOURL.test(s);' +
      'if(d>0&&d<50)return null;' +          // 50px未満はファビコン/アイコン
      'if(d===0&&!strong)return null;' +     // 未ロードかつ写真URLでない＝不採用
      'return {src:s,dim:d,score:(d>0?d:60)+(strong?100000:0)};}' +
    // 与えられた要素から最も近い「外部サイトへのリンク」を探す（同カード内のリンクとペアリング）。
    'function findExternal(el){var node=el;' +
      'for(var i=0;i<7&&node;i++){var as=node.querySelectorAll?node.querySelectorAll("a[href]"):[];' +
        'for(var j=0;j<as.length;j++){var raw=as[j].getAttribute("href");if(!raw)continue;' +
          'var u=unwrap(abs(raw));if(!u||!/^https?:\\/\\//i.test(u))continue;' +
          'var hh=host(u);if(hh&&!GOOG.test(hh))return {url:u,host:hh,anchor:as[j]};}' +
        'node=node.parentElement;}return null;}' +
    // 診断用: アンカー配下の画像候補を列挙する。
    'function describe(a,href){var info={href:(href||"").slice(0,120),imgs:[]};var nodes=[a];' +
      'try{var all=a.querySelectorAll("*");for(var k=0;k<all.length;k++)nodes.push(all[k]);}catch(e){}' +
      'for(var i=0;i<nodes.length&&info.imgs.length<10;i++){var el=nodes[i];' +
        'if(el.tagName==="IMG"){var rw=0;try{rw=Math.round(el.getBoundingClientRect().width);}catch(e){}' +
          'info.imgs.push({t:"img",src:(imgSrc(el)||el.getAttribute("src")||"").slice(0,160),alt:(el.getAttribute("alt")||"").slice(0,40),nw:el.naturalWidth||0,rw:rw});}' +
        'else{var bg=bgUrl(el);if(bg){var rw2=0;try{rw2=Math.round(el.getBoundingClientRect().width);}catch(e){}info.imgs.push({t:"bg",src:bg.slice(0,160),rw:rw2});}}' +
      '}return info;}' +
    'function titleOf(a){' +
      'var t=a.getAttribute("aria-label")||"";' +
      'if(!t){var im=a.querySelector?a.querySelector("img[alt]"):null;if(im)t=im.getAttribute("alt")||"";}' +
      'if(!t)t=(a.textContent||"").replace(/\\s+/g," ").trim();' +
      'return (t||"").slice(0,200);' +
    '}' +
    'function extract(){' +
      'var seen={},results=[],photosDiag=[],sample=[];' +
      // ── 画像起点: ページ上の商品写真を集め、各写真と同カード内の外部リンクをペアにする。
      'var imgels=Array.prototype.slice.call(document.querySelectorAll(\'img,[style*="background-image"]\'));' +
      'var cands=[];for(var i=0;i<imgels.length;i++){var ps=photoScore(imgels[i]);if(ps){ps.el=imgels[i];cands.push(ps);}}' +
      'cands.sort(function(x,y){return y.score-x.score;});' +
      'for(var c=0;c<cands.length&&results.length<MAX_ITEMS;c++){var cand=cands[c];' +
        'var lk=findExternal(cand.el);' +
        'if(photosDiag.length<8)photosDiag.push({src:cand.src.slice(0,140),dim:Math.round(cand.dim),href:(lk?lk.url:"").slice(0,120)});' +
        'if(!lk)continue;' +
        'var key=lk.host+new URL(lk.url).pathname;if(seen[key])continue;seen[key]=1;' +
        'var thumb=cand.src;if(thumb.indexOf("data:")!==0)thumb=abs(thumb);' +
        'results.push({url:lk.url,title:titleOf(lk.anchor),thumbnail:thumb||"",source:lk.host});}' +
      // ── フォールバック: 画像起点で足りなければ外部リンク（タイトル付き・サムネ無し）で補完。
      'var anchors=Array.prototype.slice.call(document.querySelectorAll("a[href]"));var external=0;' +
      'anchors.forEach(function(a){var raw=a.getAttribute&&a.getAttribute("href");if(!raw)return;' +
        'var href=unwrap(abs(raw));if(!href||!/^https?:\\/\\//i.test(href))return;var h=host(href);if(!h||GOOG.test(h))return;external++;' +
        'if(sample.length<3)sample.push(describe(a,href));' +
        'if(results.length>=MAX_ITEMS)return;' +
        'var key=h+new URL(href).pathname;if(seen[key])return;var title=titleOf(a);if(!title)return;seen[key]=1;' +
        'results.push({url:href,title:title,thumbnail:"",source:h});});' +
      // サムネ付きを優先して並べる。
      'results.sort(function(x,y){return (y.thumbnail?1:0)-(x.thumbnail?1:0);});' +
      'return{results:results.slice(0,MAX_ITEMS),' +
        'diag:{anchors:anchors.length,external:external,withImage:results.filter(function(r){return!!r.thumbnail;}).length,ready:document.readyState,photos:photosDiag,sample:sample}};' +
    '}' +
    'function send(){if(sent)return;sent=true;var d=extract();' +
      'try{fetch(BRIDGE,{method:"POST",headers:{"Content-Type":"application/json","X-Sekkeiya-Token":TOKEN},' +
        'body:JSON.stringify({crawlId:CRAWL_ID,url:location.href,lensResults:d.results,diag:d.diag})}).catch(function(){});}catch(e){}' +
    '}' +
    'var tries=0,maxTries=Math.ceil((MAX_WAIT||12000)/600);' +
    'var iv=setInterval(function(){tries++;' +
      // 遅延ロードを発火させるため段階的にスクロールする。
      'try{window.scrollTo(0,Math.floor((document.body?document.body.scrollHeight:0)*(tries/maxTries)));}catch(e){}' +
      // 外部リンクが十分現れたら、もしくはタイムアウトで送る。
      'var ext=0;try{var as=document.querySelectorAll("a[href]");for(var i=0;i<as.length;i++){var hh=as[i].getAttribute("href")||"";if(/^https?:\\/\\//i.test(hh)&&!GOOG.test(hh)&&hh.indexOf("/url?")<0){ext++;}}}catch(e){}' +
      'if((ext>=4&&tries>=4)||tries>=maxTries){clearInterval(iv);setTimeout(send,800);}' +
    '},600);' +
  '})();';
}

/**
 * 選択中モデルを Google レンズで逆画像検索し、結果一覧を返す（デスクトップ専用）。
 * 公開画像 URL を確保（ローカルモデルは一時アップロード）してから隠し WebView を開く。
 */
export async function runLensSearch(
  model: any,
  uid: string | null,
  opts: { maxItems?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ imageUrl: string; lensUrl: string; results: LensResult[]; diag: LensDiag | null }> {
  const { maxItems = 12, timeoutMs = 16000, signal } = opts;
  const imageUrl = await ensurePublicImageUrl(model, uid);
  const lensUrl = buildLensUrl(imageUrl);

  const crawlId = `lens${_lensSeq++}_${Date.now()}`;
  const initScript = buildLensExtractorScript(crawlId, Math.max(8000, timeoutMs - 2000), maxItems);

  const out = await new Promise<{ results: LensResult[]; diag: LensDiag | null }>((resolve) => {
    let done = false;
    let unlisten: (() => void) | null = null;
    const finish = (r: LensResult[], diag: LensDiag | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (unlisten) unlisten();
      if (signal) signal.removeEventListener('abort', onAbort);
      invoke('close_crawl_webview', { crawlId }).catch(() => {});
      resolve({ results: r, diag });
    };
    const onAbort = () => finish([], null);
    const timer = setTimeout(() => finish([], null), timeoutMs);

    listen<LensCrawlPayload>('crawl-page-received', (e) => {
      const p = e.payload;
      if (p && p.crawlId === crawlId) {
        console.log('[runLensSearch] diag=', p.diag, 'results=', (p.lensResults || []).length);
        finish(p.lensResults || [], p.diag || null);
      }
    }).then((un) => {
      unlisten = un;
      if (signal) {
        if (signal.aborted) { onAbort(); return; }
        signal.addEventListener('abort', onAbort);
      }
      invoke('open_crawl_webview', { url: lensUrl, crawlId, initScript }).catch(() => finish([], null));
    });
  });

  return { imageUrl, lensUrl, results: out.results, diag: out.diag };
}

/**
 * Lens 結果から「上位 N 件」を選ぶ。サムネ（商品写真）付き＝似ている確度が高いものを優先。
 */
export function pickTopLensLinks(results: LensResult[], count = 5): RelatedLink[] {
  const withThumb = results.filter((r) => r.thumbnail);
  const pool = withThumb.length >= 3 ? withThumb : results;
  return pool.slice(0, count).map((r) => ({ title: r.title || r.source, url: r.url, thumbnail: r.thumbnail || undefined, source: r.source || undefined }));
}

export interface BulkRegisterProgress {
  index: number;        // 0-based
  total: number;
  title: string;        // 処理中モデル名
  phase: 'search' | 'register' | 'done' | 'skipped' | 'error';
  added?: number;       // 追記できた件数
  message?: string;
}

export interface BulkRegisterResult {
  modelId: string;
  title: string;
  added: number;
  relatedLinks?: RelatedLink[];
  error?: string;
}

/**
 * 複数モデルに対して順番に Lens 逆画像検索し、上位 N 件を relatedLinks へ自動登録する。
 * 隠し WebView を逐次使うため直列実行。onProgress で進捗を通知、signal で中断可能。
 */
export async function bulkRegisterLensLinks(
  models: any[],
  uid: string | null,
  opts: { count?: number; onProgress?: (p: BulkRegisterProgress) => void; signal?: AbortSignal } = {},
): Promise<BulkRegisterResult[]> {
  const { count = 5, onProgress, signal } = opts;
  const out: BulkRegisterResult[] = [];
  console.log('[bulkRegister] start', models.length, 'models', models.map((m) => ({ id: m?.id, title: m?.title || m?.name })));
  for (let i = 0; i < models.length; i++) {
    if (signal?.aborted) { console.log('[bulkRegister] aborted at', i); break; }
    const model = models[i];
    const title = model?.title || model?.name || `モデル${i + 1}`;
    // Lens の連続アクセスによる制限（captcha/sorry ページ）を避けるため、2件目以降は間隔を空ける。
    if (i > 0) await new Promise((r) => setTimeout(r, 3500));
    try {
      onProgress?.({ index: i, total: models.length, title, phase: 'search' });
      const { results, diag } = await runLensSearch(model, uid, { signal });
      const links = pickTopLensLinks(results, count);
      console.log(`[bulkRegister] #${i} "${title}" id=${model?.id} results=${results.length} links=${links.length} diag.anchors=${diag?.anchors} diag.external=${diag?.external}`);
      if (links.length === 0) {
        out.push({ modelId: model.id, title, added: 0, error: '検索結果が取得できませんでした（Lensの制限の可能性）' });
        onProgress?.({ index: i, total: models.length, title, phase: 'skipped', added: 0, message: '結果なし' });
        continue;
      }
      onProgress?.({ index: i, total: models.length, title, phase: 'register', added: links.length });
      const merged = await appendRelatedLinks(model, links);
      console.log(`[bulkRegister] #${i} "${title}" registered ${links.length}, total now ${merged.length}`);
      out.push({ modelId: model.id, title, added: links.length, relatedLinks: merged });
      onProgress?.({ index: i, total: models.length, title, phase: 'done', added: links.length });
    } catch (e: any) {
      console.error(`[bulkRegister] #${i} "${title}" FAILED`, e);
      out.push({ modelId: model.id, title, added: 0, error: e?.message || '失敗' });
      onProgress?.({ index: i, total: models.length, title, phase: 'error', message: e?.message || '失敗' });
    }
  }
  console.log('[bulkRegister] done', out.map((r) => ({ title: r.title, added: r.added, error: r.error })));
  return out;
}

/**
 * 選んだリンクを 3D モデルの relatedLinks（RELATED URLs）へ追記して永続化する。
 * 既存リンクとは URL で重複排除する。更新後の relatedLinks 配列を返す。
 */
export async function appendRelatedLinks(model: any, links: RelatedLink[]): Promise<RelatedLink[]> {
  if (!model?.id) {
    throw new Error('モデルIDがありません（登録先を特定できません）');
  }
  const existing: RelatedLink[] = Array.isArray(model?.relatedLinks)
    ? model.relatedLinks.filter((l: any) => l && l.url)
    : [];
  const uid = useAuthStore.getState().currentUser?.uid || null;
  const seen = new Set(existing.map((l) => l.url));
  const merged = [...existing];
  let thumbIdx = 0;
  for (const l of links) {
    if (l && l.url && !seen.has(l.url)) {
      seen.add(l.url);
      const entry: RelatedLink = { title: l.title || '関連リンク', url: l.url };
      if (l.source) entry.source = l.source;
      // サムネ: http(s) はそのまま保存（Lens は gstatic 等の URL が多い）。data URL は
      // Firestore 1MB 制限を避けて Storage へアップロードして公開 URL に置換。
      if (l.thumbnail) {
        if (/^https?:\/\//i.test(l.thumbnail)) {
          entry.thumbnail = l.thumbnail;
        } else if (/^data:image\//i.test(l.thumbnail) && uid) {
          const uploaded = await uploadCatalogThumb(l.thumbnail, uid, model.id, thumbIdx++);
          if (uploaded) entry.thumbnail = uploaded;
        }
      }
      merged.push(entry);
    }
  }
  console.log('[appendRelatedLinks] writing to asset', model.id, 'existing=', existing.length, 'merged=', merged.length);
  await WorkspaceItemRepository.updateGlobalAsset(model.id, {
    relatedLinks: merged,
    sourceUrl: merged[0]?.url || model?.sourceUrl || '',
  });
  console.log('[appendRelatedLinks] OK', model.id);
  return merged;
}

/**
 * 選んだカタログ商品を 3D モデルの catalogLinks（カタログ登録）へ追記して永続化する。
 * RELATED URLs とは別フィールド。既存とは URL で重複排除する。更新後の配列を返す。
 */
export async function appendCatalogLinks(model: any, links: CatalogLink[]): Promise<CatalogLink[]> {
  const existing: CatalogLink[] = Array.isArray(model?.catalogLinks)
    ? model.catalogLinks.filter((l: any) => l && l.url)
    : [];
  if (!model?.id) {
    throw new Error('モデルIDがありません（登録先を特定できません）');
  }
  const uid = useAuthStore.getState().currentUser?.uid || null;
  const seen = new Set(existing.map((l) => l.url));
  const merged = [...existing];
  let thumbIdx = 0;
  for (const l of links) {
    if (l && l.url && !seen.has(l.url)) {
      seen.add(l.url);
      // undefined を Firestore に渡さないようキーを掃除する。
      const entry: CatalogLink = { title: l.title || 'カタログ商品', url: l.url };
      if (l.price) entry.price = l.price;
      if (l.source) entry.source = l.source;
      // サムネ: http(s) はそのまま、base64 データURLは Firestore 1MB 制限に引っかかるので
      // Storage へアップロードして公開 URL に置き換える（uid 不可/失敗時はサムネ無しで継続）。
      if (l.thumbnail) {
        if (/^https?:\/\//i.test(l.thumbnail)) {
          entry.thumbnail = l.thumbnail;
        } else if (/^data:image\//i.test(l.thumbnail) && uid) {
          const uploaded = await uploadCatalogThumb(l.thumbnail, uid, model.id, thumbIdx++);
          if (uploaded) entry.thumbnail = uploaded;
        }
      }
      merged.push(entry);
    }
  }
  console.log('[appendCatalogLinks] writing to asset', model.id, 'existing=', existing.length, 'merged=', merged.length);
  await WorkspaceItemRepository.updateGlobalAsset(model.id, { catalogLinks: merged });
  console.log('[appendCatalogLinks] OK', model.id);
  return merged;
}
