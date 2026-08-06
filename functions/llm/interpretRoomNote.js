// S.Layout 家具選定: 部屋メモの AI 解釈。
//
// ユーザーが部屋に書いた自由記述メモ（例:「小さい子がいるので角の丸い家具。北欧っぽく」）から、
// 家具選定に使えるスタイル・条件タグを抽出する軽量エンドポイント。
// ツールなし・Haiku固定。失敗してもレイアウト編集自体を止めないよう、クライアント側は
// この呼び出しの失敗を握りつぶす前提（このモジュールはサーバー側の解釈ロジックのみ担当）。

const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT =
  "あなたはインテリアの要望をタグに変換する変換器です。次のメモから、家具選定に使える" +
  "スタイル・条件タグを最大6個、英小文字スネークケースの JSON 配列で返してください。\n" +
  '例: 入力「小さい子がいるので角の丸い家具。北欧っぽく」→ {"styleTags":["scandinavian","kids_safe","rounded_edges"]}\n' +
  "JSON 以外は出力しないこと。";

/**
 * 部屋メモをスタイルタグに解釈する。
 * @param {object} p
 * @param {string} p.note メモ本文（呼び出し側で500字に切り詰め済み想定）
 * @returns {Promise<{ styleTags: string[], model: string, usage: object }>}
 */
exports.interpretRoomNote = async ({ note }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not defined in the environment.");
  const client = new Anthropic({ apiKey });

  const safeNote = String(note || "").slice(0, 500);

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `メモ: ${safeNote}` }],
  });

  const raw = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

  // モデルが JSON 以外を混ぜても壊れないよう、非JSONは正規表現で拾い、それも失敗したら空配列を返す
  // （このエンドポイントの失敗はクライアント側で握りつぶされる前提のため、ここでは例外を投げず
  //  常に成功レスポンスの形で返す＝呼び出し側の分岐を単純に保つ）。
  let styleTags = [];
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed.styleTags)) {
        styleTags = parsed.styleTags
          .filter((t) => typeof t === "string" && t.trim())
          .map((t) => t.trim().toLowerCase())
          .slice(0, 6);
      }
    }
  } catch (e) {
    console.warn("[interpretRoomNote] JSON parse failed, returning empty tags:", e.message);
    styleTags = [];
  }

  console.log(`[interpretRoomNote] tags=${styleTags.length} in=${resp.usage?.input_tokens} out=${resp.usage?.output_tokens}`);
  return {
    styleTags,
    model: MODEL,
    usage: {
      inputTokens: resp.usage?.input_tokens,
      outputTokens: resp.usage?.output_tokens,
      cacheReadTokens: resp.usage?.cache_read_input_tokens,
      cacheCreationTokens: resp.usage?.cache_creation_input_tokens,
    },
  };
};
