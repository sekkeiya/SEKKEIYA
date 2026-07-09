/**
 * knowledgeSearch — エージェント型RAG（ルーティング）。
 * SEKKEIYA Chat の `search_knowledge` ツールから呼ぶ。S.Library の「外付け脳(RAG)」を
 * カテゴリで絞って検索し、回答の根拠になる文章スニペットを返す。
 *
 * カテゴリは knowledgeSource には無いため、S.Library の LibraryEntry.category と
 * 突き合わせて該当ソースを解決する（title / sourceFile 一致）。
 * バックエンド: Cloud Function `retrieveKnowledge`（デプロイ済み）。
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDskStore } from '../../dsk/store/useDskStore';
import { ragSourceKey } from '../../dsk/lib/ragIngest';

export interface KnowledgeHit {
  title: string;
  text: string;
  score: number;
  category?: string;
}

export interface KnowledgeSearchResult {
  ok: boolean;
  count: number;
  category: string | null;
  scope: 'category' | 'all';
  hits: KnowledgeHit[];
  availableCategories?: string[];
  note?: string;
}

/** 取り込み済みナレッジが読み込まれていなければ読み込む。 */
async function ensureLoaded(): Promise<void> {
  const store = useAiProfileStore.getState();
  if (store.knowledgeSources.length > 0) return;
  const uid = (useAuthStore.getState().currentUser as any)?.uid;
  if (uid) {
    try { await store.loadKnowledgeSources(uid); } catch { /* noop */ }
  }
}

/**
 * 外付け脳(RAG)を検索する。category 指定時は該当カテゴリのソースに絞り、
 * 該当が無ければ全体にフォールバックする。
 */
export async function searchKnowledge(
  query: string,
  category?: string | null,
  topK = 6,
): Promise<KnowledgeSearchResult> {
  await ensureLoaded();

  const sources = useAiProfileStore.getState().knowledgeSources.filter((k) => k.status === 'ready');
  if (sources.length === 0) {
    return { ok: true, count: 0, category: category ?? null, scope: 'all', hits: [], note: '外付け脳に取り込み済みの知識がありません。S.Libraryで「RAGソースを選択」してください。' };
  }

  // S.Library エントリ → カテゴリ解決のための索引。
  const entries = useDskStore.getState().entries;
  const catBySourceId = new Map<string, string>();
  for (const s of sources) {
    const match = entries.find((e) => (s.sourceFile && s.sourceFile === ragSourceKey(e)) || s.title === e.title);
    if (match) catBySourceId.set(s.id, match.category || 'その他');
  }
  const availableCategories = Array.from(new Set(Array.from(catBySourceId.values()))).sort();

  // カテゴリ絞り込み（指定があり、該当ソースが1件以上あるときのみ）。
  let scope: 'category' | 'all' = 'all';
  let targetIds = sources.map((s) => s.id);
  const wantCat = (category || '').trim();
  if (wantCat && wantCat !== 'all') {
    const inCat = sources.filter((s) => catBySourceId.get(s.id) === wantCat).map((s) => s.id);
    if (inCat.length > 0) { targetIds = inCat; scope = 'category'; }
  }

  const fn = httpsCallable(functions, 'retrieveKnowledge', { timeout: 20000 });
  const res: any = await fn({ query, topK, sourceIds: targetIds });
  const raw: { text: string; sourceId: string; score: number }[] = res?.data?.results || [];
  const titleById = new Map(useAiProfileStore.getState().knowledgeSources.map((k) => [k.id, k.title]));

  const hits: KnowledgeHit[] = raw
    .filter((r) => typeof r.score === 'number' && r.score > 0.35)
    .map((r) => ({
      title: titleById.get(r.sourceId) || '資料',
      text: r.text,
      score: r.score,
      category: catBySourceId.get(r.sourceId),
    }));

  return {
    ok: true,
    count: hits.length,
    category: wantCat && wantCat !== 'all' ? wantCat : null,
    scope,
    hits,
    availableCategories,
    note: hits.length === 0 ? '関連する記述は見つかりませんでした。' : undefined,
  };
}
