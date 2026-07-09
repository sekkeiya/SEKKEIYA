import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// SEKKEIYA Drive（旧 AI Drive）を独立したネイティブ・ウィンドウとして開く。
// SEKKEIYA OS（チャット）ヘッダーのランチャーから Search / Reader と並べて起動する。
// ★窓は1枚だけ使い回す（プロセス積み上がり防止）。既に開いていれば最前面に出すだけ。
//   固定ラベルは capabilities の `sekkeiya-drive-*` パターンに一致させる。
const DRIVE_WINDOW_LABEL = 'sekkeiya-drive-main';

export const openDriveWindow = async () => {
  const existing = await WebviewWindow.getByLabel(DRIVE_WINDOW_LABEL);
  if (existing) {
    try { await existing.show(); } catch { /* noop */ }
    try { await existing.unminimize(); } catch { /* noop */ }
    try { await existing.setFocus(); } catch { /* noop */ }
    return existing;
  }
  const win = new WebviewWindow(DRIVE_WINDOW_LABEL, {
    url: '/?driveWindow=true',
    title: 'SEKKEIYA Drive',
    width: 1100,
    height: 820,
    minWidth: 640,
    minHeight: 480,
    center: true,
    resizable: true,
    decorations: true,
  });
  win.once('tauri://error', (e) => {
    console.error('[openDriveWindow] Failed to open window:', e);
  });
  return win;
};
