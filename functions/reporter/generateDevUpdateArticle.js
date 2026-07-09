/**
 * generateDevUpdateArticle.js — AI記者 モード③（開発アップデート記事）
 *
 * SEKKEIYA の最近の開発内容（gitコミット/変更点メモ）を受け取り、
 * 読者（設計者・ユーザー）向けの「新機能紹介 / 使い方 / お知らせ」記事を生成して
 * officialArticles に status:"review" で投入する（自動公開はしない）。
 *
 * 「AIが開発状況を洗って記事を書く」= 技術的な変更点を、ユーザー目線の価値・使い方に翻訳する。
 * ブランドボイス・製品内部リンク・CTA は officialBrandContext を共通利用（集客/宣伝と地続きに）。
 */
const admin = require("firebase-admin");
const { callLLM, getTextModelConfig } = require("./llm");
const { buildBrandBlock, sanitizeInternalLinks } = require("./officialBrandContext");

function slugify(s) {
  return String(s || "").toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 60);
}

async function uniqueSlug(col, base) {
  let slug = base || "sekkeiya-update";
  for (let n = 1; n <= 20; n++) {
    const candidate = n === 1 ? slug : `${slug}-${n}`;
    const hit = await col.where("slug", "==", candidate).limit(1).get();
    if (hit.empty) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

exports.generateDevUpdateArticle = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const textCfg = await getTextModelConfig(db);

  const notes = String(data.notes || "").slice(0, 8000).trim();
  if (!notes) return { success: false, reason: "開発内容（notes）が空です" };
  const focus = String(data.focus || "").trim();              // 記事の切り口（任意）
  const category = String(data.category || "お知らせ").trim();
  const kind = String(data.kind || "update").trim();          // update=新機能/アップデート, howto=使い方, notice=お知らせ

  const kindLabel = kind === "howto" ? "使い方・活用ガイド" : kind === "notice" ? "お知らせ" : "新機能・アップデート紹介";

  const prompt = `
あなたは SEKKEIYA（AI空間設計OS）公式ブログの編集者です。
以下は SEKKEIYA の最近の開発内容（gitコミットや変更点のメモ）です。これを**読者（建築・インテリアの設計者やユーザー）向けの「${kindLabel}」記事**に仕立ててください。

${buildBrandBlock({ mode: "trend" })}

【開発内容（内部メモ。そのまま転載しない）】
${notes}
${focus ? `\n【記事の切り口・強調したい点】\n${focus}` : ""}

【記事化の指針（技術→価値の翻訳）】
- コミットの羅列や技術用語をそのまま書かない。**「ユーザーにとって何が嬉しいか／どう使えるか」**に翻訳する
- 複数の変更があれば、関連するものをまとめ、重要なものを${kind === "notice" ? "簡潔に伝える" : "2〜4個の見出しで紹介する"}
- 事実に基づき、まだ無い機能や誇張した効果を書かない（メモにない断言をしない）
- 対象読者が「試してみたい」と思える具体性（どんな場面で役立つか）を添える

【記事の要件】
- タイトル: 32字前後。何が新しく/便利になったかが伝わる具体的な言葉。SEKKEIYA や機能名を含めてよい
- 本文: 900〜1600字の**HTML**。使用可能タグは <h2> <h3> <p> <ul> <li> <ol> <strong> <blockquote> <a> のみ（<a>は内部リンク専用）。<h2>を2〜4個＋末尾に「SEKKEIYA で試す」CTAの<h2>
- カテゴリ: ${category}
- slug は内容を表す英語 kebab-case（3〜6語）

【出力形式（JSONのみ。前後に説明やコードブロックを付けない）】
{"title":"記事タイトル","slug":"english-kebab-case","excerpt":"要約(100字以内)","body":"<h2>...</h2><p>...</p>","tags":["タグ1","タグ2","タグ3"],"seoTitle":"SEOタイトル(60字以内)","seoDescription":"メタdescription(120字以内)"}
`.trim();

  let out;
  try {
    const raw = await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model });
    out = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch (e) {
    return { success: false, reason: `generate failed: ${e.message}` };
  }

  const col = db.collection("officialArticles");
  const slug = await uniqueSlug(col, slugify(out.slug) || slugify(out.seoTitle) || "sekkeiya-update");
  const tags = Array.isArray(out.tags) && out.tags.length ? out.tags : ["SEKKEIYA", "アップデート"];

  const docData = {
    title: out.title || "SEKKEIYA アップデート",
    slug,
    excerpt: out.excerpt || "",
    body: sanitizeInternalLinks(out.body || ""),
    contentFormat: "html",
    tags,
    tagsLower: tags.map((t) => String(t).toLowerCase()),
    status: "review",                 // レビュー待ち（自動公開しない）
    source: "reporter-mode3-devupdate",
    channel: "official",
    aiDrafted: true,
    featured: false,
    seoTitle: out.seoTitle || out.title || "",
    seoDescription: out.seoDescription || "",
    category: { slug: slugify(category) || "news", name: category },
    subCategory: null,
    author: { uid: "system", displayName: "SEKKEIYA Reporter" },
    coverUrl: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: null,
  };

  const ref = await col.add(docData);
  console.log(`[generateDevUpdateArticle] created: ${slug} (kind=${kind})`);
  return { success: true, action: "created", slug, articleId: ref.id, title: docData.title };
};
