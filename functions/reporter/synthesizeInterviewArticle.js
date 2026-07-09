/**
 * synthesizeInterviewArticle.js — 取材（インタビュー）回答を記事本文に織り込む
 *
 * フロー:
 *   generateKeywordArticle が下書き＋質問を作成（status:"interview"）
 *   → 管理者が /admin/articles/{id}/edit で質問に回答（interview.questions[].answer）
 *   → 「回答を反映して仕上げる」→ synthesizeInterviewArticle({ articleId })
 *   → Gemini が下書き＋Q&Aを統合し、設計者コメント引用付きの完成記事に再生成
 *   → officialArticles を status:"review" に更新（レビュー→公開は従来どおり）
 *
 * 設計方針:
 *   - 回答（一次情報）は言い換えず要旨を活かす。1〜2箇所を <blockquote> で引用。
 *   - 空回答の質問は無視。全問スキップでも下書きをそのまま review へ通せる。
 */
const admin = require("firebase-admin");
const { callLLM, getTextModelConfig } = require("./llm");

function cleanJson(raw) {
  return String(raw)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

exports.synthesizeInterviewArticle = async (data = {}, context = {}, apiKey) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const textCfg = await getTextModelConfig(db);

  const articleId = data.articleId;
  if (!articleId) return { success: false, reason: "articleId is required" };

  const ref = db.collection("officialArticles").doc(articleId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, reason: "article not found" };
  const a = snap.data();

  const questions = Array.isArray(a.interview?.questions) ? a.interview.questions : [];
  const answered = questions.filter((q) => (q.answer || "").trim());

  // 回答が1件も無ければ、下書きをそのまま review へ通す（合成しない）
  if (answered.length === 0) {
    await ref.update({
      status: "review",
      "interview.status": "skipped",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, articleId, status: "review", synthesized: false, reason: "no answers (skipped)" };
  }

  const reporterName = a.reporterName || "SEKKEIYA";
  const qaBlock = answered.map((q, i) => `Q${i + 1}: ${q.q}\nA${i + 1}: ${q.answer}`).join("\n\n");

  const prompt = `
あなたは「${reporterName}」という、SEKKEIYA公式ブログの記者です。
以下は、AIが作成した記事の下書きと、SEKKEIYA創業者への取材（インタビュー）Q&Aです。
両者を統合し、創業者の一次情報で厚みを増した「完成記事」をHTMLで書いてください。

【統合の指示】
- 創業者の回答（A）は**断片・箇条書き・選択キーワード・言い切りメモでも構わない**。その**要旨・意図を保ったまま、自然で読みやすい日本語の文章に補正・展開**して本文に織り込む（誤字や口語は整える）
- ただし**回答に無い主張・数値・事実を創作しない**（あくまで回答の意図の範囲で肉付けする）
- そのうち1〜2箇所は <blockquote> を使い「設計者コメント」として引用する（引用も自然な一文に整えてよい）
- 回答が無い質問は無視する
- 創業者ならではの見解・体験を本文の前半に配置する（差別化・E-E-A-T のため）
- 使用可能タグは <h2> <h3> <p> <ul> <li> <ol> <strong> <blockquote>、および下記の「図解ブロック」用 <figure><figcaption> のみ（<h1>・<img>・<script>・<a>は使わない）
- 誇張・根拠のない断言は禁止

【図解ブロック（重要）】
- 重要なH2セクションの直後に、そのセクションの要点を3個前後にまとめた「図解ブロック」を **2〜3個** 挿入する（多すぎない）
- 図解ブロックは必ず次の形式（インラインstyle付き）で出力する。見出しと箇条書きの中身だけ差し替える:
<figure style="margin:1.5em 0;padding:1em 1.25em;border-left:4px solid #fb923c;border-radius:8px;background:rgba(251,146,60,0.08)"><figcaption style="font-weight:700;color:#fb923c;margin-bottom:.5em">📌 見出し</figcaption><ul style="margin:0;padding-left:1.2em"><li>要点1</li><li>要点2</li><li>要点3</li></ul></figure>
- 図解の要点は本文の言い換えでよいが、簡潔に（各20字前後）

【記事タイトル】
${a.title || ""}

【下書き本文】
${a.body || ""}

【取材Q&A】
${qaBlock}

【出力形式（JSONのみ。前後に説明やコードブロックを付けない）】
{"title":"記事タイトル（必要なら微調整）","excerpt":"記事の要約（100字以内）","body":"<h2>...</h2><p>...</p> のHTML本文","pullQuotes":["設計者コメントとして引用した文1"],"seoTitle":"SEOタイトル（60字以内）","seoDescription":"メタdescription（120字以内）"}
`.trim();

  let out;
  try {
    const raw = await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model });
    out = JSON.parse(cleanJson(raw));
  } catch (e) {
    return { success: false, reason: `Synthesis/parse failed: ${e.message}` };
  }

  const patch = {
    body: out.body || a.body,
    excerpt: out.excerpt || a.excerpt,
    seoTitle: out.seoTitle || a.seoTitle,
    seoDescription: out.seoDescription || a.seoDescription,
    status: "review",
    "interview.status": "done",
    "provenance.aiDrafted": true,
    "provenance.reporterName": reporterName,
    "provenance.interviewedUid": context.auth?.uid || null,
    "provenance.pullQuotes": Array.isArray(out.pullQuotes) ? out.pullQuotes : [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (out.title) patch.title = out.title;

  await ref.update(patch);
  console.log(`[synthesizeInterviewArticle] synthesized: ${articleId} (${answered.length} answers)`);

  // 取材タスクを完了に
  if (a.interviewTaskId && a.interviewTaskProjectId) {
    try {
      await db
        .collection("projects").doc(a.interviewTaskProjectId)
        .collection("tasks").doc(a.interviewTaskId)
        .update({ status: "done", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      console.warn(`[synthesizeInterviewArticle] task complete failed: ${e.message}`);
    }
  }

  return {
    success: true, articleId, status: "review", synthesized: true, answers: answered.length,
    before: { title: a.title || "", body: a.body || "" },
    after: { title: patch.title || a.title || "", body: patch.body || "" },
  };
};
