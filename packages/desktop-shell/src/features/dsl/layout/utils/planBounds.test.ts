import { describe, it, expect } from "vitest";
import { chainSpan, sideOffsetMm, axisExtendMm, DIM_COL_OFFSET_MM } from "./planBounds";

// 寸法列の両端は通り芯の総長にそろえる（通り芯をはみ出さない）。
// 躯体 GLB のバウンディングボックスは庇や基礎を含んで通り芯より外に出ることがあり、
// それをそのまま端点にすると壁面列だけが通り芯を突き抜けて描かれる。
describe("chainSpan", () => {
  it("通り芯が2本以上なら、建物外形が外側でも最外の通り芯を端点にする", () => {
    // 通り芯 0 / 4800 / 7800、建物外形は -474 〜 8274（両側に 474 はみ出し）
    expect(chainSpan([0, 4800, 7800], -474, 8274)).toEqual([0, 7800]);
  });

  it("通り芯が内側にあるときも通り芯を端点にする（外形へは広げない）", () => {
    expect(chainSpan([1000, 5000], 0, 8000)).toEqual([1000, 5000]);
  });

  it("通り芯が1本以下の向きは建物外形で代用する", () => {
    expect(chainSpan([3000], -474, 8274)).toEqual([-474, 8274]);
    expect(chainSpan([], -474, 8274)).toEqual([-474, 8274]);
  });

  it("通り芯が昇順で渡されなくても最外の2本を返す", () => {
    expect(chainSpan([7800, 0, 4800], -474, 8274)).toEqual([0, 7800]);
  });

  it("不正値は通り芯として数えない", () => {
    expect(chainSpan([Number.NaN, 4800], -474, 8274)).toEqual([-474, 8274]);
  });
});

// 建物外形から1列目の寸法線までの距離。辺ごとに設定でき、未設定の辺は既定値。
describe("sideOffsetMm", () => {
  it("未設定なら既定値", () => {
    expect(sideOffsetMm(undefined, "left")).toBe(DIM_COL_OFFSET_MM);
    expect(sideOffsetMm(null, "left")).toBe(DIM_COL_OFFSET_MM);
    expect(sideOffsetMm({}, "left")).toBe(DIM_COL_OFFSET_MM);
  });

  it("設定された辺だけが変わり、他の辺は既定のまま", () => {
    const offsets = { left: 1800 };
    expect(sideOffsetMm(offsets, "left")).toBe(1800);
    expect(sideOffsetMm(offsets, "right")).toBe(DIM_COL_OFFSET_MM);
  });

  it("0 は有効な値として通す（寸法列を建物にぴったり寄せられる）", () => {
    expect(sideOffsetMm({ top: 0 }, "top")).toBe(0);
  });

  it("不正値は既定へフォールバックする", () => {
    expect(sideOffsetMm({ top: Number.NaN }, "top")).toBe(DIM_COL_OFFSET_MM);
    expect(sideOffsetMm({ top: -500 }, "top")).toBe(DIM_COL_OFFSET_MM);
    expect(sideOffsetMm({ top: "1800" } as unknown as Record<string, number>, "top")).toBe(DIM_COL_OFFSET_MM);
  });
});

describe("axisExtendMm", () => {
  // 可変化する前は AXIS_EXTEND_MM = 2400 の固定値だった。既定の余白で同じ値になること
  // ＝既存の図面の見た目が変わらないことの回帰テスト。
  it("既定の余白では従来の固定値 2400 と一致する", () => {
    expect(axisExtendMm(DIM_COL_OFFSET_MM)).toBe(2400);
  });

  it("余白に 1:1 で追従する（記号が寸法列の内側に入らない）", () => {
    expect(axisExtendMm(1800)).toBe(3200);
    expect(axisExtendMm(0)).toBe(1400);
  });

  it("不正値は既定の余白として扱う", () => {
    expect(axisExtendMm(Number.NaN)).toBe(2400);
    expect(axisExtendMm(-1)).toBe(2400);
  });
});
