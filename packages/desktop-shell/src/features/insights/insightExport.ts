// 記事インサイトの書き出し（Phase D = 循環を閉じる）。
//  ① importInsightToBoard: 論証グラフ断片を選んだプロジェクトの Research & Memo へ流し込む。
//     取り込み時にカードIDは再採番されるため、旧ID→新ID を突き合わせてエッジを張り直す。
//  ② ingestInsightToRag: 分析結果を外付け脳（RAG）へ取り込み、Chat の判断根拠に接続する。

import {
  addBoardItems, addBoardEdges,
  type NewBoardItem, type NewBoardEdge,
} from '../projects/chat/researchBoardBridge';
import { useAiProfileStore } from '../../store/useAiProfileStore';
import type { ArticleInsight } from './articleInsightTypes';

export interface ImportToBoardResult {
  items: number;
  edges: number;
  skippedEdges: number;
}

/**
 * insight.graph（items/edges）を projectId の Research & Memo へ取り込む。
 * 座標は渡さず（x/y 省略）ボード側の自動配置に任せる — 既存カードへの重なりを避け、
 * 役割（role）はカードに残るので、ボードの「論証の地図」表示で筋道は再構成できる。
 */
export async function importInsightToBoard(
  projectId: string,
  insight: ArticleInsight,
): Promise<ImportToBoardResult> {
  const srcItems = insight.graph.items;
  const partials: NewBoardItem[] = srcItems.map((it) => ({
    kind: it.kind,
    role: it.role,
    text: it.text,
    url: it.url,
    color: it.color,
    refType: it.refType,
    refId: it.refId,
    refTitle: it.refTitle,
    refMeta: it.refMeta,
  }));

  // 前提: S.Blog から呼ぶときは対象プロジェクトの ResearchCanvas が未マウント（liveHost=null）で、
  // addBoardItems/addBoardEdges はどちらも Firestore を await する直列パスを通る。ボードが別窓で
  // 開いている（liveHost あり）と host.getItems() が state 反映待ちで直後のエッジが skip されうるが、
  // デスクトップの単一ワークスペース遷移ではこのケースは起きない。
  const created = await addBoardItems(projectId, partials);
  // addBoardItems は入力順を保つ（partials.map）ので index で旧→新IDを対応づけられる。
  const idMap = new Map<string, string>();
  srcItems.forEach((it, i) => { if (created[i]) idMap.set(it.id, created[i].id); });

  const edgePartials: NewBoardEdge[] = [];
  for (const e of insight.graph.edges) {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    if (!source || !target) continue;
    edgePartials.push({ source, target, relation: e.relation, label: e.label });
  }
  const edgeRes = edgePartials.length ? await addBoardEdges(projectId, edgePartials) : { created: [], skipped: [] };

  return {
    items: created.length,
    edges: edgeRes.created.length,
    skippedEdges: edgeRes.skipped.length,
  };
}

const ROLE_LABEL: Record<string, string> = { evidence: '根拠', interpretation: '解釈', conclusion: '結論' };

/** RAG に渡す平文（出典・要約・役割つき論点・キーワード）。出典が常に残る形にする。 */
export function buildInsightRagText(insight: ArticleInsight): string {
  const lines: string[] = [`# ${insight.sourceTitle}（記事分析）`];
  if (insight.sourceUrl) lines.push(`出典: ${insight.sourceUrl}`);
  lines.push('', '## 要約', insight.summary || '（なし）');
  lines.push('', '## 論点');
  for (const c of insight.claims) lines.push(`- [${ROLE_LABEL[c.role] || c.role}] ${c.text}`);
  if (insight.keywords.length) {
    lines.push('', '## キーワード', insight.keywords.map((k) => k.term).join('、'));
  }
  return lines.join('\n');
}

/** 分析結果を外付け脳（RAG）へ取り込む。sourceFile を insight ID にして重複取り込みを識別可能にする。 */
export async function ingestInsightToRag(insight: ArticleInsight, uid: string): Promise<void> {
  const ingest = useAiProfileStore.getState().ingestKnowledgeSource;
  await ingest({
    uid,
    title: `記事分析: ${insight.sourceTitle}`,
    text: buildInsightRagText(insight),
    sourceFile: `insight:${insight.id}`,
  });
}
