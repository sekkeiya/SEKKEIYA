import { describe, it, expect } from 'vitest';
import { API_VERSION, satisfiesEngine, engineErrorMessage } from './engineCompat';

describe('API_VERSION', () => {
  it('初版は 1.0.0', () => {
    expect(API_VERSION).toBe('1.0.0');
  });
});

describe('satisfiesEngine — 完全一致', () => {
  it('同じバージョンだけ通す', () => {
    expect(satisfiesEngine('1.2.3', '1.2.3')).toBe(true);
    expect(satisfiesEngine('1.2.3', '1.2.4')).toBe(false);
    expect(satisfiesEngine('1.2.3', '2.0.0')).toBe(false);
  });
});

describe('satisfiesEngine — キャレット（1.x 系）', () => {
  it('同じ major の同じか新しいものを通す', () => {
    expect(satisfiesEngine('^1.0.0', '1.0.0')).toBe(true);
    expect(satisfiesEngine('^1.0.0', '1.4.2')).toBe(true);
    expect(satisfiesEngine('^1.2.0', '1.2.0')).toBe(true);
  });
  it('range より古いものを弾く', () => {
    expect(satisfiesEngine('^1.2.0', '1.1.9')).toBe(false);
    expect(satisfiesEngine('^1.2.3', '1.2.2')).toBe(false);
  });
  it('major が違うものを弾く', () => {
    expect(satisfiesEngine('^1.0.0', '2.0.0')).toBe(false);
    expect(satisfiesEngine('^2.0.0', '1.9.9')).toBe(false);
  });
});

describe('satisfiesEngine — キャレット（0.x 系）', () => {
  it('0.x は minor を major のように扱う（semver の規則）', () => {
    expect(satisfiesEngine('^0.2.0', '0.2.5')).toBe(true);
    expect(satisfiesEngine('^0.2.0', '0.3.0')).toBe(false);
    expect(satisfiesEngine('^0.2.0', '0.1.9')).toBe(false);
  });
  it('^0.1.0 は同じ minor 内の新しい patch だけ通す', () => {
    expect(satisfiesEngine('^0.1.0', '0.1.5')).toBe(true);
    expect(satisfiesEngine('^0.1.0', '0.2.0')).toBe(false);
  });
});

describe('satisfiesEngine — キャレット（0.0.z 系）', () => {
  it('0.0.z は patch が major 相当なので完全一致だけ通す', () => {
    expect(satisfiesEngine('^0.0.3', '0.0.3')).toBe(true);
    expect(satisfiesEngine('^0.0.3', '0.0.4')).toBe(false);
    expect(satisfiesEngine('^0.0.3', '0.0.10')).toBe(false);
    expect(satisfiesEngine('^0.0.3', '0.0.2')).toBe(false);
  });
});

describe('satisfiesEngine — プレリリース', () => {
  it('version にプレリリース接尾辞が付いていたら弾く', () => {
    expect(satisfiesEngine('^1.0.0', '1.0.0-beta.1')).toBe(false);
  });
  it('range にプレリリース接尾辞が付いていたら弾く', () => {
    expect(satisfiesEngine('^1.0.0-beta.1', '1.0.0')).toBe(false);
  });
});

describe('satisfiesEngine — 不正な入力', () => {
  it('解釈できない range や version は通さない', () => {
    expect(satisfiesEngine('>=1.0.0', '1.0.0')).toBe(false);
    expect(satisfiesEngine('*', '1.0.0')).toBe(false);
    expect(satisfiesEngine('^1.0.0', 'いち')).toBe(false);
    expect(satisfiesEngine('', '1.0.0')).toBe(false);
  });
});

describe('engineErrorMessage', () => {
  it('range と現在のバージョンの両方を含む', () => {
    const msg = engineErrorMessage('^2.0.0');
    expect(msg).toContain('^2.0.0');
    expect(msg).toContain(API_VERSION);
  });
});
