/**
 * renderBlogArticle — ブログ記事ページの動的レンダリング（SEO/OGP全自動化）。
 *
 * 対応URL（hosting rewrite: /*\/blog/* と /articles/**）:
 *   ① /{handle}/blog/{slug}      … ユーザー記事のブランドURL（@あり/なし両対応）
 *   ② /articles/{slug}           … 公式記事。プリレンダ済み（ビルド時HTML化）の記事は
 *                                   hosting が実ファイルを優先配信するためここへは来ない。
 *                                   **デプロイ前の新記事だけ**がこのCFに落ちる＝空白期間の自動穴埋め。
 *   ③ /articles/u/{uid}/{slug}   … ユーザー記事のフォールバックURL（username未設定者）
 *
 * SPA（JSレンダリング）はGoogleのインデックスが遅く・稀に失敗し、SNSクローラー（OGP）はJSを
 * 実行しないためカードが出ない。この関数は
 *   - ボット（検索エンジン/SNSクローラー）→ Firestoreから記事を読み、完全なHTML
 *     （title/meta/canonical/OGP/JSON-LD/本文）を返す
 *   - 人間 → SPAの index.html をそのまま返す（従来どおりReactが描画）
 * を自動で出し分ける（dynamic rendering）。ユーザー・運営者とも手動操作は一切不要。
 */
const admin = require("firebase-admin");

const SITE_URL = "https://sekkeiya.com";

// 検索エンジン・SNS・AIクローラーのUA（ここに載らないUAはSPAへ）
const BOT_RE = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|linespider|line-parts|pinterestbot|applebot|petalbot|gptbot|oai-searchbot|chatgpt-user|claudebot|perplexitybot|amazonbot|ia_archiver/i;

const esc = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;" }[c]));

/** Firestore Timestamp | ISO | Date → ISO文字列（不明なら ""）。 */
const toIso = (v) => {
  try {
    const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
    return d && !isNaN(d.getTime()) ? d.toISOString() : "";
  } catch { return ""; }
};

