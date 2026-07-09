import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeApplications, type TextureApplication } from '../textureGrouping';

// テクスチャの部位カテゴリ（床/内壁/外壁/天井）の手動上書き。
// 自動推定が外れたときにユーザーが正しい部位を確定できる。
// キー = TextureGroup.id（auto: 'tex::<folder>::<mat>' / manual: 'tex::set::<id>'）。
// ローカル素材は読み取り専用なので localStorage に永続化（実体には書かない）。

interface TextureMetaStoreState {
  /** グループID → 部位カテゴリ（最低1つ）の上書き。 */
  appOverrides: Record<string, TextureApplication[]>;
  setAppOverride: (groupId: string, applications: TextureApplication[]) => void;
  clearAppOverride: (groupId: string) => void;
}

export const useTextureMetaStore = create<TextureMetaStoreState>()(
  persist(
    (set) => ({
      appOverrides: {},
      setAppOverride: (groupId, applications) =>
        set((s) => {
          // 空にはしない（必ず1つは部位を残す）。
          if (!applications.length) return s;
          // 結合ルール（内壁→天井）＋規定順に正規化してから保存。
          return { appOverrides: { ...s.appOverrides, [groupId]: normalizeApplications(applications) } };
        }),
      clearAppOverride: (groupId) =>
        set((s) => {
          const next = { ...s.appOverrides };
          delete next[groupId];
          return { appOverrides: next };
        }),
    }),
    { name: 'dsi-texture-meta' },
  ),
);
