import { describe, it, expect } from "vitest";
import {
  slabCeilingHeightMm,
  ceilingSlabTopMm,
  polygonCentroidMm,
  rectToPoints,
  rectAreaM2,
  roomCeilingLabel,
  ceilingSlabsOfRoom,
  ceilingHeightAtMm,
} from "./ceilingHeight";
import type { CeilingSlabLike } from "./ceilingHeight";

const rect = (x: number, z: number, width: number, depth: number) => ({ x, z, width, depth });

/** 中心(cx,cz)・幅 w・奥行 d の矩形天井。 */
const ceil = (
  id: string,
  cx: number, cz: number, w: number, d: number,
  extra: Partial<CeilingSlabLike> = {},
): CeilingSlabLike => ({
  id,
  role: "ceiling",
  floorIndex: 0,
  points: rectToPoints(rect(cx, cz, w, d)),
  ...extra,
});

describe("slabCeilingHeightMm", () => {
  it("未設定なら既定", () => {
    expect(slabCeilingHeightMm({}, 2400)).toBe(2400);
    expect(slabCeilingHeightMm(null, 2400)).toBe(2400);
    expect(slabCeilingHeightMm(undefined, 2400)).toBe(2400);
  });

  it("値があればその値", () => {
    expect(slabCeilingHeightMm({ ceilingHeightMm: 2200 }, 2400)).toBe(2200);
  });
});

// ceilingHeightMm は「天井面（＝下端）」の高さ。製図の天井高は床上〜天井の仕上げ面まで。
// スラブは上面基準で置かれ厚みが下へ付く（SlabMesh: position = baseY - t）ので、
// 置く高さ（上面）は 天井面 ＋ 厚み になる。
describe("ceilingSlabTopMm", () => {
  it("上面 = 天井面の高さ ＋ 厚み", () => {
    expect(ceilingSlabTopMm({ ceilingHeightMm: 2400, thicknessMm: 150 }, 2400)).toBe(2550);
  });

  it("高さ未設定なら既定 ＋ 厚み", () => {
    expect(ceilingSlabTopMm({ thicknessMm: 200 }, 2400)).toBe(2600);
  });

  it("厚み未設定は 0 扱い（上面＝天井面）", () => {
    expect(ceilingSlabTopMm({ ceilingHeightMm: 2400 }, 2400)).toBe(2400);
  });

  it("上面から厚みを引くと天井面に戻る（展開図のクリップが使う関係）", () => {
    const slab = { ceilingHeightMm: 2400, thicknessMm: 150 };
    expect(ceilingSlabTopMm(slab, 2400) - slab.thicknessMm).toBe(slabCeilingHeightMm(slab, 2400));
  });
});

describe("polygonCentroidMm", () => {
  it("矩形の重心は中心", () => {
    expect(polygonCentroidMm(rectToPoints(rect(1000, -500, 4000, 2000)))).toEqual({ x: 1000, z: -500 });
  });

  it("頂点が無ければ原点", () => {
    expect(polygonCentroidMm([])).toEqual({ x: 0, z: 0 });
  });
});

describe("rectToPoints", () => {
  it("中心＋幅/奥行 → 4 隅（整数 mm）", () => {
    expect(rectToPoints(rect(0, 0, 4000, 3000))).toEqual([
      { x: -2000, z: -1500 },
      { x: 2000, z: -1500 },
      { x: 2000, z: 1500 },
      { x: -2000, z: 1500 },
    ]);
  });

  it("端数は整数 mm へ丸める", () => {
    expect(rectToPoints(rect(0.4, 0, 1001, 1000))[0]).toEqual({ x: -500, z: -500 });
  });
});

describe("rectAreaM2", () => {
  it("4000×3000mm は 12㎡", () => {
    expect(rectAreaM2(rect(0, 0, 4000, 3000))).toBe(12);
  });

  it("rect が無ければ 0", () => {
    expect(rectAreaM2(null)).toBe(0);
  });
});

// 平面の部屋ラベル 2 行目。天井が無い部屋（吹き抜け）は行ごと出さない。
describe("roomCeilingLabel", () => {
  it("天井が無ければ null", () => {
    expect(roomCeilingLabel([])).toBeNull();
  });

  it("1 枚", () => {
    expect(roomCeilingLabel([2400])).toBe("CH2400mm");
  });

  it("2 枚はカンマ区切り", () => {
    expect(roomCeilingLabel([2400, 2200])).toBe("CH2400mm,2200mm");
  });

  it("mm 整数へ丸める", () => {
    expect(roomCeilingLabel([2400.6])).toBe("CH2401mm");
  });
});

