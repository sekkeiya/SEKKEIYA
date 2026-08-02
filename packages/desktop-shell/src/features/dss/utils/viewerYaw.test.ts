import { describe, it, expect } from 'vitest';
import { resolveViewerYawDeg } from './viewerYaw';

describe('resolveViewerYawDeg', () => {
  it('編集中の liveDims が yawDeg を持つならそれを使う（保存の1秒デバウンス前でも即反映）', () => {
    expect(resolveViewerYawDeg({
      liveDims: { width: 1500, depth: 800, height: 800, yawDeg: 90 },
      modelDims: { width: 1500, depth: 800, height: 800, yawDeg: 0 },
    })).toBe(90);
  });

  it('liveDims が yawDeg を持たないならモデルの値へ落とす', () => {
    // DssRightPanel は {width,depth,height} だけを書く。これを正とすると補正が失われる。
    expect(resolveViewerYawDeg({
      liveDims: { width: 1500, depth: 800, height: 800 },
      modelDims: { width: 1500, depth: 800, height: 800, yawDeg: 90 },
    })).toBe(90);
  });

  it('liveDims の yawDeg が 0 なら 0（未設定と区別する）', () => {
    expect(resolveViewerYawDeg({
      liveDims: { width: 1500, depth: 800, height: 800, yawDeg: 0 },
      modelDims: { width: 1500, depth: 800, height: 800, yawDeg: 90 },
    })).toBe(0);
  });

  it('liveDims が無ければモデルの値', () => {
    expect(resolveViewerYawDeg({ liveDims: null, modelDims: { yawDeg: 90 } })).toBe(90);
  });

  it('どこにも無ければ 0', () => {
    expect(resolveViewerYawDeg({ liveDims: null, modelDims: null })).toBe(0);
    expect(resolveViewerYawDeg({})).toBe(0);
  });

  it('90 以外の値は 0 に丸める', () => {
    expect(resolveViewerYawDeg({ modelDims: { yawDeg: 45 } })).toBe(0);
    expect(resolveViewerYawDeg({ modelDims: { yawDeg: 180 } })).toBe(0);
  });

  it('置き換え候補を表示中は候補自身の補正だけを見る（元モデルの補正を持ち込まない）', () => {
    expect(resolveViewerYawDeg({
      swapActive: true,
      swapDims: { width: 1400, depth: 900, height: 800 },
      liveDims: { width: 1500, depth: 800, height: 800, yawDeg: 90 },
      modelDims: { width: 1500, depth: 800, height: 800, yawDeg: 90 },
    })).toBe(0);
  });

  it('置き換え候補が自分の補正を持つならそれを使う', () => {
    expect(resolveViewerYawDeg({
      swapActive: true,
      swapDims: { width: 1400, depth: 900, height: 800, yawDeg: 90 },
      modelDims: { yawDeg: 0 },
    })).toBe(90);
  });
});
