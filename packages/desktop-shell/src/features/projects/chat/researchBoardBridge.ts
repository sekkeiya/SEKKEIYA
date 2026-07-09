// Research & Memo リサーチボードの AI ⇔ キャンバス ブリッジ（docs/20 のシーン束縛パターンの軽量版）。
// キャンバスがマウント中はホスト（React state）経由でライブに反映し、
// 非マウント時は Firestore（ResearchCanvasRepository）へのヘッドレス操作にフォールバックする。
// verb ハンドラ（researchVerbs.ts）はこのモジュールだけを見る。

import {
  ResearchCanvasRepository,
  compactCanvasItem,
  compactCanvasEdge,
  type ResearchCanvasItem,
  type ResearchCanvasEdge,
} from '../repositories/ResearchCanvasRepository';

/** マウント中の ResearchCanvas が登録するライブ操作面。 */
export interface ResearchBoardHost {
  projectId: string;
  getItems(): ResearchCanvasItem[];
  addItems(items: ResearchCanvasItem[]): void;
  patchItem(id: string, patch: Partial<ResearchCanvasItem>): void;
  /** カード削除。接続されたエッジの削除もホスト側の責務。 */
  removeItems(ids: string[]): void;
  getEdges(): ResearchCanvasEdge[];
  addEdges(edges: ResearchCanvasEdge[]): void;
  patchEdge(id: string, patch: Partial<ResearchCanvasEdge>): void;
  removeEdges(ids: string[]): void;
  /** エッジ追加後に呼ぶと、論証グラフを「根拠→結論」の左→右に自動整列する（デバウンス済み）。 */
  arrange?(): void;
}

let activeHost: ResearchBoardHost | null = null;

// ヘッドレス（キャンバス非表示）で直近に作成/対象化したボードキー（scope|docId）。
// マウント済みホストが無いとき、research_board_create 後の add/connect/get が
// この新ボードを対象にするための橋渡し（素のスコープだと既定ボード 'canvas' に逸れてしまう）。
let headlessBoardKey: string | null = null;

/** ヘッドレスの対象ボードを設定/解除する（research_board_create のヘッドレス経路が呼ぶ）。 */
export function setHeadlessActiveBoard(boardKey: string | null): void {
  headlessBoardKey = boardKey;
}

// ヘッドレス（Firestore フォールバック）でボードを書き換えたことを他ウィンドウへ知らせるイベント。
// ポップアウト窓の AI が更新したとき、本体のマウント済みキャンバスが読み直して反映するために使う。
export const RESEARCH_BOARD_CHANGED_EVENT = 'sekkeiya://research-board-changed';

function notifyBoardChanged(projectId: string): void {
  import('@tauri-apps/api/event')
    .then(({ emit }) => emit(RESEARCH_BOARD_CHANGED_EVENT, { projectId }))
    .catch(() => { /* Tauri 以外 or emit 失敗時は無視 */ });
}

/** キャンバス側がマウント時に呼ぶ。返り値の関数でアンマウント時に解除する。 */
export function registerResearchBoardHost(host: ResearchBoardHost): () => void {
  activeHost = host;
  return () => {
    if (activeHost === host) activeHost = null;
  };
}

function liveHost(projectId: string): ResearchBoardHost | null {
  return activeHost && activeHost.projectId === projectId ? activeHost : null;
}

/**
 * 現在マウント中のボードのID（ボードキー scope|docId）。
 * AI verb は「画面に出ているボード」を操作対象にするため、これを最優先で使う
 * （アカウントサイトの個人ボードは projectId から解決できないため必須）。
 */
export function getActiveBoardId(): string | null {
  // マウント中のキャンバス（＝画面に出ているボード）を最優先。
  // 無ければ、ヘッドレスで直近に作成/対象化したボードキーにフォールバックする。
  return activeHost?.projectId ?? headlessBoardKey;
}

// ─── ボードマネージャ（複数ボードの新規作成＋切替。ワークスペースが登録）─────────

/** マウント中の Research ワークスペースが提供するボード管理面（AIの新規作成用）。 */
export interface ResearchBoardManager {
  /** このワークスペースのスコープ（projectId または 'account'）。 */
  scope: string;
  /** 新規ボードを作成して画面をそこへ切り替え、新ボードキーを返す。 */
  createBoard(title: string): Promise<string>;
}

