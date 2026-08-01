import { describe, it, expect } from "vitest";
import {
  wallMidpointMm,
  wallMovedMm,
  wallBounds2DMm,
  slabCentroidMm,
  slabMovedPointsMm,
  slabBounds2DMm,
  roundDeltaMm,
  worldScaleK,
} from "./alignTargets";

// 壁は start/end（壁芯）で持つので、整列では「1つの位置」＝中点で代表する。
describe("wallMidpointMm", () => {
  it("start と end の中点を返す", () => {
    expect(wallMidpointMm({ start: { x: 0, z: 0 }, end: { x: 4000, z: 0 } })).toEqual({ x: 2000, z: 0 });
  });

  it("斜めの壁でも中点を返す", () => {
    expect(wallMidpointMm({ start: { x: -1000, z: 500 }, end: { x: 3000, z: 2500 } }))
      .toEqual({ x: 1000, z: 1500 });
  });
});

// 整列は平行移動なので、差分は start と end へ同じだけ乗る（＝壁の長さ・向きが変わらない）。
describe("wallMovedMm", () => {
  it("差分が start と end の両方へ同じだけ乗る", () => {
    const w = { start: { x: 0, z: 0 }, end: { x: 4000, z: 1000 } };
    expect(wallMovedMm(w, 250, -100)).toEqual({
      start: { x: 250, z: -100 },
      end: { x: 4250, z: 900 },
    });
  });

  it("元の壁を書き換えない", () => {
    const w = { start: { x: 0, z: 0 }, end: { x: 4000, z: 0 } };
    wallMovedMm(w, 500, 500);
    expect(w).toEqual({ start: { x: 0, z: 0 }, end: { x: 4000, z: 0 } });
  });

  it("差分 0 なら元の座標のまま（取消＝厳密復元）", () => {
    const w = { start: { x: 120, z: -80 }, end: { x: 3120, z: -80 } };
    expect(wallMovedMm(w, 0, 0)).toEqual(w);
  });
});

// 外接矩形は壁芯ではなく「厚みを含む帯の外形」。整列の左端／右端はこれを基準にする。
describe("wallBounds2DMm", () => {
  it("X 方向に走る壁は、長さ方向が X・厚みが Z に出る", () => {
    expect(wallBounds2DMm({ start: { x: 0, z: 0 }, end: { x: 4000, z: 0 }, thicknessMm: 200 }))
      .toEqual({ minX: 0, maxX: 4000, minZ: -100, maxZ: 100 });
  });

  it("Z 方向に走る壁は、厚みが X に出る", () => {
    expect(wallBounds2DMm({ start: { x: 1000, z: 0 }, end: { x: 1000, z: 3000 }, thicknessMm: 100 }))
      .toEqual({ minX: 950, maxX: 1050, minZ: 0, maxZ: 3000 });
  });

  it("45度の壁は厚みの分だけ両軸へ広がる", () => {
    const b = wallBounds2DMm({ start: { x: 0, z: 0 }, end: { x: 1000, z: 1000 }, thicknessMm: 200 });
    const half = (200 / 2) * Math.SQRT1_2; // 約 70.71mm
    expect(b.minX).toBeCloseTo(-half, 6);
    expect(b.maxX).toBeCloseTo(1000 + half, 6);
    expect(b.minZ).toBeCloseTo(-half, 6);
    expect(b.maxZ).toBeCloseTo(1000 + half, 6);
  });
});

// 床（天井も同じスラブ）は多角形。代表点は頂点の平均。
describe("slabCentroidMm", () => {
  it("頂点の平均を返す", () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 4000, z: 0 },
      { x: 4000, z: 3000 },
      { x: 0, z: 3000 },
    ];
    expect(slabCentroidMm(pts)).toEqual({ x: 2000, z: 1500 });
  });

  it("頂点が無ければ原点", () => {
    expect(slabCentroidMm([])).toEqual({ x: 0, z: 0 });
  });
});

describe("slabMovedPointsMm", () => {
  it("全頂点へ同じだけ乗る（形が変わらない）", () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 4000, z: 0 },
      { x: 2000, z: 3000 },
    ];
    const moved = slabMovedPointsMm(pts, -500, 250);
    expect(moved).toEqual([
      { x: -500, z: 250 },
      { x: 3500, z: 250 },
      { x: 1500, z: 3250 },
    ]);
    // 辺の長さ（＝形）が保たれている
    const edge = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(b.x - a.x, b.z - a.z);
    expect(edge(moved[0], moved[1])).toBeCloseTo(edge(pts[0], pts[1]), 9);
    expect(edge(moved[1], moved[2])).toBeCloseTo(edge(pts[1], pts[2]), 9);
  });

  it("元の頂点配列を書き換えない", () => {
    const pts = [{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 0, z: 100 }];
    slabMovedPointsMm(pts, 10, 10);
    expect(pts).toEqual([{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 0, z: 100 }]);
  });
});

describe("slabBounds2DMm", () => {
  it("凹んだ多角形でも全頂点の外接を返す", () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 4000, z: 0 },
      { x: 4000, z: 1000 },
      { x: 2000, z: 1000 },
      { x: 2000, z: 3000 },
      { x: 0, z: 3000 },
    ];
    expect(slabBounds2DMm(pts)).toEqual({ minX: 0, maxX: 4000, minZ: 0, maxZ: 3000 });
  });

  it("頂点が無ければゼロ矩形", () => {
    expect(slabBounds2DMm([])).toEqual({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
  });
});

// 壁・床の座標は整数 mm。移動量の丸めは既存のドラッグ（Math.round）と同じでなければ、
// 整列で動かした壁だけ小数 mm を持ってしまう。
describe("roundDeltaMm", () => {
  it("既存のドラッグと同じ Math.round", () => {
    for (const v of [0.4, 0.5, -0.4, -0.5, 1234.49, 1234.5, -1234.5]) {
      expect(roundDeltaMm(v)).toBe(Math.round(v));
    }
  });

  it("整数 mm の座標に足しても整数 mm のまま", () => {
    const start = { x: 1200, z: -800 };
    const moved = wallMovedMm({ start, end: { x: 5200, z: -800 } }, roundDeltaMm(37.6), roundDeltaMm(-12.2));
    expect(Number.isInteger(moved.start.x)).toBe(true);
    expect(Number.isInteger(moved.start.z)).toBe(true);
    expect(moved.start).toEqual({ x: 1238, z: -812 });
  });
});

// シーンの単位は BaseGlb 次第（mm のことも m のこともある）。各レンダラーと同じ判定にする。
describe("worldScaleK", () => {
  it("mm シーン（sceneMaxY > 100）は 1", () => {
    expect(worldScaleK(3000)).toBe(1);
  });

  it("m シーンは 0.001", () => {
    expect(worldScaleK(3)).toBe(0.001);
    expect(worldScaleK(0)).toBe(0.001);
    expect(worldScaleK(null)).toBe(0.001);
    expect(worldScaleK(undefined)).toBe(0.001);
  });
});
