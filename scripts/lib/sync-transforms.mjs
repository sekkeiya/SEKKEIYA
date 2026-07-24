// sync-desktop-shell.mjs で使う「純粋な変換関数」だけを切り出したモジュール。
//
// なぜ分けるか:
//   sync-desktop-shell.mjs は import しただけでファイルの削除・コピーを始める。
//   テストから安全に呼ぶには、副作用の無い部分だけを別ファイルにする必要がある。
//
// ここに置く関数は「入力を渡すと出力が返るだけ」であること。
// ファイル読み書き・グローバル変数への依存を持ち込まない。

import path from 'path';

/**
 * '@tauri-apps/...' の import 指定子を、Web 用シムのファイル名へ変換する。
 * 対応するシムが無い形なら null を返す（呼び出し側が警告を出す）。
 *
 *   '@tauri-apps/api/core'  -> 'api-core'
 *   '@tauri-apps/plugin-fs' -> 'plugin-fs'
 *   'react'                 -> null
 */
export function tauriSpecToShim(spec) {
  const m = spec.match(/^@tauri-apps\/(?:api\/(\w+)|(plugin-[\w-]+))/);
  if (!m) return null;
  return m[1] ? `api-${m[1]}` : m[2];
}

/**
 * desktop 側の `@/...` 指定子を、Web 側シェルから見た相対パスへ変換する。
 *
 * desktop では `@` = desktop/src だが、Web の vite では `@` = web/src を指す。
 * そのまま残すと別のツリーを参照して壊れるため、相対パスへ書き換える。
 * **ここが壊れると、ビルドもデプロイも成功したまま本番に古い UI が出る。**
 *
 * @param shellSrc  packages/desktop-shell/src の絶対パス
 * @param fromFile  変換対象のファイルの絶対パス
 * @param specPath  '@/' を除いた指定子（例: 'store/useAppStore'）
 */
export function toRelative(shellSrc, fromFile, specPath) {
  const target = path.join(shellSrc, specPath);
  let rel = path.relative(path.dirname(fromFile), target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}
