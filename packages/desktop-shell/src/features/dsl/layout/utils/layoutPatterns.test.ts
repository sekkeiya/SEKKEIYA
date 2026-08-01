import { describe, it, expect } from 'vitest';
import { stripUndefinedDeep, isEmptySnapshot, resolveOptionIndex } from './layoutPatterns';

describe('stripUndefinedDeep', () => {
  it('undefined のキーを落とす（Firestore は undefined を受け付けない）', () => {
    const v = stripUndefinedDeep({ a: 1, b: undefined, c: { d: undefined, e: 'x' } });
    expect(v).toEqual({ a: 1, c: { e: 'x' } });
  });
  it('配列と null は保つ', () => {
    expect(stripUndefinedDeep({ a: [1, 2], b: null })).toEqual({ a: [1, 2], b: null });
  });
});

describe('isEmptySnapshot', () => {
  it('4要素すべて空なら true', () => {
    expect(isEmptySnapshot({})).toBe(true);
    expect(isEmptySnapshot({ itemMaterials: {}, itemSwaps: {}, lights: [] })).toBe(true);
    expect(isEmptySnapshot({ surface: { finishes: [] } })).toBe(true);
  });
  it('どれか1つでも中身があれば false', () => {
    expect(isEmptySnapshot({ itemSwaps: { i1: 'm2' } })).toBe(false);
    expect(isEmptySnapshot({ lights: [{ id: 'l1' } as never] })).toBe(false);
  });
});

describe('resolveOptionIndex', () => {
  const opts = [{ id: 'base' }, { id: 'm1' }, { id: 'm2' }];
  it('選択肢 id を index に解決する', () => {
    expect(resolveOptionIndex(opts, 'm2', 'base')).toBe(2);
    expect(resolveOptionIndex(opts, 'base', 'base')).toBe(0);
  });
  it('未指定・存在しない id は 0（＝元の見た目）へ倒す', () => {
    expect(resolveOptionIndex(opts, undefined, 'base')).toBe(0);
    expect(resolveOptionIndex(opts, null, 'base')).toBe(0);
    expect(resolveOptionIndex(opts, 'zzz', 'base')).toBe(0);
    expect(resolveOptionIndex([], 'm1', 'base')).toBe(0);
  });
});
