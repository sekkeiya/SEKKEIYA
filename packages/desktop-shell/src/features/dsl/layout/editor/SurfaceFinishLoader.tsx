// SurfaceFinishLoader — レイアウト（Base/Plan/Option）を開いたら、保存済みの躯体仕上げを
// Firestore から購読してストアへ反映する（リロード後も復元）。描画はしない。

import { useEffect } from "react";
import { useAppStore } from "../../../../store/useAppStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useSurfaceFinishStore } from "../store/useSurfaceFinishStore";
import { useSurfacePatternStore } from "../store/useSurfacePatternStore";
import { loadSurfaceData } from "../api/surfaceFinishApi";

export default function SurfaceFinishLoader() {
  const projectId = useAppStore((s) => s.activeProjectId);
  const workspaceId = useEditorModeStore((s) => s.dslPlanContext?.workspaceId) || null;
  const layoutSel = useAppStore((s: any) => s.panelSelections?.layout);
  const layoutKey = layoutSel?.optionId || layoutSel?.planId || layoutSel?.baseId || null;
  const replaceFinishes = useSurfaceFinishStore((s) => s.replaceAll);
  const replacePatterns = useSurfacePatternStore((s) => s.replaceAll);
  const replaceActive = useSurfacePatternStore((s) => s.replaceActive);

  // レイアウト（Base/Plan/Option）を開いたタイミングで 1 回だけ読み込む。
  // ライブ購読(onSnapshot)は Firestore SDK のアサーション誘発を避けるため使わない。
  useEffect(() => {
    let cancelled = false;
    if (!projectId || !workspaceId || !layoutKey) { replaceFinishes([]); replacePatterns({}); replaceActive({}); return; }
    loadSurfaceData(projectId, workspaceId, layoutKey).then((data) => {
      if (cancelled) return;
      replaceFinishes(data.finishes);
      replacePatterns(data.patterns);
      replaceActive(data.activePatterns || {});
    });
    return () => { cancelled = true; };
  }, [projectId, workspaceId, layoutKey, replaceFinishes, replacePatterns, replaceActive]);

  return null;
}
