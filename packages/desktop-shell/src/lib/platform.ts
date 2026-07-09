// platform.ts — 実行環境の判定ヘルパー。
// Tauri デスクトップ（ネイティブ）か、ブラウザ（Web ビルド）かを判定する。
// Web ビルドではネイティブ機能（Rust invoke / ローカルFS / ウィンドウ制御等）が
// 利用できないため、呼び出し側はこの判定で分岐・フォールバックする。

/** Tauri ネイティブ環境で動作しているか。ブラウザ（Web）では false。 */
export function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
  } catch {
    return false;
  }
}

/** ブラウザ（Web）で動作しているか。 */
export function isWeb(): boolean {
  return !isTauri();
}
