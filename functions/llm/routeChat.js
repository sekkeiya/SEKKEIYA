/**
 * llm/routeChat.js — メインチャットの Haiku↔Sonnet 自動振り分け（Phase 1）。
 *
 * agentTurn はクライアント主導のステートレスなツールループ。ここでは各リクエストを
 * 「軽い会話 = Haiku / 実務・重要 = Sonnet」に振り分ける純関数を提供する。
 * 追加の LLM 呼び出しはせず、サーバー内のヒューリスティック（無料・決定的）で判定する。
 *
 * 方針（バランス）:
 *   - クライアントが明示的にモデル指定 → 尊重（自動判定しない）
 *   - ツールが絡む（履歴に tool_use / tool 結果がある = 作業実行中）→ Sonnet（品質重視）
 *   - 重要タスク語を含む / 画像添付 / 長文入力 → Sonnet
 *   - それ以外（挨拶・短い Q&A・雑談）→ Haiku
 *
 * しきい値・キーワード・モデルIDは config/aiModels.chatRouting で管理者が調整可能。
 * 未設定ならコード既定にフォールバック（＝設定だけで効き具合を変えられる）。
 */

// 既定のルーティング設定。config/aiModels.chatRouting で上書きできる。
const DEFAULT_ROUTING = {
  // ⏸ 一旦停止（2026-07-09）: 前置き32Kが大きい現状では、軽い会話を Haiku に回すと
  // Haiku 側の冷キャッシュに前置きをフル書込み（読取0%）してしまい、温まった Sonnet で
  // 読む(0.1×)より割高になるため（キャッシュはモデル別）。前置き削減後に再有効化する。
  // 再開は config/aiModels.chatRouting.enabled=true でも可（再デプロイ不要）。
  enabled: false,
  light: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  heavy: { provider: "anthropic", model: "claude-sonnet-4-6" },
  escalateOnTools: true, // ツールが絡むターンは Sonnet で実行
  escalateOnImage: true, // 画像添付は視覚読解のため Sonnet
  longInputChars: 280,   // これを超える長文入力は Sonnet
  heavyKeywords: [
    // サイト/提案書/スライド
    "提案書", "企画書", "プレゼン", "スライド", "サイト", "ページ", "セクション",
    // レイアウト/家具/3D
    "レイアウト", "配置", "家具", "間取り", "図面", "ダイアグラム", "3d", "3D", "モデル生成",
    // ブログ/リサーチ
    "記事", "ブログ", "リサーチ", "調査", "下書き", "書き直",
    // 整理・計画・実務
    "整理", "体裁", "まとめて", "計画", "方針", "コンセプト", "選定",
    // スケジュール/タスク
    "スケジュール", "タスク", "予定", "カレンダー",
    // 生成・編集の意図
    "生成", "作って", "作成", "編集",
  ],
};

/** 最新の user メッセージ（＝現在のターンの発話）を返す。無ければ null。 */
function latestUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i] && messages[i].role === "user") return messages[i];
  }
  return null;
}

/** user メッセージ（content: string | ブロック配列）からテキストを抽出する。 */
function userText(m) {
  if (!m) return "";
  const c = m.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .filter((b) => b && b.type !== "image")
      .map((b) => (b && typeof b.text === "string" ? b.text : ""))
      .join(" ");
  }
  return "";
}

/** user メッセージに画像ブロックが含まれるか。 */
function hasImage(m) {
  return !!(m && Array.isArray(m.content) && m.content.some((b) => b && b.type === "image"));
}

/** 履歴にツールのやり取り（assistant.toolCalls もしくは role:'tool'）があるか。 */
function hasToolActivity(messages) {
  return messages.some(
    (m) =>
      (m && m.role === "tool") ||
      (m && m.role === "assistant" && Array.isArray(m.toolCalls) && m.toolCalls.length > 0)
  );
}

/**
 * このチャットリクエストに使うモデルを決める。
 * @param {object} p
 * @param {Array} p.messages       agentTurn への中立フォーマットのメッセージ配列
 * @param {string|null} [p.clientModel]  クライアントが明示指定したモデル（あれば尊重）
 * @param {object} [p.routing]     config/aiModels.chatRouting をマージ済みの設定
 * @returns {{ provider:string, model:string, tier:string, reason:string }}
 */
function pickChatModel({ messages, clientModel = null, routing } = {}) {
  const cfg = { ...DEFAULT_ROUTING, ...(routing || {}) };
  const heavy = (reason) => ({ ...cfg.heavy, tier: "heavy", reason });
  const light = (reason) => ({ ...cfg.light, tier: "light", reason });

  // 明示指定は尊重（自動判定しない）。'auto'（おまかせ）・空は振り分け対象。
  if (clientModel && clientModel !== "auto") {
    return { provider: cfg.heavy.provider, model: clientModel, tier: "explicit", reason: "client-specified" };
  }
  // 自動振り分け無効化時は常に heavy（従来どおり Sonnet）
  if (cfg.enabled === false) return heavy("routing-disabled");

  const msgs = Array.isArray(messages) ? messages : [];

  // ツール実行中のターンは品質重視で Sonnet（途中でのモデルブレを避ける）
  if (cfg.escalateOnTools && hasToolActivity(msgs)) return heavy("tool-loop");

  const last = latestUserMessage(msgs);
  if (cfg.escalateOnImage && hasImage(last)) return heavy("image");

  const text = userText(last);
  if (text.length > (cfg.longInputChars || 280)) return heavy("long-input");

  const kw = (cfg.heavyKeywords || []).find((k) => k && text.includes(k));
  if (kw) return heavy(`kw:${kw}`);

  return light("chat");
}

/**
 * config/aiModels.chatRouting を読み、既定にマージして返す。
 * 読み取り失敗・未設定なら既定をそのまま返す（チャット本体を巻き込まない）。
 */
async function loadChatRouting(db) {
  try {
    if (!db) return { ...DEFAULT_ROUTING };
    const snap = await db.doc("config/aiModels").get();
    const cfg = snap.exists ? snap.data() || {} : {};
    return { ...DEFAULT_ROUTING, ...(cfg.chatRouting || {}) };
  } catch (e) {
    console.warn("[loadChatRouting] fallback to defaults:", e && e.message);
    return { ...DEFAULT_ROUTING };
  }
}

module.exports = { pickChatModel, loadChatRouting, DEFAULT_ROUTING };
