// プロジェクトサイトの「プレゼンモード」ナレーション原稿生成。
//
// サイト（1ページ縦スクロールのsection配列）をクライアントに提案する際、
// AIがナレーションを読み上げながら自動スクロールする。その原稿（話し言葉）を
// セクションごとに生成する軽量エンドポイント。ツールなし・Haiku固定。
// クライアントはサイト内容が変わらない限りキャッシュを再利用する。

const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT =
  "あなたは建築・インテリアの設計事務所のプレゼンター。" +
  "クライアントに提案サイト（縦スクロールの1ページ）を見せながら口頭で説明するナレーション原稿を書く。\n" +
  "入力は各セクションの内容（タイトル・本文・仕様表・キーワード等の要約）。\n\n" +
  "# 出力（JSONのみ。コードフェンス・前置き・後置きは一切禁止）\n" +
  '{"narrations":[{"id":"<入力と同じid>","narration":"..."}]}\n\n' +
  "# ルール\n" +
  "- 入力の全セクションについて、入力と同じ順序・同じidで narration を返す。\n" +
  "- narration は話し言葉の「です・ます」調。1セクション2〜5文・200字以内。読み上げて自然な文にする（記号・箇条書き・URLを含めない）。\n" +
  "- 最初のセクションは提案全体の導入として、最後のセクションは締めの一言を添えて書く。\n" +
  "- 仕様表・箇条書きは全部読み上げず、要点を口頭説明に変換する（例:「延床面積は約120平米、木造2階建てを想定しています」）。\n" +
  "- 画像・ギャラリー中心のセクションは「こちらが〜のイメージです」のように短く紹介する。\n" +
  "- 入力に無い事実・数値を捏造しない。誇張しすぎない。\n";

exports.generateSiteNarration = async ({ projectName, sections }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not defined in the environment.");
  if (!Array.isArray(sections) || sections.length === 0) throw new Error("sections is empty");
  const client = new Anthropic({ apiKey });

  const user =
    `プロジェクト名: ${projectName || "(未設定)"}\n\n` +
    "# セクション一覧（表示順）\n" +
    sections.map((s, i) => `## [id=${s.id}] セクション${i + 1}\n${s.text || "(本文なし)"}`).join("\n\n");

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: user }],
  });

  const raw = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("generateSiteNarration: no JSON in model output");
  const parsed = JSON.parse(m[0]);
  const list = Array.isArray(parsed.narrations) ? parsed.narrations : [];

  // idで突き合わせ、欠けは空文字（クライアント側で本文読み上げにフォールバック）
  const byId = new Map(list.filter((n) => n && typeof n.id === "string" && typeof n.narration === "string")
    .map((n) => [n.id, n.narration.trim().slice(0, 600)]));
  const narrations = sections.map((s) => ({ id: s.id, narration: byId.get(s.id) || "" }));
  const filled = narrations.filter((n) => n.narration).length;
  if (filled === 0) throw new Error("generateSiteNarration: empty result");

  console.log(`[generateSiteNarration] sections=${sections.length} filled=${filled} ` +
    `in=${resp.usage?.input_tokens} out=${resp.usage?.output_tokens}`);
  return {
    narrations,
    model: MODEL,
    usage: {
      inputTokens: resp.usage?.input_tokens,
      outputTokens: resp.usage?.output_tokens,
      cacheReadTokens: resp.usage?.cache_read_input_tokens,
      cacheCreationTokens: resp.usage?.cache_creation_input_tokens,
    },
  };
};