/** ごく軽量な Markdown → HTML（クローラーが本文テキストを読めれば十分）。 */
function mdToHtml(md) {
  const out = [];
  let inList = false;
  let inCode = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const inline = (s) => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" style="max-width:100%">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  for (const raw of String(md || "").split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^```/.test(line)) { closeList(); inCode = !inCode; out.push(inCode ? "<pre><code>" : "</code></pre>"); continue; }
    if (inCode) { out.push(esc(raw)); continue; }
    if (!line.trim()) { closeList(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); const lv = Math.min(h[1].length + 1, 4); out.push(`<h${lv}>${inline(h[2])}</h${lv}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`); continue; }
    if (/^(---|\*\*\*)$/.test(line.trim())) { closeList(); out.push("<hr>"); continue; }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

// SPA index.html のメモリキャッシュ（人間向け応答。60秒で取り直し）
let indexCache = { html: null, at: 0 };
async function getSpaIndexHtml() {
  if (indexCache.html && Date.now() - indexCache.at < 60_000) return indexCache.html;
  const r = await fetch(`${SITE_URL}/index.html`, { headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(`index.html fetch failed: ${r.status}`);
  const html = await r.text();
  indexCache = { html, at: Date.now() };
  return html;
}

/**
 * パスから記事を解決して描画用の統一形にする。
 * 返り値: null=記事が見つからない(404) / undefined=記事URLではない(SPAへ) / object=描画データ
 */
async function resolveArticle(db, parts) {
  // ③ /articles/u/{uid}/{slug} … ユーザー記事のフォールバックURL
  if (parts[0] === "articles" && parts[1] === "u" && parts[2] && parts[3]) {
    const uid = decodeURIComponent(parts[2]);
    const slug = decodeURIComponent(parts[3]);
    const snap = await db.collection(`users/${uid}/blogArticles`)
      .where("slug", "==", slug).where("status", "==", "published").limit(1).get();
    if (snap.empty) return null;
    const a = snap.docs[0].data();
    return {
      canonical: `${SITE_URL}/articles/u/${encodeURIComponent(uid)}/${encodeURIComponent(slug)}`,
      title: a.title || "SEKKEIYA Article",
      desc: a.excerpt || a.title || "",
      cover: a.coverUrl || "",
      publishedAt: toIso(a.publishedAt),
      updatedAt: toIso(a.updatedAt) || toIso(a.publishedAt),
      authorName: a.authorName || "",
      bodyHtml: mdToHtml(a.bodyMarkdown),
      tags: Array.isArray(a.tags) ? a.tags : [],
    };
  }

  // ② /articles/{slug} … 公式記事（プリレンダ未反映の新記事のみここへ来る）
  if (parts[0] === "articles" && parts[1] && !parts[2]) {
    const slug = decodeURIComponent(parts[1]);
    const snap = await db.collection("officialArticles")
      .where("slug", "==", slug).where("status", "==", "published").limit(1).get();
    if (snap.empty) return null;
    const o = snap.docs[0].data();
    return {
      canonical: `${SITE_URL}/articles/${encodeURIComponent(slug)}`,
      title: o.seoTitle || o.title || "SEKKEIYA Article",
      desc: o.seoDescription || o.excerpt || o.title || "",
      cover: o.coverUrl || "",
      publishedAt: toIso(o.publishedAt),
      updatedAt: toIso(o.updatedAt) || toIso(o.publishedAt),
      authorName: o.author?.displayName || "SEKKEIYA",
      // 公式は本文がHTML（管理者作成の信頼済みコンテンツ）。旧Markdown記事のみ変換
      bodyHtml: o.contentFormat === "markdown" ? mdToHtml(o.body) : String(o.body || ""),
      tags: Array.isArray(o.tags) ? o.tags : [],
    };
  }

  // ① /{handle}/blog/{slug} … ユーザー記事のブランドURL
  if (parts[1] === "blog" && parts[2]) {
    const handle = decodeURIComponent(parts[0] || "").replace(/^@/, "").toLowerCase();
    const slug = decodeURIComponent(parts[2]);
    const map = await db.doc(`usernames/${handle}`).get();
    const uid = map.exists ? map.data()?.uid : null;
    if (!uid) return null;
    const snap = await db.collection(`users/${uid}/blogArticles`)
      .where("slug", "==", slug).where("status", "==", "published").limit(1).get();
    if (snap.empty) return null;
    const a = snap.docs[0].data();
    return {
      canonical: `${SITE_URL}/${encodeURIComponent(handle)}/blog/${encodeURIComponent(slug)}`,
      title: a.title || "SEKKEIYA Article",
      desc: a.excerpt || a.title || "",
      cover: a.coverUrl || "",
      publishedAt: toIso(a.publishedAt),
      updatedAt: toIso(a.updatedAt) || toIso(a.publishedAt),
      authorName: a.authorName || "",
      bodyHtml: mdToHtml(a.bodyMarkdown),
      tags: Array.isArray(a.tags) ? a.tags : [],
    };
  }

  return undefined; // 記事URLではない（/articles 一覧など）→ SPAへ
}

async function renderBlogArticle(req, res) {
  try {
    const parts = String(req.path || "").split("/").filter(Boolean);
    const isBot = BOT_RE.test(req.get("user-agent") || "");

    // 👤 人間はSPAへ（Reactが描画。従来と同じ見た目）
    if (!isBot) {
      const html = await getSpaIndexHtml();
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "no-cache");
      res.status(200).send(html);
      return;
    }

    // 🤖 ボット: 記事を解決して完全なHTMLを返す
    const db = admin.firestore();
    const art = await resolveArticle(db, parts);

    if (art === undefined) {
      // 記事URLではない → ボットにもSPAを返す（プリレンダ欠落時の安全網）
      const html = await getSpaIndexHtml();
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "no-cache");
      res.status(200).send(html);
      return;
    }

    if (art === null) {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(404).send("<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><title>404 Not Found | SEKKEIYA</title><meta name=\"robots\" content=\"noindex\"></head><body><h1>404 - Article Not Found</h1></body></html>");
      return;
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: art.title,
      description: art.desc,
      url: art.canonical,
      ...(art.cover ? { image: [art.cover] } : {}),
      ...(art.publishedAt ? { datePublished: art.publishedAt } : {}),
      ...(art.updatedAt ? { dateModified: art.updatedAt } : {}),
      ...(art.authorName ? { author: { "@type": "Person", name: art.authorName } } : {}),
      publisher: { "@type": "Organization", name: "SEKKEIYA", url: SITE_URL },
    };

    const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(art.title)} | SEKKEIYA</title>
<meta name="description" content="${esc(art.desc)}">
<link rel="canonical" href="${esc(art.canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="SEKKEIYA">
<meta property="og:title" content="${esc(art.title)}">
<meta property="og:description" content="${esc(art.desc)}">
<meta property="og:url" content="${esc(art.canonical)}">
${art.cover ? `<meta property="og:image" content="${esc(art.cover)}">` : ""}
<meta name="twitter:card" content="${art.cover ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(art.title)}">
<meta name="twitter:description" content="${esc(art.desc)}">
${art.cover ? `<meta name="twitter:image" content="${esc(art.cover)}">` : ""}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<article>
<h1>${esc(art.title)}</h1>
${art.authorName ? `<p>著者: ${esc(art.authorName)}</p>` : ""}
${art.cover ? `<img src="${esc(art.cover)}" alt="${esc(art.title)}" style="max-width:100%">` : ""}
${art.bodyHtml}
${art.tags.length ? `<p>${art.tags.map((t) => `#${esc(t)}`).join(" ")}</p>` : ""}
</article>
</body>
</html>`;

    res.set("Content-Type", "text/html; charset=utf-8");
    // ⚠ CDN(共有)キャッシュ禁止: Firebase HostingのCDNは User-Agent で Vary できないため、
    // public/s-maxage にするとボット用HTMLがキャッシュされ人間にも配られてしまう（実測で確認）。
    res.set("Cache-Control", "private, max-age=300");
    res.status(200).send(html);
  } catch (e) {
    console.error("[renderBlogArticle] failed:", e);
    // 失敗時も人間体験を壊さない: SPAへフォールバック
    try {
      const html = await getSpaIndexHtml();
      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch {
      res.status(500).send("error");
    }
  }
}

module.exports = { renderBlogArticle };
