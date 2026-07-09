/**
 * aiMemory.js — AIメモリー（長期記憶）のサーバー側ヘルパー。
 * 仕様: desktop リポ docs/21_user_memory_spec.md（Phase A）。
 *
 * 2スコープ:
 *  - user:    users/{uid}/aiMemory    … 人物像（opinion/preference/profile/feedback）
 *  - project: projects/{pid}/aiMemory … 案件の記憶（decision/constraint/context/direction）
 * 各コレクションの予約ID `_digest` に「AIに毎回注入する行配列」を保持する。
 *
 * 使い方:
 *  - 注入: getDigestLines() → buildMemorySection() をシステムプロンプト末尾へ
 *  - 抽出: extractAndSaveUserMemories()（S.Blog 議論の synthesize 時など対話の節目で呼ぶ）
 * Admin SDK 経由なので Firestore ルールには依存しない。
 */
const admin = require("firebase-admin");

const TYPE_LABELS = {
  opinion: "考え方", preference: "好み", profile: "プロフィール", feedback: "AIへの指示",
  decision: "決定", constraint: "制約", context: "経緯", direction: "方針",
};
const USER_TYPES = ["opinion", "preference", "profile", "feedback"];
const PROJECT_TYPES = ["decision", "constraint", "context", "direction"];
const DIGEST_LIMIT = { user: { lines: 40, chars: 1200 }, project: { lines: 30, chars: 1000 } };
const MEMORY_TEXT_MAX = 120;
const ACTIVE_LIMIT = { user: 60, project: 40 };

const colPath = (scope, ownerId) =>
  scope === "user" ? `users/${ownerId}/aiMemory` : `projects/${ownerId}/aiMemory`;

const toMillis = (v) => {
  try { return typeof v?.toMillis === "function" ? v.toMillis() : Number(v) || 0; } catch { return 0; }
};

/** ダイジェスト（AIに注入する行配列）を読む。無ければ []（＝注入なし）。 */
async function getDigestLines(db, scope, ownerId) {
  if (!ownerId) return [];
  try {
    const snap = await db.doc(`${colPath(scope, ownerId)}/_digest`).get();
    const d = snap.exists ? snap.data() : null;
    return Array.isArray(d?.lines) ? d.lines.map((l) => String(l)).slice(0, DIGEST_LIMIT[scope].lines) : [];
  } catch (e) {
    console.warn(`[aiMemory] digest read failed (${scope}/${ownerId}): ${e.message}`);
    return [];
  }
}

/**
 * システムプロンプト末尾へ足すメモリーセクションを構築。両方空なら空文字（トークンゼロ）。
 * 優先順位ルール（今の指示 > project > user）も同梱する。
 */
function buildMemorySection(userLines, projectLines) {
  const u = Array.isArray(userLines) ? userLines : [];
  const p = Array.isArray(projectLines) ? projectLines : [];
  if (!u.length && !p.length) return "";
  let s = "\n";
  if (u.length) {
    s += `\n【このユーザーについての記憶（本人の過去の対話から抽出。応答の最適化に使う）】\n${u.map((l) => `- ${l}`).join("\n")}\n`;
  }
  if (p.length) {
    s += `\n【このプロジェクトの記憶（決定事項・制約・経緯）】\n${p.map((l) => `- ${l}`).join("\n")}\n`;
  }
  s += "\n※記憶の優先順位: 今この場の指示 > プロジェクトの記憶 > ユーザーの記憶（矛盾する場合）。" +
       "記憶を使うときも、その存在をわざわざ説明しない。";
  return s;
}

