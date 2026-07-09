// 先回り提案（proactive suggestions）。
// 空のチャット（新規含む）を開いたとき、同プロジェクトの他チャットの直近のやりとりから
// 「先回りの挨拶1行 + 提案チップ」を生成して表示する（docs/10 の対話ファースト方針）。
//
// - ダイジェストはローカルの useAIChatStore（persist済み）から無料で構築
// - 生成は軽量CF suggestNextActions（Haiku固定・ツールなし）
// - プロジェクトの会話が進んでいない限り localStorage キャッシュを再利用（コストは進捗後の初回1回のみ）

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import { useAIChatStore } from '../../store/useAIChatStore';

export interface ProactiveChip { label: string; text: string }
export interface ProactiveSuggestions { greeting: string; chips: ProactiveChip[] }

const CACHE_PREFIX = 'sekkeiya-proactive:';
const MAX_SESSIONS = 5;      // ダイジェストに含める直近セッション数
const MAX_MSGS_PER_SESSION = 4;
const MSG_TRUNC = 160;

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

/**
 * プロジェクトの他チャットからダイジェストを構築する。
 * activityKey はプロジェクト内の最終メッセージ時刻+件数（＝キャッシュの鍵）。
 * 履歴が無ければ null（静的サジェストにフォールバック）。
 */
export function buildProjectChatDigest(
  projectId: string,
  excludeSessionId?: string,
): { digest: string; activityKey: string } | null {
  const { sessions, messages } = useAIChatStore.getState();
  const projSessions = sessions.filter((s) => s.projectId === projectId);
  const projSessionIds = new Set(projSessions.map((s) => s.id));
  const projMessages = messages.filter((m) => projSessionIds.has(m.sessionId));
  if (projMessages.length === 0) return null;

  const maxTs = Math.max(...projMessages.map((m) => m.timestamp));
  const activityKey = `${maxTs}:${projMessages.length}`;

  const withMsgs = projSessions
    .filter((s) => s.id !== excludeSessionId)
    .map((s) => ({ s, msgs: projMessages.filter((m) => m.sessionId === s.id) }))
    .filter((x) => x.msgs.length > 0)
    .sort((a, b) => b.s.updatedAt - a.s.updatedAt)
    .slice(0, MAX_SESSIONS);
  if (withMsgs.length === 0) return null;

  const digest = withMsgs
    .map(({ s, msgs }) => {
      const tail = msgs.slice(-MAX_MSGS_PER_SESSION)
        .map((m) => `- ${m.role === 'user' ? 'You' : 'AI'}: ${trunc(m.text.replace(/\s+/g, ' ').trim(), MSG_TRUNC)}`)
        .join('\n');
      const when = new Date(s.updatedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
      return `## ${s.title || '無題のチャット'}（${when}・全${msgs.length}件）\n${tail}`;
    })
    .join('\n\n');

  return { digest, activityKey };
}

interface CacheEntry { activityKey: string; greeting: string; chips: ProactiveChip[] }

function readCache(projectId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + projectId);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.activityKey === 'string' && typeof p?.greeting === 'string' && Array.isArray(p?.chips)) return p;
  } catch { /* 破損は無視 */ }
  return null;
}

function writeCache(projectId: string, entry: CacheEntry): void {
  try { localStorage.setItem(CACHE_PREFIX + projectId, JSON.stringify(entry)); } catch { /* noop */ }
}

// 同時オープン（ドック+コックピット等）での二重呼び出しを防ぐ
const inflight = new Map<string, Promise<{ data: ProactiveSuggestions; fresh: boolean } | null>>();

/**
 * 先回り提案を取得する。キャッシュが有効なら即時（fresh=false）、
 * 会話が進んでいればCFで生成（fresh=true）。履歴なし・失敗時は null。
 */
export function getProactiveSuggestions(
  projectId: string,
  projectName: string,
  excludeSessionId?: string,
): Promise<{ data: ProactiveSuggestions; fresh: boolean } | null> {
  const built = buildProjectChatDigest(projectId, excludeSessionId);
  if (!built) return Promise.resolve(null);

  const cached = readCache(projectId);
  if (cached && cached.activityKey === built.activityKey) {
    return Promise.resolve({ data: { greeting: cached.greeting, chips: cached.chips }, fresh: false });
  }

  const flightKey = `${projectId}:${built.activityKey}`;
  const existing = inflight.get(flightKey);
  if (existing) return existing;

  const p = (async () => {
    try {
      const fn = httpsCallable(functions, 'suggestNextActions');
      const res = await fn({ projectName, digest: built.digest });
      const result = (res.data as any)?.result as ProactiveSuggestions | undefined;
      if (!result?.greeting || !Array.isArray(result.chips) || result.chips.length === 0) return null;
      writeCache(projectId, { activityKey: built.activityKey, greeting: result.greeting, chips: result.chips });
      return { data: result, fresh: true };
    } catch (e) {
      console.warn('[proactiveSuggestions] 生成に失敗（静的候補にフォールバック）', e);
      return null;
    } finally {
      inflight.delete(flightKey);
    }
  })();
  inflight.set(flightKey, p);
  return p;
}
