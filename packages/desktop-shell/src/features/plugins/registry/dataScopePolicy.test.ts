import { describe, it, expect } from 'vitest';
import { resolveDataScopePolicy } from './dataScopePolicy';

const perms = { workFiles: 'readwrite' as const, readScopes: ['3dss', '3dsl'] };

describe('resolveDataScopePolicy — 自分で入れた自分のツール', () => {
  it('宣言どおりに他 scope の読み取りを許す', () => {
    expect(resolveDataScopePolicy('self', perms)).toEqual({ own: 'readwrite', readScopes: ['3dss', '3dsl'] });
  });
  it('workFiles 未宣言なら自分の領域にも触れない', () => {
    expect(resolveDataScopePolicy('self', {})).toEqual({ own: 'none', readScopes: [] });
    expect(resolveDataScopePolicy('self', undefined)).toEqual({ own: 'none', readScopes: [] });
  });
});

describe('resolveDataScopePolicy — マーケット公開', () => {
  it('readScopes を宣言していても落とす（自分のデータのみ）', () => {
    expect(resolveDataScopePolicy('marketplace', perms)).toEqual({ own: 'readwrite', readScopes: [] });
  });
});

describe('resolveDataScopePolicy — チーム配布', () => {
  it('初版は経路が無いので readScopes を落とす', () => {
    expect(resolveDataScopePolicy('team', perms)).toEqual({ own: 'readwrite', readScopes: [] });
  });
});

describe('resolveDataScopePolicy — 自分の id は readScopes に混ぜない', () => {
  it('own で表現するので重複させない', () => {
    const p = resolveDataScopePolicy('self', { workFiles: 'read', readScopes: [] });
    expect(p.readScopes).toEqual([]);
  });
});
