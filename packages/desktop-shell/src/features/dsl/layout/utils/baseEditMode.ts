// baseEditMode — いま「Base（建築サイド）」を編集しているか。
//   すみ分け: Base=建築（壁・床・通り芯・寸法・断面など、全プラン共通）
//             Plan=家具レイアウトの違い / Option=家具の張地の違い。
//   壁・床・通り芯・寸法列などは Base の spaceProgram に保存される＝全プラン共通なので、
//   Plan/Option を開いている間にうっかり編集すると全プランが変わってしまう。
//   判定は LayoutShell が selectedBaseId && !selectedPlanId && !selectedOptionId から
//   立てている structureTagging（躯体モード）をそのまま使う（真実は1か所）。
import { useEditorModeStore } from "../store/useEditorModeStore";

/** ハンドラ内から同期的に見る版。true = Base を開いている（建築の編集可）。 */
export function isBaseEditMode(): boolean {
  try {
    return !!useEditorModeStore.getState().structureTagging;
  } catch {
    return false;
  }
}

/** コンポーネントから購読する版。 */
export function useBaseEditMode(): boolean {
  return useEditorModeStore((s) => !!s.structureTagging);
}
