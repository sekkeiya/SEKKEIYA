/**
 * sitemapOfficial — 公式記事（officialArticles）の動的サイトマップ。
 *
 * ビルド時生成の public/sitemap.xml は「前回デプロイ時点」の公式記事しか含まないため、
 * MCP や管理画面から公開した新記事は再デプロイまで sitemap に載らない問題があった。
 * この HTTP 関数は officialArticles（status==published）をリクエスト時に読んで XML を返すので、
 * 公開した公式記事が**再デプロイなしで**Google に発見される（renderBlogArticle の動的レンダリングと対で、
 * 公開＝即SEOを成立させる）。
 *
 * 配信: hosting rewrite /sitemap-official.xml → この関数。robots.txt にも Sitemap 行を追加済み。
 * 静的マーケページ（/, /about, 製品LP 等）は変更頻度が低く public/sitemap.xml で足りるためここには含めない
 * （この関数は「頻繁に増える公式記事」を動的に拾うことに責務を絞る）。
 */
const admin = require("firebase-admin");

const SITE_URL = "https://sekkeiya.com";

const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

/** Firestore Timestamp | ISO | Date → YYYY-MM-DD（不明なら null） */
const toYmd = (v) => {
  try {
    const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
    return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  } catch { return null; }
};

async function sitemapOfficial(req, res) {
  try {
    const db = admin.firestore();
    const snap = await db.collection("officialArticles")
      .where("status", "==", "published").limit(5000).get();

    const entry = (loc, lastmod, priority) =>
      `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

    const urls = snap.docs.map((d) => {
      const a = d.data();
      if (!a?.slug) return "";
      return entry(`${SITE_URL}/articles/${encodeURIComponent(a.slug)}`, toYmd(a.updatedAt) || toYmd(a.publishedAt), "0.7");
    }).filter(Boolean);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
    res.set("Content-Type", "application/xml; charset=utf-8");
    // CDN/ブラウザで1時間キャッシュ（公開直後でも1時間以内にサイトマップへ反映）
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(xml);
  } catch (e) {
    console.error("[sitemapOfficial] failed:", e);
    res.status(500).send("sitemap generation failed");
  }
}

module.exports = { sitemapOfficial };