describe("ceilingSlabsOfRoom", () => {
  const room = { id: "r1", floorIndex: 0, rect: rect(0, 0, 6000, 4000) }; // x -3000..3000 / z -2000..2000

  it("roomId が一致する天井を拾う", () => {
    const slabs = [ceil("c1", 0, 0, 6000, 4000, { roomId: "r1", ceilingHeightMm: 2400 })];
    expect(ceilingSlabsOfRoom(slabs, room, 2400).map((s) => s.id)).toEqual(["c1"]);
  });

  it("roomId を持たない旧データは重心が rect の中なら拾う", () => {
    const slabs = [ceil("c1", 1000, 500, 1000, 1000, { ceilingHeightMm: 2200 })];
    expect(ceilingSlabsOfRoom(slabs, room, 2400).map((s) => s.id)).toEqual(["c1"]);
  });

  it("roomId が別の部屋を指す天井は、重心が中でも拾わない", () => {
    const slabs = [ceil("c1", 1000, 500, 1000, 1000, { roomId: "other" })];
    expect(ceilingSlabsOfRoom(slabs, room, 2400)).toEqual([]);
  });

  it("床（role が ceiling でない）は拾わない", () => {
    const slabs = [{ ...ceil("f1", 0, 0, 1000, 1000, { roomId: "r1" }), role: "floor" }];
    expect(ceilingSlabsOfRoom(slabs, room, 2400)).toEqual([]);
  });

  it("階が違う天井は拾わない", () => {
    const slabs = [ceil("c1", 0, 0, 1000, 1000, { roomId: "r1", floorIndex: 1 })];
    expect(ceilingSlabsOfRoom(slabs, room, 2400)).toEqual([]);
  });

  it("並びは高さの降順（高い天井を先に読ませる）", () => {
    const slabs = [
      ceil("low", -1000, 0, 1000, 1000, { roomId: "r1", ceilingHeightMm: 2200 }),
      ceil("high", 1000, 0, 1000, 1000, { roomId: "r1", ceilingHeightMm: 2700 }),
    ];
    expect(ceilingSlabsOfRoom(slabs, room, 2400).map((s) => s.id)).toEqual(["high", "low"]);
  });

  it("高さ未設定の天井は既定として並べる", () => {
    const slabs = [
      ceil("a", -1000, 0, 1000, 1000, { roomId: "r1", ceilingHeightMm: 2000 }),
      ceil("b", 1000, 0, 1000, 1000, { roomId: "r1" }), // 既定 2400
    ];
    expect(ceilingSlabsOfRoom(slabs, room, 2400).map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("ceilingHeightAtMm", () => {
  const slabs: CeilingSlabLike[] = [
    ceil("big", 0, 0, 6000, 4000, { ceilingHeightMm: 2600 }),      // x -3000..3000 / z -2000..2000
    ceil("soffit", 2000, 1000, 1000, 1000, { ceilingHeightMm: 2100 }), // big の中の下がり天井
    ceil("f2", 0, 0, 3000, 3000, { ceilingHeightMm: 2300, floorIndex: 1 }),
  ];

  it("天井の中の点はその天井の高さ", () => {
    expect(ceilingHeightAtMm(slabs, 0, -1000, 0, 2400)).toBe(2600);
  });

  it("天井が無い点は既定", () => {
    expect(ceilingHeightAtMm(slabs, 0, 9999, 9999, 2400)).toBe(2400);
  });

  it("重なっていたら面積の小さい方（下がり天井が勝つ）", () => {
    expect(ceilingHeightAtMm(slabs, 0, 2000, 1000, 2400)).toBe(2100);
  });

  it("階が違う天井は無視する", () => {
    expect(ceilingHeightAtMm(slabs, 1, 0, 0, 2400)).toBe(2300);
  });

  it("床は無視する", () => {
    const withFloor: CeilingSlabLike[] = [
      { ...ceil("f", 0, 0, 2000, 2000, { ceilingHeightMm: 100 }), role: "floor" },
    ];
    expect(ceilingHeightAtMm(withFloor, 0, 0, 0, 2400)).toBe(2400);
  });
});
