// sync-desktop-shell.mjs の変換ロジックのテスト。
//
// このスクリプトが壊れると、ビルドもデプロイも成功したまま
// **本番 Web に古いアプリ UI が出る**（エラーが一切出ない）。
// このリポジトリで最も気づきにくい失敗モードなので、最初のテスト対象に選んだ。
//
// 実行:  cd sekkeiya && npm test
//
// テストの読み方:
//   test('説明', () => { ... })        … テスト 1 件
//   assert.equal(実際の値, 期待する値)  … 「この2つは等しいはず」
//   違っていたらテストが失敗（赤）になり、どこがどう違うか表示される。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { tauriSpecToShim, toRelative } from '../lib/sync-transforms.mjs';

// ---------------------------------------------------------------------------
// 1. @tauri-apps の指定子 → Web 用シムのファイル名
// ---------------------------------------------------------------------------
// desktop 側で新しい @tauri-apps モジュールを import したとき、対応するシムが
// 無ければ sync が警告を出す。その判定の入口がこの関数。

test('tauriSpecToShim: @tauri-apps の指定子をシム名に変換する', () => {
  // api/ 配下は 'api-' 接頭辞が付く
  assert.equal(tauriSpecToShim('@tauri-apps/api/core'), 'api-core');
  assert.equal(tauriSpecToShim('@tauri-apps/api/event'), 'api-event');

  // キャメルケースのモジュール名もそのまま通る
  assert.equal(tauriSpecToShim('@tauri-apps/api/webviewWindow'), 'api-webviewWindow');

  // plugin- 系はハイフンを含んだまま
  assert.equal(tauriSpecToShim('@tauri-apps/plugin-fs'), 'plugin-fs');
  assert.equal(tauriSpecToShim('@tauri-apps/plugin-global-shortcut'), 'plugin-global-shortcut');
});

test('tauriSpecToShim: @tauri-apps 以外は null を返す（シム不要の印）', () => {
  assert.equal(tauriSpecToShim('react'), null);
  assert.equal(tauriSpecToShim('@mui/material'), null);
  assert.equal(tauriSpecToShim('./local-module'), null);
  assert.equal(tauriSpecToShim(''), null);
});

// ---------------------------------------------------------------------------
// 2. '@/...' 指定子 → 相対パス
// ---------------------------------------------------------------------------
// desktop では @ = desktop/src。Web の vite では @ = web/src を指すため、
// そのまま残すと別ツリーを参照して壊れる。ここが本丸。

const SHELL_SRC = path.join('C:', 'shell', 'src');
const inShell = (p) => path.join(SHELL_SRC, p);

test('toRelative: 深い階層から src 直下へ、正しい数だけ遡る', () => {
  assert.equal(
    toRelative(SHELL_SRC, inShell('features/dsl/layout/editor/LayoutShell.tsx'), 'store/useAppStore'),
    '../../../../store/useAppStore',
  );
  assert.equal(
    toRelative(SHELL_SRC, inShell('shared/layout/workspace/Adapters.tsx'), 'features/dsl/x'),
    '../../../features/dsl/x',
  );
  assert.equal(
    toRelative(SHELL_SRC, inShell('store/useAppStore.ts'), 'lib/platform'),
    '../lib/platform',
  );
});

test('toRelative: 同じ階層なら "./" を付ける（付け忘れると解決できない）', () => {
  // src 直下のファイルから src 直下を指す場合、path.relative は
  // 'store/useAppStore' を返す。これは bare specifier（npm パッケージ名）と
  // 区別が付かないため、'./' を付けないと import が壊れる。
  assert.equal(
    toRelative(SHELL_SRC, inShell('App.tsx'), 'store/useAppStore'),
    './store/useAppStore',
  );
});

test('toRelative: 返すパスは常にスラッシュ区切り（Windows でも \\ にしない）', () => {
  const result = toRelative(SHELL_SRC, inShell('features/dsl/Editor.tsx'), 'store/useAppStore');
  assert.ok(!result.includes('\\'), `バックスラッシュが混入している: ${result}`);
});
