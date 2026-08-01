import { describe, it, expect } from "vitest";
import {
  levelMarksMm,
  resolveLevelMarkMove,
  resolveLevelSegmentEdit,
  levelEditTitle,
} from "./levelChain";
import type { BuildingSpec } from "../store/useBuildingSpecStore";

// 実データ基準（2026-08-01 の断面 B-B'）:
//   GL -704 / FL±0 = 0 / 1FL 階高 2796・CL 2400 / 2FL 階高 3000・CL 2400
//   → GL -704 / FL1 0 / CL1 2400 / FL2 2796 / CL2 5196 / 最上部 5796
const SPEC: BuildingSpec = {
  floorHeightMm: 3000,
  ceilingHeightMm: 2400,
  glMm: -704,
  fl0Mm: 0,
  floors: [
    { name: "1FL", flMm: 0, heightMm: 2796, clMm: 2400 },
    { name: "2FL", flMm: 2796, heightMm: 3000, clMm: 2400 },
  ],
};

describe("levelMarksMm", () => {
  it("階高・GL は GL / 各階 FL / 最上部（CL を含まない）", () => {
    expect(levelMarksMm(SPEC, "floor")).toEqual([-704, 0, 2796, 5796]);
  });

  it("旧「階レベル」は GL / FL / CL を全部混ぜる（従来どおり）", () => {
    expect(levelMarksMm(SPEC, "legacy")).toEqual([-704, 0, 2400, 2796, 5196, 5796]);
  });

  it("端は建物の外形ではなくマーク自身（GL 〜 最上部）", () => {
    const m = levelMarksMm(SPEC, "floor");
    expect(m[0]).toBe(-704);
    expect(m[m.length - 1]).toBe(5796);
  });

  it("近い刻みは 1 本に畳む（CL が上階の床とほぼ同じ＝天井フトコロ 0 の階）", () => {
    const flush: BuildingSpec = {
      ...SPEC,
      floors: [
        { name: "1FL", flMm: 0, heightMm: 3000, clMm: 2980 }, // CL 2980 と FL2 3000 は 20mm 差
        { name: "2FL", flMm: 3000, heightMm: 3000, clMm: 2400 },
      ],
    };
    expect(levelMarksMm(flush, "legacy")).toEqual([-704, 0, 2980, 5400, 6000]);
  });

  it("fl0Mm（基準の移動）がすべてのマークに乗る", () => {
    expect(levelMarksMm({ ...SPEC, fl0Mm: 1000 }, "floor")).toEqual([296, 1000, 3796, 6796]);
  });

  it("1 階だけの建物でも最上部が出る", () => {
    const one: BuildingSpec = { ...SPEC, floors: [{ name: "1FL", flMm: 0, heightMm: 2800, clMm: 2400 }] };
    expect(levelMarksMm(one, "floor")).toEqual([-704, 0, 2800]);
  });
});

describe("resolveLevelSegmentEdit", () => {
  it("GL→FL±0 は GL を動かす（FL±0 は基準なので動かせない）", () => {
    expect(resolveLevelSegmentEdit(SPEC, -704, 0, 800)).toEqual({ kind: "gl", valueMm: -800 });
  });

  it("FL→CL は天井高", () => {
    expect(resolveLevelSegmentEdit(SPEC, 0, 2400, 2500)).toEqual({ kind: "cl", index: 0, valueMm: 2500 });
  });

  it("FL→上階 FL は階高（上の床を動かす）", () => {
    expect(resolveLevelSegmentEdit(SPEC, 0, 2796, 3000)).toEqual({ kind: "fl", index: 1, valueMm: 3000 });
  });

  it("CL→上階 FL も階高（旧「階レベル」列で出る区間）", () => {
    expect(resolveLevelSegmentEdit(SPEC, 2400, 2796, 700)).toEqual({ kind: "fl", index: 1, valueMm: 3100 });
  });

  it("最上階の CL→最上部 は最上階の階高", () => {
    expect(resolveLevelSegmentEdit(SPEC, 5196, 5796, 800)).toEqual({ kind: "floorHeight", index: 1, valueMm: 3200 });
  });

  it("どのレベルにも当たらない区間は null（通り芯間・壁面など）", () => {
    expect(resolveLevelSegmentEdit(SPEC, 1000, 2000, 900)).toBeNull();
  });

  it("mm 整数へ丸める", () => {
    expect(resolveLevelSegmentEdit(SPEC, 0, 2400, 2500.6)).toEqual({ kind: "cl", index: 0, valueMm: 2501 });
  });
});

describe("resolveLevelMarkMove", () => {
  it("最上部のマークが階高として動かせる（従来は null で掴めなかった）", () => {
    expect(resolveLevelMarkMove(SPEC, 5796, 6000)).toEqual({ kind: "floorHeight", index: 1, valueMm: 3204 });
  });

  it("FL±0 は基準なので動かせない", () => {
    expect(resolveLevelMarkMove(SPEC, 0, 100)).toBeNull();
  });

  it("GL のマークは GL を動かす", () => {
    expect(resolveLevelMarkMove(SPEC, -704, -900)).toEqual({ kind: "gl", valueMm: -900 });
  });

  it("CL のマークは天井高を動かす", () => {
    expect(resolveLevelMarkMove(SPEC, 2400, 2450)).toEqual({ kind: "cl", index: 0, valueMm: 2450 });
  });
});

describe("levelEditTitle", () => {
  it("何を動かすのかを日本語で返す", () => {
    expect(levelEditTitle(SPEC, { kind: "gl", valueMm: 0 })).toBe("GL（地盤レベル）を動かす");
    expect(levelEditTitle(SPEC, { kind: "cl", index: 1, valueMm: 0 })).toBe("2FL の天井高（CL）を動かす");
    expect(levelEditTitle(SPEC, { kind: "fl", index: 1, valueMm: 0 })).toBe("2FL の床レベルを動かす");
    expect(levelEditTitle(SPEC, { kind: "floorHeight", index: 1, valueMm: 0 })).toBe("2FL の階高を動かす");
  });
});
