// 反応ログ（Reaction Log）— 学習サイクル Phase 1。
// ユーザーの暗黙の反応（表示・クリック・採用・書き直し…）を
// users/{uid}/reactionLogs へ追記専用で記録する。
//
// 設計方針（docs: 反応ログ設計書 / firestore.rules の reactionLogs 参照）:
//   - 1ドキュメント = 1イベント。クライアントは create のみ（update/delete はルールで禁止）
//   - impression（表示）も記録する — CTR の分母。「無視」は impression − clicked の差分で導出
//   - 生の会話文・本文は保存しない（PII方針）。label は ≤80字の表示文言のみ
//   - ログ失敗は UX を壊さない（fire-and-forget・握りつぶす）
//   - 語彙は usageLogs と揃える: surface = usageLogs.feature、day/month = JST パーティション

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/client';
import { isTauri } from '../platform';

/** action の固定語彙。自由文字列にしない（集計の分岐とタイポ欠測防止） */
export type ReactionAction =
  | 'impression'   // 表示された（分母）
  | 'clicked'      // クリックされた
  | 'accepted'     // 提案を採用した
  | 'rejected'     // 提案を却下した
  | 'edited'       // 生成物を編集した
  | 'published'    // 生成物を公開した
  | 'rewritten'    // 書き直させた
  | 'regenerated'  // 再生成させた
  | 'copied'       // コピーした
  | 'thumbUp'      // 明示の高評価
  | 'thumbDown'    // 明示の低評価
  | 'dwell';       // 滞在（value: ms）

export interface ReactionEvent {
  /** どの機能面か。usageLogs.feature と同じ語彙（'chat-suggest' | 'chat' | 'blog-draft' | ...） */
  surface: string;
  action: ReactionAction;
  /** 'suggestChip' | 'chatMessage' | 'article' | 'diagram' ... */
  targetType: string;
  targetId?: string;
  /** 表示セットの束ねID。impression と clicked を突合する鍵（newReactionSetId() で採番） */
  setId?: string;
  /** 対象を生成したモデル（ルーター学習の教師信号） */
  model?: string;
  /** 表示順（0始まり）。位置バイアス補正に使う */
  rank?: number;
  /** 表示した文言。≤80字・PIIなし（超過分は切り詰める） */
  label?: string;
  threadId?: string;
  projectId?: string;
  /** 粗い非PII特徴のみ（inputLen / hasImage / intent / fresh / chipCount 等）。生プロンプト禁止 */
  features?: Record<string, string | number | boolean>;
  /** 数値ペイロード（dwellMs / 評価点） */
  value?: number;
  sessionId?: string;
}

/** JST の 'YYYY-MM-DD'（usageLogs/usageDaily と同じパーティション） */
const jstDay = (d = new Date()): string =>
  new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

/** 表示セットの束ねIDを採番する（表示1回につき1つ生成して impression / clicked で共有） */
export const newReactionSetId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * 反応イベントを1件記録する。fire-and-forget（await 不要・失敗しても UI に影響しない）。
 * 未ログイン時は何もしない。匿名ユーザーは isAnonymous=true で記録される
 * （Google リンク後も uid は不変なのでログは継続する）。
 */
export function logReaction(ev: ReactionEvent): void {
  const u = auth.currentUser;
  if (!u) return;
  const day = jstDay();
  const payload: Record<string, unknown> = {
    schemaVersion: 1,
    surface: ev.surface.slice(0, 40),
    action: ev.action,
    targetType: ev.targetType,
    targetId: ev.targetId,
    setId: ev.setId,
    model: ev.model,
    rank: ev.rank,
    label: ev.label?.slice(0, 80),
    threadId: ev.threadId,
    projectId: ev.projectId,
    features: ev.features,
    value: ev.value,
    sessionId: ev.sessionId,
    isAnonymous: !!u.isAnonymous,
    platform: isTauri() ? 'desktop' : 'web',
    day,
    month: day.slice(0, 7),
    createdAt: serverTimestamp(),
  };
  // undefined のフィールドは落とす（iOS 経路の Firestore は ignoreUndefinedProperties なし）
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  addDoc(collection(db, 'users', u.uid, 'reactionLogs'), payload).catch(() => {
    /* ログ失敗は UX を壊さない */
  });
}
