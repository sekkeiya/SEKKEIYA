// applySelectionScope — トップツールバーの選択スコープ（ALL/Label/Item/Lighting/Zone/
// Material/Map）切替の副作用をまとめた共有関数。SelectionScopeButtons と
// 自動アクション（AutoActionStarMenu）の両方から呼んでモードを揃える。
//
// React 非依存（全ストアを getState で操作）なので、ボタン以外からも安全に呼べる。
import { useSelectionScopeStore } from "../store/useSelectionScopeStore";
import { enterMapModeEffects, exitMapModeEffects } from "./mapMode";
import { useUiSelectionStore } from "../store/uiSelectionStore";
import { useUiPropertiesSelectionStore } from "../store/uiPropertiesSelectionStore";
import { useLayoutTaskStore } from "../store/useLayoutTaskStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useMaterialFaceStore } from "../store/useMaterialFaceStore";
import { useStructureLabelStore } from "../store/useStructureLabelStore";
import { useUiLeftSidebarStore } from "../store/uiLeftSidebarStore";
import { useAutoActionStore } from "../store/useAutoActionStore";
import { useUiRightSidebarStore } from "../store/uiRightSidebarStore";
import { useHeightSetupStore } from "../store/useHeightSetupStore";

// Material モードに入る前の左サイドバー状態を退避し、抜けたら復元する。
let savedLeftPanelsBeforeMaterial: any = null;

export type SelectionScope = "all" | "label" | "item" | "lighting" | "zone" | "material" | "map";

