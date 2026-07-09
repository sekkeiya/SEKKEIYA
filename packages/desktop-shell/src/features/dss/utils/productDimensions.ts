// 商品ページ（productUrl）から家具の外形寸法 W/D/H(mm) をベストエフォートで抽出する。
//   - 既存の隠しWebViewクローラ（open_crawl_webview / crawl-page-received）を再利用してページ本文を取得。
//   - 取得テキストを正規表現でパース（幅/奥行/高さ・W×D×H・mm/cm 表記に対応）。
//   - 取れなければ null（呼び出し側は従来の推定にフォールバック）。

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BRIDGE_TOKEN, BRIDGE_URL } from "../../dsk/catalog/webCrawlConfig";

export interface ProductDimensions {
  width?: number;  // mm
  depth?: number;  // mm
  height?: number; // mm
}

let _seq = 0;

function buildDimsScript(crawlId: string, maxWaitMs: number): string {
  // テンプレートリテラルは使わず文字列連結（注入先での衝突回避）。
  return "(function(){" +
    "var TOKEN=" + JSON.stringify(BRIDGE_TOKEN) + ";" +
    "var CRAWL_ID=" + JSON.stringify(crawlId) + ";" +
    "var BRIDGE=" + JSON.stringify(BRIDGE_URL) + ";" +
    "var MAX_WAIT=" + JSON.stringify(maxWaitMs) + ";" +
    "var sent=false;" +
    "function send(){if(sent)return;sent=true;" +
      "var txt='';try{txt=((document.body&&document.body.innerText)||'').slice(0,200000);}catch(e){}" +
      // 仕様が JSON-LD/メタにあるサイト用に併せて収集。
      "var meta='';try{var ms=document.querySelectorAll('script[type=\"application/ld+json\"]');for(var i=0;i<ms.length;i++){meta+=' '+(ms[i].textContent||'');}}catch(e){}" +
      "try{fetch(BRIDGE,{method:'POST',headers:{'Content-Type':'application/json','X-Sekkeiya-Token':TOKEN}," +
        "body:JSON.stringify({crawlId:CRAWL_ID,url:location.href,pageText:(txt+' '+meta).slice(0,220000)})}).catch(function(){});}catch(e){}" +
    "}" +
    "var tries=0,maxTries=Math.ceil((MAX_WAIT||9000)/600);" +
    "var iv=setInterval(function(){tries++;" +
      "try{window.scrollTo(0,Math.floor((document.body?document.body.scrollHeight:0)*(tries/maxTries)));}catch(e){}" +
      "if(tries>=maxTries){clearInterval(iv);setTimeout(send,500);}" +
    "},600);" +
    "setTimeout(send,(MAX_WAIT||9000)+1500);" +
  "})();";
}

