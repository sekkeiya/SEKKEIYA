/**
 * suggestTopics.js — AI記者「ネタ出し」（トピック自動提案）
 *
 * Content Strategy の topicQueue に、検索需要を狙った記事ネタを AI が自動提案して追加する。
 *   /admin/strategy の「AIでネタ提案」ボタン → suggestTopics({ count })
 *   → 既存記事・キューと重複しないネタを Gemini が生成
 *   → カテゴリに応じて担当記者を割当て → topicQueue に status:"queued" で追加
 *   → 管理者がキューを確認 → ⚡ で記事生成（→ 取材フローへ）
 */
const admin = require("firebase-admin");

async function callGemini(apiKey, prompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// categories コレクションが未整備のときのフォールバック
const DEFAULT_CATEGORIES = [
  "AI News", "SEKKEIYA", "S.Model", "S.Layout", "S.Slide",
  "Desktop", "Workflow", "Tips / Learn", "トレンド",
];

/** クライアント getWeekStart/getWeekLabel と揃える（月曜始まり） */
function weekStart(offset) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function weekLabel(start) {
  const sun = new Date(start); sun.setDate(start.getDate() + 6);
  return `${start.getMonth() + 1}/${start.getDate()}〜${sun.getMonth() + 1}/${sun.getDate()}`;
}

exports.suggestTopics = async (data = {}, context = {}, apiKey) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  const count = Math.max(1, Math.min(10, Number(data.count) || 5));
  const focusCategory = (data.category || "").trim();

  // 重複回避のための既存情報＋記者＋カテゴリを収集
  const [artSnap, topicSnap, repSnap, catSnap] = await Promise.all([
    db.collection("officialArticles").orderBy("updatedAt", "desc").limit(60).get(),
    db.collection("topicQueue").orderBy("createdAt", "desc").limit(60).get(),
    db.collection("reporters").get(),
    db.collection("categories").get(),
  ]);

  // カテゴリ（管理画面で管理）。未整備ならデフォルトにフォールバック。
  let catDocs = catSnap.docs
    .map((d) => d.data())
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  // 全カテゴリ名（ハブ+サブ）= 検証用ホワイトリスト
  const CATEGORIES = catDocs.length ? catDocs.map((c) => c.name).filter(Boolean) : DEFAULT_CATEGORIES;
  // ハブ → サブ の階層をプロンプトに提示
  let categoryLines;
  if (catDocs.length) {
    const tops = catDocs.filter((c) => !c.parent);
    categoryLines = tops.map((t) => {
      const subs = catDocs.filter((c) => c.parent === t.slug);
      const subLines = subs.map((s) => `    ・${s.name}${s.description ? `：${s.description}` : ""}`).join("\n");
      return `■ ${t.name}${t.description ? `（${t.description}）` : ""}${subLines ? `\n${subLines}` : ""}`;
    }).join("\n");
  } else {
    categoryLines = DEFAULT_CATEGORIES.map((n) => `- ${n}`).join("\n");
  }
  const existingTitles = artSnap.docs.map((d) => d.data().title).filter(Boolean);
  const existingKeywords = [
    ...artSnap.docs.map((d) => d.data().targetKeyword).filter(Boolean),
    ...topicSnap.docs.map((d) => d.data().keyword).filter(Boolean),
  ];
  const reporters = repSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.active !== false);

  const reporterLines = reporters
    .map((r) => `- ${r.displayName || r.name}（担当: ${(r.categories || []).join(", ") || "汎用"}）`)
    .join("\n") || "（記者未登録）";

  const prompt = `
あなたはSEKKEIYA（AIとの対話で建築・インテリア設計を行うOS。家具の自動レイアウト、3Dモデル管理・共有、歩ける3Dプレゼン、AIレンダリング、Rhino連携などの機能）の編集長です。
検索流入（SEO集客）に効く公式ブログの記事ネタ（トピック）を${count}件提案してください。

【カテゴリ階層（■=ハブ / ・=サブカテゴリ）】
${categoryLines}
${focusCategory ? `\n【今回はこのカテゴリ/ハブを中心に】${focusCategory}` : ""}

※ category には、上記の中で**最も具体的なサブカテゴリ名（・の項目）**を割り当ててください（親ハブ名ではなくサブを優先）。適切なサブが無い場合のみハブ名でも可。

【担当記者（参考。カテゴリで自動割当される）】
${reporterLines}

【既存の公開記事タイトル（重複を避ける）】
${existingTitles.slice(0, 40).map((t) => `- ${t}`).join("\n") || "（なし）"}

【キュー内・既出のキーワード（重複を避ける）】
${existingKeywords.slice(0, 40).join(" / ") || "（なし）"}

【要件】
- 実際に検索されそうな具体的なキーワード/記事タイトルイメージにする（ロングテール歓迎）。上記の既存と重複させない
- 各ネタに最も具体的なサブカテゴリを1つ割り当てる（category は上記リストの名称と完全一致させる）
- note には「検索意図・なぜ集客に効くか」を1行で書く
- 建築・インテリア設計の実務者や施主が知りたい実用テーマを優先する

【出力形式（JSONのみ。前後に説明やコードブロックを付けない）】
{"topics":[{"keyword":"狙うキーワード/タイトルイメージ","category":"カテゴリ名","note":"検索意図・狙い"}]}
`.trim();

  let parsed;
  try {
    const raw = await callGemini(apiKey, prompt);
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return { success: false, reason: `Suggestion/parse failed: ${e.message}` };
  }

  const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, count) : [];
  if (topics.length === 0) return { success: false, reason: "no topics generated" };

  const added = [];
  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    const keyword = String(t.keyword || "").trim();
    if (!keyword) continue;
    const fallbackCat = (focusCategory && CATEGORIES.includes(focusCategory)) ? focusCategory : (CATEGORIES.includes("チュートリアル") ? "チュートリアル" : CATEGORIES[0]);
    const category = CATEGORIES.includes(t.category) ? t.category : fallbackCat;
    // カテゴリ一致の記者を自動割当
    const rep = reporters.find((r) => Array.isArray(r.categories) && r.categories.includes(category)) || null;
    // 2件/週で先の週へ配分（4週カレンダーを埋める）
    const offset = Math.min(3, Math.floor(added.length / 2));
    const start = weekStart(offset);

    const payload = {
      keyword,
      category,
      note: String(t.note || "").trim(),
      reporterId: rep?.id || null,
      reporterName: rep ? (rep.displayName || rep.name) : null,
      targetWeekOffset: offset,
      targetWeekStart: admin.firestore.Timestamp.fromDate(start),
      targetWeekLabel: weekLabel(start),
      status: "queued",
      source: "ai-suggested",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection("topicQueue").add(payload);
    added.push({ id: ref.id, keyword, category });
  }

  console.log(`[suggestTopics] added ${added.length} topics`);
  return { success: true, added: added.length, topics: added };
};
