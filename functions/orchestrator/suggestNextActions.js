// SEKKEIYA Chat - 先回り提案（proactive suggestions）
//
// 新しいチャット/空のチャットを開いたとき、同プロジェクトの他チャットの
// ダイジェスト（クライアントが構築）から「先回りの挨拶1行 + 提案チップ3〜5個」を生成する。
// agentTurn と違いツール定義・巨大システムプロンプトを持たない軽量エンドポイント。
// モデルは Haiku 固定（低コスト・低レイテンシ）。

const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT =
  "あなたは SEKKEIYA（建築・インテリア設計OS）のアシスタント。" +
  "ユーザーが新しいチャットを開いた瞬間に表示する「先回り提案」を作る。\n" +
  "入力は、そのプロジェクトの他チャットの直近のやりとりのダイジェスト。\n\n" +
  "# 出力（JSONのみ。コードフェンス・前置き・後置きは一切禁止）\n" +
  '{"greeting":"...","chips":[{"label":"...","text":"..."}]}\n\n' +
  "# ルール\n" +
  "- greeting: 直近の文脈を踏まえた先回りの一言（60字以内・日本語・砕けすぎない）。" +
  "例:「前回はカフェの南面採光プランを検討していましたね。続きを進めますか？」\n" +
  "- chips: 3〜5個。label はチップ表示用の短い日本語（10字前後）。text はクリック時に入力欄へ入る具体的な依頼文（そのままAIに送れる文面）。\n" +
  "- 最初のチップは必ず「直近の議論の続き」を提案する。残りは進捗から見て自然な次の一手（詰め残し・次工程・別アプローチ）。\n" +
  "- ダイジェストに無い事実を捏造しない。固有名詞・数値はダイジェストにあるものだけ使う。\n" +
  "- ダイジェストが薄い/空に近い場合も、プロジェクト名から無理なく出せる汎用的な提案を返す（greeting は簡素に）。";

exports.suggestNextActions = async ({ projectName, digest }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not defined in the environment.");
  const client = new Anthropic({ apiKey });

  const user =
    `プロジェクト名: ${projectName || "(未設定)"}\n\n` +
    `# 他チャットのダイジェスト（新しい順）\n${digest || "(履歴なし)"}`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: user }],
  });

  const raw = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  // 念のためコードフェンスや前置きが混ざっても JSON 部分を拾う
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("suggestNextActions: no JSON in model output");
  const parsed = JSON.parse(m[0]);

  const greeting = typeof parsed.greeting === "string" ? parsed.greeting.slice(0, 120) : "";
  const chips = Array.isArray(parsed.chips)
    ? parsed.chips
        .filter((c) => c && typeof c.label === "string" && typeof c.text === "string")
        .slice(0, 5)
        .map((c) => ({ label: c.label.slice(0, 20), text: c.text.slice(0, 500) }))
    : [];
  if (!greeting || chips.length === 0) throw new Error("suggestNextActions: empty result");

  console.log(`[suggestNextActions] chips=${chips.length} in=${resp.usage?.input_tokens} out=${resp.usage?.output_tokens}`);
  return { greeting, chips };
};
