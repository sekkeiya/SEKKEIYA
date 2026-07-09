/**
 * prerender.mjs — ビルド後に主要ルートを実HTML化する（SPA向けプリレンダ）。
 *
 * 仕組み:
 *  1. dist/ を簡易静的サーバで配信（未知パスは index.html にフォールバック＝SPA）
 *  2. システム Chrome を puppeteer-core でヘッドレス起動
 *  3. 各ルートを開いて #root 描画＋settle を待ち、レンダ後の HTML を取得
 *  4. dist/<route>/index.html として書き出す（Firebase Hosting は実ファイルを rewrite より優先）
 *
 * 設計方針:
 *  - JS未実行クローラ/SNSに「中身入りHTML」を返すのが目的。実ユーザは通常通り JS で再描画。
 *  - **何があってもビルド/デプロイを止めない**: Chrome 不在や個別ルート失敗は warn して継続、exit 0。
 *  - networkidle は Firestore の realtime 接続で発火しないため使わず、#root 描画＋固定 settle で待つ。
 *
 * Chrome パスは CHROME_PATH / PUPPETEER_EXECUTABLE_PATH 環境変数で上書き可。
 */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, extname } from "node:path";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { PRODUCT_ROUTES } from "../src/shared/data/productSlugs.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, "../dist");
const PORT = 4178;

// 静的マーケ系ルート（クロールさせたいページ）＋ 製品LP（productSlugs.mjs が正典）
const STATIC_ROUTES = ["/", "/about", "/services", "/vision", "/articles", "/demo", "/gallery", "/marketplace", ...PRODUCT_ROUTES];

const firebaseConfig = {
  apiKey: "AIzaSyB1q5bTAaBIJb1Ug0Tqqb_hSNH7Vo2B2CY",
  authDomain: "shapeshare3d.firebaseapp.com",
  projectId: "shapeshare3d",
  storageBucket: "shapeshare3d.firebasestorage.app",
  messagingSenderId: "1064599680534",
  appId: "1:1064599680534:web:671460066e66a01e64a737",
};

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".glb": "model/gltf-binary", ".hdr": "application/octet-stream", ".wasm": "application/wasm",
};

