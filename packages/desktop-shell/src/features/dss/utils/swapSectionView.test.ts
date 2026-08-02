import { describe, it, expect } from 'vitest';
import { buildDimCompareRows, formatDiff, diffColor, mergeSwapCandidate } from './swapSectionView';

describe('mergeSwapCandidate', () => {
  const ref = {
    id: 'm1',
    title: '登録時のタイトル',
    thumbUrl: 'https://x/old.jpg',
    dimensions: { width: 600, depth: 1500, height: 600 },
  };

  it('読み込み済みの実体があれば寸法・タイトル・サムネはそちらを正とする', () => {
    // 候補モデル本体を編集しても extendedMetadata.swapModels のコピーは更新されないため、
    // 実体が手に入るときは常にそちらを優先する。
    const merged = mergeSwapCandidate(ref, {
      id: 'm1',
      title: '編集後のタイトル',
      thumbnailUrl: 'https://x/new.jpg',
      dimensions: { width: 1500, depth: 600, height: 600, seatHeight: 400 },
    });
    expect(merged.title).toBe('編集後のタイトル');
    expect(merged.thumbUrl).toBe('https://x/new.jpg');
    expect(merged.dimensions).toEqual({ width: 1500, depth: 600, height: 600, seatHeight: 400 });
  });

  it('実体が無ければ登録時のスナップショットをそのまま使う', () => {
    const merged = mergeSwapCandidate(ref, undefined);
    expect(merged.title).toBe('登録時のタイトル');
    expect(merged.thumbUrl).toBe('https://x/old.jpg');
    expect(merged.dimensions).toEqual({ width: 600, depth: 1500, height: 600 });
  });

  it('実体にその項目が無ければ項目ごとにスナップショットへ落とす', () => {
    const merged = mergeSwapCandidate(ref, { id: 'm1' });
    expect(merged.title).toBe('登録時のタイトル');
    expect(merged.thumbUrl).toBe('https://x/old.jpg');
    expect(merged.dimensions).toEqual({ width: 600, depth: 1500, height: 600 });
  });

  it('実体のサムネは thumbnailUrl → thumbnail の順に見る', () => {
    expect(mergeSwapCandidate(ref, { id: 'm1', thumbnail: 'https://x/t2.jpg' }).thumbUrl).toBe('https://x/t2.jpg');
  });

  it('実体のタイトルが空文字なら name を見て、それも無ければスナップショット', () => {
    expect(mergeSwapCandidate(ref, { id: 'm1', title: '', name: '名前' }).title).toBe('名前');
    expect(mergeSwapCandidate(ref, { id: 'm1', title: '', name: '' }).title).toBe('登録時のタイトル');
  });
});

describe('buildDimCompareRows', () => {
  it('W/D/H の3行を返し、差は candidate - own', () => {
    const rows = buildDimCompareRows(
      { width: 1500, depth: 800, height: 800 },
      { width: 1500, depth: 900, height: 760 },
    );
    expect(rows.map((r) => [r.key, r.own, r.candidate, r.diff])).toEqual([
      ['width', 1500, 1500, 0],
      ['depth', 800, 900, 100],
      ['height', 800, 760, -40],
    ]);
  });

  it('5mm 以内の差は 0 に丸める', () => {
    const rows = buildDimCompareRows({ width: 1500 }, { width: 1503 });
    expect(rows[0].diff).toBe(0);
  });

  it('6mm 以上は丸めない', () => {
    const rows = buildDimCompareRows({ width: 1500 }, { width: 1506 });
    expect(rows[0].diff).toBe(6);
  });

  it('candidate が null なら diff は常に null（元モデルのみ表示）', () => {
    const rows = buildDimCompareRows({ width: 1500, depth: 800, height: 800 }, null);
    expect(rows.every((r) => r.diff === null)).toBe(true);
    expect(rows.map((r) => r.own)).toEqual([1500, 800, 800]);
  });

  it('どちらかの値が未登録（0）の行は diff を null にする', () => {
    const rows = buildDimCompareRows({ width: 1500, depth: 0 }, { width: 1400, depth: 900 });
    expect(rows[0].diff).toBe(-100);
    expect(rows[1].diff).toBeNull();
  });

  it('SH の行はどちらかに座面高があるときだけ出す', () => {
    const without = buildDimCompareRows({ width: 1500 }, { width: 1500 });
    expect(without.map((r) => r.key)).toEqual(['width', 'depth', 'height']);

    const withOwn = buildDimCompareRows({ width: 1500, seatHeight: 400 }, { width: 1500 });
    expect(withOwn.map((r) => r.key)).toEqual(['width', 'depth', 'height', 'seatHeight']);
    // 候補側は seatHeight を持たないので差は出ない
    expect(withOwn[3].diff).toBeNull();
  });

  it('ラベルは日本語の軸名', () => {
    const rows = buildDimCompareRows({ width: 1, seatHeight: 400 }, null);
    expect(rows.map((r) => r.label)).toEqual(['W 幅', 'D 奥行', 'H 高さ', 'SH 座面高']);
  });

  it('own も candidate も無ければ W/D/H が全て 0 の3行', () => {
    const rows = buildDimCompareRows(null, null);
    expect(rows.map((r) => [r.own, r.candidate, r.diff])).toEqual([
      [0, 0, null], [0, 0, null], [0, 0, null],
    ]);
  });
});

describe('formatDiff', () => {
  it('0 は ±0', () => { expect(formatDiff(0)).toBe('±0'); });
  it('正は + 付き', () => { expect(formatDiff(100)).toBe('+100'); });
  it('負は全角マイナス', () => { expect(formatDiff(-40)).toBe('−40'); });
  it('小数は四捨五入する', () => { expect(formatDiff(99.6)).toBe('+100'); });
  it('null は空文字', () => { expect(formatDiff(null)).toBe(''); });
});

describe('diffColor', () => {
  it('0 と null は中立色', () => {
    expect(diffColor(0)).toBe('rgba(148,163,184,0.6)');
    expect(diffColor(null)).toBe('rgba(148,163,184,0.6)');
  });
  it('正はコーラル', () => { expect(diffColor(100)).toBe('#f0997b'); });
  it('負はティール', () => { expect(diffColor(-40)).toBe('#5dcaa5'); });
});
