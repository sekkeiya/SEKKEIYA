// useLayoutLoadSignal.ts
// LayoutStateLoader が「保存状態のロード（replaceAll）」を完了したことを通知するシグナル。
// EditorAngleBar はこの完了後にだけデフォルトビューをシードする
// （ローダーの非同期 replaceAll([]) でシードが消される競合を避けるため）。
import { create } from "zustand";

interface LayoutLoadSignalStore {
  // `${projectId}/${workspaceId}/${baseId}` 形式のキー。Base ごとに変わる。
  loadedKey: string | null;
  markLoaded: (key: string | null) => void;
}

export const useLayoutLoadSignal = create<LayoutLoadSignalStore>((set) => ({
  loadedKey: null,
  markLoaded: (key) => set({ loadedKey: key }),
}));