function findChrome() {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  const candidates = [
    env,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

async function fetchArticleRoutes() {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const q = query(collection(db, "officialArticles"), where("status", "==", "published"), orderBy("publishedAt", "desc"));
    const snap = await getDocs(q);
    const routes = [];
    snap.forEach((d) => { const a = d.data(); if (a?.slug) routes.push(`/articles/${a.slug}`); });
    return routes;
  } catch (e) {
    console.warn(`[prerender] 記事スラッグ取得失敗（記事はスキップ）: ${e?.message || e}`);
    return [];
  }
}

/**
 * 素の index.html（helmet が管理するメタを除去したもの）を返す。
 * 静的 index.html の home 用 canonical/description/og/twitter が残ると、
 * 各ページの helmet メタと二重化するため、土台からは取り除いておく
 * （ディスクの dist/index.html はそのまま＝JS未実行/非プリレンダ用のフォールバックに残す）。
 */
function stripManagedMeta(html) {
  return html
    .replace(/[ \t]*<link[^>]*rel=["']canonical["'][^>]*>\s*\n?/gi, "")
    .replace(/[ \t]*<meta[^>]*name=["']description["'][^>]*>\s*\n?/gi, "")
    .replace(/[ \t]*<meta[^>]*property=["']og:[^"']*["'][^>]*>\s*\n?/gi, "")
    .replace(/[ \t]*<meta[^>]*name=["']twitter:[^"']*["'][^>]*>\s*\n?/gi, "")
    .replace(/[ \t]*<meta[^>]*property=["']twitter:[^"']*["'][^>]*>\s*\n?/gi, "");
}

function startServer(strippedIndexHtml) {
  const indexBuf = Buffer.from(strippedIndexHtml, "utf8");
  return new Promise((res) => {
    const server = createServer(async (req, reqRes) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        // SPA の土台（"/" や拡張子なしルート、実ファイル不在）は **メモリ上の素のindex** を返す。
        // プリレンダ中に dist/index.html を上書きしても土台が汚染されないようにする。
        const looksLikeFile = extname(urlPath) !== "";
        let filePath = null;
        if (looksLikeFile) {
          const candidate = join(DIST, urlPath);
          try { if ((await stat(candidate)).isFile()) filePath = candidate; } catch { filePath = null; }
        }
        if (!filePath) {
          if (looksLikeFile) { reqRes.statusCode = 404; reqRes.end("not found"); return; }
          reqRes.setHeader("Content-Type", "text/html; charset=utf-8");
          reqRes.end(indexBuf);
          return;
        }
        const body = await readFile(filePath);
        reqRes.setHeader("Content-Type", MIME[extname(filePath)] || "application/octet-stream");
        reqRes.end(body);
      } catch {
        reqRes.statusCode = 500; reqRes.end("err");
      }
    });
    server.listen(PORT, () => res(server));
  });
}

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.warn("[prerender] dist/index.html が無い（先に vite build が必要）。スキップ。");
    return;
  }
  const chrome = findChrome();
  if (!chrome) {
    console.warn("[prerender] Chrome が見つからない（CHROME_PATH で指定可）。プリレンダをスキップ。");
    return;
  }

  let puppeteer;
  try {
    puppeteer = (await import("puppeteer-core")).default;
  } catch {
    console.warn("[prerender] puppeteer-core 未インストール。スキップ。");
    return;
  }

  const articleRoutes = await fetchArticleRoutes();
  const routes = [...STATIC_ROUTES, ...articleRoutes];
  // 土台にする素の index.html（helmet 管理メタを除去）をメモリに用意
  const originalIndex = await readFile(join(DIST, "index.html"), "utf8");
  const strippedIndex = stripManagedMeta(originalIndex);
  const server = await startServer(strippedIndex);
  const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });

  let ok = 0, fail = 0;
  for (const route of routes) {
    const page = await browser.newPage();
    try {
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      // #root にDOMが入るまで（最大15s）
      await page.waitForFunction(() => {
        const r = document.getElementById("root");
        return r && r.children.length > 0;
      }, { timeout: 15000 }).catch(() => {});
      // helmet のhead反映＋非同期描画の settle
      await new Promise((r) => setTimeout(r, 1800));

      // ── FOUC対策: emotion(MUI) は speedy モードで CSSOM に insertRule する。
      // これらのルールは DOM の innerHTML に出ないため page.content() で消える。
      // CSSOM を走査して全ルールを実テキストの <style> に焼き込み、
      // プリレンダHTML だけでも正しくスタイルが当たる状態にする。
      await page.evaluate(() => {
        let css = "";
        for (const sheet of Array.from(document.styleSheets)) {
          let rules;
          try { rules = sheet.cssRules; } catch { continue; } // cross-origin はスキップ
          if (!rules) continue;
          for (const rule of Array.from(rules)) css += rule.cssText + "\n";
        }
        if (css) {
          const style = document.createElement("style");
          style.setAttribute("data-prerender-css", "");
          style.appendChild(document.createTextNode(css));
          document.head.appendChild(style);
        }
      }).catch(() => {});

      const html = await page.content();
      const outDir = route === "/" ? DIST : join(DIST, route);
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "index.html"), html, "utf8");
      ok++;
      console.log(`[prerender] ✓ ${route}`);
    } catch (e) {
      fail++;
      console.warn(`[prerender] ✗ ${route}: ${e?.message || e}`);
    } finally {
      await page.close().catch(() => {});
    }
  }

  await browser.close().catch(() => {});
  server.close();
  console.log(`[prerender] 完了: 成功 ${ok} / 失敗 ${fail}（静的 ${STATIC_ROUTES.length} + 記事 ${articleRoutes.length}）`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.warn(`[prerender] 予期せぬエラー（無視して継続）: ${e?.message || e}`); process.exit(0); });
