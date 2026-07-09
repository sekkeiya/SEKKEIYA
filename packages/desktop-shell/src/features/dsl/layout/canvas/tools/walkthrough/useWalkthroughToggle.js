// src/features/dsl/layout/canvas/tools/walkthrough/useWalkthroughToggle.js
//
// ウォークスルー入退場のトグル。入場前のカメラ姿勢（俯瞰）を退避し、退場時に復元する。
// ツールバーボタンと HUD の退出ボタンの両方から共有する。

import { useCallback } from "react";
import { layoutSceneRef } from "../../../services/layoutSceneRef";
import { useEditorModeStore } from "../../../store/useEditorModeStore";

// 入場前の俯瞰カメラ姿勢（モジュールスコープ。viewport をまたいで 1 つ保持すれば十分）
let savedOverviewPose = null;

export function useWalkthroughToggle() {
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const enterWalkthrough = useEditorModeStore((s) => s.enterWalkthrough);
  const exitWalkthrough = useEditorModeStore((s) => s.exitWalkthrough);

  const isWalkthrough = editorMode === "walkthrough";

  const enter = useCallback(() => {
    try {
      savedOverviewPose = layoutSceneRef.getCameraState?.() ?? null;
    } catch {
      savedOverviewPose = null;
    }
    enterWalkthrough();
  }, [enterWalkthrough]);

  const exit = useCallback(() => {
    exitWalkthrough();
    // OrbitControls が再び有効になった次フレームで俯瞰姿勢を復元する
    const pose = savedOverviewPose;
    if (pose) {
      requestAnimationFrame(() => {
        try {
          layoutSceneRef.setCameraPose?.(pose);
        } catch {
          /* noop */
        }
      });
    }
  }, [exitWalkthrough]);

  const toggle = useCallback(() => {
    if (isWalkthrough) exit();
    else enter();
  }, [isWalkthrough, enter, exit]);

  return { isWalkthrough, enter, exit, toggle };
}
