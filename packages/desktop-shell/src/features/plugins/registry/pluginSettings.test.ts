import { describe, it, expect } from 'vitest';
import {
  parsePluginSettings, serializePluginSettings, withPluginDisabled,
  parseInstallMeta, serializeInstallMeta,
} from './pluginSettings';

describe('parsePluginSettings', () => {
  it('無い/空/壊れた JSON は「全部有効」に倒す', () => {
    expect(parsePluginSettings(null)).toEqual({ disabled: [] });
    expect(parsePluginSettings('')).toEqual({ disabled: [] });
    expect(parsePluginSettings('{not json')).toEqual({ disabled: [] });
    expect(parsePluginSettings('[]')).toEqual({ disabled: [] });
    expect(parsePluginSettings('{"disabled": "com.a.b"}')).toEqual({ disabled: [] });
  });
  it('disabled の文字列だけ拾う（混入した非文字列は捨てる）', () => {
    expect(parsePluginSettings('{"disabled": ["com.a.b", 1, null, "com.c.d"]}'))
      .toEqual({ disabled: ['com.a.b', 'com.c.d'] });
  });
  it('serialize → parse で往復できる', () => {
    const s = { disabled: ['com.b.b', 'com.a.a'] };
    expect(parsePluginSettings(serializePluginSettings(s))).toEqual({ disabled: ['com.a.a', 'com.b.b'] });
  });
});

describe('withPluginDisabled', () => {
  it('無効化は追加・再有効化は削除、重複しない', () => {
    let s = parsePluginSettings(null);
    s = withPluginDisabled(s, 'com.a.b', true);
    s = withPluginDisabled(s, 'com.a.b', true);
    expect(s.disabled).toEqual(['com.a.b']);
    s = withPluginDisabled(s, 'com.a.b', false);
    expect(s.disabled).toEqual([]);
  });
  it('元のオブジェクトを破壊しない', () => {
    const before = { disabled: ['com.a.b'] };
    withPluginDisabled(before, 'com.c.d', true);
    expect(before.disabled).toEqual(['com.a.b']);
  });
});

describe('parseInstallMeta', () => {
  it('正常系: source と同意フラグを読む', () => {
    const raw = serializeInstallMeta({ source: 'marketplace', grantedPermissions: true, installedAt: '2026-08-02T00:00:00.000Z' });
    expect(parseInstallMeta(raw)).toEqual({
      source: 'marketplace', grantedPermissions: true, installedAt: '2026-08-02T00:00:00.000Z',
    });
  });
  it('source が不正なら null（呼び出し側が self / 同意扱いへ倒す）', () => {
    expect(parseInstallMeta('{"source":"github","grantedPermissions":true}')).toBeNull();
    expect(parseInstallMeta('{"grantedPermissions":true}')).toBeNull();
    expect(parseInstallMeta('broken')).toBeNull();
    expect(parseInstallMeta(null)).toBeNull();
  });
  it('grantedPermissions は true 以外すべて false', () => {
    expect(parseInstallMeta('{"source":"marketplace","grantedPermissions":"yes"}')?.grantedPermissions).toBe(false);
    expect(parseInstallMeta('{"source":"marketplace"}')?.grantedPermissions).toBe(false);
  });
});
