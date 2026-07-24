// マインドマップの AI ⇔ キャンバス ブリッジ（researchBoardBridge と同じシーン束縛パターン）。
// MindMapCanvas がマウント中はホスト（React state）経由でライブに反映し、
// 非マウント時は Firestore（ResearchCanvasRepository の mindmap フィールド）への
// ヘッドレス操作にフォールバックする。verb ハンドラ（mindmapVerbs.ts）はこのモジュールだけを見る。

import {
  ResearchCanvasRepository,
  compactMindNode,
  compactMindRelation,
  parseBoardKey,
  type MindMapNode,
  type MindMapRelation,
  type MindMapSummary,
} from '../repositories/ResearchCanvasRepository';
import { RESEARCH_BOARD_CHANGED_EVENT, resolveTargetBoardKey } from './researchBoardBridge';
import { requestShowBoard } from './boardContextBus';

/** マウント中の MindMapCanvas が登録するライブ操作面。 */
export interface MindMapHost {
  /** ボードキー（scope|docId）。 */
  boardKey: string;
  getTopics(): MindMapNode[];
  getRelations(): MindMapRelation[];
  getSummaries(): MindMapSummary[];
  /** トピック追加（id/rank/時刻は確定済み）。expandIds は折りたたみを開く親。 */
  addTopics(nodes: MindMapNode[], expandIds: string[]): void;
  patchTopic(id: string, patch: Partial<MindMapNode>): void;
  /** ids は部分木展開済みの全ID。ぶら下がる関係線・まとめの掃除もホスト側の責務。 */
  removeTopics(ids: string[]): void;
  addRelations(rels: MindMapRelation[]): void;
  removeRelations(ids: string[]): void;
}

let activeHost: MindMapHost | null = null;

export function registerMindMapHost(host: MindMapHost): () => void {
  activeHost = host;
  return () => { if (activeHost === host) activeHost = null; };
}

/**
 * マインドマップ verb の書き込み先ボードキーを解決する。**チャットが正**:
 * セッションの属するスコープを最優先し、表示中のボード（このウィンドウのマウント中 /
 * 本体から配信された表示中 / ヘッドレスの直近対象）は「同じスコープのとき」だけ
 * docId まで採用する。別プロジェクトを表示中でも、チャットのプロジェクト側へ書く。
 */
export function resolveMindMapBoardKey(sessionScope: string | null | undefined): string | null {
  const own = activeHost?.boardKey ?? null;
  if (sessionScope) {
    if (own && parseBoardKey(own).scope === sessionScope) return own;
    return resolveTargetBoardKey(sessionScope);
  }
  return own ?? resolveTargetBoardKey(null);
}

/**
 * マインドマップが画面に出ているか（＝ MindMapCanvas がマウント中か）。
 * どちらのビューを見ているかでチャットに渡すプレイブックを切り替えるのに使う。
 */
export function isMindMapMounted(): boolean {
  return activeHost !== null;
}

function liveHost(boardKey: string): MindMapHost | null {
  return activeHost && activeHost.boardKey === boardKey ? activeHost : null;
}

function notifyChanged(boardKey: string): void {
  import('@tauri-apps/api/event')
    .then(({ emit }) => emit(RESEARCH_BOARD_CHANGED_EVENT, { projectId: boardKey, part: 'mindmap' }))
    .catch(() => { /* Tauri 以外 or emit 失敗時は無視 */ });
}

