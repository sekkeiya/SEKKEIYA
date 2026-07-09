import { create } from 'zustand';
import type { ModelVisibility, LocalUploadMeta } from '../upload/uploadLocalModelToCloud';

// ──────────────────────────────────────────────────────────────────────────────
// Local Models のクラウド保存状態（公開/非公開）を保持するストア。
// Rust の local_uploads.json（local path 小文字 → {assetId, visibility}）を読み込み、
// カードのラベル・絞り込み・アップロードボタンの状態判定に使う。
// ──────────────────────────────────────────────────────────────────────────────

export interface LocalUploadRecord {
  assetId: string;
  visibility: ModelVisibility;
  uploadedAt: string;
}

export type CloudFilter = 'all' | 'cloud' | 'public' | 'private' | 'local';

interface LocalUploadState {
  /** ローカルパス（小文字）→ アップロード記録。 */
  records: Record<string, LocalUploadRecord>;
  /** 絞り込み（パンくず横のチップ）。 */
  cloudFilter: CloudFilter;
  setCloudFilter: (f: CloudFilter) => void;
  /** アップロード進行中のローカルパス集合（ボタンのスピナー用）。 */
  uploading: Record<string, boolean>;

  refresh: () => Promise<void>;
  /** ローカルモデルをクラウドへアップロードして記録を更新（メタデータ付き）。 */
  upload: (model: any, visibility: ModelVisibility, meta?: LocalUploadMeta) => Promise<void>;
  /** クラウド保存を解除してローカルに戻す（クラウドデータ削除）。 */
  revertToLocal: (model: any) => Promise<void>;
  /** ローカルパスの記録を取得（無ければ null）。 */
  recordFor: (localPath?: string | null) => LocalUploadRecord | null;
}

async function tauriCore() {
  const core = await import('@tauri-apps/api/core');
  return core.isTauri() ? core : null;
}

export const useLocalUploadStore = create<LocalUploadState>((set, get) => ({
  records: {},
  cloudFilter: 'all',
  setCloudFilter: (cloudFilter) => set({ cloudFilter }),
  uploading: {},

  refresh: async () => {
    const core = await tauriCore();
    if (!core) return;
    try {
      const records = await core.invoke<Record<string, LocalUploadRecord>>('get_local_upload_records');
      set({ records: records || {} });
    } catch (e) {
      console.error('[useLocalUploadStore] get_local_upload_records failed', e);
    }
  },

  upload: async (model, visibility, meta) => {
    const path: string | undefined = model?.localPath;
    if (!path) return;
    const key = path.toLowerCase();
    set((s) => ({ uploading: { ...s.uploading, [key]: true } }));
    try {
      const { uploadLocalModelToCloud } = await import('../upload/uploadLocalModelToCloud');
      const assetId = await uploadLocalModelToCloud(model, visibility, meta);
      set((s) => ({
        records: { ...s.records, [key]: { assetId, visibility, uploadedAt: new Date().toISOString() } },
      }));
    } catch (e) {
      console.error('[useLocalUploadStore] upload failed', e);
      window.alert('アップロードに失敗しました: ' + String(e));
      throw e;
    } finally {
      set((s) => {
        const u = { ...s.uploading };
        delete u[key];
        return { uploading: u };
      });
    }
  },

  revertToLocal: async (model) => {
    const path: string | undefined = model?.localPath;
    if (!path) return;
    const key = path.toLowerCase();
    const rec = get().records[key];
    if (!rec) return;
    set((s) => ({ uploading: { ...s.uploading, [key]: true } }));
    try {
      const { revertLocalModelToLocal } = await import('../upload/uploadLocalModelToCloud');
      await revertLocalModelToLocal(rec.assetId, path);
      set((s) => {
        const r = { ...s.records };
        delete r[key];
        return { records: r };
      });
    } catch (e) {
      console.error('[useLocalUploadStore] revert failed', e);
      window.alert('ローカルに戻す処理に失敗しました: ' + String(e));
    } finally {
      set((s) => {
        const u = { ...s.uploading };
        delete u[key];
        return { uploading: u };
      });
    }
  },

  recordFor: (localPath) => {
    if (!localPath) return null;
    return get().records[localPath.toLowerCase()] || null;
  },
}));
