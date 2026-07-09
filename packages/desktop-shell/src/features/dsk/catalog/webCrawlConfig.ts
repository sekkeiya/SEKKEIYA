// ──────────────────────────────────────────────────────────────────────────────
// Web 巡回のサイト設定と、隠し WebView に注入する抽出スクリプトの組み立て。
//
// 抽出スクリプトはページ（リモート origin）でレンダリング後に DOM を走査し、
// 商品カード（リンク+画像+価格）とカテゴリリンクを集めて、ローカルブリッジ
// サーバ(127.0.0.1:14207 の POST /crawl)へ送る。lib.rs の handle_bookmark_conn 参照。
// ──────────────────────────────────────────────────────────────────────────────

// ブリッジ共有トークン（Rust 側 BOOKMARK_BRIDGE_TOKEN と一致させること）。
export const BRIDGE_TOKEN = 'sekkeiya-slibrary-bridge-v1';
export const BRIDGE_URL = 'http://127.0.0.1:14207/crawl';

export interface SiteConfig {
  productPattern: string;   // 商品ページ URL 判定（RegExp ソース）
  categoryPattern: string;  // カテゴリ/一覧ページ URL 判定（RegExp ソース）
  pagePattern: string;      // ページネーションリンク判定（RegExp ソース、クエリ付きで判定）
  productHint: string;      // レンダリング完了待ちに使う商品リンクの部分文字列
  priceRegex: string;       // 価格テキスト抽出（RegExp ソース）
  maxItemsPerPage: number;  // 1ページから拾う商品上限
  maxWaitMs: number;        // レンダリング待ちの上限
}

const FLYMEE: SiteConfig = {
  productPattern: '/product/\\d+',
  categoryPattern: '/category/[a-z0-9\\-]+/?$',
  // FLYMEe のページ送りはパス形式（/category/<slug>/2/, /3/ …）。?page=N 形式も一応許容。
  pagePattern: '/category/[a-z0-9\\-]+/\\d+/?$|[?&]page=\\d+',
  productHint: '/product/',
  priceRegex: '[¥￥]\\s?[\\d,]+|[\\d,]+\\s*円',
  maxItemsPerPage: 200,
  maxWaitMs: 18000,
};

// 壁紙屋本舗（Shopify型）。/collections/<id> 一覧 → /products/<slug> 詳細。サーバーレンダリングで索引向き。
const KABEGAMIYA: SiteConfig = {
  productPattern: '/products/[a-z0-9_\\-]+',
  categoryPattern: '/collections/\\d+',
  pagePattern: '[?&]page=\\d+',
  productHint: '/products/',
  priceRegex: '[¥￥]\\s?[\\d,]+|[\\d,]+\\s*円',
  maxItemsPerPage: 200,
  maxWaitMs: 16000,
};

const GENERIC: SiteConfig = {
  productPattern: '/(product|products|item|items|dp|goods)/',
  categoryPattern: '/(category|categories|collection|collections|c)/',
  pagePattern: '[?&]page=\\d+|/page/\\d+',
  productHint: '/product',
  priceRegex: '[¥￥$]\\s?[\\d,]+|[\\d,]+\\s*円',
  maxItemsPerPage: 200,
  maxWaitMs: 15000,
};

/** URL のホスト名からサイト設定を選ぶ（未知サイトは汎用設定）。 */
export function getSiteConfig(url: string): SiteConfig {
  try {
    const host = new URL(url).host;
    if (host.includes('flymee.jp')) return FLYMEE;
    if (host.includes('kabegamiyahonpo.com')) return KABEGAMIYA;
  } catch { /* noop */ }
  return GENERIC;
}

/**
 * 隠し WebView へ注入する抽出スクリプトを文字列で組み立てる。
 * crawlId とサイト設定をクロージャに埋め込む。document-start で走り、
 * 商品リンクの出現 or タイムアウトまで待ってから抽出→ブリッジへ POST する。
 */
