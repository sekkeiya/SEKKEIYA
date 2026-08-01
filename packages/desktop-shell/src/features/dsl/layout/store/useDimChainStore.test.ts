import { describe, it, expect } from "vitest";
import { isSideLinked, applyOffsetToLinkedSides, defaultChainsFor } from "./useDimChainStore";

// 余白はリンクマークで辺どうしを連動できる。既定は全辺リンク。
// リンクを外した辺は、自分を編集しても他へ波及せず、他の辺の連動にも巻き込まれない。
describe("isSideLinked", () => {
  it("未設定の辺はリンクされているものとして扱う（既定は連動）", () => {
    expect(isSideLinked(undefined, "left")).toBe(true);
    expect(isSideLinked({}, "left")).toBe(true);
  });

  it("false を明示した辺だけが外れる", () => {
    expect(isSideLinked({ left: false }, "left")).toBe(false);
    expect(isSideLinked({ left: false }, "right")).toBe(true);
  });
});

describe("applyOffsetToLinkedSides", () => {
  it("既定（全辺リンク）ならどの辺を編集しても4辺そろう", () => {
    expect(applyOffsetToLinkedSides({}, undefined, "left", 2500)).toEqual({
      top: 2500, bottom: 2500, left: 2500, right: 2500,
    });
  });

  it("リンクを外した辺は連動に巻き込まれない", () => {
    const links = { right: false };
    const next = applyOffsetToLinkedSides({ right: 800 }, links, "left", 2500);
    expect(next).toEqual({ top: 2500, bottom: 2500, left: 2500, right: 800 });
  });

  it("リンクを外した辺を編集しても、その辺しか変わらない", () => {
    const links = { right: false };
    const prev = { top: 2000, bottom: 2000, left: 2000, right: 800 };
    expect(applyOffsetToLinkedSides(prev, links, "right", 1200)).toEqual({
      top: 2000, bottom: 2000, left: 2000, right: 1200,
    });
  });

  it("上下だけリンクを残せば、上を編集しても左右は動かない", () => {
    const links = { left: false, right: false };
    const prev = { top: 2000, bottom: 2000, left: 900, right: 800 };
    expect(applyOffsetToLinkedSides(prev, links, "top", 3000)).toEqual({
      top: 3000, bottom: 3000, left: 900, right: 800,
    });
  });

  it("負値・不正値は 0 以上の整数へ丸める", () => {
    expect(applyOffsetToLinkedSides({}, { top: false }, "top", -500)).toEqual({ top: 0 });
    expect(applyOffsetToLinkedSides({}, { top: false }, "top", 1234.6)).toEqual({ top: 1235 });
    expect(applyOffsetToLinkedSides({}, { top: false }, "top", Number.NaN)).toEqual({ top: 0 });
  });

  it("元のオブジェクトを書き換えない", () => {
    const prev = { left: 1000 };
    applyOffsetToLinkedSides(prev, undefined, "left", 2500);
    expect(prev).toEqual({ left: 1000 });
  });
});

// 断面図の高さ寸法は寸法列に一本化した（LevelLinesOverlay の寸法線は廃止）。
// 製図の作法どおり、内側に天井高・外側に階高/GL・いちばん外に総寸法を並べる。
describe("defaultChainsFor（断面・立面の既定列）", () => {
  it("断面は左に 階高・GL → 総寸法（天井高は図面内の室内寸法で出す）", () => {
    const c = defaultChainsFor("sect:B-B'");
    expect(c.left.map((x) => x.source)).toEqual(["levelFloor", "total"]);
    expect(c.bottom.map((x) => x.source)).toEqual(["grid", "total"]);
  });

  it("立面は CL を描かないので 階高・GL → 総寸法 の 2 列", () => {
    const c = defaultChainsFor("facade:north");
    expect(c.left.map((x) => x.source)).toEqual(["levelFloor", "total"]);
  });

  it("平面は従来どおり通り芯間 → 総寸法", () => {
    const c = defaultChainsFor("plan:1F");
    expect(c.left.map((x) => x.source)).toEqual(["grid", "total"]);
    expect(c.bottom.map((x) => x.source)).toEqual(["grid", "total"]);
  });

  it("展開図は空のまま", () => {
    const c = defaultChainsFor("elev:room1");
    expect(c.left).toEqual([]);
    expect(c.bottom).toEqual([]);
  });
});
