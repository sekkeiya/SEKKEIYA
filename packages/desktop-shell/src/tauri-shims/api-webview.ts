// Web stub for @tauri-apps/api/webview
// Web版にはネイティブ WebView が無いため、ドラッグ&ドロップ等のイベント購読は no-op。
// 購読メソッドは「解除関数」を返す契約なので、空の unlisten を返す。
const noop = () => Promise.resolve();

export class Webview {
  label: string;
  constructor(label = 'main') {
    this.label = label;
  }
  onDragDropEvent = (_handler: (e: unknown) => void) => Promise.resolve(() => {});
  once = (_event: string, _handler: (e: unknown) => void) => Promise.resolve(() => {});
  listen = (_event: string, _handler: (e: unknown) => void) => Promise.resolve(() => {});
  emit = (_event: string, _payload?: unknown) => Promise.resolve();
  show = noop;
  hide = noop;
  close = noop;
  setFocus = noop;
}

export function getCurrentWebview(): Webview {
  return new Webview('main');
}
