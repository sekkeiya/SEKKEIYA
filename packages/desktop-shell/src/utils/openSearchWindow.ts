import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// SEKKEIYA Search を独立したネイティブ・ウィンドウ（常時最前面）として開く。
// アプリのWebView外＝デスクトップ上の任意位置へ移動でき、他アプリと並べて使える。
// 別JSコンテキストになるため v1 は家具/視覚検索（IndexedDB共有）を主対象とする。
// ★窓は1枚だけ使い回す（プロセス積み上がり防止）。既に開いていれば最前面に出すだけ。
//   固定ラベルは capabilities の `sekkeiya-search-*` パターンに一致させる。
const SEARCH_WINDOW_LABEL = 'sekkeiya-search-main';

export const openSearchWindow = async () => {
  const existing = await WebviewWindow.getByLabel(SEARCH_WINDOW_LABEL);
  if (existing) {
    try { await existing.show(); } catch { /* noop */ }
    try { await existing.unminimize(); } catch { /* noop */ }
    try { await existing.setFocus(); } catch { /* noop */ }
    return existing;
  }
  const win = new WebviewWindow(SEARCH_WINDOW_LABEL, {
    url: '/?searchWindow=true',
    title: 'SEKKEIYA Search',
    width: 720,
    height: 680,
    minWidth: 380,
    minHeight: 420,
    center: true,
    resizable: true,
    decorations: true,
    alwaysOnTop: true,
  });
  win.once('tauri://error', (e) => {
    console.error('[openSearchWindow] Failed to open window:', e);
  });
  return win;
};
