/**
 * useFurnitureDefaultsStore.ts
 * カテゴリ別デフォルト家具のクライアントサイドストア。
 */

import { create } from 'zustand';
import type { FurnitureDefaultEntry } from '../services/furnitureDefaultsApi';

interface FurnitureDefaultsState {
  defaults: Map<string, FurnitureDefaultEntry>;
  loaded: boolean;
  loading: boolean;
  /** ロード試行済みだが失敗(権限エラー等)。true の間は再ロードしない。 */
  loadError: boolean;

  load: (userId: string, projectId?: string | null) => Promise<void>;
  reload: (userId: string, projectId?: string | null) => Promise<void>;
  set: (userId: string, entry: FurnitureDefaultEntry, projectId?: string | null) => Promise<void>;
  clear: (userId: string, categoryKey: string, projectId?: string | null) => Promise<void>;
  getEntry: (categoryKey: string) => FurnitureDefaultEntry | undefined;
}

export const useFurnitureDefaultsStore = create<FurnitureDefaultsState>((setState, getState) => ({
  defaults: new Map(),
  loaded: false,
  loading: false,
  loadError: false,

  load: async (userId, projectId) => {
    const s = getState();
    // すでにロード済み・ロード中・エラー済みなら再試行しない
    if (s.loading || s.loaded || s.loadError) return;
    setState({ loading: true });
    try {
      const { getMergedDefaults } = await import('../services/furnitureDefaultsApi');
      const map = await getMergedDefaults(userId, projectId);
      setState({ defaults: map, loaded: true, loadError: false });
    } catch (e) {
      console.warn('[useFurnitureDefaultsStore] load failed (will not retry):', e);
      setState({ loadError: true });
    } finally {
      setState({ loading: false });
    }
  },

  /** 強制リロード（エラー状態を解除して再試行） */
  reload: async (userId, projectId) => {
    setState({ loadError: false, loaded: false });
    await useFurnitureDefaultsStore.getState().load(userId, projectId);
  },

  set: async (userId, entry, projectId) => {
    const { setUserDefault, setProjectDefault } = await import('../services/furnitureDefaultsApi');
    if (projectId) {
      await setProjectDefault(projectId, entry);
    } else {
      await setUserDefault(userId, entry);
    }
    setState(s => {
      const next = new Map(s.defaults);
      next.set(entry.categoryKey, entry);
      return { defaults: next };
    });
  },

  clear: async (userId, categoryKey, projectId) => {
    const { clearUserDefault, clearProjectDefault } = await import('../services/furnitureDefaultsApi');
    if (projectId) {
      await clearProjectDefault(projectId, categoryKey);
    } else {
      await clearUserDefault(userId, categoryKey);
    }
    setState(s => {
      const next = new Map(s.defaults);
      next.delete(categoryKey);
      return { defaults: next };
    });
  },

  getEntry: (categoryKey) => getState().defaults.get(categoryKey),
}));
