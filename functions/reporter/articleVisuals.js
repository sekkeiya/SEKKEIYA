/**
 * articleVisuals.js — 記事にビジュアルを差し込む
 *
 *  mode:"slide" … ペライチの図解スライド(SVG)を生成して <figure><img> で挿入（C）
 *  mode:"image" … AI画像(nanobanana=Gemini / gpt-image-1=OpenAI)を生成して挿入（B）
 *
 * フロー: 記事本文を読む → 文章モデルが「どのセクションに何を出すか」の spec を計画
 *   → 各 spec をレンダー/生成 → Storage 保存 → 該当 H2 の直後に <figure> を差し込み → 本文更新
 *
 * Secrets（onCall に付与）: GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY
 */
const admin = require("firebase-admin");
const { callLLM, getTextModelConfig } = require("./llm");

const escXml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escRe = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------- C: SVG スライド（決定的レンダー・外部API不要） ----------
 * エディトリアル調の「章末サマリーカード」。ブログのスタイルプリセットに追従し、
 * 記事の誌面（articleTheme）と同じ人格でレンダーする。
 *   magazine/warm = 紙色×セリフ見出し / minimal = 無彩色×サンス / tech = ダーク×サンス */
const SLIDE_PALETTES = {
  magazine: { bg: "#fbfaf8", text: "#1c1914", sub: "#8a8378", line: "rgba(28,25,20,0.12)", border: "rgba(28,25,20,0.16)", serif: true },
  minimal:  { bg: "#fafafa", text: "#26282c", sub: "#8b8f96", line: "rgba(38,40,44,0.10)", border: "rgba(38,40,44,0.14)", serif: false },
  warm:     { bg: "#faf6f0", text: "#332e26", sub: "#948b7d", line: "rgba(51,46,38,0.12)", border: "rgba(51,46,38,0.16)", serif: true },
  tech:     { bg: "#12141a", text: "#f4f5f7", sub: "#8b919c", line: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.12)", serif: false },
};
function renderSlideSvg({ title, points = [], accent = "#fb923c", brandLabel = "SEKKEIYA", preset = "tech" }) {
  const pal = SLIDE_PALETTES[preset] || SLIDE_PALETTES.tech;
  const SANS = "'Segoe UI','Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic UI',sans-serif";
  const SERIF = "Georgia,'Times New Roman','Yu Mincho','YuMincho','Hiragino Mincho ProN',serif";
  const HEAD = pal.serif ? SERIF : SANS;
  const pts = (points || []).slice(0, 4);
  const W = 1200, PAD = 88;
  const headerH = 196, rowH = 100;
  const H = headerH + pts.length * rowH + 56;
  const clip = (s, n) => { const t = String(s || ""); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
  const rows = pts.map((p, i) => {
    const heading = typeof p === "string" ? p : (p.heading || p.detail || "");
    const detail = typeof p === "string" ? "" : (p.detail || "");
    const y = headerH + 40 + i * rowH;
    return `<g>
      <text x="${PAD}" y="${y + 6}" font-size="26" font-weight="800" fill="${accent}" font-family="${SANS}" letter-spacing="1">${String(i + 1).padStart(2, "0")}</text>
      <text x="${PAD + 74}" y="${y + 4}" font-size="25" font-weight="700" fill="${pal.text}" font-family="${SANS}">${escXml(clip(heading, 26))}</text>
      ${detail ? `<text x="${PAD + 74}" y="${y + 40}" font-size="16.5" fill="${pal.sub}" font-family="${SANS}" letter-spacing="0.5">${escXml(clip(detail, 52))}</text>` : ""}
      ${i < pts.length - 1 ? `<line x1="${PAD}" y1="${y + rowH - 34}" x2="${W - PAD}" y2="${y + rowH - 34}" stroke="${pal.line}" stroke-width="1"/>` : ""}
    </g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="14" fill="${pal.bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${pal.border}" stroke-width="1"/>
  <rect x="${PAD}" y="72" width="26" height="4" fill="${accent}"/>
  <text x="${PAD + 40}" y="82" font-size="15" font-weight="700" fill="${accent}" font-family="${SANS}" letter-spacing="6">POINT</text>
  <text x="${PAD}" y="146" font-size="38" font-weight="${pal.serif ? 700 : 800}" fill="${pal.text}" font-family="${HEAD}" letter-spacing="1">${escXml(clip(title, 24))}</text>
  <line x1="${PAD}" y1="${headerH - 12}" x2="${W - PAD}" y2="${headerH - 12}" stroke="${pal.line}" stroke-width="1"/>
  <text x="${W - PAD}" y="${H - 30}" font-size="13" fill="${pal.sub}" text-anchor="end" font-family="${SANS}" letter-spacing="3">${escXml(brandLabel)}</text>
  ${rows}
</svg>`;
}

/** LLMが出力するMarkdownの強調ゆらぎ（`** 太字 **` のようなマーカー内空白）を有効な形に正規化。
 *  正規表現だと隣接スパンを誤結合するため、行ごとに `**` で分割し対になっている行のみ内側を trim。 */
const normalizeMd = (s) => String(s || "").split("\n").map((line) => {
  const parts = line.split("**");
  if (parts.length < 3 || parts.length % 2 === 0) return line;
  for (let i = 1; i < parts.length; i += 2) parts[i] = parts[i].trim();
  return parts.join("**");
}).join("\n");

/* ---------- B: AI 画像生成（provider 切替） ---------- */
async function genImageGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini image HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p.inlineData || p.inline_data);
  if (!imgPart) throw new Error("No image returned by Gemini");
  const inline = imgPart.inlineData || imgPart.inline_data;
  return { buffer: Buffer.from(inline.data, "base64"), mime: inline.mimeType || inline.mime_type || "image/png" };
}

async function genImageOpenAI(prompt, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || "gpt-image-1", prompt, size: "1536x1024", n: 1 }),
  });
  if (!res.ok) throw new Error(`OpenAI image HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned by OpenAI");
  return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
}

async function uploadToStorage(buffer, contentType, path) {
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  await file.save(buffer, { metadata: { contentType } });
  await file.makePublic();
  return file.publicUrl();
}

/** 本文の該当 H2 直後に html を挿入。見つからなければ i 番目の </h2> 後、無ければ末尾。 */
function insertAfterHeading(body, headingText, html, fallbackIndex) {
  if (headingText) {
    const re = new RegExp(`(<h2[^>]*>[^<]*${escRe(headingText.trim())}[^<]*</h2>)`, "i");
    if (re.test(body)) return body.replace(re, `$1\n${html}`);
  }
  const closes = [...body.matchAll(/<\/h2>/gi)];
  if (closes.length) {
    const idx = Math.min(fallbackIndex, closes.length - 1);
    const pos = closes[idx].index + "</h2>".length;
    return body.slice(0, pos) + "\n" + html + body.slice(pos);
  }
  return body + "\n" + html;
}

/** Markdown版: 「## 見出し」セクションの**末尾**（次の見出しの直前）に md ブロックを挿入。
 *  見出し直後だと本文と二重に見えるため、節のまとめとして節末に置く。 */
function insertAfterMdHeading(body, headingText, md, fallbackIndex) {
  const lines = body.split("\n");
  const h2idx = [];
  lines.forEach((l, i) => { if (/^##\s+/.test(l)) h2idx.push(i); });
  let at = -1;
  if (headingText) {
    const needle = headingText.trim();
    at = h2idx.find((i) => lines[i].includes(needle)) ?? -1;
  }
  if (at < 0 && h2idx.length) at = h2idx[Math.min(fallbackIndex, h2idx.length - 1)];
  if (at < 0) return body + "\n\n" + md + "\n";
  // 節の末尾 = 次の # / ## 見出しの直前（### は節内なので跨ぐ）
  let end = at + 1;
  while (end < lines.length && !/^##?\s/.test(lines[end])) end++;
  let insertAt = end;
  while (insertAt > at + 1 && lines[insertAt - 1].trim() === "") insertAt--; // 末尾の空行の手前へ
  lines.splice(insertAt, 0, "", md, "");
  return lines.join("\n");
}

exports.insertArticleVisuals = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const articleId = data.articleId;
  const mode = data.mode === "image" ? "image" : "slide";
  // target: 'official'=公式記事(HTML) / 'blog'=S.Blogのユーザー記事(Markdown・本人のみ)
  const target = data.target === "blog" ? "blog" : "official";
  const uid = context.auth?.uid;
  const count = Math.max(1, Math.min(3, Number(data.count) || 2));
  if (!articleId) return { success: false, reason: "articleId is required" };
  if (target === "blog" && !uid) return { success: false, reason: "unauthenticated" };

  const ref = target === "blog"
    ? db.collection("users").doc(uid).collection("blogArticles").doc(articleId)
    : db.collection("officialArticles").doc(articleId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, reason: "article not found" };
  const a = snap.data();
  const rawBody = target === "blog" ? (a.bodyMarkdown || "") : (a.body || "");

  const textCfg = await getTextModelConfig(db);
  const cfg = (await db.doc("config/aiModels").get()).data() || {};
  const imageProvider = cfg.imageProvider || "gemini";
  const imageModel = cfg.imageModel || "nanobanana";
  if (mode === "image" && imageProvider === "none") {
    return { success: false, reason: "画像生成モデルが「なし」に設定されています（Content Strategyで設定）" };
  }

  // 1) 文章モデルで「どのセクションに何を出すか」を計画
  const headingHint = target === "blog"
    ? "afterHeading=記事内の『## 見出し』の文言（## は除いた本文そのまま）"
    : "afterHeading=記事内のH2見出しの文言そのまま";
  const plainBody = target === "blog"
    ? String(rawBody).replace(/[#>*`\-]/g, " ").slice(0, 2500)
    : String(rawBody).replace(/<[^>]+>/g, " ").slice(0, 2500);
  const planPrompt = mode === "image"
    ? `以下の記事に、内容に合うAI生成画像を${count}枚差し込みます。各画像について、挿入位置(${headingHint})、alt(日本語の短いキャプション)、prompt(英語の画像生成プロンプト。建築・インテリアのフォトリアルな情景。**画像内に文字を入れない**。人物の顔は避ける)を作ってください。
【記事タイトル】${a.title || ""}
【本文(抜粋)】${plainBody}
【出力(JSONのみ)】{"specs":[{"afterHeading":"","alt":"","prompt":""}]}`
    : `以下の記事に、要点をまとめた図解スライドを${count}枚差し込みます。各スライドについて、挿入位置(${headingHint})、title(スライド見出し・15字前後)、points(要点3〜4個。各 heading=10字前後 / detail=20字前後)を作ってください。
- points は本文の文の丸写しではなく、**読者が覚えて帰れる形の要約**にする（数値・対比・手順など、ひと目で価値が伝わる切り口）
- スライドは節の「まとめ」として節末に置かれる。その節を読み終えた読者に効く内容にする
【記事タイトル】${a.title || ""}
【本文(抜粋)】${plainBody}
【出力(JSONのみ)】{"specs":[{"afterHeading":"","title":"","points":[{"heading":"","detail":""}]}]}`;

  let specs = [];
  try {
    const raw = await callLLM(planPrompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 2048 });
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim());
    specs = Array.isArray(parsed.specs) ? parsed.specs.slice(0, count) : [];
  } catch (e) {
    return { success: false, reason: `plan failed: ${e.message}` };
  }
  if (!specs.length) return { success: false, reason: "no specs" };

  // 2) 各 spec をレンダー/生成 → Storage → 本文に挿入
  const basePath = target === "blog"
    ? `users/${uid}/blog_visuals/${articleId}`
    : `officialArticles/inline/${articleId}`;
  let body = rawBody;
  const inserted = [];
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    try {
      let url, block;
      if (mode === "slide") {
        const svg = renderSlideSvg({
          title: s.title || a.title,
          points: s.points || [],
          accent: target === "blog" ? "#e57373" : "#fb923c", // S.Blogはブランド色
          preset: target === "blog" ? "magazine" : "tech",   // 公式記事はダーク誌面のまま
        });
        url = await uploadToStorage(Buffer.from(svg, "utf8"), "image/svg+xml", `${basePath}/slide_${Date.now()}_${i}.svg`);
        block = target === "blog"
          ? `![${(s.title || "図解").replace(/[\[\]]/g, "")}](${url})`
          : `<figure style="margin:1.75em 0"><img src="${url}" alt="${escXml(s.title || "図解")}" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.1)"/></figure>`;
      } else {
        const img = imageProvider === "openai"
          ? await genImageOpenAI(s.prompt || `${a.title} architecture interior, photorealistic`, imageModel)
          : await genImageGemini(s.prompt || `${a.title} architecture interior, photorealistic`);
        const ext = (img.mime.split("/")[1] || "png").replace("+xml", "");
        url = await uploadToStorage(img.buffer, img.mime, `${basePath}/img_${Date.now()}_${i}.${ext}`);
        block = target === "blog"
          ? `![${(s.alt || "").replace(/[\[\]]/g, "")}](${url})${s.alt ? `\n*${s.alt}*` : ""}`
          : `<figure style="margin:1.75em 0"><img src="${url}" alt="${escXml(s.alt || "")}" style="width:100%;border-radius:8px"/>${s.alt ? `<figcaption style="font-size:.85em;color:rgba(255,255,255,0.5);margin-top:.5em">${escXml(s.alt)}</figcaption>` : ""}</figure>`;
      }
      body = target === "blog"
        ? insertAfterMdHeading(body, s.afterHeading, block, i + 1)
        : insertAfterHeading(body, s.afterHeading, block, i + 1);
      inserted.push(url);
    } catch (e) {
      console.warn(`[insertArticleVisuals] spec ${i} failed: ${e.message}`);
    }
  }

  if (!inserted.length) return { success: false, reason: "生成に失敗しました" };

  if (target === "blog") {
    await ref.update({ bodyMarkdown: body, updatedAt: new Date().toISOString() });
  } else {
    await ref.update({ body, contentFormat: "html", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  console.log(`[insertArticleVisuals] ${articleId} target=${target} mode=${mode} inserted=${inserted.length}`);
  return { success: true, articleId, mode, target, inserted: inserted.length, urls: inserted, body };
};

/* ======================================================================
 * designBlogArticle — S.Blog「✨デザイン」: 記事全体を読みやすく美しく整形
 *
 * users/{uid}/blogSettings/style（プリセット/アクセント色/署名/ビジュアル量/独自指示）
 * を読み、①本文をプリセットに沿って整形（Markdown）②図解スライドを統一デザインで
 * 節末に挿入 ③（設定により）AI画像も挿入、まで一括で行う。
 * → 全記事に統一感（preset+accent+署名）を持たせつつ、独自性（色・署名・文体指示）も反映。
 * ==================================================================== */

const PRESET_GUIDES = {
  minimal: `- 余白を活かす: 段落は2〜3文で短く区切る。装飾（太字・引用）は本当に重要な箇所だけ
- 見出しは簡潔な体言止め。リストは使いすぎない
- リード文は1〜2文のみ。要点ボックスは作らない`,
  magazine: `- 冒頭に導入リード（2〜3文）+「この記事のポイント」箇条書きボックス（3項目・引用ブロックで）
- 重要フレーズを **太字** で強調。節の区切りに引用（> ）で印象的な一文を置いてよい
- 見出しは読者の興味を引く言い回し（疑問形・数字入り歓迎）`,
  tech: `- 手順・条件は必ず番号付きリスト/箇条書きに変換。曖昧な形容は削る
- 用語は初出で短く定義。比較は表形式（Markdownテーブル）を積極的に使う
- 見出しは「何ができるか」が分かる具体的なものに`,
  warm: `- 語りかける文体（「〜ですよね」「〜してみてください」）。体験談・気づきを段落の先頭に
- 専門用語はやさしく言い換え、たとえ話を1つ以上入れる
- 締めは読者への応援・提案で終える`,
};

exports.designBlogArticle = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const uid = context.auth?.uid;
  const articleId = data.articleId;
  if (!uid) return { success: false, reason: "unauthenticated" };
  if (!articleId) return { success: false, reason: "articleId is required" };

  const ref = db.collection("users").doc(uid).collection("blogArticles").doc(articleId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, reason: "article not found" };
  const a = snap.data();
  if (!String(a.bodyMarkdown || "").trim()) return { success: false, reason: "本文がまだありません" };

  // ブログ全体のスタイル設定（未設定なら既定=マガジン）
  let style = { preset: "magazine", accent: "#e57373", brandLabel: "", visuals: "slides", customNote: "" };
  try {
    const s = (await db.collection("users").doc(uid).collection("blogSettings").doc("style").get()).data();
    if (s) style = { ...style, ...s };
  } catch { /* 既定を使用 */ }
  const presetGuide = PRESET_GUIDES[style.preset] || PRESET_GUIDES.magazine;
  const brandLabel = (style.brandLabel || a.authorName || "BLOG").slice(0, 24);

  const textCfg = await getTextModelConfig(db);
  const cfg = (await db.doc("config/aiModels").get()).data() || {};
  const imageProvider = cfg.imageProvider || "gemini";
  const imageModel = cfg.imageModel || "nanobanana";

  /* ---- ① 本文をプリセットに沿って整形 ---- */
  const formatPrompt = `
あなたはブログの編集デザイナーです。以下の記事本文（Markdown）を、指定スタイルに沿って**読みやすく美しく**整形してください。

【絶対に守ること】
- 内容・主張・事実・著者の一人称の声は変えない（追加の意見・数値を創作しない）
- 「### 参考記事」などの出典リンクは必ず残す
- 既に入っている画像（![...](...)）はそのままの位置で残す
- 全体の文字数は元の0.8〜1.2倍に収める
- Markdownの文法を厳密に守る: 太字は必ず \`**語句**\` の形（\`**\` と語句の間に空白を入れない）。見出し行（#）を \`**\` で囲まない
- 冒頭は「リード段落（2〜3文で記事の魅力を要約）」から始める。1つの段落は3〜4文まで（長い段落は分割する）

【スタイル: ${style.preset}】
${presetGuide}
${style.customNote ? `\n【著者の独自指示（最優先で尊重）】\n${style.customNote}` : ""}

【本文（Markdown）】
${String(a.bodyMarkdown).slice(0, 9000)}

【出力（JSONのみ）】
{"bodyMarkdown":"整形後の本文","excerpt":"抜粋(80字以内・魅力的に)"}
`.trim();

  let formatted;
  try {
    const raw = await callLLM(formatPrompt, { provider: textCfg.provider, model: textCfg.model });
    formatted = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch (e) {
    return { success: false, reason: `整形に失敗しました: ${e.message}` };
  }
  let body = normalizeMd(formatted.bodyMarkdown || a.bodyMarkdown);

  /* ---- ② 図解スライド（統一デザイン）を節末に挿入 ---- */
  const inserted = [];
  if (style.visuals !== "none") {
    // 既存の図解（blog_visuals 由来の画像）は重複しないよう一旦除去して作り直す
    body = body.split("\n").filter((l) => !/!\[[^\]]*\]\([^)]*blog_visuals[^)]*\)/.test(l)).join("\n");
    try {
      const planPrompt = `以下の記事に、要点をまとめた図解スライドを2枚差し込みます。各スライドについて、挿入位置(afterHeading=記事内の『## 見出し』の文言。##は除く)、title(15字前後)、points(3〜4個。heading=10字前後/detail=20字前後)を作ってください。
- points は本文の丸写しでなく、読者が覚えて帰れる要約（数値・対比・手順の切り口）
【記事タイトル】${a.title || ""}
【本文(抜粋)】${body.replace(/[#>*`\-]/g, " ").slice(0, 2500)}
【出力(JSONのみ)】{"specs":[{"afterHeading":"","title":"","points":[{"heading":"","detail":""}]}]}`;
      const raw = await callLLM(planPrompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 2048 });
      const specs = (JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()).specs || []).slice(0, 2);
      for (let i = 0; i < specs.length; i++) {
        const s = specs[i];
        const svg = renderSlideSvg({ title: s.title || a.title, points: s.points || [], accent: style.accent || "#e57373", brandLabel, preset: style.preset });
        const url = await uploadToStorage(Buffer.from(svg, "utf8"), "image/svg+xml", `users/${uid}/blog_visuals/${articleId}/slide_${Date.now()}_${i}.svg`);
        body = insertAfterMdHeading(body, s.afterHeading, `![${(s.title || "図解").replace(/[\[\]]/g, "")}](${url})`, i + 1);
        inserted.push(url);
      }
    } catch (e) {
      console.warn(`[designBlogArticle] slides failed: ${e.message}`);
    }
  }

  /* ---- ③ AI画像（設定が slides+images のとき・冒頭に1枚） ---- */
  if (style.visuals === "slides+images" && imageProvider !== "none") {
    try {
      const pPrompt = `この記事の冒頭に置くヒーロー画像の英語プロンプトを1つ。建築・インテリアのフォトリアルな情景、画像内に文字なし、人物の顔なし。記事:「${a.title}」`;
      const raw = await callLLM(`${pPrompt}\n【出力(JSONのみ)】{"prompt":"..."}`, { provider: textCfg.provider, model: textCfg.model, maxTokens: 512 });
      const p = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()).prompt;
      const img = imageProvider === "openai" ? await genImageOpenAI(p, imageModel) : await genImageGemini(p);
      const ext = (img.mime.split("/")[1] || "png").replace("+xml", "");
      const url = await uploadToStorage(img.buffer, img.mime, `users/${uid}/blog_visuals/${articleId}/hero_${Date.now()}.${ext}`);
      body = `![${(a.title || "").replace(/[\[\]]/g, "")}](${url})\n\n` + body.replace(/^!\[[^\]]*\]\([^)]*\)\n\n/, "");
      if (!a.coverUrl) await ref.update({ coverUrl: url }); // カバー未設定なら流用
      inserted.push(url);
    } catch (e) {
      console.warn(`[designBlogArticle] hero image failed: ${e.message}`);
    }
  }

  await ref.update({
    bodyMarkdown: body,
    ...(formatted.excerpt ? { excerpt: formatted.excerpt } : {}),
    updatedAt: new Date().toISOString(),
  });
  console.log(`[designBlogArticle] ${articleId} preset=${style.preset} visuals=${style.visuals} inserted=${inserted.length}`);
  return {
    success: true, articleId, body,
    excerpt: formatted.excerpt || a.excerpt,
    inserted: inserted.length,
    before: { bodyMarkdown: a.bodyMarkdown },
  };
};
