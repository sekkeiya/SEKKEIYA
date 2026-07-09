/**
 * planBlogContent.js — AI投稿計画（編集長）。
 *
 * 「AIがSEKKEIYA/ユーザー自身の状況を分析して、次に書くべき記事（投稿計画）を提案する」。
 * 記事の自動執筆はしない（提案のみ）。クライアントが提案を確認してスケジュールへ載せ、
 * 実行時に自動執筆 or 議論で書く。
 *
 * scope で「宣伝対象＝情報源」を切り替える:
 *  - official: SEKKEIYA を宣伝。officialArticles(カバレッジ)＋製品一覧＋利用トレンド＋任意の開発メモ
 *  - account : ユーザー自身を宣伝。blogArticles(カバレッジ)＋本人のプロジェクト/実績＋カテゴリ
 * 出力: topics[]（topic/category/kind/angle/rationale）。既存記事と重複しない「空白」を突く。
 */
const admin = require("firebase-admin");
const { callLLM, getTextModelConfig } = require("./llm");
const { PRODUCTS } = require("./officialBrandContext");

const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

async function gatherOfficial(db, devNotes) {
  const [artSnap, catSnap, trendSnap] = await Promise.all([
    db.collection("officialArticles").orderBy("updatedAt", "desc").limit(60).get(),
    db.collection("categories").limit(50).get().catch(() => ({ docs: [] })),
    db.collection("analytics").doc("weeklyTrends").get().catch(() => ({ exists: false })),
  ]);
  const existing = artSnap.docs.map((d) => clip(d.data().title, 40)).filter(Boolean);
  const cats = catSnap.docs.map((d) => d.data().name).filter(Boolean);
  const trends = trendSnap.exists ? (trendSnap.data().topKeywords || []).slice(0, 8).map((k) => k.word).filter(Boolean) : [];
  const products = PRODUCTS.map((p) => `${p.name}: ${p.desc}`);
  return {
    subject: "SEKKEIYA（AI空間設計OS。宣伝・使い方・お知らせを発信する自社メディア）",
    material: [
      `【SEKKEIYAの製品（宣伝・解説の題材）】\n${products.join("\n")}`,
      cats.length ? `【カテゴリ】${cats.join("・")}` : "",
      trends.length ? `【最近ユーザーがよく指示したこと（利用トレンド）】${trends.join("・")}` : "",
      devNotes ? `【最近の開発内容（新機能・改善のネタ）】\n${clip(devNotes, 3000)}` : "",
    ].filter(Boolean).join("\n\n"),
    existing,
    catOptions: cats.length ? cats : ["お知らせ", "使い方・学習", "3Dモデル・マテリアル", "AI×空間設計", "制作ワークフロー・連携"],
  };
}

async function gatherAccount(db, uid) {
  const [artSnap, userSnap, projByOwner, settingsSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("blogArticles").orderBy("updatedAt", "desc").limit(50).get().catch(() => ({ docs: [] })),
    db.collection("users").doc(uid).get().catch(() => ({ exists: false, data: () => ({}) })),
    db.collection("projects").where("ownerId", "==", uid).limit(30).get().catch(() => ({ docs: [] })),
    db.collection("users").doc(uid).collection("blogSettings").doc("main").get().catch(() => ({ exists: false })),
  ]);
  const existing = artSnap.docs.map((d) => clip(d.data().title, 40)).filter(Boolean);
  const u = userSnap.exists ? userSnap.data() : {};
  const projects = projByOwner.docs.map((d) => {
    const p = d.data();
    return `${clip(p.name, 30)}${p.description ? `（${clip(p.description, 60)}）` : ""}`;
  }).filter(Boolean);
  const cats = (settingsSnap.exists && Array.isArray(settingsSnap.data().categories)) ? settingsSnap.data().categories : [];
  const name = u.displayName || u.username || "あなた";
  return {
    subject: `${name}（建築・インテリアの設計者。自分の実績・専門性・サービスを宣伝したい）`,
    material: [
      u.bio ? `【プロフィール】${clip(u.bio, 200)}` : "",
      projects.length ? `【自分のプロジェクト/実績（記事の題材にできる）】\n- ${projects.join("\n- ")}` : "（プロジェクト情報なし。専門性・想定サービスから発想する）",
      cats.length ? `【ブログのカテゴリ】${cats.join("・")}` : "",
      "【共通の題材】設計事例の紹介 / 自分の設計プロセス・こだわり / 使っているツール(SEKKEIYA含む)での効率化 / 提供サービスの案内",
    ].filter(Boolean).join("\n\n"),
    existing,
    catOptions: cats.length ? cats : ["施工事例", "設計", "インテリア", "コラム", "お知らせ"],
  };
}

