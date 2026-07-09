import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 手動テクスチャセット。
// 自動グループ化（ファイル名から basecolor/normal/roughness/ao を束ねる）で
// まとまらないテクスチャを、ユーザーが手で「1マテリアル＝1セット」にまとめる。
// メンバーは画像 ID（ローカル素材なら絶対パス、クラウドなら Firestore ID）で保持。
// localStorage に永続化（ローカル素材は読み取り専用なので実体には書かない）。

export interface ManualTextureSet {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: number;
}

interface TextureSetStoreState {
  sets: ManualTextureSet[];
  /** メンバー ID 群から新しいセットを作成（2件以上で有効）。作成したセットIDを返す。 */
  createSet: (memberIds: string[], name?: string) => string | null;
  /** セットを解除（削除）。 */
  removeSet: (id: string) => void;
  /** セット名を変更。 */
  renameSet: (id: string, name: string) => void;
}

let counter = 0;
const genId = () => `texset_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const useTextureSetStore = create<TextureSetStoreState>()(
  persist(
    (set) => ({
      sets: [],
      createSet: (memberIds, name) => {
        const unique = Array.from(new Set(memberIds.filter(Boolean)));
        if (unique.length < 2) return null;
        const id = genId();
        set((s) => ({
          sets: [
            // 既存セットから今回のメンバーを取り除き（重複所属を防ぐ）、新セットを追加。
            ...s.sets
              .map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => !unique.includes(m)) }))
              .filter((g) => g.memberIds.length >= 2),
            { id, name: name || 'テクスチャセット', memberIds: unique, createdAt: Date.now() },
          ],
        }));
        return id;
      },
      removeSet: (id) => set((s) => ({ sets: s.sets.filter((g) => g.id !== id) })),
      renameSet: (id, name) =>
        set((s) => ({ sets: s.sets.map((g) => (g.id === id ? { ...g, name } : g)) })),
    }),
    { name: 'dsi-texture-sets' },
  ),
);