let activeManager: ResearchBoardManager | null = null;

export function registerResearchBoardManager(m: ResearchBoardManager): () => void {
  activeManager = m;
  return () => { if (activeManager === m) activeManager = null; };
}

export function getActiveBoardManager(): ResearchBoardManager | null {
  return activeManager;
}

/** AI から追加するアイテム（id/時刻は自動、座標は省略可＝自動配置）。 */
export type NewBoardItem = Partial<Pick<ResearchCanvasItem, 'x' | 'y'>> &
  Omit<ResearchCanvasItem, 'id' | 'createdAt' | 'updatedAt' | 'x' | 'y'>;

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ─── 自動配置 ─────────────────────────────────────────────────────────────────
// 座標未指定のアイテムは、既存ボードのバウンディングボックスの右側に
// 縦3枚×列の格子で並べる（既存カードに重ねない）。空ボードは原点から。

const AUTO_COL_W = 300;
const AUTO_ROW_H = 180;
const AUTO_ROWS = 3;
const AUTO_GAP_X = 80;

function autoPositions(existing: ResearchCanvasItem[], count: number): Array<{ x: number; y: number }> {
  let originX = 0;
  let originY = 0;
  if (existing.length > 0) {
    originX = Math.max(...existing.map(i => i.x)) + AUTO_COL_W + AUTO_GAP_X;
    originY = Math.min(...existing.map(i => i.y));
  }
  return Array.from({ length: count }, (_, i) => ({
    x: originX + Math.floor(i / AUTO_ROWS) * AUTO_COL_W,
    y: originY + (i % AUTO_ROWS) * AUTO_ROW_H,
  }));
}

// ─── 操作 API（verb ハンドラから呼ぶ） ────────────────────────────────────────

export async function listBoardItems(projectId: string): Promise<ResearchCanvasItem[]> {
  const host = liveHost(projectId);
  return host ? host.getItems() : (await ResearchCanvasRepository.load(projectId)).items;
}

export async function listBoardEdges(projectId: string): Promise<ResearchCanvasEdge[]> {
  const host = liveHost(projectId);
  return host ? host.getEdges() : (await ResearchCanvasRepository.load(projectId)).edges;
}

export async function addBoardItems(projectId: string, partials: NewBoardItem[]): Promise<ResearchCanvasItem[]> {
  const host = liveHost(projectId);
  const existing = host ? host.getItems() : (await ResearchCanvasRepository.load(projectId)).items;

  const needsAuto = partials.filter(p => p.x === undefined || p.y === undefined).length;
  const autoPos = autoPositions(existing, needsAuto);
  let autoIdx = 0;

  const now = new Date().toISOString();
  const created: ResearchCanvasItem[] = partials.map(p => {
    const pos = p.x === undefined || p.y === undefined ? autoPos[autoIdx++] : { x: p.x, y: p.y };
    return compactCanvasItem({
      ...p,
      x: pos.x,
      y: pos.y,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    } as ResearchCanvasItem);
  });

  if (host) {
    host.addItems(created);
  } else {
    await ResearchCanvasRepository.save(projectId, { items: [...existing, ...created] });
    notifyBoardChanged(projectId);
  }
  return created;
}

export async function updateBoardItem(
  projectId: string,
  id: string,
  patch: Partial<ResearchCanvasItem>,
): Promise<boolean> {
  const host = liveHost(projectId);
  if (host) {
    if (!host.getItems().some(i => i.id === id)) return false;
    host.patchItem(id, patch);
    return true;
  }
  const { items } = await ResearchCanvasRepository.load(projectId);
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return false;
  items[idx] = compactCanvasItem({ ...items[idx], ...patch, updatedAt: new Date().toISOString() });
  await ResearchCanvasRepository.save(projectId, { items });
  notifyBoardChanged(projectId);
  return true;
}

