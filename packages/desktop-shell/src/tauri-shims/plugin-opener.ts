// Web stub for @tauri-apps/plugin-opener — real web fallback via window.open.
export function openUrl(url: string, _openWith?: string): Promise<void> {
  window.open(url, '_blank', 'noopener,noreferrer');
  return Promise.resolve();
}
export function openPath(_path: string, _openWith?: string): Promise<void> {
  // No filesystem on web — nothing to open.
  return Promise.resolve();
}
export function revealItemInDir(_path: string): Promise<void> {
  return Promise.resolve();
}
