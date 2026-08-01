// sectionFrame — 3D（パース）に出す「断面枠」が覆う範囲。
//
//   枠の役割は「いまどこを切っているか」を示すこと。なので:
//     ・端は図面（寸法列・断面線）とそろえたい → 通り芯の総長を基準にする
//       （chainSpan と同じ規則。躯体 GLB の箱は庇や基礎を含んで通り芯より外に出るので、
//        外形をそのまま端にすると図面と枠がずれる）
//     ・ただし切っている実体より小さくしてはいけない → 通り芯と建物外形の広い方を採る
//       （通り芯が建物より内側に引かれている場合、通り芯だけだと枠が建物を覆えない）
//
//   単位は呼び出し側に合わせる（world でも mm でもよい。混ぜないこと）。
import { chainSpan } from "./planBounds";

/**
 * 1 軸ぶんの枠の範囲。
 * @param gridPositions その向きの通り芯の位置（昇順でなくてよい）
 * @param lo/hi         建物外形のその軸の範囲（順序は問わない）
 * @param pad           両側に足す余白
 */
export function sectionFrameSpan(
  gridPositions: number[],
  lo: number,
  hi: number,
  pad: number,
): [number, number] {
  const bLo = Math.min(lo, hi);
  const bHi = Math.max(lo, hi);
  // 通り芯が 2 本以上あればその総長、1 本以下なら建物外形（chainSpan の規則）。
  const [gLo, gHi] = chainSpan(gridPositions, bLo, bHi);
  return [Math.min(gLo, bLo) - pad, Math.max(gHi, bHi) + pad];
}
