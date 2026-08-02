// プラグインの読み込み（Tauri fs 依存はこのファイルだけ）。
// 起動時に $HOME/SEKKEIYA/Plugins/*/plugin.json を読み、検証と engine 照合を通ったものだけ返す。
// 弾いたものは理由つきで rejected に入れ、プラグイン一覧に出せるようにする（要件72）。
//
// この時点では iframe を作らない。タブが押されて初めて PluginFrame が起動する。
import { exists as fsExists, readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { isTauri } from '../../../lib/platform';
import { validateManifest } from '../manifest/validateManifest';
import type { PluginManifest } from '../manifest/manifestTypes';
import { API_VERSION, satisfiesEngine, engineErrorMessage } from './engineCompat';
import { resolveDataScopePolicy, type DataScopePolicy, type PluginSource } from './dataScopePolicy';
import { buildPluginsRoot } from './pluginPaths';
import {
  PLUGIN_SETTINGS_FILE, INSTALL_META_FILE,
  parsePluginSettings, parseInstallMeta,
} from './pluginSettings';

export interface LoadedPlugin {
  manifest: PluginManifest;
  /** プラグインフォルダの絶対パス。 */
  dir: string;
  source: PluginSource;
  policy: DataScopePolicy;
  /** 要件71: plugins.json で無効化されていないか。無効でも一覧には出す（再有効化のため）。 */
  enabled: boolean;
}

export interface RejectedPlugin {
  dir: string;
  reason: string;
}

export interface LoadResult {
  loaded: LoadedPlugin[];
  rejected: RejectedPlugin[];
}

export async function loadPlugins(): Promise<LoadResult> {
  if (!isTauri()) return { loaded: [], rejected: [] };

  const loaded: LoadedPlugin[] = [];
  const rejected: RejectedPlugin[] = [];

  // 呼び出し側が catch し忘れても起動が止まらないように、初期化エラーも常に resolve として返す。
  try {
    const root = buildPluginsRoot(await homeDir());
    if (!(await fsExists(root))) return { loaded, rejected };

    // 有効/無効（要件71）。ファイルが無ければ全部有効。
    const settingsFile = `${root}/${PLUGIN_SETTINGS_FILE}`;
    const settings = parsePluginSettings(
      (await fsExists(settingsFile)) ? await readTextFile(settingsFile) : null,
    );

    for (const entry of await readDir(root)) {
      if (!entry.isDirectory) continue;
      const dir = `${root}/${entry.name}`;
      const file = `${dir}/plugin.json`;
      try {
        if (!(await fsExists(file))) {
          rejected.push({ dir, reason: 'plugin.json がありません' });
          continue;
        }
        const raw: unknown = JSON.parse(await readTextFile(file));
        const result = validateManifest(raw);
        if (!result.ok) {
          rejected.push({ dir, reason: result.errors.map(e => `${e.path}: ${e.message}`).join(' / ') });
          continue;
        }
        const { manifest } = result;
        if (!satisfiesEngine(manifest.engine, API_VERSION)) {
          rejected.push({ dir, reason: engineErrorMessage(manifest.engine) });
          continue;
        }
        if (loaded.some(p => p.manifest.id === manifest.id)) {
          rejected.push({ dir, reason: `id が重複しています: ${manifest.id}` });
          continue;
        }

        // 出所と同意（要件70）。インストーラー経由なら .install.json がある。
        // 手でフォルダを置いた開発中プラグインにはメタが無い＝自分のツール（self / 同意扱い）。
        let source: PluginSource = 'self';
        let granted = true;
        const metaFile = `${dir}/${INSTALL_META_FILE}`;
        if (await fsExists(metaFile)) {
          const meta = parseInstallMeta(await readTextFile(metaFile));
          if (meta) {
            source = meta.source;
            granted = meta.grantedPermissions;
          }
        }

        loaded.push({
          manifest,
          dir,
          source,
          policy: resolveDataScopePolicy(source, manifest.permissions, granted),
          enabled: !settings.disabled.includes(manifest.id),
        });
      } catch (e) {
        rejected.push({ dir, reason: e instanceof Error ? e.message : String(e) });
      }
    }
  } catch (e) {
    rejected.push({ dir: '', reason: e instanceof Error ? e.message : String(e) });
  }

  return { loaded, rejected };
}
