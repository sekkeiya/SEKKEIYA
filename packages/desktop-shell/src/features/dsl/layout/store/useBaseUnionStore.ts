import { create } from "zustand";
import type { Mesh } from "three";

/**
 * Base を CSG Union で 1ソリッド化した結果メッシュを保持する。
 * 設定されている間は、コリジョン/面ピック/自動ラベル/自動マテリアルの対象を
 * この結合メッシュに切り替える（元の分割メッシュは非表示＆raycast無効化）。
 * セッション内のみ（GLB保存はしない＝「上書き」）。Base 再読込で破棄。
 */
interface BaseUnionState {
  unionMesh: Mesh | null;
  /** 変更検知用カウンタ（再構築トリガ）。 */
  rev: number;
  setUnion: (mesh: Mesh | null) => void;
  clear: () => void;
}

export const useBaseUnionStore = create<BaseUnionState>((set) => ({
  unionMesh: null,
  rev: 0,
  setUnion: (unionMesh) => set((s) => ({ unionMesh, rev: s.rev + 1 })),
  clear: () => set((s) => (s.unionMesh ? { unionMesh: null, rev: s.rev + 1 } : s)),
}));
