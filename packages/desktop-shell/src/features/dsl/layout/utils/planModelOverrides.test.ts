import { describe, it, expect } from 'vitest';
import { resolveModelOverride, filterByIds, type OverrideChainEntry } from './planModelOverrides';

const chain: OverrideChainEntry[] = [
  { layoutId: 'opt1', modelOverrides: { m1: { materialVariantIds: ['v1'] } } },
  { layoutId: 'plan1', modelOverrides: { m1: { swapModelIds: ['s1'] }, m2: { anim: null } } },
  { layoutId: 'base1', modelOverrides: { m3: { materialVariantIds: ['v9'] } } },
];

describe('resolveModelOverride', () => {
  it('手前の層が丸ごと勝つ（フィールドマージしない）', () => {
    expect(resolveModelOverride(chain, 'm1')).toEqual({ materialVariantIds: ['v1'] });
  });
  it('手前に無ければ親の層を採用', () => {
    expect(resolveModelOverride(chain, 'm2')).toEqual({ anim: null });
    expect(resolveModelOverride(chain, 'm3')).toEqual({ materialVariantIds: ['v9'] });
  });
  it('どの層にも無ければ null', () => {
    expect(resolveModelOverride(chain, 'mX')).toBeNull();
    expect(resolveModelOverride([], 'm1')).toBeNull();
  });
});

describe('filterByIds', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('ids 未設定なら全件', () => {
    expect(filterByIds(list, undefined)).toEqual(list);
  });
  it('積集合（順序維持・存在しない id は無視）', () => {
    expect(filterByIds(list, ['c', 'a', 'zzz'])).toEqual([{ id: 'a' }, { id: 'c' }]);
  });
  it('積集合が空なら空配列', () => {
    expect(filterByIds(list, ['zzz'])).toEqual([]);
  });
});
