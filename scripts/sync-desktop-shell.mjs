// sync-desktop-shell.mjs
// ---------------------------------------------------------------------------
// Web 版 (sekkeiya) のログイン後アプリは、desktop アプリ (sekkeiya-desktop) の
// src を packages/desktop-shell/src に「ベンダリング(コピー)」して、@desktop
// エイリアス経由で mount している。手作業コピーだとドリフトして古くなるため、
// このスクリプトで desktop/src から決定論的に再生成する。
//
// 変換ルール:
//   1. desktop/src を packages/desktop-shell/src へ丸ごとコピー
//      （tauri-shims/ と DesktopShellWeb.tsx は Web 専用グルーなので保護）
//   2. コード中の `@/...` import 指定子を相対パスに書き換える
//      （desktop の `@` = desktop/src。Web の vite では `@` = web/src を指すため、
//        そのままだと別ツリーを参照して壊れる。現行 shell も @/ をほぼ持たない）
//   3. App.tsx の AppContent / GlobalModals / GlobalLoader に `export` を注入
//      （DesktopShellWeb.tsx がこれらを named import するため）
//   4. `@tauri-apps/*` import は vite.config の alias が shim へ振るので無変換。
//      ただし未 shim の指定子があれば警告（要 shim 追加）。
//
// 使い方:  node scripts/sync-desktop-shell.mjs
// その後:  npm run build && firebase deploy --only hosting
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// 純粋な変換関数は lib/ に切り出してテスト可能にしてある（scripts/__tests__/ 参照）
import { tauriSpecToShim, toRelative } from './lib/sync-transforms.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const DESKTOP_ROOT = path.resolve(WEB_ROOT, '../sekkeiya-desktop');
const DESKTOP_SRC = path.join(DESKTOP_ROOT, 'src');
const SHELL_SRC = path.resolve(WEB_ROOT, 'packages/desktop-shell/src');
// desktop の一部 src ファイルは src 外の Tauri アセットを `../../../src-tauri/...`
// で import している。同じ相対構造を packages/desktop-shell/src-tauri/ に mirror
// しておくと、パス書き換え不要でそのまま解決できる（旧ベンダリングと同じ配置）。
const DESKTOP_TAURI = path.join(DESKTOP_ROOT, 'src-tauri');
const SHELL_TAURI = path.resolve(WEB_ROOT, 'packages/desktop-shell/src-tauri');

// desktop には存在せず Web 専用なので上書き/削除しない最上位エントリ
const PRESERVE = new Set(['tauri-shims', 'DesktopShellWeb.tsx']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// 既存 shim の集合（カバレッジ検証用）。例: 'api-core', 'plugin-fs'
const SHIMMED = new Set(
  fs.readdirSync(path.join(SHELL_SRC, 'tauri-shims'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, '')),
);

function rmExceptPreserve(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (PRESERVE.has(entry)) continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function copyInto(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyInto(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

let fileCount = 0;
let rewriteCount = 0;
const missingShims = new Set();

function processFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1) quoted `@/...` 指定子 → 相対パス（from / import() / require() 全て対象）
  code = code.replace(/(['"])@\/([^'"]+)\1/g, (_m, q, p) => {
    changed = true;
    rewriteCount++;
    return q + toRelative(SHELL_SRC, file, p) + q;
  });

  // 2) tauri 指定子の shim カバレッジ検証
  for (const m of code.matchAll(/['"](@tauri-apps\/[^'"]+)['"]/g)) {
    const shim = tauriSpecToShim(m[1]);
    if (!shim || !SHIMMED.has(shim)) missingShims.add(m[1]);
  }

  if (changed) fs.writeFileSync(file, code);
}

// src 外から import される Tauri アセットを mirror（src-tauri/src/assets, src-tauri/icons/icon.png）
function mirrorTauriAssets() {
  const assetsSrc = path.join(DESKTOP_TAURI, 'src', 'assets');
  const assetsDst = path.join(SHELL_TAURI, 'src', 'assets');
  if (fs.existsSync(assetsSrc)) {
    fs.rmSync(assetsDst, { recursive: true, force: true });
    copyInto(assetsSrc, assetsDst);
  }
  const iconSrc = path.join(DESKTOP_TAURI, 'icons', 'icon.png');
  if (fs.existsSync(iconSrc)) {
    fs.mkdirSync(path.join(SHELL_TAURI, 'icons'), { recursive: true });
    fs.copyFileSync(iconSrc, path.join(SHELL_TAURI, 'icons', 'icon.png'));
  }
  console.log('[sync] tauri アセット mirror 完了（src-tauri/src/assets, src-tauri/icons/icon.png）');
}

// App.tsx の 3 つの const に export を注入
function injectExports() {
  const appFile = path.join(SHELL_SRC, 'App.tsx');
  let code = fs.readFileSync(appFile, 'utf8');
  for (const name of ['AppContent', 'GlobalModals', 'GlobalLoader']) {
    const has = new RegExp(`^const ${name} = `, 'm');
    const already = new RegExp(`^export const ${name} = `, 'm');
    if (already.test(code)) continue;
    if (has.test(code)) {
      code = code.replace(has, `export const ${name} = `);
    } else {
      console.warn(`[sync] ⚠ App.tsx に const ${name} が見つかりません（DesktopShellWeb の import が壊れる可能性）`);
    }
  }
  fs.writeFileSync(appFile, code);
}

// --- run ---------------------------------------------------------------
if (!fs.existsSync(DESKTOP_SRC)) {
  console.error(`[sync] desktop src が見つかりません: ${DESKTOP_SRC}`);
  process.exit(1);
}
console.log('[sync] desktop:', DESKTOP_SRC);
console.log('[sync] shell  :', SHELL_SRC);

// 1) 保護対象以外を一掃 → desktop からクリーンコピー（orphan は自然に消える）
rmExceptPreserve(SHELL_SRC);
for (const entry of fs.readdirSync(DESKTOP_SRC, { withFileTypes: true })) {
  if (PRESERVE.has(entry.name)) continue;
  const s = path.join(DESKTOP_SRC, entry.name);
  const d = path.join(SHELL_SRC, entry.name);
  if (entry.isDirectory()) copyInto(s, d);
  else if (entry.isFile()) fs.copyFileSync(s, d);
}

// 2) コードを書き換え（shim/グルーは除外）
walk(SHELL_SRC, (p) => {
  if (p.endsWith('DesktopShellWeb.tsx')) return;
  if (p.split(path.sep).includes('tauri-shims')) return;
  if (!CODE_EXT.has(path.extname(p))) return;
  fileCount++;
  processFile(p);
});

// 3) src 外 Tauri アセットの mirror
mirrorTauriAssets();

// 4) export 注入
injectExports();

console.log(`[sync] 処理ファイル: ${fileCount} 件 / @/ 書き換え: ${rewriteCount} 件`);
if (missingShims.size) {
  console.warn('[sync] ⚠ shim 未登録の @tauri-apps 指定子:');
  for (const s of [...missingShims].sort()) console.warn('   -', s);
  console.warn('[sync]   → tauri-shims/ に対応ファイルを追加し、vite.config.js の alias に登録してください');
} else {
  console.log('[sync] ✓ すべての @tauri-apps import は shim 済み');
}
console.log('[sync] 完了。次: npm run build && firebase deploy --only hosting');
