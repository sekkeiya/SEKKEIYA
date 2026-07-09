// Web stub for @tauri-apps/api/webviewWindow
const noop = () => Promise.resolve();

export class WebviewWindow {
  label: string;
  constructor(label: string, _options?: Record<string, unknown>) {
    this.label = label;
  }
  once = (_event: string, _handler: (e: unknown) => void) => Promise.resolve(() => {});
  listen = (_event: string, _handler: (e: unknown) => void) => Promise.resolve(() => {});
  emit = (_event: string, _payload?: unknown) => Promise.resolve();
  show = noop;
  hide = noop;
  close = noop;
  setFocus = noop;
  static getByLabel(_label: string): Promise<WebviewWindow | null> {
    return Promise.resolve(null);
  }
  static getAll(): Promise<WebviewWindow[]> {
    return Promise.resolve([]);
  }
}

export function getCurrentWebviewWindow(): WebviewWindow {
  return new WebviewWindow('main');
}
