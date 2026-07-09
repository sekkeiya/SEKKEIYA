// Web stub for @tauri-apps/api/path
// Filesystem paths are meaningless on web; these are reached only from native-only
// code paths that are guarded by isTauri(). Reject loudly if somehow called.
const unavailable = (name: string) => () =>
  Promise.reject(new Error(`[web] path.${name} unavailable`));

export const appDataDir = unavailable('appDataDir');
export const appConfigDir = unavailable('appConfigDir');
export const appCacheDir = unavailable('appCacheDir');
export const appLocalDataDir = unavailable('appLocalDataDir');
export const dataDir = unavailable('dataDir');
export const desktopDir = unavailable('desktopDir');
export const documentDir = unavailable('documentDir');
export const downloadDir = unavailable('downloadDir');
export const homeDir = unavailable('homeDir');
export const tempDir = unavailable('tempDir');
export const resourceDir = unavailable('resourceDir');

export function join(...parts: string[]): Promise<string> {
  return Promise.resolve(parts.join('/'));
}
export function dirname(p: string): Promise<string> {
  return Promise.resolve(p.replace(/[/\\][^/\\]*$/, ''));
}
export function basename(p: string): Promise<string> {
  return Promise.resolve(p.replace(/^.*[/\\]/, ''));
}
export function extname(p: string): Promise<string> {
  const m = /\.([^.\\/]+)$/.exec(p);
  return Promise.resolve(m ? m[1] : '');
}
export const sep = '/';
export const delimiter = ':';
