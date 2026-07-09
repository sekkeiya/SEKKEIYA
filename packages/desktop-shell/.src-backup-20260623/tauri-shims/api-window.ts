// Web stub for @tauri-apps/api/window
const noop = () => Promise.resolve();

class StubWindow {
  label = 'main';
  setTitle = (_t: string) => Promise.resolve();
  show = noop;
  hide = noop;
  setFocus = noop;
  unminimize = noop;
  minimize = noop;
  maximize = noop;
  unmaximize = noop;
  close = noop;
  center = noop;
  setSize = noop;
  setPosition = noop;
  listen = () => Promise.resolve(() => {});
  once = () => Promise.resolve(() => {});
  emit = noop;
  onCloseRequested = () => Promise.resolve(() => {});
}

const current = new StubWindow();

export function getCurrentWindow(): StubWindow {
  return current;
}

export function getAllWindows(): Promise<StubWindow[]> {
  return Promise.resolve([current]);
}

export { StubWindow as Window };
export const appWindow = current;
