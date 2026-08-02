import { describe, it, expect } from 'vitest';
import {
  swatchVisualOf, variantVisualOf, selectionsEqual, selectionSummary, placeholderCount,
} from './materialSectionView';
import type { MaterialPresetSlot, MaterialPresetOption, MaterialVariant } from '../../shared/material/materialPresets';
import type { DsmtMaterialSnapshot, DsmtPbrParams, DsmtTextureMaps } from '../../dsmt/types';

/** baseColor 未指定（空文字＝falsy）を既定にしたスナップショット。 */
const snap = (params: Partial<DsmtPbrParams> = {}, maps: DsmtTextureMaps = {}): DsmtMaterialSnapshot => ({
  params: { baseColor: '', roughness: 0.5, metalness: 0, ...params },
  maps,
});

const opt = (over: Partial<MaterialPresetOption> = {}): MaterialPresetOption => ({
  id: 'o1',
  title: 'ファブリック・ベージュ',
  snapshot: snap(),
  ...over,
});

const slot = (over: Partial<MaterialPresetSlot> = {}): MaterialPresetSlot => ({
  slotKey: 'Seat#0',
  meshName: 'Seat',
  materialIndex: 0,
  label: '張地',
  options: [opt()],
  ...over,
});

describe('swatchVisualOf', () => {
  it('albedo テクスチャがあれば画像を優先する', () => {
    const o = opt({ swatchColor: '#ff0000', snapshot: snap({ baseColor: '#00ff00' }, { albedo: 'https://x/a.png' }) });
    // 背面色は画像が読めないときの下地。優先順は swatchColor > baseColor のまま。
    expect(swatchVisualOf(o)).toEqual({ imageUrl: 'https://x/a.png', color: '#ff0000' });
  });
  it('テクスチャが無ければ swatchColor', () => {
    const o = opt({ swatchColor: '#ff0000', snapshot: snap({ baseColor: '#00ff00' }) });
    expect(swatchVisualOf(o)).toEqual({ color: '#ff0000' });
  });
  it('swatchColor も無ければ baseColor', () => {
    const o = opt({ snapshot: snap({ baseColor: '#00ff00' }) });
    expect(swatchVisualOf(o)).toEqual({ color: '#00ff00' });
  });
  it('どれも無ければ既定色', () => {
    expect(swatchVisualOf(opt())).toEqual({ color: '#9aa0a6' });
  });
});

describe('variantVisualOf', () => {
  const presets = [slot()];
  it('保存時サムネがあれば最優先', () => {
    const v: MaterialVariant = { id: 'v1', selection: { 'Seat#0': 'o1' }, thumbUrl: 'https://x/t.jpg' };
    expect(variantVisualOf(presets, v)).toEqual({ imageUrl: 'https://x/t.jpg', color: '#9aa0a6' });
  });
  it('サムネが無ければ選択中オプションの albedo', () => {
    const p = [slot({ options: [opt({ snapshot: snap({}, { albedo: 'https://x/a.png' }) })] })];
    const v: MaterialVariant = { id: 'v1', selection: { 'Seat#0': 'o1' }, thumbUrl: null };
    expect(variantVisualOf(p, v).imageUrl).toBe('https://x/a.png');
  });
  it('画像がまったく無ければ代表色だけ返す', () => {
    const p = [slot({ options: [opt({ swatchColor: '#c9b79a' })] })];
    const v: MaterialVariant = { id: 'v1', selection: { 'Seat#0': 'o1' } };
    expect(variantVisualOf(p, v)).toEqual({ color: '#c9b79a' });
  });
});

describe('selectionsEqual', () => {
  it('同じ内容なら true（キー順は問わない）', () => {
    expect(selectionsEqual({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true);
  });
  it('空同士は true', () => {
    expect(selectionsEqual({}, {})).toBe(true);
  });
  it('キー数が違えば false', () => {
    expect(selectionsEqual({ a: '1' }, { a: '1', b: '2' })).toBe(false);
  });
  it('値が違えば false', () => {
    expect(selectionsEqual({ a: '1' }, { a: '2' })).toBe(false);
  });
});

describe('selectionSummary', () => {
  const presets = [
    slot({ slotKey: 'Seat#0', label: '張地', options: [opt({ id: 'o1', title: 'ベージュ' })] }),
    slot({ slotKey: 'Leg#0', meshName: 'Leg', label: '脚', options: [opt({ id: 'p1', title: 'ウォルナット' })] }),
  ];
  it('未選択なら「元の見た目」', () => {
    expect(selectionSummary(presets, {})).toBe('元の見た目');
  });
  it('選択済みの部位だけを並べる', () => {
    expect(selectionSummary(presets, { 'Seat#0': 'o1' })).toBe('張地 ベージュ');
  });
  it('複数は全角スラッシュで連結する', () => {
    expect(selectionSummary(presets, { 'Seat#0': 'o1', 'Leg#0': 'p1' })).toBe('張地 ベージュ　／　脚 ウォルナット');
  });
  it('label が無く自動生成メッシュ名なら「部位 N」を使う', () => {
    const p = [slot({ slotKey: 'Object_2#0', meshName: 'Object_2', label: '', options: [opt({ id: 'o1', title: 'ベージュ' })] })];
    expect(selectionSummary(p, { 'Object_2#0': 'o1' })).toBe('部位 1 ベージュ');
  });
  it('オプション名が無ければ部位名だけ', () => {
    const p = [slot({ options: [opt({ id: 'o1', title: '' })] })];
    expect(selectionSummary(p, { 'Seat#0': 'o1' })).toBe('張地');
  });
});

describe('placeholderCount', () => {
  it('4 列に満たない分を埋める', () => {
    expect(placeholderCount(1)).toBe(3);
    expect(placeholderCount(2)).toBe(2);
    expect(placeholderCount(3)).toBe(1);
  });
  it('ちょうど 4 の倍数なら 0', () => {
    expect(placeholderCount(4)).toBe(0);
    expect(placeholderCount(8)).toBe(0);
  });
  it('5 枚なら次の 4 の倍数まで埋める', () => {
    expect(placeholderCount(5)).toBe(3);
  });
  it('0 枚なら 0（呼び出し側がブロックごと出さない）', () => {
    expect(placeholderCount(0)).toBe(0);
  });
});
