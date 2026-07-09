/**
 * indexnow-ping.mjs — sitemap.xml のURLを IndexNow で各検索エンジンに即時通知する。
 *
 * IndexNow とは: 「このURLを更新した」をクローラに即push通知するプロトコル。
 *   - 対応: Bing / Yandex / Seznam / Naver、および ChatGPT Search・Copilot 等のAI検索。
 *   - ⚠️ Google は IndexNow を公式採用していない（Google向けは sitemap lastmod + GSC が本筋）。
 *     ただしAI検索が伸びる中、AI製品である SEKKEIYA にとって Bing/AI検索への即通知は十分価値がある。
 *
 * 仕組み:
 *  1. public/sitemap.xml（無ければ dist/sitemap.xml）から <loc> を全部抜く
 *  2. https://api.indexnow.org/indexnow に {host, key, keyLocation, urlList} を一括POST
 *
 * 設計方針: prerender/sitemap と同じく **何があってもビルド/デプロイを止めない**（warn して継続）。
 *
 * 前提: public/<KEY>.txt に同じ鍵を置き、本番 https://sekkeiya.com/<KEY>.txt で配信されること
 *       （= ドメイン所有の証明）。このリポジトリには既に同梱済み。
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOST = "sekkeiya.com";
const KEY = "7addb61b75059d9d752035c62f724a79";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

/** public または dist の sitemap.xml から <loc> を全部抜く */
async function collectUrls() {
  const candidates = [
    resolve(__dirname, "../public/sitemap.xml"),
    resolve(__dirname, "../dist/sitemap.xml"),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) {
    console.warn("[indexnow] sitemap.xml が無い（先に `npm run sitemap` か build が必要）。スキップ。");
    return [];
  }
  const xml = await readFile(path, "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return [...new Set(urls)].filter(Boolean);
}

async function main() {
  const urlList = await collectUrls();
  if (urlList.length === 0) {
    console.warn("[indexnow] 送信対象URLが0件。スキップ。");
    return;
  }

  const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList });

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body,
    });
    // 200=受理, 202=受理(検証待ち)。それ以外は内容を表示して継続。
    if (res.ok) {
      console.log(`[indexnow] ✓ ${urlList.length}件のURLを送信（HTTP ${res.status}）`);
    } else {
      const text = await res.text().catch(() => "");
      console.warn(`[indexnow] ✗ HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (e) {
    console.warn(`[indexnow] 送信失敗（無視して継続）: ${e?.message || e}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.warn(`[indexnow] 予期せぬエラー（無視）: ${e?.message || e}`); process.exit(0); });