export async function removeBoardItems(projectId: string, ids: string[]): Promise<number> {
  const host = liveHost(projectId);
  const idSet = new Set(ids);
  if (host) {
    const hit = host.getItems().filter(i => idSet.has(i.id)).length;
    if (hit > 0) host.removeItems(ids);
    return hit;
  }
  const { items, edges } = await ResearchCanvasRepository.load(projectId);
  const remain = items.filter(i => !idSet.has(i.id));
  const removed = items.length - remain.length;
  if (removed > 0) {
    // 消えたカードにぶら下がるエッジも一緒に掃除する（宙に浮いたエッジを残さない）
    const remainIds = new Set(remain.map(i => i.id));
    const remainEdges = edges.filter(e => remainIds.has(e.source) && remainIds.has(e.target));
    await ResearchCanvasRepository.save(projectId, { items: remain, edges: remainEdges });
    notifyBoardChanged(projectId);
  }
  return removed;
}

// ─── エッジ操作 API ───────────────────────────────────────────────────────────

/** AI・UI から追加するエッジ（id/時刻は自動）。 */
export type NewBoardEdge = Omit<ResearchCanvasEdge, 'id' | 'createdAt' | 'updatedAt'>;

export interface AddEdgesResult {
  created: ResearchCanvasEdge[];
  /** source/target 不明・自己ループ・重複などで置けなかったエッジの理由。 */
  skipped: string[];
}

export async function addBoardEdges(projectId: string, partials: NewBoardEdge[]): Promise<AddEdgesResult> {
  const host = liveHost(projectId);
  const doc = host
    ? { items: host.getItems(), edges: host.getEdges() }
    : await ResearchCanvasRepository.load(projectId);
  const itemIds = new Set(doc.items.map(i => i.id));
  // 同じ2枚の間でも relation が違えば複数本OK（支持と反証を両方張る等）。
  // 重複は「source→target が同じ関係」のときだけ弾く。
  const relKey = (e: { source: string; target: string; relation: string }) => `${e.source}->${e.target}:${e.relation}`;
  const existingRels = new Set(doc.edges.map(relKey));

  const now = new Date().toISOString();
  const skipped: string[] = [];
  const created: ResearchCanvasEdge[] = [];
  for (const p of partials) {
    if (!itemIds.has(p.source)) { skipped.push(`source が見つかりません: ${p.source}`); continue; }
    if (!itemIds.has(p.target)) { skipped.push(`target が見つかりません: ${p.target}`); continue; }
    if (p.source === p.target) { skipped.push(`自己ループは張れません: ${p.source}`); continue; }
    if (existingRels.has(relKey(p))) { skipped.push(`同じ関係で既に接続済みです: ${relKey(p)}`); continue; }
    existingRels.add(relKey(p));
    created.push(compactCanvasEdge({ ...p, id: newId(), createdAt: now, updatedAt: now }));
  }

  if (created.length > 0) {
    if (host) {
      host.addEdges(created);
      // エッジが増えて論証グラフの骨格が変わったので、左→右の流れに自動整列させる
      host.arrange?.();
    } else {
      await ResearchCanvasRepository.save(projectId, { edges: [...doc.edges, ...created] });
      notifyBoardChanged(projectId);
    }
  }
  return { created, skipped };
}

export async function updateBoardEdge(
  projectId: string,
  id: string,
  patch: Partial<ResearchCanvasEdge>,
): Promise<boolean> {
  const host = liveHost(projectId);
  if (host) {
    if (!host.getEdges().some(e => e.id === id)) return false;
    host.patchEdge(id, patch);
    return true;
  }
  const { edges } = await ResearchCanvasRepository.load(projectId);
  const idx = edges.findIndex(e => e.id === id);
  if (idx < 0) return false;
  edges[idx] = compactCanvasEdge({ ...edges[idx], ...patch, updatedAt: new Date().toISOString() });
  await ResearchCanvasRepository.save(projectId, { edges });
  notifyBoardChanged(projectId);
  return true;
}

export async function removeBoardEdges(projectId: string, ids: string[]): Promise<number> {
  const host = liveHost(projectId);
  const idSet = new Set(ids);
  if (host) {
    const hit = host.getEdges().filter(e => idSet.has(e.id)).length;
    if (hit > 0) host.removeEdges(ids);
    return hit;
  }
  const { edges } = await ResearchCanvasRepository.load(projectId);
  const remain = edges.filter(e => !idSet.has(e.id));
  const removed = edges.length - remain.length;
  if (removed > 0) {
    await ResearchCanvasRepository.save(projectId, { edges: remain });
    notifyBoardChanged(projectId);
  }
  return removed;
}
