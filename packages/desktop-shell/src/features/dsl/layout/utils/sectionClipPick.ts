// sectionClipPick — 断面クリッピングで「隠れている」面をクリック選択させないための判定。
// レイキャストは Three.js のクリッピング(material.clippingPlanes)を無視してヒットするため、
// SectionClipManager と同じ条件でヒット点を判定し、隠れ側のヒットを除外する。
//
// クリップ面（SectionClipManager と一致）:
//   Y: y <= sectionClipHeight を表示（上を隠す）
//   X: x <= sectionClipX を表示
//   Z: z <= sectionClipZ を表示
//   Top ビューでは X/Z（縦断面）は無視（描画側と揃える）。
//   walkthrough / Material 一人称 / Label モード ではクリップ無効。
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useMaterialViewStore } from "../store/useMaterialViewStore";

const EPS = 1; // 境界の面を誤って弾かないための許容（シーン単位）

export interface PickPoint { x: number; y: number; z: number; }

/** 与えた世界座標が断面クリップで隠れている側にあるか（= 選択させたくない）。 */
export function isPointSectionClipped(p: PickPoint | null | undefined, isTopView = false): boolean {
  if (!p) return false;
  const es: any = useEditorModeStore.getState();
  const firstPerson = useMaterialViewStore.getState().firstPerson;
  const enabled =
    es.isSectionClipEnabled &&
    es.editorMode !== "walkthrough" &&
    !firstPerson &&
    es.editorMode !== "label";
  if (!enabled) return false;

  if (es.sectionClipYEnabled && p.y > es.sectionClipHeight + EPS) return true;
  if (!isTopView) {
    if (es.sectionClipXEnabled && p.x > es.sectionClipX + EPS) return true;
    if (es.sectionClipZEnabled && p.z > es.sectionClipZ + EPS) return true;
  }
  return false;
}

/** ヒット配列（近い順）から、断面クリップで隠れていない最初のヒットを返す。 */
export function firstVisibleHit<T extends { point?: PickPoint }>(hits: T[] | null | undefined, isTopView = false): T | null {
  if (!Array.isArray(hits)) return null;
  for (const h of hits) {
    if (h?.point && isPointSectionClipped(h.point, isTopView)) continue;
    return h;
  }
  return null;
}
