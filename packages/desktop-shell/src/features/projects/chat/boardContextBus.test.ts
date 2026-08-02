import { describe, it, expect } from 'vitest';
import { sameBoardContext, shouldSkipPublish, type BoardContext } from './boardContextBus';

const OPEN_A: BoardContext = { open: true, view: 'mindmap', boardKey: 'proj-a|main' };
const OPEN_B: BoardContext = { open: true, view: 'mindmap', boardKey: 'proj-b|main' };
const CLOSED: BoardContext = { open: false, view: null, boardKey: null };

describe('sameBoardContext', () => {
  it('3フィールドが一致すれば同じ', () => {
    expect(sameBoardContext(OPEN_A, { ...OPEN_A })).toBe(true);
  });
  it('ボードが違えば別', () => {
    expect(sameBoardContext(OPEN_A, OPEN_B)).toBe(false);
  });
  it('ビューが違えば別', () => {
    expect(sameBoardContext(OPEN_A, { ...OPEN_A, view: 'canvas' })).toBe(false);
  });
});

describe('shouldSkipPublish', () => {
  it('既に閉じているのに閉じ直すのは黙る', () => {
    expect(shouldSkipPublish(CLOSED, CLOSED, null, 'me')).toBe(true);
  });
  it('自分がオーナーで値が変わらないなら黙る', () => {
    expect(shouldSkipPublish(OPEN_A, { ...OPEN_A }, 'me', 'me')).toBe(true);
  });
  it('自分がオーナーで値が変われば配信する', () => {
    expect(shouldSkipPublish(OPEN_A, OPEN_B, 'me', 'me')).toBe(false);
  });
  it('他窓がオーナーのときの「閉じました」は捨てる（引き継ぎレース）', () => {
    expect(shouldSkipPublish(OPEN_A, CLOSED, 'other', 'me')).toBe(true);
  });
  it('他窓がオーナーでも「開きました」は配信する（オーナーを奪う）', () => {
    expect(shouldSkipPublish(OPEN_A, OPEN_B, 'other', 'me')).toBe(false);
  });
  it('他窓がオーナーで同じ値でも、自分が開いたなら配信する', () => {
    expect(shouldSkipPublish(OPEN_A, { ...OPEN_A }, 'other', 'me')).toBe(false);
  });
});
