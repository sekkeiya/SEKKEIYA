/**
 * blogStrategy.js — AIとブログ運営戦略・目標を議論して決める。
 *
 * 「状況分析」だけでなく、ユーザー/公式が**どう記事を書いていきたいか**をAIと対話して
 * 戦略・目標（読者・狙い・方向性・トーン）を言語化する。決まった戦略は blogSettings/config に保存し、
 * planBlogContent（投稿計画）が最優先の材料として使う。
 *
 * mode:
 *   "turn"  … 対話1ターン。AIが状況を踏まえて問い、選択肢も返す。history + userMessage を受ける。
 *   "save"  … これまでの対話から戦略を要約・構造化して返す（クライアントが保存）。
 */
const admin = require("firebase-admin");
const { callLLM, getTextModelConfig } = require("./llm");
const { gatherSituation, readStrategy } = require("./planBlogContent");

const fmtHistory = (h = []) =>
  h.slice(-16).map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${String(m.text || "").trim()}`).join("\n");
const cleanJson = (s) => String(s || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

exports.blogStrategy = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const textCfg = await getTextModelConfig(db);

  const scope = data.scope === "official" ? "official" : "account";
  const uid = context.auth?.uid;
  if (scope === "account" && !uid) return { success: false, reason: "ログインが必要です" };
  const mode = data.mode === "save" ? "save" : "turn";

  const ctx = await gatherSituation(db, scope, uid, data.devNotes);
  const history = Array.isArray(data.history) ? data.history : [];
  const existingStrategy = await readStrategy(db, scope, uid);
  const isOpening = history.length === 0 && !String(data.userMessage || "").trim();

  const subjectLine = `対象は「${ctx.subject}」のブログ。目的は宣伝・集客（自社/自分のプロモーション）。`;
  const situationLine = `【現状】\n${ctx.material}\n【すでに書いた記事】${ctx.existing.slice(0, 20).join(" / ") || "なし"}`;

  if (mode === "save") {
    const prompt = `
あなたはブログの編集長です。${subjectLine}
以下の対話から、この媒体の**運営戦略・目標**を簡潔に構造化してください。対話で決まった内容を尊重し、足りない点は状況から補う。

${situationLine}

【これまでの対話】
${fmtHistory(history) || "（対話なし）"}

【出力（JSONのみ）】
{"summary":"戦略の要約(3〜5文。誰に何を届け、どう差別化し、どんな記事を優先するか)","audience":"主な読者像(1文)","goals":"達成したい目標(1〜2文・可能なら数値/頻度)","focus":["重視するテーマ1","テーマ2","テーマ3"],"tone":"文体・トーン(1文)"}
`.trim();
    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 1024 })));
      return {
        success: true,
        strategy: {
          summary: String(out.summary || "").trim(),
          audience: String(out.audience || "").trim(),
          goals: String(out.goals || "").trim(),
          focus: Array.isArray(out.focus) ? out.focus.map((f) => String(f).trim()).filter(Boolean).slice(0, 6) : [],
          tone: String(out.tone || "").trim(),
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (e) {
      return { success: false, reason: `save failed: ${e.message}` };
    }
  }

  // mode: turn
  const prompt = `
あなたはブログの編集長として、運営者と**戦略・目標を一緒に決める相談**をします。${subjectLine}

${situationLine}
${existingStrategy && existingStrategy.summary ? `\n【現在の戦略（見直し中）】\n${existingStrategy.summary}` : ""}

【対話の進め方】
- ${isOpening ? "まず現状を一言で踏まえ、最初の問いを1つ投げる（例: このブログで一番達成したいことは？誰に届けたい？）" : "相手の答えを受け止め、戦略が具体化するよう次の問いを1つする"}
- 質問は**1ターンに1つ**。宣伝・集客の観点（誰に/何を売りたいか、強み、差別化、投稿頻度）を、相手の言葉で引き出す
- 3〜5往復で戦略が固まる想定。十分に定まったら「戦略がまとまってきました。『戦略を確定』で保存できます」と促す
- タップで答えられる**選択肢を2〜4個**（各8〜16字）用意する

【これまでの対話】
${fmtHistory(history) || "（まだ無し）"}
${data.userMessage ? `\n【ユーザーの発言】\n${String(data.userMessage).trim()}` : ""}

【出力（JSONのみ）】
{"reply":"あなたの応答(3〜5文)","choices":["選択肢1","選択肢2","選択肢3"],"ready":false}
`.trim();
  try {
    const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 1024 })));
    return {
      success: true,
      reply: String(out.reply || "").trim(),
      choices: Array.isArray(out.choices) ? out.choices.slice(0, 4).map((c) => String(c).trim()).filter(Boolean) : [],
      ready: !!out.ready,
    };
  } catch (e) {
    return { success: false, reason: `turn failed: ${e.message}` };
  }
};
