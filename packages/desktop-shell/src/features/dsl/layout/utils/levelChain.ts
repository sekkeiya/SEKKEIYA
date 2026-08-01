// levelChain — 断面図・立面図の「階レベル」寸法列の刻みと、その寸法値を編集したときの書き戻し先。
//
//   寸法列は 3 つの経路で同じ知識を必要とする:
//     ① マークをどこに打つか（DimensionChainsOverlay の marksFor）
//     ② 区切りをドラッグしたとき何を動かすか（resolveMarkDrag）
//     ③ 寸法値をダブルクリックで書き換えたとき何を動かすか
//   ②と③がずれると「ドラッグと数値入力で結果が違う」ので、ここに 1 か所へ集める。
//
//   規則は 1 本だけ:
//     区間の数値編集 ＝ その区間の「動かせる側の区切り」を、指定 mm になる位置へ動かす。
//     上側が動かせればそれを、動かせなければ下側を動かす（GL→FL±0 が後者。FL±0 は基準）。
//
//   単位はすべて world mm（fl0Mm を足した絶対値）。world 座標への換算は呼び出し側の責務。
import { floorHeightOf, ceilingHeightOf } from "../store/useBuildingSpecStore";
import type { BuildingSpec } from "../store/useBuildingSpecStore";

/** 刻み元の種類。"legacy" は旧「階レベル」列（GL/FL/CL を 1 列に混ぜる）。
 *  天井高だけの列は持たない（部屋ごとに違うので図面の中に室ごとに立てる）。 */
export type LevelKind = "floor" | "legacy";

/**
 * 書き戻し先。valueMm は **対応する setter へそのまま渡す値**。
 *   gl          … setGlMm(valueMm)                    FL±0 からの相対
 *   cl          … setCeilingHeightAt(index, valueMm)  その階の天井高
 *   fl          … setFloorFlMm(index, valueMm)        FL±0 からの相対（＝下階の階高が変わる）
 *   floorHeight … setFloorHeightAt(index, valueMm)    その階の階高
 */
export type LevelEdit =
  | { kind: "gl"; valueMm: number }
  | { kind: "cl"; index: number; valueMm: number }
  | { kind: "fl"; index: number; valueMm: number }
  | { kind: "floorHeight"; index: number; valueMm: number };

/** 近い刻みを 1 本とみなす既定の許容(mm)。従来の寸法列と同じ。 */
export const LEVEL_MARK_TOL_MM = 60;
/** マークを「掴んだ」とみなす許容(mm)。従来の resolveMarkDrag と同じ。 */
const HIT_TOL_MM = 80;

const floorCount = (spec: BuildingSpec) => spec.floors?.length || 0;
/** その階の床レベル（world mm）。 */
const flAt = (spec: BuildingSpec, i: number) => (spec.fl0Mm || 0) + (spec.floors?.[i]?.flMm || 0);
/** 建物の最上部（最上階の床 ＋ その階の階高）。 */
const topAt = (spec: BuildingSpec) => {
  const last = floorCount(spec) - 1;
  if (last < 0) return spec.fl0Mm || 0;
  return flAt(spec, last) + floorHeightOf(spec, last);
};

/** 昇順に並べ、tol 未満で隣り合う値を 1 本に畳む。 */
function mergeSorted(values: number[], tolMm: number): number[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (!out.length || v - out[out.length - 1] >= tolMm) out.push(v);
  }
  return out;
}

/**
 * その刻み元のマーク（world mm・昇順）。
 * ⚠️ 端は建物のバウンディングボックスではなく **マーク自身**（GL 〜 最上部）。
 *    寸法列の normalizeMarks は端を図面の外形へ強制するので、こちらは通さないこと。
 */
export function levelMarksMm(
  spec: BuildingSpec,
  kind: LevelKind,
  tolMm: number = LEVEL_MARK_TOL_MM,
): number[] {
  const n = floorCount(spec);
  if (n <= 0) return [];
  const vals: number[] = [];

  if (kind === "floor" || kind === "legacy") vals.push((spec.fl0Mm || 0) + spec.glMm);

  for (let i = 0; i < n; i++) {
    const fl = flAt(spec, i);
    vals.push(fl);
    if (kind === "legacy") vals.push(fl + ceilingHeightOf(spec, i));
  }
  vals.push(topAt(spec));

  return mergeSorted(vals, tolMm);
}

/**
 * マークを targetMm へ動かすための書き戻し先。動かせないマーク（FL±0＝基準、
 * どのレベルにも当たらない位置）は null。
 */
export function resolveLevelMarkMove(
  spec: BuildingSpec,
  markMm: number,
  targetMm: number,
): LevelEdit | null {
  const base = spec.fl0Mm || 0;
  const target = Math.round(targetMm);
  const near = (v: number) => Math.abs(v - markMm) < HIT_TOL_MM;

  if (near(base + spec.glMm)) return { kind: "gl", valueMm: target - base };

  const n = floorCount(spec);
  for (let i = 0; i < n; i++) {
    const fl = flAt(spec, i);
    // FL±0（i===0）は基準なので動かせない。床レベルを先に見る（CL と重なったとき床を優先）。
    if (i > 0 && near(fl)) return { kind: "fl", index: i, valueMm: target - base };
    if (near(fl + ceilingHeightOf(spec, i))) {
      return { kind: "cl", index: i, valueMm: target - fl };
    }
  }

  // 最上部（最上階の床 ＋ 階高）。従来はここに該当する floors[i] が無く掴めなかった。
  const last = n - 1;
  if (last >= 0 && near(topAt(spec))) {
    return { kind: "floorHeight", index: last, valueMm: target - flAt(spec, last) };
  }
  return null;
}

/**
 * 区間 loMm→hiMm の長さを newLenMm にするための書き戻し先。
 * 上側の区切りが動かせればそれを、動かせなければ下側を動かす。どちらも無理なら null。
 */
export function resolveLevelSegmentEdit(
  spec: BuildingSpec,
  loMm: number,
  hiMm: number,
  newLenMm: number,
): LevelEdit | null {
  const len = Math.round(newLenMm);
  return (
    resolveLevelMarkMove(spec, hiMm, loMm + len) ??
    resolveLevelMarkMove(spec, loMm, hiMm - len)
  );
}

/** 何を動かすのかの説明（ドラッグハンドルの title／数値入力のツールチップ）。 */
export function levelEditTitle(spec: BuildingSpec, edit: LevelEdit): string {
  const name = (i: number) => spec.floors?.[i]?.name || `${i + 1}FL`;
  if (edit.kind === "gl") return "GL（地盤レベル）を動かす";
  if (edit.kind === "cl") return `${name(edit.index)} の天井高（CL）を動かす`;
  if (edit.kind === "fl") return `${name(edit.index)} の床レベルを動かす`;
  return `${name(edit.index)} の階高を動かす`;
}
