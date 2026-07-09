// Web stub for @tauri-apps/api/core
// `invoke` reaches the Rust backend on desktop. On web there is no backend, so we
// reject. Most callers already .catch() native-only commands; the ones that consume
// the result structurally are guarded off via isTauri().
export function invoke<T = unknown>(cmd: string, _args?: Record<string, unknown>): Promise<T> {
  return Promise.reject(new Error(`[web] Tauri command unavailable: ${cmd}`));
}

export function isTauri(): boolean {
  return false;
}

export function transformCallback(): number {
  return 0;
}

export class Channel<T = unknown> {
  onmessage: ((msg: T) => void) | null = null;
}

export class PluginListener {}

export function addPluginListener(): Promise<PluginListener> {
  return Promise.resolve(new PluginListener());
}

export function convertFileSrc(filePath: string): string {
  return filePath;
}
