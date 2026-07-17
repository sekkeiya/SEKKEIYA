import React from "react";
import LayoutToolbar from "./LayoutToolbar";
import PresentToolbar from "./PresentToolbar";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";

// ModeToolbar — Row2 右側のツールバーを 2D/3D グループで切替える。
// - 2D 配置: LayoutToolbar（造作家具 / 寸法 / スナップ / 回転 / 整列 = 配置系フルセット）
// - 3D 演出: PresentToolbar（ウォークスルー / 断面 / グリッド = 演出・確認系）
export default function ModeToolbar({ layoutItems = [], ...props }) {
  const viewGroup = useEditorModeStore((s) => s.editorViewGroup);

  if (viewGroup === "3d") {
    return <PresentToolbar {...props} />;
  }

  return <LayoutToolbar layoutItems={layoutItems} {...props} />;
}
