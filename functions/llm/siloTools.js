/**
 * llm/siloTools.js — 前置き削減②B（Phase B）: サーバー側の文脈別ツールsilo判定。
 *
 * agentTurn は 65 ツールを毎回送っており、その定義が前置き(キャッシュ対象)の約8割を占める。
 * この会話で一度も話題にしていないドメインのツール群(silo)を外し、前置きを小さくする。
 * 判定は追加の LLM 呼び出しなし・サーバー内のヒューリスティック（無料・決定的）。
 *
 * 安全設計（モデルルーター routeChat.js と同じ「ループ安全・包含寄り」）:
 *   - 現ターンがツール実行継続中（最後のメッセージが role:'tool'）→ 除外しない（フロー途中で欠落させない）
 *   - 新規ユーザーターン → 会話履歴のユーザー発話全体に silo のドメイン語が一度も出ていない場合のみ除外
 *   - コア/site編集/schedule/3d・image は silo 化しない（曖昧な依頼が多く常時必要）＝呼び出し側の SILOS に定義しない
 *
 * excludeSilos の値（'research' 等）は agentTurn.js の SILOS マップのキーと一致させること。
 * keywords・enabled は config/aiModels.toolSilos で管理者が調整可能（未設定は既定）。
 */

// silo キー → その領域を示すキーワード（小文字化して部分一致）。
// 包含寄り: どれか1語でも会話に出ていれば、その silo のツールは残す（外さない）。
//
// ⚠️ research（リサーチボード）は自動silo対象から除外＝research_board_* は常時送信する。
//   理由: ボード作業は「まとめる/整理/関連/図」等、言い方が多様でキーワード検出が不安定。
//   B1（会話内容のみで判定）ではタブ文脈が分からず誤除外→ボード編集ツール欠落の恐れがある。
//   タブスコープを送る B2 実装後に、確実な形で research の silo 化を再検討する。
//   （config/aiModels.toolSilos.keywords.research を設定すれば手動で再有効化も可能）
const DEFAULT_SILO_KEYWORDS = {
  slide:        ["スライド", "プレゼン", "presentation", "s.slide", "slide"],
  layout:       ["レイアウト", "配置", "家具", "間取り", "プラン", "furniture", "layout", "s.layout", "平面", "什器", "ソファ", "デスク", "テーブル"],
  blog:         ["ブログ", "記事", "blog", "s.blog", "コラム"],
  drive:        ["ドライブ", "drive", "ファイル", "アセット", "資料", "s.drive"],
  library:      ["ライブラリ", "library", "s.library", "pdf", "蔵書", "ナレッジ", "知識"],
  local_assets: ["ローカル", "local", "素材フォルダ", "pcの", "手元の"],
};

/** messages 内の全 user メッセージのテキストを連結して小文字で返す。 */
function allUserText(messages) {
  const parts = [];
  for (const m of messages) {
    if (!m || m.role !== "user") continue;
    const c = m.content;
    if (typeof c === "string") parts.push(c);
    else if (Array.isArray(c)) {
      for (const b of c) if (b && typeof b.text === "string") parts.push(b.text);
    }
  }
  return parts.join(" \n ").toLowerCase();
}

/** 現ターンがツール実行の継続中か（最後のメッセージが tool 結果）。 */
function isMidToolLoop(messages) {
  const last = messages[messages.length - 1];
  return !!(last && last.role === "tool");
}

/**
 * この会話で除外してよい silo キーの配列を返す。
 * @param {object} p
 * @param {Array} p.messages
 * @param {object} [p.config]  { enabled?, keywords? } を config からマージ済み
 * @returns {string[]} 除外する silo キー（agentTurn の SILOS キー）
 */
function computeExcludedSilos({ messages, config } = {}) {
  const cfg = config || {};
  if (cfg.enabled === false) return [];
  const msgs = Array.isArray(messages) ? messages : [];
  if (msgs.length === 0) return [];
  // フロー途中は欠落させない（安全最優先）
  if (isMidToolLoop(msgs)) return [];

  const keywords = { ...DEFAULT_SILO_KEYWORDS, ...(cfg.keywords || {}) };
  const text = allUserText(msgs);
  const exclude = [];
  for (const [silo, words] of Object.entries(keywords)) {
    const mentioned = (words || []).some((w) => w && text.includes(String(w).toLowerCase()));
    if (!mentioned) exclude.push(silo);
  }
  return exclude;
}

/**
 * config/aiModels.toolSilos を読み、既定とマージして返す。
 * 読み取り失敗・未設定なら既定（{enabled:true}）。
 */
async function loadSiloConfig(db) {
  const fallback = { enabled: true };
  try {
    if (!db) return fallback;
    const snap = await db.doc("config/aiModels").get();
    const cfg = snap.exists ? snap.data() || {} : {};
    return { ...fallback, ...(cfg.toolSilos || {}) };
  } catch (e) {
    console.warn("[loadSiloConfig] fallback to defaults:", e && e.message);
    return fallback;
  }
}

module.exports = { computeExcludedSilos, loadSiloConfig, DEFAULT_SILO_KEYWORDS };
