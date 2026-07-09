// Web stub for @tauri-apps/plugin-global-shortcut
// OS-level global shortcuts are desktop-only; no-op on web.
export function register(_shortcut: string, _handler: (e: unknown) => void): Promise<void> {
  return Promise.resolve();
}
export function registerAll(_shortcuts: string[], _handler: (e: unknown) => void): Promise<void> {
  return Promise.resolve();
}
export function unregister(_shortcut: string): Promise<void> {
  return Promise.resolve();
}
export function unregisterAll(): Promise<void> {
  return Promise.resolve();
}
export function isRegistered(_shortcut: string): Promise<boolean> {
  return Promise.resolve(false);
}
