// プラグインの置き場所（React / fs 非依存の純ロジック）。
//
// $HOME/SEKKEIYA/** は capabilities で既に fs 許可済みなので、ここに置けば
// 追加の Tauri 設定なしで読める。SEKKEIYA/Dev（開発プロジェクト）と並ぶ位置。
export const PLUGINS_SUBDIR = 'SEKKEIYA/Plugins';

export function buildPluginsRoot(home: string): string {
  const base = home.replace(/[\\/]+$/, '').replace(/\\/g, '/');
  return `${base}/${PLUGINS_SUBDIR}`;
}

export function buildPluginDir(home: string, pluginId: string): string {
  return `${buildPluginsRoot(home)}/${pluginId}`;
}
