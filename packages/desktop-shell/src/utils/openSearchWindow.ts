import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// SEKKEIYA Search を独立したネイティブ・ウィンドウ（常時最前面）として開く。
// アプリのWebView外＝デスクトップ上の任意位置へ移動でき、他アプリと並べて使える。
// 別JSコンテキストになるため v1 は家具/視覚検索（IndexedDB共有）を主対象とする。
export const openSearchWindow = () => {
  const label = `sekkeiya-search-${Date.now()}`;
  const win = new WebviewWindow(label, {
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
