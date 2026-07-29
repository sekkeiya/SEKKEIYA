import { describe, it, expect } from 'vitest';
import { PLUGINS_SUBDIR, buildPluginsRoot, buildPluginDir } from './pluginPaths';

describe('buildPluginsRoot', () => {
  it('SEKKEIYA/Plugins 配下を返す', () => {
    expect(buildPluginsRoot('C:/Users/me')).toBe('C:/Users/me/SEKKEIYA/Plugins');
  });
  it('バックスラッシュを / に正規化する', () => {
    expect(buildPluginsRoot('C:\\Users\\me')).toBe('C:/Users/me/SEKKEIYA/Plugins');
  });
  it('末尾の区切りを吸収する', () => {
    expect(buildPluginsRoot('C:/Users/me/')).toBe('C:/Users/me/SEKKEIYA/Plugins');
  });
  it('サブディレクトリ定数と一致する', () => {
    expect(PLUGINS_SUBDIR).toBe('SEKKEIYA/Plugins');
  });
});

describe('buildPluginDir', () => {
  it('プラグイン id のフォルダを返す', () => {
    expect(buildPluginDir('C:/Users/me', 'com.example.tool')).toBe('C:/Users/me/SEKKEIYA/Plugins/com.example.tool');
  });
});
