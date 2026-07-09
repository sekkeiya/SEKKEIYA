// S.Model（DSS）のアップロードダイアログを外部（例: 3D一括生成の進捗パネル）から
// 開くための橋渡しストア。openWith(files) を呼ぶと、DssDashboard が「最初からファイルが
// 読み込まれた状態」でアップロードダイアログを開く（空のドロップ画面は見せない）。
import { create } from 'zustand';

interface SeedDimensions { width?: number; depth?: number; height?: number }

interface DssUploadBridgeState {
  /** ダイアログを開く一意トークン（毎回更新で再オープンできる）。 */
  token: number;
  /** 開く時点で読み込ませるファイル。 */
  files: File[];
  /** ファイル取得中など、ダイアログ表示前の準備中フラグ。 */
  preparing: boolean;
  /** 商品ページ由来の実寸（mm）。自動アップロード時に AI 推定より優先して反映する。 */
  seedDimensions: SeedDimensions | null;
  /** ファイル付きでダイアログを開く。 */
  openWith: (files: File[]) => void;
  setPreparing: (v: boolean) => void;
  setSeedDimensions: (d: SeedDimensions | null) => void;
  reset: () => void;
}

export const useDssUploadBridge = create<DssUploadBridgeState>((set, get) => ({
  token: 0,
  files: [],
  preparing: false,
  seedDimensions: null,
  openWith: (files) => set({ files, token: get().token + 1, preparing: false }),
  setPreparing: (v) => set({ preparing: v }),
  setSeedDimensions: (d) => set({ seedDimensions: d }),
  reset: () => set({ files: [], preparing: false, seedDimensions: null }),
}));
