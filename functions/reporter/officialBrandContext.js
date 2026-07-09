/**
 * officialBrandContext.js — 公式ブログ記事のAI生成に「ブランド一貫性・製品導線・内部リンク・CTA」を
 * 注入するための共有コンテキスト（generateKeywordArticle / generateTrendArticle から使用）。
 *
 * 公式ブログの記事は「個人の表現」ではなく「SEKKEIYAが検索ユーザーを集めて製品へ導く」集客記事。
 * そのため、①関連する製品を自然に絡める ②末尾にCTA ③製品LP/関連記事への内部リンク ④統一ブランドボイス
 * を効かせる。内部リンク先は下の PRODUCTS の URL に限定し、生成後にサニタイズで外部リンクを除去する。
 */

const SITE_URL = "https://sekkeiya.com";

// 製品LPの正典（productSlugs.mjs と一致）。記事から自然に絡められるよう1行説明つき。
const PRODUCTS = [
  { name: "S.Layout", url: "/products/s-layout", desc: "家具を置いた3D空間で間取り・レイアウトを検討（AI自動レイアウト・ウォークスルー）" },
  { name: "S.Model", url: "/products/s-model", desc: "3Dモデル・家具ライブラリの管理と共有（Rhino連携・リンク共有）" },
  { name: "S.Create", url: "/products/s-create", desc: "スケッチや写真から特注家具・什器を3D生成" },
  { name: "S.Slide", url: "/products/s-slide", desc: "歩ける没入型の3Dプレゼンをリンクで配信" },
  { name: "S.Material", url: "/products/s-material", desc: "仕上げ材の比較検討・標準化（マテリアル在庫化）" },
  { name: "S.Diagram", url: "/products/s-diagram", desc: "ゾーニング・動線・構成図などのダイアグラム作成" },
  { name: "S.Drawing", url: "/products/s-drawing", desc: "平面図・立面図・詳細図の図面セット管理と共有" },
  { name: "S.Image", url: "/products/s-image", desc: "パース・動画・AI生成画像の集約管理" },
  { name: "S.Movie", url: "/products/s-movie", desc: "ウォークスルー動画・短尺ムービーの自動編集" },
  { name: "S.Library", url: "/products/s-library", desc: "書籍・PDF・Web記事を知識ベース化しAIの外付けの脳に" },
  { name: "S.Portfolio", url: "/products/s-portfolio", desc: "作品集PDFをフリップブック化してURLで公開" },
  { name: "S.Quest", url: "/products/s-quest", desc: "設計スキルをステップ式で学べる学習コース" },
  { name: "S.Blog", url: "/products/s-blog", desc: "AIと議論しながらSEOに強い公開ブログを執筆" },
];

/**
 * 生成プロンプトに差し込むブランド・製品・内部リンク・CTAの指示ブロック。
 * @param {object} opts
 * @param {"keyword"|"trend"} opts.mode 記事の性格（keyword=集客/実用, trend=トレンド/ブランディング）
 * @param {"html"|"markdown"} opts.format 本文フォーマット（内部リンクの書式を切り替える）
 */
function buildBrandBlock({ mode = "keyword", format = "html" } = {}) {
  const productList = PRODUCTS.map((p) => `- ${p.name}（${p.url}）: ${p.desc}`).join("\n");
  const linkSyntax = format === "markdown"
    ? '[製品名](/products/xxx) の Markdown リンク形式'
    : '<a href="/products/xxx">製品名</a> の HTML リンク形式';
  const ctaHeading = format === "markdown" ? "## SEKKEIYA で試す" : "<h2>SEKKEIYA で試す</h2>";
  return `
【SEKKEIYA について（ブランド）】
SEKKEIYA は「設計は、対話になる。」を掲げる AI空間設計 OS。建築・インテリアの設計プロセス全体を、AIとの対話で組み立てられるようにする製品群を持つ。

【ブランドボイス（この記事の書き手＝SEKKEIYA として）】
- 一人称は使わず、SEKKEIYA という媒体（ブランド）の立場で書く
- 設計者・建築/インテリアのプロに向けた、実務的で誠実なトーン。誇張・煽り・断定しすぎを避ける
- 読者の課題解決を最優先し、製品の押し売りはしない（価値が伝わる文脈でのみ製品に触れる）

【SEKKEIYA の製品（内部リンク・言及の対象。これ以外の外部サービスへのリンクは禁止）】
${productList}

【製品への自然な言及と内部リンク（SEOと集客の要）】
- 記事のテーマに**本当に関連する製品を1〜2個**選び、その機能が読者の課題をどう助けるかを本文中で自然に触れる（宣伝臭くしない・無関係な製品は入れない）
- 触れた製品名には**内部リンク**を張る: ${linkSyntax}（href/URL は上のリストの "/products/xxx" のパスを**そのまま**使う。フルURLにしない）
- 外部サイト・実在しないURLへのリンクは**絶対に作らない**（URLを捏造しない）
- リンクの総数は記事全体で**最大3個**まで（貼りすぎない）

【記事末尾のCTA（必須）】
- 記事の最後に「${ctaHeading}」の見出しで**2〜3文のCTA**を置く
- そのテーマに最も関連する製品1つへ、読者が次に取る行動（試す/詳しく見る）を促す。該当製品への内部リンクを1つ含める
- 例:「本記事で触れた〜は、${PRODUCTS[0].name} で実際に試せます。…」のように、記事内容と地続きにする（テンプレ丸写しにしない）

${mode === "trend"
  ? "【この記事の性格】業界トレンド/ブランディング寄り。SEKKEIYA の視点・思想を示しつつ、製品導線で締める。"
  : "【この記事の性格】検索キーワードの実用記事。まず検索意図を満たし切り、その延長線上で自然に製品へ導く。"}
`.trim();
}

/**
 * 生成HTMLから内部リンク以外の <a> を除去する（ハルシネーションの外部リンク対策）。
 * - href が "/" 始まり、または https://sekkeiya.com で始まるものだけ許可
 * - それ以外の <a ...>text</a> はテキストだけ残してタグを剥がす
 * @param {string} html
 */
function sanitizeInternalLinks(html) {
  return String(html || "").replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (m, attrs, inner) => {
    const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? "") : "";
    const isInternal = /^\/(?!\/)/.test(href) || /^https:\/\/sekkeiya\.com(\/|$)/i.test(href);
    if (!isInternal) return inner; // 外部/不正リンクはテキスト化
    // 内部リンクは href を正規化（フルURL→パス）して rel だけ付ける
    const path = href.replace(/^https:\/\/sekkeiya\.com/i, "") || "/";
    return `<a href="${path}">${inner}</a>`;
  });
}

/**
 * Markdown本文から内部リンク以外のリンクを除去する（[text](url) 形式）。
 * href が "/" 始まり or https://sekkeiya.com のものだけ許可。それ以外はテキスト化。
 */
function sanitizeInternalLinksMd(md) {
  return String(md || "").replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (m, text, href) => {
    const isInternal = /^\/(?!\/)/.test(href) || /^https:\/\/sekkeiya\.com(\/|$)/i.test(href);
    if (!isInternal) return text; // 外部/不正リンクはテキスト化
    const path = href.replace(/^https:\/\/sekkeiya\.com/i, "") || "/";
    return `[${text}](${path})`;
  });
}

module.exports = { PRODUCTS, buildBrandBlock, sanitizeInternalLinks, sanitizeInternalLinksMd, SITE_URL };
