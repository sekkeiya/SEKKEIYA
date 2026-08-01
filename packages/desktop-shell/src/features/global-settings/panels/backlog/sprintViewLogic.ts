// 過去スプリント閲覧（履歴モード）の純ロジック。fs / React 非依存。
// 図はスナップショット（凍結）だが、バックログは凍結せず現在データを sprintId で絞る割り切り（spec §0）。
import type { BacklogItem, Sprint } from '../DevStatusPanel';

/** サイドバーの選択状態。all=全スプリント表示（既定）/ backlog=未割当 / sprint=特定スプリント。 */
export type SidebarSel =
  | { kind: 'all' }
  | { kind: 'backlog' }
  | { kind: 'sprint'; id: string };

/** 該当スプリントの要件＋その親要求だけを返す（表示用の上流フィルタ）。 */
export function filterItemsBySprint(items: BacklogItem[], sprintId: string): BacklogItem[] {
  const reqs = items.filter(i => i.type === 'requirement' && i.sprintId === sprintId);
  const parentIds = new Set(reqs.map(r => r.requestId).filter(Boolean));
  const requests = items.filter(i => i.type === 'request' && parentIds.has(i.id));
  return [...requests, ...reqs];
}

/** クラウドのスナップショット doc ID（devDiagramSnapshots）。 */
export function snapshotDocId(sprintId: string, type: string): string {
  return `${sprintId}_${type}`;
}

/** サイドバーに出すアーカイブ済みスプリント（新しい順）。 */
export function archivedSprintsDesc(sprints: Sprint[]): Sprint[] {
  return sprints.filter(s => s.archived).sort((a, b) => (b.seq || 0) - (a.seq || 0));
}

/** バックログ表示: 未割当の要件＋その親要求＋要件ゼロの要求（作りたての要求が見えるように）。 */
export function filterBacklogItems(items: BacklogItem[]): BacklogItem[] {
  const reqs = items.filter(i => i.type === 'requirement' && !i.sprintId);
  const parentIds = new Set(reqs.map(r => r.requestId).filter(Boolean));
  const hasChild = new Set(items.filter(i => i.type === 'requirement').map(r => r.requestId).filter(Boolean));
  const requests = items.filter(i => i.type === 'request' && (parentIds.has(i.id) || !hasChild.has(i.id)));
  return [...requests, ...reqs];
}

/** サイドバー一覧: 全スプリント（アクティブ＋アーカイブ済み）を新しい順で。 */
export function allSprintsDesc(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort((a, b) => (b.seq || 0) - (a.seq || 0));
}
