/**
 * 自動ラベリング時の「3Dスキャン」演出ステート。
 * X→Y→Z の順に、断面（スラブ）がレントゲンのように躯体を流れる。
 * 実体は ScanFx.jsx（R3F）が購読して描画する。
 */
import { create } from "zustand";
import * as THREE from "three";

export interface ScanFxConfig {
  /** 1軸あたりの掃引時間(ms) */
  axisDurationMs: number;
  /** 軸間の間(ms) */
  gapMs: number;
  /** スキャン光の色 */
  color: string;
}

interface ScanFxState {
  /** 起動トークン（変わるたびに ScanFx がリセット） */
  token: number;
  box: THREE.Box3 | null;
  config: ScanFxConfig;
  startScan: (box: THREE.Box3, cfg?: Partial<ScanFxConfig>) => void;
  stop: () => void;
  /** 全体の所要時間(ms)。ラベル適用のタイミング合わせに使う。 */
  totalMs: () => number;
}

const DEFAULT: ScanFxConfig = { axisDurationMs: 820, gapMs: 150, color: "#34e7ff" };

let seq = 0;

export const useScanFxStore = create<ScanFxState>((set, get) => ({
  token: 0,
  box: null,
  config: DEFAULT,
  startScan: (box, cfg) =>
    set({ token: ++seq, box: box.clone(), config: { ...DEFAULT, ...(cfg || {}) } }),
  stop: () => set({ box: null }),
  totalMs: () => {
    const c = get().config;
    return c.axisDurationMs * 3 + c.gapMs * 2 + 260;
  },
}));
