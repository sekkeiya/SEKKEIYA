/**
 * モジュールスコープ参照 — SingleViewportCanvas が保持する WebGL canvas 要素。
 * LayoutShell でサムネイル撮影時に参照する（ref threading / store 不要）。
 */
export const layoutCanvasRef: { current: HTMLCanvasElement | null } = { current: null };
