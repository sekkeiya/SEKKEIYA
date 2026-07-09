// Web stub for @tauri-apps/plugin-deep-link
// Deep-link / custom-scheme handling is desktop-only; no-op on web.
export function onOpenUrl(_handler: (urls: string[]) => void): Promise<() => void> {
  return Promise.resolve(() => {});
}
export function getCurrent(): Promise<string[] | null> {
  return Promise.resolve(null);
}
export function register(_scheme: string): Promise<void> {
  return Promise.resolve();
}
export function unregister(_scheme: string): Promise<void> {
  return Promise.resolve();
}
export function isRegistered(_scheme: string): Promise<boolean> {
  return Promise.resolve(false);
}
