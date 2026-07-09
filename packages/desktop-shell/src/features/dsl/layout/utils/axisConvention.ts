/**
 * S.Layout 表示座標規約（Rhino/CAD ユーザー向け Z-up）
 *
 * エンジンは Three.js のネイティブ Y-up のまま。ジオメトリ・カメラ・物理・ライト等の
 * 内部計算は一切変えない。UI に「数値座標」を見せる／入力させる箇所だけ、Rhino 式の
 * Z-up に並べ替えて表示・反映する。
 *
 *   表示 X = データ X （横 / 左右）
 *   表示 Y = データ Z （奥行き / 縦＝平面図の上下）
 *   表示 Z = データ Y （高さ / 上下＝法線）
 *
 * インデックス対応（表示 i 列 → データ index）:
 *   DISPLAY_TO_DATA = [0, 2, 1]
 * これは添字 1↔2 の入れ替えなので「データ→表示」も同じ並べ替えで対称。
 */

/** 表示列インデックス → Three.js データ配列インデックス。 */
export const DISPLAY_TO_DATA = [0, 2, 1] as const;

/** UI に出す軸ラベル（左から表示 X / Y / Z）。 */
export const DISPLAY_AXIS_LABELS = ["X", "Y", "Z"] as const;

type Vec3 = [number, number, number] | number[];

/** データ [x,y,z](Y-up) → 表示 [x,z,y](Z-up)。 */
export function dataToDisplayVec3(v: Vec3): [number, number, number] {
  return [v[0], v[2], v[1]];
}

/** 表示 [x,y,z](Z-up) → データ [x,y,z](Y-up)。対称なので並べ替えは同じ。 */
export function displayToDataVec3(v: Vec3): [number, number, number] {
  return [v[0], v[2], v[1]];
}
