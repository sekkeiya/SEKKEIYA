import { describe, it, expect } from 'vitest';
import { resolveDataScopePolicy } from './dataScopePolicy';

const perms = {
  workFiles: 'readwrite' as const,
  readScopes: ['3dss', '3dsl'],
  network: ['https://api.example.com'],
  chat: true,
};

describe('resolveDataScopePolicy — 自分で入れた自分のツール', () => {
  it('宣言どおりに他 scope の読み取り・通信・チャットを許す', () => {
    expect(resolveDataScopePolicy('self', perms)).toEqual({
      own: 'readwrite',
      readScopes: ['3dss', '3dsl'],
      network: ['https://api.example.com'],
      chat: true,
    });
  });
  it('workFiles 未宣言なら自分の領域にも触れない', () => {
    expect(resolveDataScopePolicy('self', {})).toEqual({ own: 'none', readScopes: [], network: [], chat: false });
    expect(resolveDataScopePolicy('self', undefined)).toEqual({ own: 'none', readScopes: [], network: [], chat: false });
  });
});

describe('resolveDataScopePolicy — マーケット公開', () => {
  it('readScopes を宣言していても落とす（自分のデータのみ）', () => {
    const p = resolveDataScopePolicy('marketplace', perms, true);
    expect(p.own).toBe('readwrite');
    expect(p.readScopes).toEqual([]);
  });
  it('同意なしなら network / chat も落とす（要件70）', () => {
    expect(resolveDataScopePolicy('marketplace', perms, false)).toEqual({
      own: 'readwrite', readScopes: [], network: [], chat: false,
    });
    // granted 省略時は self 以外は未同意扱い
    expect(resolveDataScopePolicy('marketplace', perms).network).toEqual([]);
  });
  it('同意ありなら宣言どおりの network / chat を許す（readScopes は開かない）', () => {
    expect(resolveDataScopePolicy('marketplace', perms, true)).toEqual({
      own: 'readwrite', readScopes: [], network: ['https://api.example.com'], chat: true,
    });
  });
});

describe('resolveDataScopePolicy — チーム配布', () => {
  it('初版は経路が無いので readScopes を落とす', () => {
    const p = resolveDataScopePolicy('team', perms, true);
    expect(p.readScopes).toEqual([]);
    expect(p.network).toEqual(['https://api.example.com']);
  });
});

describe('resolveDataScopePolicy — 自分の id は readScopes に混ぜない', () => {
  it('own で表現するので重複させない', () => {
    const p = resolveDataScopePolicy('self', { workFiles: 'read', readScopes: [] });
    expect(p.readScopes).toEqual([]);
  });
});
