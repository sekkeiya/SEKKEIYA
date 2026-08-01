import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  chainSpan, sideOffsetMm, axisExtendMm, measureXZBounds, defaultSectionSpan,
  defaultSectionPos, DIM_COL_OFFSET_MM,
} from "./planBounds";

/** 指定サイズ・位置の箱メッシュ（Box3.setFromObject で測れる最小の実体）。 */
function boxAt(sx: number, sz: number, x: number, z: number, userData: Record<string, unknown> = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 1000, sz));
  m.position.set(x, 500, z);
  Object.assign(m.userData, userData);
  m.updateMatrixWorld(true);
  return m;
}

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

// 歩行モードの自動床スキャンが作る不可視の床板は「建物」ではない。建物より大きかったり
// 片側に寄っていたりするので、注記の基準に混ぜると寸法線や断面記号が遠くへ飛ぶ。
describe("measureXZBounds", () => {
  const w = (mm: number) => mm;

  it("スキャン床板は建物の範囲に含めない", () => {
    const building = boxAt(8000, 6000, 0, 0);                                  // X: -4000..4000
    const scanned = boxAt(20000, 20000, 0, 0, { isScannedFloor: true });       // X: -10000..10000
    const b = measureXZBounds([building, scanned], [], w);
    expect(b?.minX).toBeCloseTo(-4000);
    expect(b?.maxX).toBeCloseTo(4000);
  });

  it("実躯体だけのときは従来どおり測る", () => {
    const b = measureXZBounds([boxAt(8000, 6000, 0, 0)], [], w);
    expect(b?.minZ).toBeCloseTo(-3000);
    expect(b?.maxZ).toBeCloseTo(3000);
  });

  it("作図した壁は範囲に含める", () => {
    const b = measureXZBounds([boxAt(2000, 2000, 0, 0)], [{ start: { x: -5000, z: 0 }, end: { x: 5000, z: 0 } }], w);
    expect(b?.minX).toBeCloseTo(-5000);
    expect(b?.maxX).toBeCloseTo(5000);
  });

  it("スキャン床板しか無いときは null（建物が無い＝呼び手がフォールバックする）", () => {
    expect(measureXZBounds([boxAt(20000, 20000, 0, 0, { isScannedFloor: true })], [], w)).toBeNull();
  });
});

describe("axisExtendMm", () => {
  // 可変化する前は AXIS_EXTEND_MM = 2400 の固定値（＝当時の既定余白 1000 + 余裕 1400）だった。
  // 余白 1000 で 2400 に一致すること＝余裕 1400 の内訳が保たれていることの回帰テスト。
  it("余白 1000 では旧固定値 2400 と一致する（余裕 1400 の回帰）", () => {
    expect(axisExtendMm(1000)).toBe(2400);
  });

  it("余白に 1:1 で追従する（記号が寸法列の内側に入らない）", () => {
    expect(axisExtendMm(1800)).toBe(3200);
    expect(axisExtendMm(0)).toBe(1400);
  });

  it("不正値は既定の余白として扱う", () => {
    expect(axisExtendMm(Number.NaN)).toBe(DIM_COL_OFFSET_MM + 1400);
    expect(axisExtendMm(-1)).toBe(DIM_COL_OFFSET_MM + 1400);
  });
});

