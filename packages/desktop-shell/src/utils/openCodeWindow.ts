import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// SEKKEIYA Code を独立ネイティブ窓として開く。窓は1枚だけ使い回す。
// ラベルは capabilities の `sekkeiya-code-*` パターンに一致させる。
const CODE_WINDOW_LABEL = 'sekkeiya-code-main';

export const openCodeWindow = async () => {
  const existing = await WebviewWindow.getByLabel(CODE_WINDOW_LABEL);
  if (existing) {
    try { await existing.show(); } catch { /* noop */ }
    try { await existing.unminimize(); } catch { /* noop */ }
    try { await existing.setFocus(); } catch { /* noop */ }
    return existing;
  }
  const win = new WebviewWindow(CODE_WINDOW_LABEL, {
    url: '/?codeWindow=true',
    title: 'SEKKEIYA Code',
    width: 1200,
    height: 840,
    minWidth: 720,
    minHeight: 520,
    center: true,
    resizable: true,
    decorations: true,
  });
  win.once('tauri://error', (e) => console.error('[openCodeWindow] Failed to open window:', e));
  return win;
};
