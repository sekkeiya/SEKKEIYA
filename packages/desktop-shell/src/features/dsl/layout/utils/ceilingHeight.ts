// ceilingHeight — 天井高の解決。**正は天井の面（FloorSlab role="ceiling"）**。
//
//   部屋も建物も天井高を持たない。面が自分の高さ（ceilingHeightMm・FL からの mm）を持ち、
//   roomId でどの部屋の天井かを指す。だから天井を消せば天井高も消える（＝吹き抜け）。
//
//   消費側（貼付高さ・断面の寸法・平面のラベル・展開図）は必ずここを通す。
//
//   ⚠️ 天井の貼付高さは slabCeilingHeightMm（面自身）で決めること。
//      ceilingHeightAtMm（位置から引く）を使うと、天井の高さを決めるのに
//      天井の高さが要る＝循環する。
//
//   単位はすべて world mm。world 座標への換算は呼び出し側の責務。
//
//   このファイルは純粋関数だけ（ストアを読まない）。既定天井高は呼び出し側が
//   ceilingHeightOf(spec, floorIndex) で取って defaultMm として渡す。

export interface PointMm {
  x: number;
  z: number;
}

export interface RectMm {
  x: number;
  z: number;
  width: number;
  depth: number;
}

/** 天井高の解決に必要な最小のスラブ情報。 */
export interface CeilingSlabLike {
  id: string;
  role?: string;
  floorIndex?: number;
  points?: PointMm[];
  /** 天井面（＝下端）の高さ(mm)。FL からの高さ。未設定は既定。 */
  ceilingHeightMm?: number;
  /** スラブ厚(mm)。上面基準で置かれ、厚みは下へ付く。 */
  thicknessMm?: number;
  /** どの部屋の天井か。 */
  roomId?: string;
}

/** 部屋のうち、天井の紐付けに使う部分。 */
export interface RoomLike {
  id: string;
  floorIndex?: number;
  rect?: RectMm | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** 天井面（＝下端）の高さ(mm)。未設定なら既定。これが製図でいう「天井高」。 */
export function slabCeilingHeightMm(
  slab: { ceilingHeightMm?: number } | null | undefined,
  defaultMm: number,
): number {
  return num(slab?.ceilingHeightMm) ?? defaultMm;
}

/**
 * 天井スラブを置く高さ＝**上面**(mm・FL から)。
 *
 * ⚠️ ここが天井まわりで一番間違えやすいところ。
 *    ceilingHeightMm は「天井面（下端）」の高さ＝人が見上げる面。製図の天井高もそこまで測る。
 *    一方スラブは上面基準で置かれ、厚みが下へ付く（SlabMesh: position = baseY - t）。
 *    なので置く高さは 天井面 ＋ 厚み。ここを取り違えると天井が厚みぶん下がり、
 *    断面の寸法が天井の上端で止まる。
 */
export function ceilingSlabTopMm(
  slab: { ceilingHeightMm?: number; thicknessMm?: number } | null | undefined,
  defaultMm: number,
): number {
  return slabCeilingHeightMm(slab, defaultMm) + (num(slab?.thicknessMm) ?? 0);
}

/** 多角形の重心(mm)＝頂点の平均。天井がどの部屋にあるかの判定に使う。 */
export function polygonCentroidMm(points: PointMm[] | null | undefined): PointMm {
  if (!points?.length) return { x: 0, z: 0 };
  let sx = 0;
  let sz = 0;
  for (const p of points) {
    sx += p.x;
    sz += p.z;
  }
  return { x: sx / points.length, z: sz / points.length };
}

/** 多角形の外接矩形(mm)。 */
export function polygonBounds2DMm(points: PointMm[] | null | undefined) {
  if (!points?.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
}

/** 部屋の rect → 天井の輪郭（4 隅・整数 mm・順回り）。自動生成と追従で使う。 */
export function rectToPoints(rect: RectMm): PointMm[] {
  const hw = (rect.width || 0) / 2;
  const hd = (rect.depth || 0) / 2;
  const r = (v: number) => Math.round(v);
  return [
    { x: r(rect.x - hw), z: r(rect.z - hd) },
    { x: r(rect.x + hw), z: r(rect.z - hd) },
    { x: r(rect.x + hw), z: r(rect.z + hd) },
    { x: r(rect.x - hw), z: r(rect.z + hd) },
  ];
}

/** 部屋の面積(㎡)。rect から。 */
export function rectAreaM2(rect: { width?: number; depth?: number } | null | undefined): number {
  const w = Math.abs(num(rect?.width) ?? 0);
  const d = Math.abs(num(rect?.depth) ?? 0);
  return (w * d) / 1_000_000;
}

/** 平面の部屋ラベル 2 行目。天井が無ければ null（行ごと出さない）。 */
export function roomCeilingLabel(heightsMm: number[]): string | null {
  const vals = (heightsMm || []).filter((v) => num(v) != null).map((v) => Math.round(v));
  if (!vals.length) return null;
  return `CH${vals.join("mm,")}mm`;
}

const isCeiling = (s: CeilingSlabLike) => s?.role === "ceiling";

/** 点が多角形の外接矩形の中か（判定は矩形で足りる。天井はほぼ矩形）。 */
function insideBounds(points: PointMm[] | undefined, x: number, z: number): boolean {
  if (!points?.length) return false;
  const b = polygonBounds2DMm(points);
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/**
 * その部屋の天井。roomId 一致を優先し、roomId を持たない旧データは
 * 「重心が部屋の rect の中」で拾う。並びは高さの降順。
 */
export function ceilingSlabsOfRoom(
  slabs: CeilingSlabLike[],
  room: RoomLike | null | undefined,
  defaultMm: number,
): CeilingSlabLike[] {
  if (!room?.id) return [];
  const floorIndex = num(room.floorIndex) ?? 0;
  const rect = room.rect;
  const hit = (slabs || []).filter((s) => {
    if (!isCeiling(s)) return false;
    if ((num(s.floorIndex) ?? 0) !== floorIndex) return false;
    if (s.roomId) return s.roomId === room.id;
    if (!rect) return false;
    const c = polygonCentroidMm(s.points);
    return (
      Math.abs(c.x - rect.x) <= (rect.width || 0) / 2 &&
      Math.abs(c.z - rect.z) <= (rect.depth || 0) / 2
    );
  });
  return hit.sort((a, b) => slabCeilingHeightMm(b, defaultMm) - slabCeilingHeightMm(a, defaultMm));
}

/**
 * その位置(world mm)の天井高(mm)。点を覆う天井が無ければ既定。
 * 重なっていたら面積の小さい方（下がり天井が勝つ）。
 * ⚠️ 天井そのものの貼付高さには使わないこと（循環する）。
 */
export function ceilingHeightAtMm(
  slabs: CeilingSlabLike[],
  floorIndex: number,
  x: number,
  z: number,
  defaultMm: number,
): number {
  let best: CeilingSlabLike | null = null;
  let bestArea = Infinity;
  for (const s of slabs || []) {
    if (!isCeiling(s)) continue;
    if ((num(s.floorIndex) ?? 0) !== (floorIndex || 0)) continue;
    if (!insideBounds(s.points, x, z)) continue;
    const b = polygonBounds2DMm(s.points);
    const area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
    if (area < bestArea) {
      bestArea = area;
      best = s;
    }
  }
  return slabCeilingHeightMm(best, defaultMm);
}
