/**
 * useLayoutDockStore.ts
 *
 * Bottombar（下部ドック）を外部から開く/モードを切り替えるための
 * 軽量シグナルストア。
 *
 * 使い方:
 *   送信側: useLayoutDockStore.getState().openMode("lighting")
 *   受信側: Bottombar が useEffect でwatchしてモードを切り替える
 */
import { create } from 'zustand';

interface LayoutDockStore {
  /** 開きたいモード名。Bottombar が読んだ後に null にする */
  requestOpenMode: string | null;
  /** モードを要求する */
  openMode: (mode: string) => void;
  /** Bottombar 側が読んだ後にクリアする */
  clearRequestOpenMode: () => void;
}

export const useLayoutDockStore = create<LayoutDockStore>((set) => ({
  requestOpenMode: null,
  openMode: (mode) => set({ requestOpenMode: mode }),
  clearRequestOpenMode: () => set({ requestOpenMode: null }),
}));
