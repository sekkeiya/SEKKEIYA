// プラグインの有効/無効（plugins.json）と導入メタ（.install.json）の純ロジック（要件70/71）。
// fs は pluginInstaller.ts / loadPlugins.ts 側。ここは文字列 ⇄ 構造体の変換と判断だけ。
//
// - $HOME/SEKKEIYA/Plugins/plugins.json … 無効化したプラグイン id の一覧。
//   「有効」を既定にするため disabled 側を持つ（ファイルが無ければ全部有効）。
// - $HOME/SEKKEIYA/Plugins/<id>/.install.json … インストーラー経由で入れた証跡。
//   出所（source）と、インストール時に権限一覧へ同意したか（grantedPermissions）。
//   手でフォルダを置いた開発中プラグインにはこのファイルが無い＝ self / 同意扱い。
import type { PluginSource } from './dataScopePolicy';

export const PLUGIN_SETTINGS_FILE = 'plugins.json';
export const INSTALL_META_FILE = '.install.json';

export interface PluginSettings {
  /** 無効化されたプラグイン id。 */
  disabled: string[];
}

/** 壊れた/無い設定はエラーにせず「全部有効」に倒す（起動を止めないため）。 */
export function parsePluginSettings(raw: string | null | undefined): PluginSettings {
  if (!raw) return { disabled: [] };
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && Array.isArray((v as { disabled?: unknown }).disabled)) {
      const list = (v as { disabled: unknown[] }).disabled;
      return { disabled: list.filter((d): d is string => typeof d === 'string') };
    }
  } catch {
    // fallthrough
  }
  return { disabled: [] };
}

export function serializePluginSettings(settings: PluginSettings): string {
  return JSON.stringify({ disabled: [...settings.disabled].sort() }, null, 2) + '\n';
}

export function withPluginDisabled(settings: PluginSettings, pluginId: string, disabled: boolean): PluginSettings {
  const set = new Set(settings.disabled);
  if (disabled) set.add(pluginId);
  else set.delete(pluginId);
  return { disabled: [...set] };
}

export interface InstallMeta {
  source: PluginSource;
  /** インストール時に権限一覧を提示してユーザーが同意したか（要件70）。 */
  grantedPermissions: boolean;
  /** ISO 8601。表示用でロジックには使わない。 */
  installedAt?: string;
}

const SOURCES: PluginSource[] = ['self', 'team', 'marketplace'];

/** 形が壊れていたら null（呼び出し側は「メタ無し＝手置きの self」に倒す）。 */
export function parseInstallMeta(raw: string | null | undefined): InstallMeta | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const m = v as { source?: unknown; grantedPermissions?: unknown; installedAt?: unknown };
    if (typeof m.source !== 'string' || !SOURCES.includes(m.source as PluginSource)) return null;
    return {
      source: m.source as PluginSource,
      grantedPermissions: m.grantedPermissions === true,
      installedAt: typeof m.installedAt === 'string' ? m.installedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function serializeInstallMeta(meta: InstallMeta): string {
  return JSON.stringify(meta, null, 2) + '\n';
}