/** 保存済みの戦略・目標（ブログをどう運営したいか）を読む。account=blogSettings / official=config/official。 */
async function readStrategy(db, scope, uid) {
  try {
    const ref = scope === "official" ? db.doc("config/official") : db.doc(`users/${uid}/blogSettings/main`);
    const snap = await ref.get();
    const s = snap.exists ? snap.data().strategy : null;
    return s && typeof s === "object" ? s : null;
  } catch { return null; }
}

/** scope に応じて状況（宣伝対象＝情報源）を集める。planBlogContent / blogStrategy 共通。 */
async function gatherSituation(db, scope, uid, devNotes) {
  return scope === "official" ? gatherOfficial(db, devNotes) : gatherAccount(db, uid);
}

exports.gatherSituation = gatherSituation;
exports.readStrategy = readStrategy;

exports.planBlogContent = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const textCfg = await getTextModelConfig(db);

  const scope = data.scope === "official" ? "official" : "account";
  const uid = context.auth?.uid;
  if (scope === "account" && !uid) return { success: false, reason: "ログインが必要です" };
  const count = Math.max(1, Math.min(8, Number(data.count) || 5));

  const ctx = await gatherSituation(db, scope, uid, data.devNotes);
  const strategy = await readStrategy(db, scope, uid);
  const strategyBlock = strategy && strategy.summary
    ? `\n【この著者/媒体が決めた運営戦略・目標（最優先で従う）】\n${clip(strategy.summary, 800)}${strategy.audience ? `\n・読者: ${clip(strategy.audience, 120)}` : ""}${strategy.goals ? `\n・目標: ${clip(strategy.goals, 200)}` : ""}`
    : "";

  const prompt = `
あなたは「${ctx.subject}」のブログの編集長です。宣伝・集客につながる投稿計画を立てます。
目的は**${scope === "official" ? "SEKKEIYA" : "この著者"}自身をプロモーションする記事**を、状況を踏まえて計画すること。
※これは自社/自分に関する記事なので、他者の著作物を題材にはしません（宣伝・実績・使い方・お知らせが中心）。
${strategyBlock}

【現状の材料】
${ctx.material}

【すでに書いた記事（重複を避ける）】
${ctx.existing.length ? ctx.existing.map((t) => `- ${t}`).join("\n") : "（まだ記事なし）"}

【計画の方針】
${strategy && strategy.summary ? "- **上の運営戦略・目標を最優先**に、それに沿う記事案を出す\n" : ""}- 「まだ書いていない空白」や「今が旬（新機能・季節・トレンド）」を突いて、**${count}件**の記事案を出す
- 各案は宣伝として機能しつつ、読者に価値がある切り口にする（宣伝臭くしすぎない）
- kind は "promo"(宣伝/実績紹介) / "howto"(使い方・活用) / "notice"(お知らせ/アップデート) から最適なものを選ぶ
- rationale（なぜ今これを書くべきか）を1文で。angle（記事の切り口・具体的な中身の方向）も1文で

【出力（JSONのみ。前後に説明やコードブロックを付けない）】
{"topics":[{"topic":"記事タイトル案(30字前後)","category":"${ctx.catOptions[0]}","kind":"promo","angle":"切り口を1文","rationale":"なぜ今これを書くべきか1文"}]}
`.trim();

  try {
    const raw = await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 2048 });
    const out = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim());
    const topics = (Array.isArray(out.topics) ? out.topics : []).slice(0, count).map((t) => ({
      topic: clip(t.topic, 80),
      category: clip(t.category, 40) || ctx.catOptions[0],
      kind: ["promo", "howto", "notice"].includes(t.kind) ? t.kind : "promo",
      angle: clip(t.angle, 160),
      rationale: clip(t.rationale, 160),
    })).filter((t) => t.topic);
    return { success: true, scope, topics };
  } catch (e) {
    return { success: false, reason: `plan failed: ${e.message}` };
  }
};
