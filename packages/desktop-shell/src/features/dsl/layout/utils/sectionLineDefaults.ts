// sectionLineDefaults — 断面線を「初期位置に戻す」操作。
//   位置の決め方そのものは planBounds の defaultSectionPos（純粋・テスト済み）に置き、
//   ここは各ストアから材料を集めて適用するだけの薄い層にする。
//   これにより useSectionLinesStore は純粋なデータストアのままでいられる。
import { measureXZBounds, defaultSectionPos } from "./planBounds";
import { useSectionLinesStore } from "../store/useSectionLinesStore";
import { useSceneObjectRegistryStore } from "../store/sceneObjectRegistryStore";
import { useWallStore } from "../store/useWallStore";
import { useEditorModeStore } from "../store/useEditorModeStore";

/**
 * 断面線を初期位置へ戻す。位置＝建物中心、長さ＝自動（手動の span をクリア）。
 * 見る向き（flip）と軸（axis）は触らない。
 *
 * ⚠️ 建物を測るのはこの関数を呼んだ瞬間だけ。measureXZBounds の Box3.setFromObject は
 *    GLB のシーングラフを丸ごと走査して重いので、レンダー中に呼ばないこと（クリック時のみ）。
 *
 * @returns 戻した後の位置（world）。線が見つからなければ null。
 */
export function resetSectionLine(id: string): number | null {
  const st = useSectionLinesStore.getState();
  const line = st.lines.find((l) => l.id === id);
  if (!line) return null;

  const isMm = (useEditorModeStore.getState().sceneMaxY || 0) > 100;
  const w = (mm: number) => (isMm ? mm : mm / 1000);
  const bounds = measureXZBounds(
    useSceneObjectRegistryStore.getState().baseColliders,
    useWallStore.getState().walls,
    w,
  );

  // ドラッグ操作と同じ 50mm 刻みへ丸める。
  const raw = defaultSectionPos(bounds, line.axis);
  const pos = isMm ? Math.round(raw / 50) * 50 : Math.round(raw / 0.05) * 0.05;

  // span を undefined に戻すと、両端とも自動の長さへ追従するようになる。
  st.updateLine(id, { pos, span: undefined });
  return pos;
}
