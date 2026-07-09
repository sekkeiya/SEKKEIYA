/**
 * knowledgeRag
 * ------------------------------------------------------------------
 * SEKKEIYA Chat 用の RAG ヘルパー。アクティブAIに接続されたナレッジ
 * (equippedKnowledge) からユーザーの発話に関連するチャンクを検索し、
 * システムプロンプトへ注入する文字列と、表示用の出典リストを返す。
 *
 * バックエンド: Cloud Function `retrieveKnowledge`(デプロイ済み)。
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import { useAiProfileStore } from '../../../store/useAiProfileStore';

export interface KnowledgeCitation {
  id: string;
  title: string;
}

export async function retrieveConnectedKnowledge(
  query: string,
): Promise<{ promptSection: string; citations: KnowledgeCitation[] }> {
  const empty = { promptSection: '', citations: [] as KnowledgeCitation[] };
  try {
    if (!query || query.trim().length < 2) return empty;

    const store = useAiProfileStore.getState();
    const active = store.aiProfiles.find((p) => p.status === 'Active');
    // 接続ナレッジ優先。1件も接続されていなければ、取り込み済み全ナレッジを対象にする。
    const connectedIds = (active?.equippedKnowledge || []).filter(Boolean);
    const readyIds = store.knowledgeSources.filter((k) => k.status === 'ready').map((k) => k.id);
    const sourceIds = connectedIds.length > 0 ? connectedIds.filter((id) => readyIds.includes(id)) : readyIds;
    if (sourceIds.length === 0) return empty;

    const fn = httpsCallable(functions, 'retrieveKnowledge', { timeout: 20000 });
    const res: any = await fn({ query, topK: 4, sourceIds });
    const results: { text: string; sourceId: string; score: number }[] = res?.data?.results || [];
    // 弱い一致を除外（無関係な注入を避ける）
    const strong = results.filter((r) => typeof r.score === 'number' && r.score > 0.4);
    if (strong.length === 0) return empty;

    const titleById = new Map(store.knowledgeSources.map((k) => [k.id, k.title]));
    const citations: KnowledgeCitation[] = [];
    const seen = new Set<string>();
    for (const r of strong) {
      if (!seen.has(r.sourceId)) {
        seen.add(r.sourceId);
        citations.push({ id: r.sourceId, title: titleById.get(r.sourceId) || '資料' });
      }
    }

    const body = strong
      .map((r) => `【${titleById.get(r.sourceId) || '資料'}】\n${r.text}`)
      .join('\n\n');
    const promptSection =
      `\n\n[接続ナレッジ (RAG)]\n` +
      `以下はユーザーが接続した資料からの関連抜粋です。回答に関係する場合は根拠として使用し、` +
      `使用した場合は回答の最後に「出典: 資料名」を明記してください。資料に無い内容を断定しないでください。\n` +
      `---\n${body}\n---`;

    return { promptSection, citations };
  } catch (e) {
    console.warn('[knowledgeRag] retrieve failed:', e);
    return empty;
  }
}
