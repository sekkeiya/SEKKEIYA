import { describe, it, expect } from 'vitest';
import { checkPermission, type PermissionContext } from './permissions';

const ctx = (over: Partial<PermissionContext> = {}): PermissionContext => ({
  pluginId: 'com.example.tool',
  policy: { own: 'readwrite', readScopes: ['3dss'] },
  network: ['https://api.example.com'],
  chat: false,
  ...over,
});

const denied = (r: ReturnType<typeof checkPermission>) => (r.allowed ? '' : r.error);

describe('checkPermission — 宣言不要のもの', () => {
  it('context / ui / storage は常に通す', () => {
    for (const m of ['context.get', 'ui.toast', 'ui.confirm', 'ui.setTitle', 'ui.setSelection', 'storage.get', 'storage.set'] as const) {
      expect(checkPermission(m, {}, ctx()).allowed).toBe(true);
    }
  });
});

describe('checkPermission — workFiles の読み取り', () => {
  it('own が none なら自分の領域も読めない', () => {
    const r = checkPermission('workFiles.list', {}, ctx({ policy: { own: 'none', readScopes: [] } }));
    expect(r.allowed).toBe(false);
    expect(denied(r)).toContain('workFiles');
  });
  it('own が read なら自分の領域を読める', () => {
    expect(checkPermission('workFiles.list', {}, ctx({ policy: { own: 'read', readScopes: [] } })).allowed).toBe(true);
  });
  it('宣言した他 scope は読める', () => {
    expect(checkPermission('workFiles.list', { appScope: '3dss' }, ctx()).allowed).toBe(true);
  });
  it('宣言していない他 scope は読めない', () => {
    const r = checkPermission('workFiles.list', { appScope: '3dsl' }, ctx());
    expect(r.allowed).toBe(false);
    expect(denied(r)).toContain('3dsl');
    expect(denied(r)).toContain('readScopes');
  });
});

describe('checkPermission — workFiles の書き込み', () => {
  it('own が readwrite なら自分の領域に書ける', () => {
    expect(checkPermission('workFiles.create', {}, ctx()).allowed).toBe(true);
    expect(checkPermission('workFiles.update', { id: 'x' }, ctx()).allowed).toBe(true);
    expect(checkPermission('workFiles.remove', { id: 'x' }, ctx()).allowed).toBe(true);
  });
  it('own が read なら書けない', () => {
    const r = checkPermission('workFiles.create', {}, ctx({ policy: { own: 'read', readScopes: [] } }));
    expect(r.allowed).toBe(false);
    expect(denied(r)).toContain('readwrite');
  });
  it('読み取りを許した他 scope にも書き込めない', () => {
    const r = checkPermission('workFiles.create', { appScope: '3dss' }, ctx());
    expect(r.allowed).toBe(false);
    expect(denied(r)).toContain('書き込め');
  });
});

describe('checkPermission — http.request', () => {
  it('宣言したオリジンは通す（パスやクエリが付いていても）', () => {
    expect(checkPermission('http.request', { url: 'https://api.example.com/v1/items?q=1' }, ctx()).allowed).toBe(true);
  });
  it('宣言していないオリジンを弾く', () => {
    const r = checkPermission('http.request', { url: 'https://evil.example.net/x' }, ctx());
    expect(r.allowed).toBe(false);
    expect(denied(r)).toContain('network');
    expect(denied(r)).toContain('evil.example.net');
  });
  it('サブドメインは別オリジンとして弾く', () => {
    expect(checkPermission('http.request', { url: 'https://sub.api.example.com/x' }, ctx()).allowed).toBe(false);
  });
  it('http は弾く', () => {
    expect(checkPermission('http.request', { url: 'http://api.example.com/x' }, ctx()).allowed).toBe(false);
  });
  it('network の宣言に末尾スラッシュが付いていても許可する（validateManifest が許容する表記とのズレ対策）', () => {
    const r = checkPermission('http.request', { url: 'https://api.example.com/x' }, ctx({ network: ['https://api.example.com/'] }));
    expect(r.allowed).toBe(true);
  });
  it('URL として読めないものを弾く', () => {
    expect(checkPermission('http.request', { url: 'not a url' }, ctx()).allowed).toBe(false);
    expect(checkPermission('http.request', {}, ctx()).allowed).toBe(false);
  });
});

describe('checkPermission — chat.send', () => {
  it('chat: false なら弾く', () => {
    const r = checkPermission('chat.send', { text: 'hi' }, ctx());
    expect(r.allowed).toBe(false);
    expect(denied(r)).toContain('chat');
  });
  it('chat: true なら通す', () => {
    expect(checkPermission('chat.send', { text: 'hi' }, ctx({ chat: true })).allowed).toBe(true);
  });
});

describe('checkPermission — エラーメッセージ', () => {
  it('manifest のどこを直せばよいか分かる文言にする', () => {
    // 開発中に宣言漏れは日常的に起きるので、Claude Code が読んで直せる必要がある
    expect(denied(checkPermission('http.request', { url: 'https://x.com/' }, ctx()))).toContain('manifest');
    expect(denied(checkPermission('chat.send', {}, ctx()))).toContain('manifest');
  });
});
