// インストール / アンインストール / 有効・無効 / パッケージ化の fs 実務（要件70/71）。
// 判断（zip の検証・設定の形）は pluginPackage.ts / pluginSettings.ts の純ロジック側。
// ここは $HOME/SEKKEIYA 配下への読み書きだけを行う（Tauri 環境専用）。
import {
  exists, mkdir, readDir, readFile, readTextFile, remove, writeFile, writeTextFile,
} from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import type { PluginManifest } from '../manifest/manifestTypes';
import { validateManifest } from '../manifest/validateManifest';
import type { PluginSource } from './dataScopePolicy';
import { buildPluginsRoot, buildPluginDir } from './pluginPaths';
import {
  PLUGIN_SETTINGS_FILE, INSTALL_META_FILE,
  parsePluginSettings, serializePluginSettings, withPluginDisabled, serializeInstallMeta,
} from './pluginSettings';
import {
  extractPluginPackage, packPluginFiles, packageFileName, type PluginPackage,
} from './pluginPackage';
import { DEV_PROJECTS_SUBDIR } from '../../global-settings/panels/backlog/projectPaths';

/**
 * 任意の場所のファイルをバイナリで読む。
 * capabilities の fs スコープは $HOME/SEKKEIYA/** のみなので、ダイアログで選んだ
 * zip（ダウンロードフォルダ等）は既存の Rust コマンド経由で読む。
 */
export async function readBinaryFileAnywhere(path: string): Promise<Uint8Array> {
  const data = await invoke<number[]>('read_local_binary_file', { path });
  return new Uint8Array(data);
}

/**
 * 展開済みパッケージを $HOME/SEKKEIYA/Plugins/<id>/ へ書き込む。
 * 同 id が既にあれば丸ごと置き換え（更新）。導入メタ（出所と同意）も書く。
 * 呼び出し側は書き込み前に必ず権限同意ダイアログを通すこと（要件70）。
 */
export async function installPluginPackage(pkg: PluginPackage, source: PluginSource): Promise<string> {
  const home = await homeDir();
  const dir = buildPluginDir(home, pkg.manifest.id);
  if (await exists(dir)) await remove(dir, { recursive: true });
  await mkdir(dir, { recursive: true });

  // サブディレクトリを先に掘る（writeFile は親を作らない）。
  const dirs = new Set<string>();
  for (const rel of Object.keys(pkg.files)) {
    const parts = rel.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  for (const d of [...dirs].sort()) await mkdir(`${dir}/${d}`, { recursive: true });

  for (const [rel, data] of Object.entries(pkg.files)) {
    await writeFile(`${dir}/${rel}`, data);
  }
  await writeTextFile(`${dir}/${INSTALL_META_FILE}`, serializeInstallMeta({
    source,
    grantedPermissions: true,
    installedAt: new Date().toISOString(),
  }));
  return dir;
}

/** プラグインフォルダを削除する（アンインストール）。 */
export async function uninstallPlugin(dir: string): Promise<void> {
  await remove(dir, { recursive: true });
}

/** plugins.json を読み書きして有効/無効を切り替える（要件71）。 */
export async function setPluginDisabled(pluginId: string, disabled: boolean): Promise<void> {
  const home = await homeDir();
  const root = buildPluginsRoot(home);
  await mkdir(root, { recursive: true });
  const file = `${root}/${PLUGIN_SETTINGS_FILE}`;
  const current = parsePluginSettings((await exists(file)) ? await readTextFile(file) : null);
  await writeTextFile(file, serializePluginSettings(withPluginDisabled(current, pluginId, disabled)));
}

export interface DevPluginProject {
  /** プロジェクトフォルダの絶対パス。 */
  dir: string;
  folderName: string;
  manifest: PluginManifest;
}

/** $HOME/SEKKEIYA/Dev/ 直下から plugin.json を持つプロジェクトを列挙する（要件71 パッケージ化の対象）。 */
export async function listDevPluginProjects(): Promise<DevPluginProject[]> {
  const home = await homeDir();
  const base = home.replace(/[\\/]+$/, '').replace(/\\/g, '/');
  const devRoot = `${base}/${DEV_PROJECTS_SUBDIR}`;
  const out: DevPluginProject[] = [];
  if (!(await exists(devRoot))) return out;
  for (const entry of await readDir(devRoot)) {
    if (!entry.isDirectory) continue;
    const dir = `${devRoot}/${entry.name}`;
    try {
      const file = `${dir}/plugin.json`;
      if (!(await exists(file))) continue;
      const result = validateManifest(JSON.parse(await readTextFile(file)));
      if (result.ok) out.push({ dir, folderName: entry.name, manifest: result.manifest });
    } catch {
      // 壊れた plugin.json のプロジェクトは一覧に出さない（作成途中でありうる）
    }
  }
  return out;
}

/** パッケージに含めないフォルダ / ファイル。 */
const PACK_SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.claude']);
const PACK_SKIP_FILES = new Set([INSTALL_META_FILE]);

async function collectFiles(base: string, rel: string, out: Record<string, Uint8Array>): Promise<void> {
  for (const entry of await readDir(rel ? `${base}/${rel}` : base)) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory) {
      if (PACK_SKIP_DIRS.has(entry.name)) continue;
      await collectFiles(base, childRel, out);
    } else {
      if (PACK_SKIP_FILES.has(entry.name)) continue;
      out[childRel] = await readFile(`${base}/${childRel}`);
    }
  }
}

export interface PackResult {
  zipPath: string;
  manifest: PluginManifest;
  bytes: Uint8Array;
}

/**
 * 開発プロジェクトを zip にパッケージ化し、<プロジェクト>/dist/<id>-<version>.zip に書き出す。
 * 生成した zip を extractPluginPackage で開き直して検証する（配布物そのものを検証するため）。
 */
export async function packDevProject(projectDir: string): Promise<PackResult> {
  const files: Record<string, Uint8Array> = {};
  await collectFiles(projectDir, '', files);
  const bytes = packPluginFiles(files);
  const result = extractPluginPackage(bytes);
  if (!result.ok) throw new Error(result.error);

  const distDir = `${projectDir}/dist`;
  await mkdir(distDir, { recursive: true });
  const zipPath = `${distDir}/${packageFileName(result.pkg.manifest)}`;
  await writeFile(zipPath, bytes);
  return { zipPath, manifest: result.pkg.manifest, bytes };
}