function newId(prefix: 'm' | 'r'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** マインドマップの現在の状態（ライブ or Firestore）。 */
export interface MindMapState {
  nodes: MindMapNode[];
  relations: MindMapRelation[];
  summaries: MindMapSummary[];
}

export async function getMindMapState(boardKey: string): Promise<MindMapState> {
  const host = liveHost(boardKey);
  if (host) return { nodes: host.getTopics(), relations: host.getRelations(), summaries: host.getSummaries() };
  const doc = await ResearchCanvasRepository.load(boardKey);
  return { nodes: doc.mindmap, relations: doc.mindmapRelations, summaries: doc.mindmapSummaries };
}

/** AI から追加するトピック。parent は既存トピック id / "#N"（同時追加分の添字）/ 省略=中心トピック直下。 */
export interface NewMindTopic {
  text: string;
  parent?: string;
  note?: string;
  link?: string;
  image?: string;
  refType?: 'library' | 'article';
  refId?: string;
  refTitle?: string;
}

export interface AddTopicsResult {
  created: MindMapNode[];
  /** ボードが空で中心トピックも新規作成した場合、その id。 */
  createdRootId?: string;
  skipped: string[];
}

/**
 * トピックをまとめて追加する。"#N" 参照で1回の呼び出しで部分木を組める。
 * ボードにまだ中心トピックが無ければ自動で作る（ヘッドレスで新規ボードに書く場合）。
 */
export async function addMindTopics(boardKey: string, partials: NewMindTopic[]): Promise<AddTopicsResult> {
  const host = liveHost(boardKey);
  const state = await getMindMapState(boardKey);
  const nodes = [...state.nodes];
  const now = new Date().toISOString();
  const skipped: string[] = [];
  const created: MindMapNode[] = [];

  // 中心トピックの保証（空ボードへのヘッドレス書き込みで必要）
  let root = nodes.find(n => n.parentId == null);
  let createdRootId: string | undefined;
  if (!root) {
    root = { id: newId('m'), parentId: null, rank: 0, text: '中心トピック', createdAt: now, updatedAt: now };
    nodes.push(root);
    created.push(root);
    createdRootId = root.id;
  }

  const byId = new Map(nodes.map(n => [n.id, n]));
  // 親ごとの次の rank（既存の最大 + 1 から採番していく）
  const nextRank = new Map<string, number>();
  const takeRank = (parentId: string): number => {
    if (!nextRank.has(parentId)) {
      const sib = nodes.filter(n => n.parentId === parentId);
      nextRank.set(parentId, sib.length ? Math.max(...sib.map(s => s.rank)) + 1 : 0);
    }
    const r = nextRank.get(parentId)!;
    nextRank.set(parentId, r + 1);
    return r;
  };

  // "#N" は partials の添字 → 生成した実 id
  const idxToId = new Map<number, string>();
  const expandIds = new Set<string>();

  partials.forEach((p, idx) => {
    const text = (p.text || '').trim();
    if (!text) { skipped.push(`topics[${idx}]: text が必要です`); return; }
    let parentId = root!.id;
    if (p.parent) {
      const m = String(p.parent).match(/^#(\d+)$/);
      const resolved = m ? idxToId.get(Number(m[1])) : (byId.has(p.parent) ? p.parent : undefined);
      if (!resolved) { skipped.push(`topics[${idx}]: parent を解決できません（${p.parent}）`); return; }
      parentId = resolved;
    }
    const parent = byId.get(parentId);
    if (parent?.collapsed) expandIds.add(parentId);
    const node = compactMindNode({
      id: newId('m'), parentId, rank: takeRank(parentId), text,
      note: p.note || undefined,
      link: p.link || undefined,
      image: p.image || undefined,
      refType: p.refType, refId: p.refId, refTitle: p.refTitle,
      createdAt: now, updatedAt: now,
    } as MindMapNode);
    nodes.push(node);
    byId.set(node.id, node);
    idxToId.set(idx, node.id);
    created.push(node);
  });

  if (created.length > 0) {
    if (host) {
      host.addTopics(created, [...expandIds]);
    } else {
      const saved = nodes.map(n => expandIds.has(n.id) && n.collapsed
        ? compactMindNode({ ...n, collapsed: false, updatedAt: now })
        : n);
      await ResearchCanvasRepository.save(boardKey, { mindmap: saved });
      notifyChanged(boardKey);
    }
    // チャットが正: 書き込みが始まったら、そのマップを本体ウィンドウに表示する
    requestShowBoard({ boardKey, view: 'mindmap' });
  }
  return { created, createdRootId, skipped };
}

export async function updateMindTopic(
  boardKey: string,
  id: string,
  patch: Partial<MindMapNode>,
): Promise<boolean> {
  const host = liveHost(boardKey);
  if (host) {
    if (!host.getTopics().some(n => n.id === id)) return false;
    host.patchTopic(id, patch);
    requestShowBoard({ boardKey, view: 'mindmap' });
    return true;
  }
  const doc = await ResearchCanvasRepository.load(boardKey);
  const idx = doc.mindmap.findIndex(n => n.id === id);
  if (idx < 0) return false;
  doc.mindmap[idx] = compactMindNode({ ...doc.mindmap[idx], ...patch, updatedAt: new Date().toISOString() });
  await ResearchCanvasRepository.save(boardKey, { mindmap: doc.mindmap });
  notifyChanged(boardKey);
  requestShowBoard({ boardKey, view: 'mindmap' });
  return true;
}

/** 部分木ごと削除する。中心トピックは対象外（skipped に理由を返す）。 */
export async function removeMindTopics(boardKey: string, ids: string[]): Promise<{ removed: number; skipped: string[] }> {
  const state = await getMindMapState(boardKey);
  const byId = new Map(state.nodes.map(n => [n.id, n]));
  const skipped: string[] = [];

  const targets = new Set<string>();
  for (const id of ids) {
    const n = byId.get(id);
    if (!n) { skipped.push(`トピックが見つかりません: ${id}`); continue; }
    if (n.parentId == null) { skipped.push('中心トピックは削除できません'); continue; }
    targets.add(id);
  }
  // 部分木展開
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of state.nodes) {
      if (n.parentId != null && targets.has(n.parentId) && !targets.has(n.id)) { targets.add(n.id); grew = true; }
    }
  }
  if (targets.size === 0) return { removed: 0, skipped };

  const host = liveHost(boardKey);
  if (host) {
    host.removeTopics([...targets]);
  } else {
    const mindmap = state.nodes.filter(n => !targets.has(n.id));
    const mindmapRelations = state.relations.filter(r => !targets.has(r.source) && !targets.has(r.target));
    const mindmapSummaries = state.summaries
      .map(s => (s.nodeIds.some(i => targets.has(i)) ? { ...s, nodeIds: s.nodeIds.filter(i => !targets.has(i)) } : s))
      .filter(s => s.nodeIds.length > 0);
    await ResearchCanvasRepository.save(boardKey, { mindmap, mindmapRelations, mindmapSummaries });
    notifyChanged(boardKey);
  }
  requestShowBoard({ boardKey, view: 'mindmap' });
  return { removed: targets.size, skipped };
}

