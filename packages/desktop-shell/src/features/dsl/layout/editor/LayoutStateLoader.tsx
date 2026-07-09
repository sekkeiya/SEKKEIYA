// LayoutStateLoader — Base を開いたら、保存済みのライティング・面ラベル・カメラアングルを
// Firestore から読み込んでストアへ反映する（リロード後も復元）。描画はしない。
// マテリアル仕上げは別の SurfaceFinishLoader（layoutKey 単位）が担当する。

import { useEffect } from "react";
import { useAppStore } from "../../../../store/useAppStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useLightingStore } from "../store/useLightingStore";
import { useStructureLabelStore } from "../store/useStructureLabelStore";
import { useShotStore } from "../store/useShotStore";
import { useBuildingSpecStore } from "../store/useBuildingSpecStore";
import { useLayoutLoadSignal } from "../store/useLayoutLoadSignal";
import { loadLayoutState } from "../api/layoutStateApi";

export default function LayoutStateLoader() {
  const projectId = useAppStore((s) => s.activeProjectId);
  const workspaceId = useEditorModeStore((s) => s.dslPlanContext?.workspaceId) || null;
  const baseId = useAppStore((s: any) => s.panelSelections?.layout?.baseId) || null;

  // Base を開く/切り替えるたびに 1 回だけ読み込む（onSnapshot は使わない）。
  useEffect(() => {
    let cancelled = false;
    const loadKey = `${projectId || ""}/${workspaceId || ""}/${baseId || ""}`;
    // ロード（replaceAll）完了後に通知する。EditorAngleBar はこの後にだけシードする。
    const signalLoaded = () => useLayoutLoadSignal.getState().markLoaded(loadKey);

    const toDefaults = () => {
      useLightingStore.getState().setLights([]); // 空→初期ライトにフォールバック
      useShotStore.getState().replaceAll({ shots: [], sets: [] });
      useBuildingSpecStore.getState().replaceAll(null); // 既定の階高/CH
    };

    // 面ラベルは Base 単位（byBase）で管理されるので、まず activeBase を合わせる。
    useStructureLabelStore.getState().setActiveBase(baseId);

    if (!projectId || !workspaceId || !baseId) {
      toDefaults();
      useStructureLabelStore.getState().replaceAll({});
      signalLoaded();
      return;
    }

    loadLayoutState(projectId, workspaceId, baseId).then((data) => {
      if (cancelled) return;
      console.log("[LayoutStateLoader] load", { projectId, workspaceId, baseId, found: !!data, lights: data?.lights?.length, labels: data ? Object.keys(data.labels || {}).length : 0, shots: data?.shots?.length });
      if (!data) {
        toDefaults();
        useStructureLabelStore.getState().replaceAll({});
        signalLoaded();
        return;
      }
      useLightingStore.getState().setLights(data.lights || []);
      useStructureLabelStore.getState().replaceAll(data.labels || {});
      useShotStore.getState().replaceAll({ shots: data.shots || [], sets: data.sets || [] });
      useBuildingSpecStore.getState().replaceAll(data.buildingSpec || null);
      signalLoaded();
    });

    return () => { cancelled = true; };
  }, [projectId, workspaceId, baseId]);

  return null;
}
