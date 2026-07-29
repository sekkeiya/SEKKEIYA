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

export interface LoadedPlugin {
  manifest: PluginManifest;
  /** プラグインフォルダの絶対パス。 */
  dir: string;
  source: PluginSource;
  policy: DataScopePolicy;
}

export interface RejectedPlugin {
  dir: string;
  reason: string;
}

export interface LoadResult {
  loaded: LoadedPlugin[];
  rejected: RejectedPlugin[];
}

/**
 * $HOME/SEKKEIYA/Plugins に自分で置いたものは source='self'。
 * 初版はここしか経路が無い(チーム配布とマーケットは未実装)。
 */
const LOCAL_SOURCE: PluginSource = 'self';

export async function loadPlugins(): Promise<LoadResult> {
  if (!isTauri()) return { loaded: [], rejected: [] };

  const loaded: LoadedPlugin[] = [];
  const rejected: RejectedPlugin[] = [];

  // 呼び出し側が catch し忘れても起動が止まらないように、初期化エラーも常に resolve として返す。
  try {
    const root = buildPluginsRoot(await homeDir());
    if (!(await fsExists(root))) return { loaded, rejected };

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
        loaded.push({
          manifest,
          dir,
          source: LOCAL_SOURCE,
          policy: resolveDataScopePolicy(LOCAL_SOURCE, manifest.permissions),
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