export function buildExtractorScript(crawlId: string, cfg: SiteConfig): string {
  const cfgJson = JSON.stringify(cfg);
  // 注意: テンプレートリテラルは使わず、文字列連結で組む（注入先での衝突回避）。
  return '(function(){' +
    'if(location.hostname==="127.0.0.1")return;' + // 送信先(ブリッジ)に遷移後は何もしない
    'var TOKEN=' + JSON.stringify(BRIDGE_TOKEN) + ';' +
    'var CRAWL_ID=' + JSON.stringify(crawlId) + ';' +
    'var BRIDGE=' + JSON.stringify(BRIDGE_URL) + ';' +
    'var CFG=' + cfgJson + ';' +
    'var sent=false;' +
    'function abs(h){try{return new URL(h,location.href).href;}catch(e){return null;}}' +
    'function sameHost(u){try{return new URL(u).host===location.host;}catch(e){return false;}}' +
    'var priceRe=new RegExp(CFG.priceRegex);' +
    'function priceOf(el){var t=(el&&el.textContent)||"";var m=t.match(priceRe);return m?m[0].replace(/\\s/g,""):"";}' +
    // 商品URL/カテゴリURL/ページネーションURLのみ収集（画像/価格/名は Rust が商品詳細から取得）。
    'function extract(){' +
      'var products=[],categories=[],pages=[],seen={},catSeen={},pageSeen={},prodLinkCount=0;' +
      'var prodRe=new RegExp(CFG.productPattern);var catRe=new RegExp(CFG.categoryPattern);var pageRe=new RegExp(CFG.pagePattern);' +
      'var anchors=Array.prototype.slice.call(document.querySelectorAll("[href]"));' +
      'anchors.forEach(function(a){' +
        'var raw=a.getAttribute&&a.getAttribute("href");if(!raw)return;' +
        'var href=abs(raw);if(!href||!sameHost(href))return;' +
        'var full=href.split("#")[0];' +              // クエリは残す（ページネーション判定用）
        'var clean=full.split("?")[0];' +
        'if(pageRe.test(full)){if(!pageSeen[full]){pageSeen[full]=1;pages.push(full);}}' +
        'if(prodRe.test(clean)){' +
          'prodLinkCount++;' +
          'if(seen[clean])return;seen[clean]=1;products.push(clean);' +
        '}else if(catRe.test(clean)){if(!catSeen[clean]){catSeen[clean]=1;categories.push(clean);}}' +
      '});' +
      'var self=null;var cur=location.href.split("#")[0].split("?")[0];' +
      'if(prodRe.test(cur)){self=cur;}' +
      'return{products:products.slice(0,CFG.maxItemsPerPage),categories:categories.slice(0,200),pages:pages.slice(0,80),self:self,' +
        'diag:{anchors:anchors.length,productLinks:prodLinkCount,categories:categories.length,ready:document.readyState}};' +
    '}' +
    // 送信は fetch ではなくトップレベル遷移（GET）。EC の CSP(connect-src)/PNA を回避できる。
    'function send(){if(sent)return;sent=true;try{window.scrollTo(0,0);}catch(e){}var d=extract();' +
      'try{var json=JSON.stringify({crawlId:CRAWL_ID,products:d.products,categories:d.categories,pages:d.pages,self:d.self,diag:d.diag});' +
        'location.href=BRIDGE+"?crawlId="+encodeURIComponent(CRAWL_ID)+"&d="+encodeURIComponent(json);}catch(e){}' +
    '}' +
    // 末尾までスクロールして無限ロードを誘発し、商品リンク数が増えなくなったら（=出尽くし）抽出する。
    'var tries=0,maxTries=Math.ceil((CFG.maxWaitMs||15000)/600),last=-1,stable=0;' +
    'var iv=setInterval(function(){tries++;' +
      'try{window.scrollTo(0,document.body.scrollHeight);}catch(e){}' +
      'var cnt=document.querySelectorAll(\'[href*="\'+CFG.productHint+\'"]\').length;' +
      'if(cnt===last){stable++;}else{stable=0;last=cnt;}' +
      'if((cnt>0&&stable>=3)||tries>=maxTries){clearInterval(iv);setTimeout(send,600);}' +
    '},600);' +
  '})();';
}