/** active メモリーからダイジェストを再生成して保存（クライアント aiMemoryApi.ts と同じ規約）。 */
async function regenerateDigest(db, scope, ownerId) {
  const snap = await db.collection(colPath(scope, ownerId)).get();
  const order = scope === "user" ? USER_TYPES : PROJECT_TYPES;
  const active = snap.docs
    .filter((d) => d.id !== "_digest")
    .map((d) => d.data())
    .filter((m) => m.status !== "archived" && String(m.text || "").trim())
    .sort((a, b) => {
      const ta = order.indexOf(a.type); const tb = order.indexOf(b.type);
      if (ta !== tb) return ta - tb;
      return toMillis(b.updatedAt) - toMillis(a.updatedAt);
    });
  const limit = DIGEST_LIMIT[scope];
  const lines = [];
  let chars = 0;
  for (const m of active) {
    if (lines.length >= limit.lines) break;
    const line = `（${TYPE_LABELS[m.type] || m.type}）${String(m.text).trim()}`;
    if (chars + line.length > limit.chars) break;
    lines.push(line);
    chars += line.length;
  }
  await db.doc(`${colPath(scope, ownerId)}/_digest`).set({
    lines,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return lines;
}

/**
 * 対話ログから「ユーザーの持続的な考え方・好み」を抽出して保存する（0〜2件・確信がなければ0件）。
 * S.Blog 議論の synthesize 時に呼ぶ想定。失敗は握りつぶして []（本処理を巻き込まない）。
 * @returns 保存したメモリー [{text,type,topics}]（クライアントの「保存しました」チップ用）
 */
async function extractAndSaveUserMemories(db, uid, { history, sourceKind, refId, callLLM }) {
  try {
    const userTurns = (Array.isArray(history) ? history : [])
      .filter((m) => m.role === "user" && String(m.text || "").trim());
    // ユーザーが実質話していない議論からは抽出しない（ノイズ防止）
    if (!uid || userTurns.length < 2) return [];

    const existing = await getDigestLines(db, "user", uid);
    const historyText = (Array.isArray(history) ? history : [])
      .slice(-24)
      .map((m) => `${m.role === "user" ? "著者" : "AI"}: ${String(m.text || "").slice(0, 400)}`)
      .join("\n");

    const prompt = `
以下は、ブログ著者（ユーザー）とAIの議論ログです。
この対話から「今後の**別の話題の対話でも役立つ**、ユーザーの持続的な考え方・好み・立場」を抽出してください。

【既存のメモリー（これと重複する内容は出さない）】
${existing.length ? existing.map((l) => `- ${l}`).join("\n") : "（まだ無い）"}

【議論ログ】
${historyText}

【条件】
- 0〜2件。確信が持てなければ0件でよい（無理に作らない）。**著者本人の発言**からのみ抽出する
- 各1〜2文・${MEMORY_TEXT_MAX}字以内。「別のプロジェクト・別の話題でも真」といえる持続的な事実だけ
- 一時的なタスク・この記事の内容そのもの・AI側の意見は出さない
- type: opinion(考え方・立場) / preference(好み・スタイル) / profile(属性・文脈) / feedback(AIへの恒久的な要望)
- topics: その事実に関わる概念タグ1〜3個（例:「商業空間」「素材」「文体」）

【出力（JSONのみ）】
{"memories":[{"text":"...","type":"opinion","topics":["タグ1"]}]}
`.trim();

    const cleanJson = (raw) =>
      String(raw).replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const out = JSON.parse(cleanJson(await callLLM(prompt, {
      provider: "gemini", model: "gemini-2.5-flash", maxTokens: 1024,
    })));

    const memories = (Array.isArray(out.memories) ? out.memories : [])
      .map((m) => ({
        text: String(m.text || "").trim().slice(0, MEMORY_TEXT_MAX),
        type: USER_TYPES.includes(m.type) ? m.type : "opinion",
        topics: (Array.isArray(m.topics) ? m.topics : [])
          .map((t) => String(t).trim().slice(0, 20)).filter(Boolean).slice(0, 3),
      }))
      .filter((m) => m.text)
      .slice(0, 2);
    if (!memories.length) return [];

    // 上限チェック（超過時は保存しない。整理は Phase D のコンソリデーションで）
    const col = db.collection(colPath("user", uid));
    const countSnap = await col.get();
    const activeCount = countSnap.docs.filter((d) => d.id !== "_digest" && d.data().status !== "archived").length;
    if (activeCount + memories.length > ACTIVE_LIMIT.user) {
      console.log(`[aiMemory] active limit reached (${activeCount}) — skip saving`);
      return [];
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await Promise.all(memories.map((m) => col.add({
      text: m.text,
      type: m.type,
      topics: m.topics,
      source: { kind: sourceKind || "chat", ...(refId ? { refId: String(refId).slice(0, 200) } : {}) },
      status: "active",
      createdAt: now,
      updatedAt: now,
    })));
    await regenerateDigest(db, "user", uid);
    console.log(`[aiMemory] saved ${memories.length} user memories for ${uid}`);
    return memories;
  } catch (e) {
    console.warn(`[aiMemory] extract failed: ${e.message}`);
    return [];
  }
}

module.exports = { getDigestLines, buildMemorySection, regenerateDigest, extractAndSaveUserMemories };
