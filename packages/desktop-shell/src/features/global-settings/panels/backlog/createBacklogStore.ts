// ProjectRef → BacklogStore の解決。local はパスごとにインスタンスをキャッシュして
// 切替往復でも watch / blob キャッシュを使い回す。
// キャッシュした LocalFileBacklogStore は dispose() しない: dispose は watcher と blob URL を
// 解放するだけで file/loading の内部状態を戻さないため、dispose 後に再購読すると
// 「ロード済みなので load しない → watch も張り直さない」で黙って監視が止まる。
// アプリの生存期間中は使い回す前提（プロセス終了でまとめて解放される）。
import type { BacklogStore } from './BacklogStore';
import { firestoreBacklogStore } from './FirestoreBacklogStore';
import { LocalFileBacklogStore } from './LocalFileBacklogStore';

export type ProjectRef = { kind: 'cloud' } | { kind: 'local'; path: string };

const localCache = new Map<string, LocalFileBacklogStore>();

/**
 * 要件74: プロジェクト未選択（一般ユーザーがまだ1つも作っていない）状態の空 store。
 * 「購読すると即座に空データを返し、書き込みは拒否する」だけの null オブジェクト。
 * これがあると DevStatusPanel 側が store の有無で分岐せずに済む。
 */
export const nullBacklogStore: BacklogStore = {
  subscribeItems: (cb) => { cb([]); return () => {}; },
  subscribeSprints: (cb) => { cb([]); return () => {}; },
  addItem: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  updateItem: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  removeItem: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  addSprint: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  updateSprint: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  removeSprint: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  uploadAttachment: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  removeAttachment: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  now: () => new Date().toISOString(),
  getAttachmentUrl: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  subscribeDiagrams: (cb) => { cb({}); return () => {}; },
  saveDiagram: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  requestDiagram: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  snapshotDiagrams: () => Promise.reject(new Error('プロジェクトが選択されていません')),
  getDiagramSnapshots: async () => ({}),
};

export function createBacklogStore(ref: ProjectRef | null): BacklogStore {
  if (ref === null) return nullBacklogStore;
  if (ref.kind === 'cloud') return firestoreBacklogStore;
  // LocalFileBacklogStore と同じ正規化をしてからキーにする。
  // しないと "C:/repo" と "C:/repo/" が別インスタンス扱いになり、同じフォルダに watcher が二重に張られる。
  const key = ref.path.replace(/[\\/]+$/, '');
  let s = localCache.get(key);
  if (!s) { s = new LocalFileBacklogStore(key); localCache.set(key, s); }
  return s;
}

export function projectLabel(ref: ProjectRef | null): string {
  if (ref === null) return 'プロジェクト未選択';
  return ref.kind === 'cloud' ? 'SEKKEIYA（クラウド）' : (ref.path.split(/[\\/]/).pop() || ref.path);
}
