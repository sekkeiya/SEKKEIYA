/**
 * Map モード（敷地に航空写真を合わせる作業モード）の入退処理。
 * トップツールバー（SelectionScopeButtons）と右ドックの Map ボタンの両方から呼べるよう集約する。
 *
 * Map モードでは:
 *   - editorMode = "map"（家具寸法/ゾーン/照明バッジ等のオーバーレイを隠す）
 *   - 右サイドバーは Map パネルのみを排他表示
 *   - 家具/照明/ゾーンの選択は不可（canSelect* が "map" で false）
 */
import { useSelectionScopeStore } from "../store/useSelectionScopeStore";
import { useUiSelectionStore } from "../store/uiSelectionStore";
import { useUiPropertiesSelectionStore } from "../store/uiPropertiesSelectionStore";
import { useLayoutTaskStore } from "../store/useLayoutTaskStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useUiRightSidebarStore } from "../store/uiRightSidebarStore";

/** Map モードに入る際の副作用（scope の切替は呼び出し側で行う）。 */
export function enterMapModeEffects() {
  // 選択をすべて解除（家具/マテリアル/ゾーン）
  useUiSelectionStore.getState().setSelectedItemIds([]);
  useUiPropertiesSelectionStore.getState().clearSelection?.();
  useLayoutTaskStore.getState().setActiveZoneId(null);

  useEditorModeStore.getState().setEditorMode("map");

  // 右サイドバーは Map パネルだけを排他表示にする。
  useUiRightSidebarStore.getState().setRightPanels({
    scene: false,
    properties: false,
    library: false,
    history: false,
    autoLayout: false,
    characters: false,
    map: true,
  });
}

/** Map モードを抜ける際の副作用（scope の切替は呼び出し側で行う）。 */
export function exitMapModeEffects() {
  useEditorModeStore.getState().setEditorMode("layout");
  // Map パネルだけを閉じる（他パネルを既定値へ戻さない）。
  useUiRightSidebarStore.getState().setRightPanel("map", false);
}

/** 右ドックの Map ボタン用：scope を切り替えつつ入退する。 */
export function toggleMapMode() {
  const scope = useSelectionScopeStore.getState().scope;
  if (scope === "map") {
    useSelectionScopeStore.getState().setScope("all");
    exitMapModeEffects();
  } else {
    useSelectionScopeStore.getState().setScope("map");
    enterMapModeEffects();
  }
}