// 断面記号は「1列目の寸法線から一定の距離だけ内側」に置く（建物基準ではない）。
// ⚠️ 建物のバウンディングボックスは通り芯に対して偏りうる（Rhino 躯体が片側だけはみ出す等）。
//    両端に同じ out を使うと、片方の端でしか「寸法線から一定」を満たせない。端ごとに求めること。
describe("defaultSectionSpan", () => {
  const w = (mm: number) => mm;
  const bounds = { minX: -4000, maxX: 4000, minZ: -3000, maxZ: 3000, minY: 0, maxY: 3000 };

  it("寸法線から SECTION_LABEL_CLEARANCE_MM だけ内側にラベルが来る", () => {
    // 1列目までの実距離 2000 → 線端は 2000 - 460 = 1540 外側（labelOffset 0）
    const s = defaultSectionSpan(bounds, "x", w, 9999, 0, { lo: 2000, hi: 2000 });
    expect(s.from).toBeCloseTo(-4000 - 1540);
    expect(s.to).toBeCloseTo(4000 + 1540);
  });

  it("建物が通り芯に対して偏っていても、両端とも寸法線から等距離になる", () => {
    // 実測（2026-07-29）: 通り芯 -3900…12400 / 建物 -5195.34…12392 / 余白 3000
    //   左の1列目 = -6900、建物左端まで 1704.66 ／ 右の1列目 = 15400、建物右端まで 3008
    const real = { minX: -5195.34, maxX: 12392, minZ: -5051.93, maxZ: 5051.93, minY: 0, maxY: 8066.7 };
    const s = defaultSectionSpan(real, "x", w, 9999, 330, { lo: 1704.66, hi: 3008 });
    // ラベル位置 = 線端 ± labelOffset。どちらの端も1列目から 460 内側であること。
    expect((s.from - 330) - -6900).toBeCloseTo(460);
    expect(15400 - (s.to + 330)).toBeCloseTo(460);
  });

  it("寸法線を外へ動かすと断面記号も同じだけ外へ動く（一定の間隔を保つ）", () => {
    const a = defaultSectionSpan(bounds, "x", w, 9999, 0, { lo: 2000, hi: 2000 });
    const b = defaultSectionSpan(bounds, "x", w, 9999, 0, { lo: 3000, hi: 3000 });
    expect(b.to - a.to).toBeCloseTo(1000);
  });

  it("ラベル分（labelOffset）は線端から差し引く", () => {
    const s = defaultSectionSpan(bounds, "x", w, 9999, 300, { lo: 2000, hi: 2000 });
    expect(s.to).toBeCloseTo(4000 + (2000 - 460 - 300));
  });

  it("寸法線が建物の外形より内側にあると、線も建物の内側へ引っ込む", () => {
    // 1列目が建物の端と同じ位置（実距離 0）→ 線端はそこから 460 内側
    const s = defaultSectionSpan(bounds, "z", w, 9999, 0, { lo: 0, hi: 0 });
    expect(s.from).toBeCloseTo(-3000 + 460);
    expect(s.to).toBeCloseTo(3000 - 460);
  });

  it("引っ込みは端ごとに 700 で止まる（図から浮いて読めなくなるのを防ぐ）", () => {
    // 低い側だけ深く引っ込む条件 → 低い側は 700 で頭打ち、高い側は素の計算どおり
    const s = defaultSectionSpan(bounds, "z", w, 9999, 0, { lo: -1000, hi: 2000 });
    expect(s.from).toBeCloseTo(-3000 + 700);
    expect(s.to).toBeCloseTo(3000 + (2000 - 460));
  });

  it("省略時は両端とも既定の余白ぶん離れているものとみなす", () => {
    const s = defaultSectionSpan(bounds, "x", w, 9999, 0);
    expect(s.to).toBeCloseTo(4000 + (DIM_COL_OFFSET_MM - 460));
    expect(s.from).toBeCloseTo(-4000 - (DIM_COL_OFFSET_MM - 460));
  });

  it("建物が測れないときはフォールバック幅を返す", () => {
    expect(defaultSectionSpan(null, "x", w, 1234)).toEqual({ from: -1234, to: 1234 });
  });
});

// 断面線の初期位置＝その軸方向の建物中心。作成時のシードと「初期位置に戻す」で同じ規則を使う。
describe("defaultSectionPos", () => {
  const bounds = { minX: -4000, maxX: 8000, minZ: -3000, maxZ: 1000, minY: 0, maxY: 3000 };

  it("axis=x は X の中心を返す", () => {
    expect(defaultSectionPos(bounds, "x")).toBe(2000);
  });

  it("axis=z は Z の中心を返す", () => {
    expect(defaultSectionPos(bounds, "z")).toBe(-1000);
  });

  it("原点対称な建物では 0 になる", () => {
    const sym = { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 5000, minY: 0, maxY: 3000 };
    expect(defaultSectionPos(sym, "x")).toBe(0);
    expect(defaultSectionPos(sym, "z")).toBe(0);
  });

  it("建物が測れないときは 0（原点）", () => {
    expect(defaultSectionPos(null, "x")).toBe(0);
    expect(defaultSectionPos(undefined, "z")).toBe(0);
  });
});
