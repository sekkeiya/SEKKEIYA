/**
 * generate-sitemap.mjs — ビルド時に public/sitemap.xml を生成する。
 *
 * 静的ページ + Firestore の公開記事(officialArticles, status==published)を
 * 1枚の sitemap.xml にまとめる。`npm run build` の prebuild で自動実行される。
 *
 * 設計方針:
 *  - 記事取得に失敗(オフライン/ルール/インデックス未整備)しても **静的ページ分は必ず書き出す**。
 *    ビルド全体を止めないため、例外は握りつぶして warn する。
 *  - 本番ドメインは seoConfig と一致させる(単一の真実)。変える時は両方。
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PRODUCT_ROUTES } from "../src/shared/data/productSlugs.mjs";

const SITE_URL = "https://sekkeiya.com";

// firebase.js と同一の公開クライアント設定（クライアント config は秘匿情報ではない）
const firebaseConfig = {
  apiKey: "AIzaSyB1q5bTAaBIJb1Ug0Tqqb_hSNH7Vo2B2CY",
  authDomain: "shapeshare3d.firebaseapp.com",
  projectId: "shapeshare3d",
  storageBucket: "shapeshare3d.firebasestorage.app",
  messagingSenderId: "1064599680534",
  appId: "1:1064599680534:web:671460066e66a01e64a737",
};

// 静的ページ（手動メンテ）。loc は SITE_URL からの相対。
const STATIC_PAGES = [
  { loc: "/",            changefreq: "weekly",  priority: "1.0" },
  { loc: "/demo",        changefreq: "weekly",  priority: "0.9" },
  { loc: "/services",    changefreq: "weekly",  priority: "0.9" },
  { loc: "/gallery",     changefreq: "weekly",  priority: "0.8" },
  { loc: "/about",       changefreq: "monthly", priority: "0.8" },
  { loc: "/vision",      changefreq: "monthly", priority: "0.7" },
  { loc: "/marketplace", changefreq: "weekly",  priority: "0.7" },
  { loc: "/articles",    changefreq: "weekly",  priority: "0.7" },
  // 製品LP（/products/{slug}）。スラッグは productSlugs.mjs が正典。
  ...PRODUCT_ROUTES.map((loc) => ({ loc, changefreq: "weekly", priority: "0.8" })),
];

/** Firestore Timestamp | ISO文字列 | Date → "YYYY-MM-DD"（取れなければ null） */
function toYmd(v) {
  try {
    const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
    if (!d || isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

async function fetchPublishedArticles() {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const q = query(
      collection(db, "officialArticles"),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
    );
    const snap = await getDocs(q);
    const articles = [];
    snap.forEach((doc) => {
      const a = doc.data();
      if (!a?.slug) return;
      articles.push({ slug: a.slug, lastmod: toYmd(a.updatedAt) || toYmd(a.publishedAt) });
    });
    return articles;
  } catch (err) {
    console.warn(`[sitemap] 記事取得に失敗（静的ページのみ出力）: ${err?.message || err}`);
    return [];
  }
}

/** S.Blog 公開記事のミラー（/articles「みんなの記事」）。失敗しても全体は止めない。 */
async function fetchCommunityArticles() {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snap = await getDocs(query(collection(db, "communityArticles"), orderBy("publishedAt", "desc")));
    const items = [];
    snap.forEach((doc) => {
      const a = doc.data();
      if (!a?.slug || !a?.authorUid) return;
      items.push({ authorUid: a.authorUid, slug: a.slug, lastmod: toYmd(a.updatedAt) || toYmd(a.publishedAt) });
    });
    return items;
  } catch (err) {
    console.warn(`[sitemap] みんなの記事の取得に失敗（スキップ）: ${err?.message || err}`);
    return [];
  }
}

function urlEntry({ loc, changefreq, priority, lastmod }) {
  const lines = [
    "  <url>",
    `    <loc>${xmlEscape(SITE_URL + loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean);
  return lines.join("\n");
}

async function main() {
  const articles = await fetchPublishedArticles();
  const community = await fetchCommunityArticles();
  const entries = [
    ...STATIC_PAGES,
    ...articles.map((a) => ({
      loc: `/articles/${a.slug}`,
      changefreq: "monthly",
      priority: "0.6",
      lastmod: a.lastmod,
    })),
    ...community.map((a) => ({
      loc: `/articles/u/${a.authorUid}/${a.slug}`,
      changefreq: "monthly",
      priority: "0.5",
      lastmod: a.lastmod,
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const out = resolve(__dirname, "../public/sitemap.xml");
  writeFileSync(out, xml, "utf8");
  console.log(`[sitemap] 出力: ${out}（静的 ${STATIC_PAGES.length} + 記事 ${articles.length} + みんなの記事 ${community.length}）`);
}

main().then(() => process.exit(0)).catch((e) => {
  // 念のための最終防衛（main 内で握りつぶしているので通常到達しない）
  console.warn(`[sitemap] 予期せぬエラー: ${e?.message || e}`);
  process.exit(0);
});