export function applySelectionScope(next: SelectionScope | string): void {
  if (!next) return;
  const prev = useSelectionScopeStore.getState().scope;
  if (prev === next) return; // 既に同じモードなら何もしない（副作用の二重実行防止）
  useSelectionScopeStore.getState().setScope(next as SelectionScope);

  // Material モードを抜けるとき: editorMode を layout に戻し、面選択と左サイドバーを復元。
  if (prev === "material" && next !== "material") {
    useEditorModeStore.getState().setEditorMode("layout");
    useMaterialFaceStore.getState().setSelectedFace(null);
    if (savedLeftPanelsBeforeMaterial) {
      useUiLeftSidebarStore.getState().setLeftPanels(savedLeftPanelsBeforeMaterial);
      savedLeftPanelsBeforeMaterial = null;
    }
  }

  // Map モードを抜けるとき: editorMode を layout に戻し、Map パネルを閉じる。
  if (prev === "map" && next !== "map") {
    exitMapModeEffects();
  }

  // Lighting スコープを抜けるとき: スコープ起因で開いた自動ライティングの右パネルを解除。
  if (prev === "lighting" && next !== "lighting") {
    if (useAutoActionStore.getState().selectedAuto === "autoLighting") {
      useAutoActionStore.getState().setSelectedAuto(null);
      useAutoActionStore.getState().setActiveSide(null);
    }
  }

  // Zone スコープを抜けるとき: zoning（ゾーン編集）操作を解除して layout に戻す。
  // カメラ/断面は触らない（ビューポート設定でユーザーが保持する＝統一）。
  if (prev === "zone" && next !== "zone") {
    useEditorModeStore.getState().setEditorMode("layout");
  }

  // Map モード
  if (next === "map") {
    enterMapModeEffects();
    return;
  }

  // Label モードを抜けるとき: editorMode を layout に戻し、自動ラベルの右パネルも解除。
  if (prev === "label" && next !== "label") {
    useEditorModeStore.getState().setEditorMode("layout");
    if (useAutoActionStore.getState().selectedAuto === "autoLabel") {
      useAutoActionStore.getState().setSelectedAuto(null);
      useAutoActionStore.getState().setActiveSide(null);
    }
    // 高さ設定（横断面ビュー）も終了して俯瞰パースに戻す（断面クリップも復帰）。
    if (useHeightSetupStore.getState().active) {
      useHeightSetupStore.getState().exit();
    }
  }

  // Label モード: 面ラベルの付与/確認。カメラ・断面・フレーミングは触らない（統一）。
  // ※ ビューポートの見た目はビューポート設定でユーザーが管理し、モードを跨いで保持される。
  if (next === "label") {
    useUiSelectionStore.getState().setSelectedItemIds([]);
    const sel = useUiPropertiesSelectionStore.getState().selection;
    if (sel) useUiPropertiesSelectionStore.getState().clearSelection?.();
    useLayoutTaskStore.getState().setActiveZoneId(null);
    useEditorModeStore.getState().setEditorMode("label");
    // 右サイドバーに「自動ラベル」と同じパネルを出す（面未選択時。面選択時は面ラベル設定が優先表示）。
    useAutoActionStore.getState().setSelectedAuto("autoLabel");
    useAutoActionStore.getState().setActiveSide("autoLabel");
    useUiRightSidebarStore.getState().setRightPanel("scene", false);
    useUiRightSidebarStore.getState().setRightPanel("history", false);
    useUiRightSidebarStore.getState().setRightPanel("properties", true);
    return;
  }

  // Material モード: editorMode="material"（面ピック）。家具クリックは無効化されるが、
  // 家具の半透明やカメラ・断面はビューポート設定で管理（統一）。
  if (next === "material") {
    useUiSelectionStore.getState().setSelectedItemIds([]);
    const sel = useUiPropertiesSelectionStore.getState().selection;
    if (sel) useUiPropertiesSelectionStore.getState().clearSelection?.();
    useLayoutTaskStore.getState().setActiveZoneId(null);
    useEditorModeStore.getState().setEditorMode("material");
    if (prev !== "material") {
      savedLeftPanelsBeforeMaterial = { ...useUiLeftSidebarStore.getState().leftPanels };
      useUiLeftSidebarStore.getState().closeAll();
    }
    return;
  }

  // ALL / Item / Lighting / Zone: 選択スコープの切替のみ。
  // カメラ・断面・フレーミングは一切触らない（どのモードでも同じビューを維持＝統一）。
  if (next === "item") {
    const sel = useUiPropertiesSelectionStore.getState().selection;
    if (sel?.kind === "light") useUiPropertiesSelectionStore.getState().clearSelection();
    useLayoutTaskStore.getState().setActiveZoneId(null);
  } else if (next === "lighting") {
    useUiSelectionStore.getState().setSelectedItemIds([]);
    useLayoutTaskStore.getState().setActiveZoneId(null);
    // 右サイドバーに「自動ライティング」と同じパネルを出す（自動アクションと UI を揃える）。
    // ライトを個別選択していなければ AutoActionSidePanel(kind="autoLighting") が表示される。
    useAutoActionStore.getState().setSelectedAuto("autoLighting");
    useAutoActionStore.getState().setActiveSide("autoLighting");
    useUiRightSidebarStore.getState().setRightPanel("scene", false);
    useUiRightSidebarStore.getState().setRightPanel("history", false);
    useUiRightSidebarStore.getState().setRightPanel("properties", true);
  } else if (next === "zone") {
    useUiSelectionStore.getState().setSelectedItemIds([]);
    const sel = useUiPropertiesSelectionStore.getState().selection;
    if (sel?.kind === "light") useUiPropertiesSelectionStore.getState().clearSelection();
    // Label モード等から持ち越した面選択を解除（右サイドバーが面ラベルパネルに張り付くのを防ぐ）。
    useStructureLabelStore.getState().clearSelection?.();
    // Zone: ゾーン編集操作を有効化（editorMode="zoning"）。ゾーンは俯瞰パースのままでも編集可。
    // 真上 Top で作業したい場合はビューポート設定の「カメラビュー」で切替（モード跨ぎで保持）。
    useEditorModeStore.getState().setEditorMode("zoning");
  }
}
