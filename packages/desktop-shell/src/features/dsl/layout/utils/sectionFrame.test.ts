import { describe, it, expect } from "vitest";
import { sectionFrameSpan } from "./sectionFrame";

// 3D の断面枠が覆う範囲。図面（寸法列・断面線）と端をそろえたいので通り芯を基準にするが、
// 枠は「どこを切っているか」を示すものなので、切っている実体より小さくしてはいけない。
describe("sectionFrameSpan", () => {
  it("通り芯が建物より外なら通り芯にそろえる（＋余白）", () => {
    // 通り芯 0..7800 / 建物 500..7000
    expect(sectionFrameSpan([0, 4800, 7800], 500, 7000, 100)).toEqual([-100, 7900]);
  });

  it("通り芯が建物より内側なら建物を覆う（枠が実体より小さくならない）", () => {
    // 通り芯 1000..5000 / 建物 0..8000（庇・基礎が通り芯より外に出ている）
    expect(sectionFrameSpan([1000, 5000], 0, 8000, 100)).toEqual([-100, 8100]);
  });

  it("片側だけ通り芯が外なら、辺ごとに広い方を採る", () => {
    // 通り芯 -500..5000 / 建物 0..8000
    expect(sectionFrameSpan([-500, 5000], 0, 8000, 0)).toEqual([-500, 8000]);
  });

  it("通り芯が1本なら建物外形で代用する（chainSpan と同じ規則）", () => {
    expect(sectionFrameSpan([3000], 0, 8000, 200)).toEqual([-200, 8200]);
  });

  it("通り芯が無くても建物外形で出る", () => {
    expect(sectionFrameSpan([], -1000, 1000, 50)).toEqual([-1050, 1050]);
  });

  it("余白 0 なら端そのもの", () => {
    expect(sectionFrameSpan([0, 6000], 1000, 5000, 0)).toEqual([0, 6000]);
  });

  it("建物の範囲が逆転していても正しい向きで返す", () => {
    expect(sectionFrameSpan([], 1000, -1000, 0)).toEqual([-1000, 1000]);
  });
});
