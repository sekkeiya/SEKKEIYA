import { describe, it, expect } from 'vitest';
import {
  stripUndefinedDeep,
  isEmptySnapshot,
  resolveOptionIndex,
  resolveProposalPlan,
  sanitizeItemsForSnapshot,
  PATTERN_ITEMS_BYTE_LIMIT,
} from './layoutPatterns';

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

describe('resolveProposalPlan', () => {
  const plans = [{ id: 'p1', name: 'Plan A' }, { id: 'p2' }];
  it('planId 無しは「躯体のみの提案」', () => {
    expect(resolveProposalPlan(null, plans)).toEqual({ kind: 'none' });
    expect(resolveProposalPlan(undefined, plans)).toEqual({ kind: 'none' });
  });
  it('存在する Plan は名前を返す（無名は "Plan" にフォールバック）', () => {
    expect(resolveProposalPlan('p1', plans)).toEqual({ kind: 'ok', name: 'Plan A' });
    expect(resolveProposalPlan('p2', plans)).toEqual({ kind: 'ok', name: 'Plan' });
  });
  it('削除済み Plan は missing', () => {
    expect(resolveProposalPlan('gone', plans)).toEqual({ kind: 'missing' });
  });
});

describe('sanitizeItemsForSnapshot', () => {
  it('配列以外は undefined', () => {
    expect(sanitizeItemsForSnapshot(null)).toBeUndefined();
    expect(sanitizeItemsForSnapshot(undefined)).toBeUndefined();
  });
  it('空配列は [] を返す（家具を全部消した状態をキャプチャできるように）', () => {
    expect(sanitizeItemsForSnapshot([])).toEqual([]);
  });
  it('_ 始まりの内部フィールドと undefined を落とす', () => {
    const out = sanitizeItemsForSnapshot([
      { id: 'a', title: 'chair', _assetDraft: { type: 'new' }, tmp: undefined },
    ]);
    expect(out).toEqual([{ id: 'a', title: 'chair' }]);
  });
  it('関数など JSON にならない値は落ちる', () => {
    const out = sanitizeItemsForSnapshot([{ id: 'a', cb: () => {} }]);
    expect(out).toEqual([{ id: 'a' }]);
  });
  it('サイズ上限を超えたら undefined（キャプチャをスキップ）', () => {
    const big = 'x'.repeat(PATTERN_ITEMS_BYTE_LIMIT);
    expect(sanitizeItemsForSnapshot([{ id: 'a', blob: big }])).toBeUndefined();
  });
});
