/**
 * sitemapCommunity — みんなの記事（S.Blog公開記事）の動的サイトマップ。
 *
 * ビルド時生成の public/sitemap.xml は officialArticles だけを含むため、
 * ユーザーが S.Blog で公開した記事は「次のデプロイまで sitemap に載らない」問題がある。
 * この HTTP 関数は communityArticles（公開ミラー。公開/非公開のたびに upsert/削除される）を
 * リクエスト時に読んで XML を返すので、公開した記事が**再デプロイなしで**Googleに発見される。
 *
 * URL は canonical と同じブランド形式 /{username}/blog/{slug} を出す。
 * username 未設定の著者はフォールバックの /articles/u/{uid}/{slug} を出す（こちらも有効なルート）。
 * 配信: hosting rewrite /sitemap-community.xml → この関数。robots.txt にも Sitemap 行を追加済み。
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

async function sitemapCommunity(req, res) {
  try {
    const db = admin.firestore();
    // みんなの記事（公開ミラー）＋ 公式記事（published）を並列取得。
    // 公式はビルド時 sitemap.xml にも載るが、デプロイ前の新記事を拾うためここにも含める
    // （重複URLは Google 側で無害にデデュープされる）。
    const [snap, officialSnap] = await Promise.all([
      db.collection("communityArticles").limit(5000).get(),
      db.collection("officialArticles").where("status", "==", "published").limit(5000).get(),
    ]);

    // 著者 uid → username をまとめて解決（重複 uid は1回だけ読む）
    const uids = [...new Set(snap.docs.map((d) => d.data().authorUid).filter(Boolean))];
    const usernameByUid = new Map();
    await Promise.all(uids.map(async (uid) => {
      try {
        const u = await db.doc(`users/${uid}`).get();
        const name = u.exists ? (u.data().username || null) : null;
        if (name) usernameByUid.set(uid, String(name).toLowerCase());
      } catch { /* username なし → フォールバックURL */ }
    }));

    const entry = (loc, lastmod, priority) =>
      `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

    const urls = snap.docs.map((d) => {
      const a = d.data();
      if (!a?.slug || !a?.authorUid) return "";
      const username = usernameByUid.get(a.authorUid);
      const loc = username
        ? `${SITE_URL}/${encodeURIComponent(username)}/blog/${encodeURIComponent(a.slug)}`
        : `${SITE_URL}/articles/u/${encodeURIComponent(a.authorUid)}/${encodeURIComponent(a.slug)}`;
      return entry(loc, toYmd(a.updatedAt) || toYmd(a.publishedAt), "0.6");
    }).filter(Boolean);

    // 公式記事（/articles/{slug}）
    for (const d of officialSnap.docs) {
      const a = d.data();
      if (!a?.slug) continue;
      urls.push(entry(`${SITE_URL}/articles/${encodeURIComponent(a.slug)}`, toYmd(a.updatedAt) || toYmd(a.publishedAt), "0.7"));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
    res.set("Content-Type", "application/xml; charset=utf-8");
    // CDN/ブラウザで1時間キャッシュ（公開直後でも1時間以内にサイトマップへ反映）
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(xml);
  } catch (e) {
    console.error("[sitemapCommunity] failed:", e);
    res.status(500).send("sitemap generation failed");
  }
}

module.exports = { sitemapCommunity };