export interface AddRelationsResult {
  created: MindMapRelation[];
  skipped: string[];
}

/** 関係線（木と無関係な注釈の矢印）を張る。同じ source→target の重複は弾く。 */
export async function addMindRelations(
  boardKey: string,
  partials: Array<{ source: string; target: string; text?: string }>,
): Promise<AddRelationsResult> {
  const state = await getMindMapState(boardKey);
  const idSet = new Set(state.nodes.map(n => n.id));
  const existing = new Set(state.relations.map(r => `${r.source}->${r.target}`));
  const now = new Date().toISOString();
  const skipped: string[] = [];
  const created: MindMapRelation[] = [];

  for (const p of partials) {
    if (!idSet.has(p.source)) { skipped.push(`source が見つかりません: ${p.source}`); continue; }
    if (!idSet.has(p.target)) { skipped.push(`target が見つかりません: ${p.target}`); continue; }
    if (p.source === p.target) { skipped.push(`自己ループは張れません: ${p.source}`); continue; }
    const key = `${p.source}->${p.target}`;
    if (existing.has(key)) { skipped.push(`既に関係線があります: ${key}`); continue; }
    existing.add(key);
    created.push(compactMindRelation({
      id: newId('r'), source: p.source, target: p.target,
      text: p.text?.trim() || undefined,
      createdAt: now, updatedAt: now,
    }));
  }

  if (created.length > 0) {
    const host = liveHost(boardKey);
    if (host) {
      host.addRelations(created);
    } else {
      await ResearchCanvasRepository.save(boardKey, { mindmapRelations: [...state.relations, ...created] });
      notifyChanged(boardKey);
    }
    requestShowBoard({ boardKey, view: 'mindmap' });
  }
  return { created, skipped };
}

export async function removeMindRelations(boardKey: string, ids: string[]): Promise<number> {
  const host = liveHost(boardKey);
  const idSet = new Set(ids);
  if (host) {
    const hit = host.getRelations().filter(r => idSet.has(r.id)).length;
    if (hit > 0) { host.removeRelations(ids); requestShowBoard({ boardKey, view: 'mindmap' }); }
    return hit;
  }
  const doc = await ResearchCanvasRepository.load(boardKey);
  const remain = doc.mindmapRelations.filter(r => !idSet.has(r.id));
  const removed = doc.mindmapRelations.length - remain.length;
  if (removed > 0) {
    await ResearchCanvasRepository.save(boardKey, { mindmapRelations: remain });
    notifyChanged(boardKey);
    requestShowBoard({ boardKey, view: 'mindmap' });
  }
  return removed;
}