/** 商品ページの本文テキストを隠しWebViewで取得（デスクトップ専用）。失敗時 null。 */
async function fetchProductPageText(productUrl: string, timeoutMs = 12000): Promise<string | null> {
  const crawlId = `dims${_seq++}_${Date.now()}`;
  const initScript = buildDimsScript(crawlId, Math.max(7000, timeoutMs - 2000));
  return await new Promise<string | null>((resolve) => {
    let done = false;
    let unlisten: (() => void) | null = null;
    const finish = (text: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (unlisten) unlisten();
      invoke("close_crawl_webview", { crawlId }).catch(() => {});
      resolve(text);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    listen<any>("crawl-page-received", (e) => {
      const p = e.payload;
      if (p && p.crawlId === crawlId) finish(typeof p.pageText === "string" ? p.pageText : null);
    }).then((un) => {
      unlisten = un;
      invoke("open_crawl_webview", { url: productUrl, crawlId, initScript }).catch(() => finish(null));
    }).catch(() => finish(null));
  });
}

const num = (s: string) => parseFloat(String(s).replace(/[,，\s]/g, ""));

// ラベル付き（幅/奥行/高さ・W/D/H）の値を1つ拾う。{ value, unit } を返す。
function grabLabeled(text: string, labels: string[]): { v: number; unit: string } | null {
  for (const lab of labels) {
    const re = new RegExp(lab + "[\\s:：=約约]*([0-9][0-9,，.]{1,6})\\s*(mm|cm|㎜|㎝|ミリ|センチ)?", "i");
    const m = text.match(re);
    if (m) {
      const v = num(m[1]);
      if (isFinite(v) && v > 0) return { v, unit: (m[2] || "").toLowerCase() };
    }
  }
  return null;
}

function toMm(x: { v: number; unit: string } | null, fallbackUnit: "mm" | "cm"): number | undefined {
  if (!x) return undefined;
  const u = x.unit;
  const isCm = u === "cm" || u === "㎝" || u === "センチ" || (!u && fallbackUnit === "cm");
  return Math.round(x.v * (isCm ? 10 : 1));
}

/**
 * 商品ページ本文テキストから外形寸法 W/D/H(mm) を抽出する。取れなければ null。
 * 1) 幅/奥行/高さ or W/D/H のラベル付きを優先。
 * 2) ダメなら "1000 × 780 × 738 mm" のような3連数値を W,D,H とみなす。
 */
export function parseFurnitureDimensions(rawText: string): ProductDimensions | null {
  if (!rawText) return null;
  const text = rawText.replace(/×|✕|ｘ|Ｘ/g, "x"); // × 系を x に正規化

  // 全体のスケール判断用: cm 表記が多いか mm 表記が多いか。
  const cmHits = (text.match(/cm|㎝|センチ/gi) || []).length;
  const mmHits = (text.match(/mm|㎜|ミリ/gi) || []).length;
  let fallbackUnit: "mm" | "cm" = mmHits >= cmHits ? "mm" : "cm";

  // 1) ラベル付き
  const W = grabLabeled(text, ["幅", "横幅", "\\bwidth\\b", "(?<![A-Za-z])W(?![A-Za-z])"]);
  const D = grabLabeled(text, ["奥行(?:き)?", "\\bdepth\\b", "(?<![A-Za-z])D(?![A-Za-z])"]);
  const H = grabLabeled(text, ["高さ", "\\bheight\\b", "(?<![A-Za-z])H(?![A-Za-z])"]);
  let width = toMm(W, fallbackUnit);
  let depth = toMm(D, fallbackUnit);
  let height = toMm(H, fallbackUnit);

  // 2) 3連数値（W×D×H）。ラベルで取れなかった軸を補完。
  if (!(width && depth && height)) {
    const triple = text.match(/([0-9][0-9,，.]{1,5})\s*x\s*([0-9][0-9,，.]{1,5})\s*x\s*([0-9][0-9,，.]{1,5})\s*(mm|cm|㎜|㎝)?/i);
    if (triple) {
      const unit = (triple[4] || "").toLowerCase();
      const a = toMm({ v: num(triple[1]), unit }, fallbackUnit);
      const b = toMm({ v: num(triple[2]), unit }, fallbackUnit);
      const c = toMm({ v: num(triple[3]), unit }, fallbackUnit);
      width = width || a;
      depth = depth || b;
      height = height || c;
    }
  }

  // 値の妥当性: 家具として現実的な範囲(1mm超・5m未満)だけ採用。
  const ok = (n?: number) => typeof n === "number" && n > 1 && n < 5000;
  const dims: ProductDimensions = {};
  if (ok(width)) dims.width = width;
  if (ok(depth)) dims.depth = depth;
  if (ok(height)) dims.height = height;
  // 1軸も取れなければ無効。
  if (dims.width || dims.depth || dims.height) return dims;
  return null;
}

/** 商品ページ URL から外形寸法(mm)をベストエフォートで取得。失敗時 null。 */
export async function fetchProductDimensions(productUrl: string, timeoutMs = 12000): Promise<ProductDimensions | null> {
  if (!productUrl || !/^https?:\/\//i.test(productUrl)) return null;
  try {
    const text = await fetchProductPageText(productUrl, timeoutMs);
    if (!text) return null;
    return parseFurnitureDimensions(text);
  } catch {
    return null;
  }
}
