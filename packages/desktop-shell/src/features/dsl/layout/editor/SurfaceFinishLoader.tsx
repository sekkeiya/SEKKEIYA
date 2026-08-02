// SurfaceFinishLoader — レイアウト（Base/Plan/Option）を開いたら、保存済みの躯体仕上げを
// Firestore から購読してストアへ反映する（リロード後も復元）。描画はしない。

import { useEffect } from "react";
import { useAppStore } from "../../../../store/useAppStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useSurfaceFinishStore } from "../store/useSurfaceFinishStore";
import { useSurfacePatternStore } from "../store/useSurfacePatternStore";
import { useDrawnFinishStore } from "../store/useDrawnFinishStore";
import { loadSurfaceData } from "../api/surfaceFinishApi";
import { useLayoutPatternStore } from "../store/useLayoutPatternStore";
import { applyPattern } from "../services/patternSnapshot";
import { getProposalItemsBridge } from "../services/proposalItemsBridge";

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
    if (!projectId || !workspaceId || !layoutKey) {
      replaceFinishes([]); replacePatterns({}); replaceActive({});
      useDrawnFinishStore.getState().clear();
      return;
    }
    loadSurfaceData(projectId, workspaceId, layoutKey).then((data) => {
      if (cancelled) return;
      replaceFinishes(data.finishes);
      replacePatterns(data.patterns);
      replaceActive(data.activePatterns || {});
      // 作図した壁/床の仕上げ（無ければクリア＝既定色に戻す）
      const df = data.drawnFinishes;
      if (df) {
        useDrawnFinishStore.getState().setFinishes({
          interiorWall: df.interiorWall ?? null,
          exteriorWall: df.exteriorWall ?? null,
          floor: df.floor ?? null,
          styleKey: df.styleKey ?? null,
        });
      } else {
        useDrawnFinishStore.getState().clear();
      }
      // Plan 切替を伴う提案適用の予約があれば、プラン既定を読み込んだ「後」に重ねる。
      // （切替直後に適用するとこのローダーが上書きして提案の見た目が消えるため）
      const { pendingApplyId, patterns } = useLayoutPatternStore.getState();
      if (pendingApplyId) {
        useLayoutPatternStore.getState().setPendingApply(null);
        const p = patterns.find((x) => x.id === pendingApplyId);
        if (p) {
          applyPattern(p);
          // v2: 配置スナップショットも Plan（作業バッファ）へ書き戻す。
          // applying を立ててキャプチャを抑止（復元による draft 変化を記録しない）。
          if (Array.isArray(p.items)) {
            useLayoutPatternStore.getState().setApplying(true);
            void getProposalItemsBridge()?.restoreItems(p.items as Record<string, unknown>[])
              ?.catch((e) => console.warn('[SurfaceFinishLoader] 配置の復元に失敗:', e))
              ?.finally?.(() => useLayoutPatternStore.getState().setApplying(false));
            if (!getProposalItemsBridge()) useLayoutPatternStore.getState().setApplying(false);
          }
        }
      }
    }).catch((e) => {
      if (cancelled) return;
      // ロード失敗時も予約を残したままにすると、次のロード成功時に古い提案が
      // 不意に適用されてしまうため、ここで確実に破棄する。
      useLayoutPatternStore.getState().setPendingApply(null);
      console.warn('[SurfaceFinishLoader] 面仕上げの読み込みに失敗:', e);
    });
    return () => { cancelled = true; };
  }, [projectId, workspaceId, layoutKey, replaceFinishes, replacePatterns, replaceActive]);

  return null;
}
