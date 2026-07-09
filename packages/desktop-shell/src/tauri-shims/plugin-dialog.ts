// Web stub for @tauri-apps/plugin-dialog
// Native file/message dialogs are desktop-only. Resolve as "cancelled".
export function open(_options?: unknown): Promise<string | string[] | null> {
  return Promise.resolve(null);
}
export function save(_options?: unknown): Promise<string | null> {
  return Promise.resolve(null);
}
export function message(_message: string, _options?: unknown): Promise<void> {
  return Promise.resolve();
}
export function ask(_message: string, _options?: unknown): Promise<boolean> {
  return Promise.resolve(false);
}
export function confirm(_message: string, _options?: unknown): Promise<boolean> {
  return Promise.resolve(false);
}
