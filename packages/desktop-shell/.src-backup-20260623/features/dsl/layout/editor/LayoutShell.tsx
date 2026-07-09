import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Box, Typography, Snackbar, Alert, Button, TextField, Collapse, CircularProgress, Rating, Paper } from "@mui/material";

// @ts-ignore
import Header from "./header/Header";
// @ts-ignore
import ViewportPanel from "../canvas/ViewportPanel";
// @ts-ignore
import Bottombar from "./dock/Bottombar";
// @ts-ignore
import BottomDock from "./dock/BottomDock";
// @ts-ignore
import RightSidebar from "./sidebars/RightSidebar/RightSidebar";
// @ts-ignore
import SelectBaseModal from "./modals/SelectBaseModal";
// @ts-ignore
import SelectWorkFileAsBaseModal from "./modals/SelectWorkFileAsBaseModal";
// @ts-ignore

// @ts-ignore
import ViewportShortcutsOverlay from "./overlays/ViewportShortcutsOverlay";

import { serverTimestamp, updateDoc, getDoc, doc, collectionGroup, query, where, limit, getDocs, collection, or, and } from "firebase/firestore";
import { db, storage } from "@desktop/lib/firebase/client";
import { useAuth } from "@desktop/features/dsl/layout/hooks/useAuthProxy";
import { useOptionDoc } from "@desktop/features/dsl/layout/hooks/useOptionDoc";
import { useWorkspaceStructure } from "@desktop/features/dsl/layout/hooks/useWorkspaceStructure";

import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

import { getPlanDocRef, migrateLegacyBaseToPlanOption } from "@desktop/features/dsl/layout/utils/workspaceStubs";
import { captureLayoutTopView } from "@desktop/features/dsl/layout/services/layoutThumbnailCapture";
import { useResolvedUrl, resolveUrlAsync } from "../hooks/useResolvedUrl";
import { useGLTF } from "@react-three/drei";

// ✅ hooks
import { useLayoutCrudActions } from "@desktop/features/dsl/layout/hooks/useLayoutCrudActions";
import { createLayoutShare } from "@desktop/features/dsl/layout/utils/layoutShareUtils";

// ✅ history / shortcuts（新規）
import { useLayoutHistory } from "@desktop/features/dsl/layout/hooks/useLayoutHistory";
import { useUndoRedoShortcuts } from "@desktop/features/dsl/layout/hooks/useUndoRedoShortcuts";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

import { useUiRightSidebarStore } from "@desktop/features/dsl/layout/store/uiRightSidebarStore";
import { useUiLeftSidebarStore } from "@desktop/features/dsl/layout/store/uiLeftSidebarStore";

import LayoutDashboard from "./dashboards/LayoutDashboard";
// (LeftSidebar removed from LayoutShell to avoid double rendering with MainLayout)
import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";
import { openLocalModelFiles } from "@desktop/features/dsl/layout/services/layoutFileImportService";
import { layoutPersistenceService } from "@desktop/features/dsl/layout/services/layoutPersistenceService";
import { useAutosaveDraft } from "@desktop/shared/hooks/useAutosaveDraft";
// ✅ tools store（TopBar/Buttonsのpropsバケツリレー削減）
import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";
import { useAiProfileStore } from "@desktop/store/useAiProfileStore";

// ✅ MaterialPicker store（Scene pick を集約）
import { useMaterialPickerStore } from "@desktop/features/dsl/layout/store/materialPickerStore";

// ✅ WorkspaceStructureStore
import { useWorkspaceStructureStore } from "@desktop/features/dsl/layout/store/useWorkspaceStructureStore";
import { useDslWorkspaceContextStore } from "@desktop/features/dsl/layout/store/useDslWorkspaceContextStore";

import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
import { useAutoLayoutStore } from "@desktop/features/dsl/layout/store/useAutoLayoutStore";
import { extractZoneData, runAutoLayout } from "@desktop/features/dsl/layout/services/autoLayoutService";
import { useZoningStore } from "@desktop/features/dsl/layout/store/useZoningStore";
import type { ZoneRect } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
// @ts-ignore
import ZoneCreateDialog from "@desktop/features/dsl/layout/editor/overlays/ZoneCreateDialog";
import { AutoLayoutConfigDialog } from "@desktop/features/dsl/layout/components/AutoLayoutConfigDialog";
import { FurnitureSwapDialog } from "@desktop/features/dsl/layout/components/FurnitureSwapDialog";

import { buildCopyPayload } from "@desktop/features/dsl/layout/commands/copyOps";

import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { useAppStore } from "@desktop/store/useAppStore";
import { convert3dmToGlb } from "@desktop/features/dss/upload/utils/convert3dmToGlb";

import { projectAssetsApi } from "@desktop/features/projects/api/projectAssetsApi";
import type { LayoutSceneObject, LayoutDocument } from "../types/layoutTypes";

// Global panel is managed natively by sekkeiya-desktop now


// ---------------------------
// utils
// ---------------------------
function safeArray(v: any) {
  return Array.isArray(v) ? v : [];
}
function safeString(v: any, fb = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fb;
}
function safeNumber(n: any, fb = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : fb;
}
function safeVec3(v: any, fb: [number, number, number] = [0, 0, 0]): [number, number, number] {
  if (!Array.isArray(v) || v.length < 3) return fb;
  return [safeNumber(v[0], fb[0]), safeNumber(v[1], fb[1]), safeNumber(v[2], fb[2])] as [number, number, number];
}

// ✅ LayoutShell 側では「layout 正規化」だけ残す（Save / DnD で使う）
function normalizeLayout(l: any): LayoutDocument {
  const base = l && typeof l === "object" ? l : {};
  const items = Array.isArray(base.items) ? base.items : [];
  return { ...base, items };
}

function pickFirstString(...candidates: any[]) {
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickGlbRawFromPayload(payload: any) {
  return pickFirstString(
    payload?.glbUrl,
    payload?.modelGlbUrl,
    payload?.viewerGlbUrl,
    payload?.asset?.glbUrl,
    
    payload?.downloadUrl,

    payload?.files?.glb?.url,
    payload?.files?.glb?.downloadUrl,
    payload?.files?.glb?.downloadURL,
    payload?.files?.glb?.fullPath,
    payload?.files?.glb?.path,
    payload?.files?.glb?.storagePath,
    payload?.files?.glb?.glbStoragePath,

    payload?.glbStoragePath
  );
}

function pickGlbRawFromModelDocData(data: any) {
  if (!data) return "";
  return pickFirstString(
    data?.glbUrl,
    data?.viewerGlbUrl,
    data?.modelGlbUrl,
    data?.asset?.glbUrl,

    data?.files?.glb?.url,
    data?.files?.glb?.downloadUrl,
    data?.files?.glb?.downloadURL,
    data?.files?.glb?.fullPath,
    data?.files?.glb?.storagePath,
    data?.files?.glb?.path,

    data?.glbStoragePath
  );
}

async function resolveGlbRaw({ payload, uid }: { payload: any; uid: string | null | undefined }) {
  const fromPayload = pickGlbRawFromPayload(payload);
  if (fromPayload) return fromPayload;

  const modelId = safeString(payload?.modelId || payload?.id || "");
  if (!modelId) return "";

  // ① users/{uid}/models/{modelId}
  if (uid) {
    try {
      const r2 = doc(db, "users", uid, "models", modelId);
      const s2 = await getDoc(r2);
      if (s2.exists()) {
        const raw = pickGlbRawFromModelDocData(s2.data());
        if (raw) return raw;
      }
    } catch (e: any) {
      console.warn("[resolveGlbRaw] read users/{uid}/models/{modelId} failed:", e?.code || e, e?.message || "");
    }
  }

  // ② fallback: collectionGroup("models") for public models
  try {
    const q = query(collectionGroup(db, "models"), where("id", "==", modelId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const raw = pickGlbRawFromModelDocData(snap.docs[0].data());
      if (raw) return raw;
    }
  } catch (e: any) {
    console.warn("[resolveGlbRaw] collectionGroup read failed:", e?.code || e, e?.message || "");
  }

  // ③ unified phase 11 architecture: fetch from global assets
  try {
    const assetRef = doc(db, "assets", modelId);
    const snap = await getDoc(assetRef);
    if (snap.exists()) {
      const data = snap.data();
      const raw = pickFirstString(data?.glbUrl, data?.downloadUrl);
      if (raw) return raw;
    }
  } catch (e: any) {
    console.warn("[resolveGlbRaw] assets read failed:", e?.code || e, e?.message || "");
  }

  return "";
}

function makeNewItemFromPayload(payload: any, glbRaw: string, defaultY: number = 0): LayoutSceneObject {
  const now = Date.now();
  const id = `item-${now}-${Math.random().toString(16).slice(2)}`;

  const modelId = safeString(payload?.modelId || payload?.id || "");
  const title = safeString(payload?.title || payload?.name || payload?.label || modelId || "MODEL");
  const brand = safeString(payload?.brand || "");
  const ownerHandle = safeString(payload?.ownerHandle || "");
  const type = safeString(payload?.type || "");
  const subType = safeString(payload?.subType || "");
  const group = safeString(payload?.group || "");
  const thumbUrl = payload?.thumbUrl || payload?.thumbnailUrl || payload?.thumbnailUrl || null;

  return {
    id,
    kind: "model",
    modelId,

    // ✅ これを標準に
    title,
    name: title,
    label: title,
    
    brand,
    ownerHandle,
    type,
    subType,
    group,
    thumbUrl,

    glbUrl: safeString(glbRaw, ""),

    dimensionsMm: payload?.dimensionsMm || payload?.dimensions || null,
    dimensionSource: payload?.dimensionSource || null,

    transform: {
      position: safeVec3(payload?.transform?.position, [0, defaultY, 0]),
      rotation: safeVec3(payload?.transform?.rotation, [0, 0, 0]),
      scale: safeVec3(payload?.transform?.scale, [1, 1, 1]),
    },

    pinnedVersion: payload?.latestVersion || 1,
    createdAtMs: now,
  };
}


function safeFileName(name: string | null | undefined, fallback: string = "base.glb") {
  const n = String(name || "").trim();
  if (!n) return fallback;
  return n.replace(/[\\/:*?"<>|]/g, "_");
}

/** contentType が空でも弾かれないように必ず付与 */
function pickContentTypeForUpload(file: any) {
  const t = String(file?.type || "").trim();
  if (t) return t;
  return "model/gltf-binary";
}

// ---------------------------
// breadcrumb helpers（LayoutShellで生成してHeaderへ渡す）
// ---------------------------
function numToAlpha(n: number) {
  let x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "A";
  let s = "";
  while (x > 0) {
    x -= 1;
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26);
  }
  return s;
}
function displayBaseNameByIndex(i0: number) {
  return `Base-${numToAlpha(i0 + 1)}`;
}
function displayPlanNameByIndex(i0: number) {
  return `Plan-${numToAlpha(i0 + 1)}`;
}
function displayOptionNameByIndex(i0: number) {
  return `A-${i0 + 1}`;
}

export interface LayoutShellProps {
  projectId: string;
  workspaceId: string;
  workspaceName?: string;
  initialBaseId?: string | null;
  initialPlanId?: string | null;
  initialOptionId?: string | null;
  meta?: any;
  loadingMeta?: boolean;
}

export default function LayoutShell({
  projectId,
  workspaceId,
  workspaceName,
  initialBaseId,
  initialPlanId,
  initialOptionId,
  meta,
  loadingMeta,
}: LayoutShellProps) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const logSaveDataEvent = useAiProfileStore(s => s.logSaveDataEvent);

  const setGlobalLoading = useAppStore(s => s.setGlobalLoading);
  const setPanelSelection = useAppStore(s => s.setPanelSelection);
  const activeProjectName = useAppStore(s => s.projects.find(p => p.id === projectId)?.name ?? undefined);

  const activeGlobalPanel = null;
  const globalPanelWidth = 0;
  
  const editorMode = useEditorModeStore((s) => s.editorMode);
  
  const rawRightSections = useUiRightSidebarStore((s) => s.visibleSections || []);
  const hasRightSidebar = rawRightSections.length > 0;

  const rawLeftSections = useUiLeftSidebarStore((s) => s.visibleSections || []);
  const isLibraryDetached = useUiLeftSidebarStore((s) => s.isLibraryDetached);

  const actualLeftSections = isLibraryDetached
    ? rawLeftSections.filter(k => k !== "library")
    : rawLeftSections;

  const leftSidebarVisible = actualLeftSections.length > 0;
  const dslLeftSidebarWidth = leftSidebarVisible ? 320 : 0;


  const portalTarget = useUiRightSidebarStore(s => s.portalElement);

  // ============================================================
  // ✅ toolsStore（TopBar/Buttonsのpropsバケツリレー削減）
  // ============================================================
  const materialPicking = useToolsStore((s) => s.materialPicking);
  const toggleMaterialPicker = useToolsStore((s) => s.toggleMaterialPicker);

  const gizmoMode = useToolsStore((s) => s.mode);
  const gizmoSpace = useToolsStore((s) => s.space);
  const snapEnabled = useToolsStore((s) => s.snapEnabled);

  const saving = useToolsStore((s) => s.saving);
  const setSaving = useToolsStore((s) => s.setSaving);

  const dirty = useToolsStore((s) => s.dirty);
  const setDirty = useToolsStore((s) => s.setDirty);

  // 未保存状態をグローバル registry に反映 → タブの「作業中」ドット表示に使う
  const setScopeDirty = useAppStore((s) => s.setScopeDirty);
  useEffect(() => {
    setScopeDirty('3dsl', dirty);
  }, [dirty, setScopeDirty]);
  useEffect(() => () => { useAppStore.getState().setScopeDirty('3dsl', false); }, []);

  const setCommands = useToolsStore((s) => s.setCommands);

  // ✅ LeftSidebar に拾った情報を渡す（そのままでOK）
  const [pickedMaterialInfo, setPickedMaterialInfo] = useState(null);

  // ✅ RightSidebar(=Properties) に渡す “確定した materialSelection” を持つ
  const [materialSelection, setMaterialSelection] = useState<any>(null);
  const [materialSelectionTick, setMaterialSelectionTick] = useState(0);

  // AI Training Data Collection state
  const [activeGenerationSessions, setActiveGenerationSessions] = useState<{sessionIds: string[], zoneIds: string[]}[]>([]);
  const [feedbackSessionIds, setFeedbackSessionIds] = useState<string[]>([]);
  const [feedbackRating, setFeedbackRating] = useState<number|null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Auto Layout 実行時にインポートされたが、まだ手動保存が行われていないアセットを保持
  const [pendingSaveAssets, setPendingSaveAssets] = useState<any[]>([]);

  // 再レイアウト時のための設定保持
  const [lastAutoLayoutConfig, setLastAutoLayoutConfig] = useState<{ zoneIds: string[]; mode: 'rules-only' | 'ai'; furnitureSource: 'project' | 'following' | 'public' } | null>(null);

  const swapDialogOpen = useAutoLayoutStore((s) => s.swapDialogOpen);
  const openSwapDialog = useAutoLayoutStore((s) => s.openSwapDialog);
  const closeSwapDialog = useAutoLayoutStore((s) => s.closeSwapDialog);

  // ============================================================
  // ✅ Material Picker: Scene pick を受けるハンドラ（ここが “購読側”）
  // ============================================================
  const handlePickMaterial = useCallback(
    (info: any) => {
      setPickedMaterialInfo(info);

      const payload = {
        id: info?.id || info?.materialUuid || info?.meshUuid || info?.objectId || `mat-${Date.now()}`,

        material: info?.material || null,
        materialUuid: info?.materialUuid || info?.material?.uuid || null,
        materialIndex: typeof info?.materialIndex === "number" ? info.materialIndex : null,

        meshUuid: info?.meshUuid || info?.objectUuid || null,
        objectId: info?.objectId || null,
        ownerItemId: info?.ownerItemId || info?.itemId || null,

        materialName: info?.materialName || info?.material?.name || null,
        meshName: info?.meshName || info?.name || null,
        slot: info?.slot || null,
      };

      setMaterialSelection(payload);
      setMaterialSelectionTick((t) => t + 1);

      // ✅ Libraryを開く（LeftSidebarへ移動）
      useAppStore.getState().setDslLeftPanel("library");

      // Log MATERIAL_CHANGED
      logSaveDataEvent({
        userId: uid || 'anonymous',
        actionType: 'MATERIAL_CHANGED',
        context: {
          projectId,
          workspaceId,
          targetType: 'layout_workspace',
          source: 'user',
          payload: { materialName: payload.materialName || payload.id }
        }
      });
    },
    []
  );

  // ✅ ScenePick を store から購読
  useEffect(() => {
    useMaterialPickerStore.getState().setSceneOnPick(handlePickMaterial);
    return () => useMaterialPickerStore.getState().setSceneOnPick(null);
  }, [handlePickMaterial]);

  // useWorkspaceTabTitleSync(workspaceId, workspaceName || meta?.boardName);

  // =========================
  // ✅ ProjectTabs: switching UI
  // =========================
  const [projectSwitching, setProjectSwitching] = useState(false);
  const onProjectSwitchStart = useCallback(() => setProjectSwitching(true), []);
  const onProjectSwitchEnd = useCallback(() => setProjectSwitching(false), []);

  useEffect(() => {
    if (!projectSwitching) return;
    const t = setTimeout(() => setProjectSwitching(false), 2500);
    return () => clearTimeout(t);
  }, [projectSwitching]);

  // =========================
  // ✅ Layout selection
  // =========================
  const setLeftPanels = useUiLeftSidebarStore((s) => s.setLeftPanels);

  // === Base / Plan / Option structure (resurrected hierarchy) ===
  const {
    bases,
    plansOfSelectedBase,
    options,
    selectedBaseId,
    selectedPlanId,
    selectedOptionId,
    setSelectedBaseId,
    setSelectedPlanId,
    setSelectedOptionId,
    onSelectBase,
    onSelectPlan,
    isWorkspaceLoading,
    optionsLoading,
  } = useWorkspaceStructure({
    projectId,
    workspaceId,
    initialBaseId,
    initialPlanId,
    initialOptionId,
  });

  // Active furniture doc id: Option > Plan > Base (legacy single-doc falls back to Base).
  const effectiveLayoutId = selectedOptionId || selectedPlanId || selectedBaseId || null;
  // Base doc carries the shared architecture (glbUrl) + spaceProgram (zones/rooms/circulation).
  const baseDocId = selectedBaseId || null;

  const prevLayoutId = useRef(effectiveLayoutId);
  const isBaseReady = !!effectiveLayoutId;

  // 未保存ファイル一覧（workingFiles）への登録（effectiveLayoutId が必要なのでここで）
  useEffect(() => {
    const wfId = effectiveLayoutId || '__dsl_active__';
    const key = `3dsl:${wfId}`;
    useAppStore.getState().setWorkingFile(key, dirty && projectId ? {
      scope: '3dsl', projectId, workFileId: wfId,
      name: workspaceName || (meta as any)?.boardName || 'レイアウト', isNew: false,
    } : null);
    return () => { useAppStore.getState().setWorkingFile(`3dsl:${wfId}`, null); };
  }, [dirty, effectiveLayoutId, projectId, workspaceName, meta]);

  // Switch to project and library automatically whenever a layout option becomes active.
  useEffect(() => {
    const activeId = effectiveLayoutId;
    if (activeId && activeId !== prevLayoutId.current) {
      setLeftPanels({ project: true, library: true, dashboard: false });
    }
    prevLayoutId.current = activeId;
  }, [effectiveLayoutId, setLeftPanels]);

  // =========================
  // ✅ LayoutDoc（選択中）※フラットなLayoutDocを取得
  // =========================
  const { data: optionDoc, loading: optionDocLoading, ref: optionRef, ensureExists, saveLayout } = useOptionDoc({
    projectId,
    workspaceId,
    baseId: null, // obsolete
    planId: effectiveLayoutId,
  });

  // Base doc: shared architecture (glbUrl) + spaceProgram (zones/rooms/circulation).
  // When only a Base is selected (legacy single-doc), baseDocId === effectiveLayoutId,
  // so baseDoc/optionDoc resolve to the same document and all reads/writes coalesce.
  const { data: baseDoc, loading: baseDocLoading, ref: baseRef } = useOptionDoc({
    projectId,
    workspaceId,
    baseId: null,
    planId: baseDocId,
  });

  // =========================
  // ✅ baseGlbUrl 解決
  // =========================
  const baseGlbUrlRaw =
    baseDoc?.asset?.glbUrl ||
    baseDoc?.glbUrl ||
    baseDoc?.buildingVariantKey ||
    "";

  const [baseGlbVersion, setBaseGlbVersion] = useState(0);
  const bumpBaseVersion = useCallback(() => setBaseGlbVersion((v) => v + 1), []);
  const baseGlbUrlResolved = useResolvedUrl(baseGlbUrlRaw, baseGlbVersion);

  // =========================
  // ✅ Lazy migration: legacy flat Layout → Base + default Plan 1 / Option 1
  // When a Base carrying legacy furniture has no Plans, move that furniture into a
  // freshly created Plan 1 / Option 1 (architecture + zones stay on the Base). Runs
  // once per base; conservative & idempotent (see migrateLegacyBaseToPlanOption).
  // =========================
  const migratedBasesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!projectId || !workspaceId || !uid) return;
    if (!selectedBaseId) return;
    // Only when viewing the Base directly (no Plan/Option selected yet).
    if (effectiveLayoutId !== selectedBaseId) return;
    if (optionDocLoading || optionsLoading || isWorkspaceLoading) return;
    if (Array.isArray(plansOfSelectedBase) && plansOfSelectedBase.length > 0) return;
    if (migratedBasesRef.current.has(selectedBaseId)) return;

    const items: any[] = optionDoc?.layout?.items ?? [];
    const hasFurniture = items.some((it) => it && it.type !== "architecture");
    if (!hasFurniture) return;

    migratedBasesRef.current.add(selectedBaseId);
    (async () => {
      try {
        const res = await migrateLegacyBaseToPlanOption({ projectId, workspaceId, baseId: selectedBaseId, userId: uid });
        if (res?.planId) {
          setSelectedPlanId(res.planId);
          setSelectedOptionId(res.optionId);
          console.log("[LayoutShell] ✅ migrated legacy base → plan/option:", res);
        }
      } catch (err) {
        console.warn("[LayoutShell] legacy base migration failed (non-fatal):", err);
        migratedBasesRef.current.delete(selectedBaseId);
      }
    })();
  }, [
    projectId,
    workspaceId,
    uid,
    selectedBaseId,
    effectiveLayoutId,
    optionDoc?.layout?.items,
    optionDocLoading,
    optionsLoading,
    isWorkspaceLoading,
    plansOfSelectedBase,
    setSelectedPlanId,
    setSelectedOptionId,
  ]);

  // 3DSC context — keep useEditorModeStore in sync so VerticalEditToolbar can pass room context
  const setDslBaseGlbUrl  = useEditorModeStore((s) => s.setDslBaseGlbUrl);
  const setDslPlanContext  = useEditorModeStore((s) => s.setDslPlanContext);
  useEffect(() => {
    setDslBaseGlbUrl(baseGlbUrlResolved || null);
  }, [baseGlbUrlResolved, setDslBaseGlbUrl]);
  useEffect(() => {
    if (projectId && workspaceId && effectiveLayoutId) {
      setDslPlanContext({ projectId, workspaceId, planId: effectiveLayoutId });
    } else {
      setDslPlanContext(null);
    }
  }, [projectId, workspaceId, effectiveLayoutId, setDslPlanContext]);

  // 作業中コンテキストをワークスペース単位で永続化（画面遷移をまたいで復元するため）。
  // panelSelections とは別管理にして、ダッシュボードの選択クリアの影響を受けないようにする。
  useEffect(() => {
    if (!projectId || !workspaceId) return;
    const baseName = (bases || []).find((b: any) => b?.id === selectedBaseId)?.name ?? null;
    const planName = (plansOfSelectedBase || []).find((p: any) => p?.id === selectedPlanId)?.name ?? null;
    const optionName = (options || []).find((o: any) => o?.id === selectedOptionId)?.name ?? null;
    useDslWorkspaceContextStore.getState().setContext(projectId, workspaceId, {
      baseId: selectedBaseId ?? null,
      planId: selectedPlanId ?? null,
      optionId: selectedOptionId ?? null,
      baseName,
      planName,
      optionName,
    });
  }, [projectId, workspaceId, selectedBaseId, selectedPlanId, selectedOptionId, bases, plansOfSelectedBase, options]);

  // =========================
  // ✅ BottomDock mode
  // =========================
  const [bottomMode, setBottomMode] = useState("media");
  const [bottomOpen, setBottomOpen] = useState(false);
  const toggleBottomOpen = useCallback(() => setBottomOpen((v) => !v), []);

  useEffect(() => {
    if (!isBaseReady) return;
    if (!selectedPlanId) return;
    if (optionsLoading) return;
    if (!selectedOptionId) return;
    if (optionDocLoading) return;
    if (optionDoc) return;

    const meta0 = options.find((o) => o.id === selectedOptionId) || {};
    ensureExists({
      name: meta0.name || selectedOptionId,
      memo: meta0.memo || "",
      order: typeof meta0.order === "number" ? meta0.order : 9999,
    });
  }, [
    isBaseReady,
    selectedPlanId,
    optionsLoading,
    selectedOptionId,
    optionDocLoading,
    optionDoc,
    options,
    ensureExists,
  ]);

  useEffect(() => {
    if (!projectSwitching) return;
    if (loadingMeta) return;
    if (baseDocLoading) return;
    if (optionDocLoading) return;
    onProjectSwitchEnd();
  }, [projectSwitching, loadingMeta, baseDocLoading, optionDocLoading, onProjectSwitchEnd]);

  // =========================
  // ✅ Optionのlayoutをローカルで編集するDraft（hookへ移動）
  // =========================
  const {
    layoutDraft,
    applyLayoutDraft,
    handleUndo: coreHandleUndo,
    handleRedo,
    beginBatch,
    endBatch,
    cancelBatch,
  } = useLayoutHistory({
    optionDoc,
    optionDocLoading,
    setDirty,
    historyLimit: 100,
  });

  const handleUndo = useCallback(() => {
    coreHandleUndo();
    logSaveDataEvent({
      userId: uid || 'anonymous',
      actionType: 'UNDO_PERFORMED',
      context: {
        projectId,
        workspaceId,
        targetType: 'layout_workspace',
        source: 'user'
      }
    });
  }, [coreHandleUndo, logSaveDataEvent, uid, projectId, workspaceId]);

  // ✅ Ctrl/Cmd + Z/Y（hookへ移動）
  useUndoRedoShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
  });

  // =========================
  // =========================
  const layoutDraftRef = useRef(layoutDraft);
  useEffect(() => {
    layoutDraftRef.current = layoutDraft;
  }, [layoutDraft]);

  // 自動保存（ローカル下書きのみ）— 編集停止後に layout_draft.json へ書き出す
  useAutosaveDraft({
    key: (projectId && workspaceId && selectedPlanId && selectedOptionId)
      ? `3dsl:${selectedOptionId}` : null,
    dirty,
    signal: layoutDraft,
    save: async () => {
      if (!projectId || !workspaceId || !selectedPlanId || !selectedOptionId || !layoutDraftRef.current) return;
      await layoutPersistenceService.saveLocalDraft(
        projectId, workspaceId, selectedPlanId, selectedOptionId, layoutDraftRef.current,
      );
    },
  });

  // =========================
  // ✅ Local Draft Auto-Load (Offline / Crash Recovery)
  // =========================
  const loadedDraftOptions = useRef(new Set()); // Track which options we have already loaded local drafts for

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (optionDocLoading) return;
      if (!projectId || !workspaceId || !selectedPlanId || !selectedOptionId) return;

      // Only attempt to load the local draft once per option session
      if (loadedDraftOptions.current.has(selectedOptionId)) return;

      try {
        const local = await layoutPersistenceService.loadLocalDraft(
          projectId,
          workspaceId,
          selectedPlanId,
          selectedOptionId
        );
        
        if (local && mounted) {
          const remoteTime = optionDoc?.updatedAt?.toMillis ? optionDoc.updatedAt.toMillis() : 0;
          // Load local if it's strictly newer than remote or remote is missing
          if (local.mtime > remoteTime || (!optionDoc?.layout && local.content)) {
            console.log("[3DSL] Loading local layout draft as it is newer or remote is empty.", local.mtime, remoteTime);
            applyLayoutDraft(local.content, { markDirty: true, pushToHistory: false }); // Mark dirty so it can be saved
          }
          // Mark as loaded so we don't infinitely reload it if optionDoc updates frequently (e.g. zone edits)
          loadedDraftOptions.current.add(selectedOptionId);
        } else if (mounted) {
          // Even if there's no local draft, mark as checked so we don't spam IndexedDb
          loadedDraftOptions.current.add(selectedOptionId);
        }
      } catch (err) {
        console.warn("[3DSL] Could not load local layout draft", err);
        if (mounted) loadedDraftOptions.current.add(selectedOptionId);
      }
    })();
    return () => { mounted = false; };
  }, [
    optionDocLoading, 
    projectId, 
    workspaceId, 
    selectedPlanId, 
    selectedOptionId, 
    optionDoc?.updatedAt,
    optionDoc?.layout,
    applyLayoutDraft
  ]);

  // =========================
  // ✅ 選択中 Item
  // =========================
  const clearSelection = useUiSelectionStore((s) => s.clearSelection);
  const setSelectedItemIdRaw = useUiSelectionStore((s) => s.setSelectedItemId);

  const setSelectedItemId = useCallback(
    (id) => {
      setSelectedItemIdRaw?.(id);
    },
    [setSelectedItemIdRaw]
  );

  useEffect(() => {
    clearSelection();
  }, [selectedBaseId, selectedPlanId, selectedOptionId, clearSelection]);

  // =========================
  // ✅ Phase 1: Layout Task Actuals Aggregation & Active Zone Badge
  // =========================
  const activeZoneId = useLayoutTaskStore((s) => s.activeZoneId);
  const zones = useLayoutTaskStore((s) => s.zones);
  const circulationPatterns = useLayoutTaskStore((s) => s.circulationPatterns);
  const activeCirculationPatternId = useLayoutTaskStore((s) => s.activeCirculationPatternId);

  const setZones = useLayoutTaskStore((s) => s.setZones);
  const setCirculations = useLayoutTaskStore((s) => s.setCirculations);

  const setRooms = useLayoutTaskStore((s) => s.setRooms);

  // Sync zones from BaseDoc to Zustand (zones live on the shared Base)
  useEffect(() => {
    if (!baseDocLoading && baseDoc?.spaceProgram?.zones) {
      setZones(baseDoc.spaceProgram.zones);
    } else if (!baseDocLoading && !baseDoc?.spaceProgram?.zones) {
      setZones([]);
    }
  }, [baseDoc?.spaceProgram?.zones, baseDocLoading, setZones]);

  // Sync rooms from BaseDoc to Zustand
  useEffect(() => {
    if (!baseDocLoading) {
      setRooms(baseDoc?.spaceProgram?.rooms || []);
    }
  }, [baseDoc?.spaceProgram?.rooms, baseDocLoading, setRooms]);

  // Sync circulation patterns and handle migration from legacy flat circulations
  const setCirculationPatterns = useLayoutTaskStore((s) => s.setCirculationPatterns);
  const setActiveCirculationPatternId = useLayoutTaskStore((s) => s.setActiveCirculationPatternId);

  useEffect(() => {
    if (!baseDocLoading && baseDoc?.spaceProgram) {
      const sp = baseDoc.spaceProgram;
      let patterns = sp.circulationPatterns;

      // Migration from old flat circulations if no patterns exist
      if (!patterns && sp.circulations && sp.circulations.length > 0) {
        patterns = [{
          id: `pattern-${Date.now()}`,
          name: "Pattern A",
          circulations: sp.circulations,
          createdAtMs: Date.now()
        }];
      } else if (!patterns) {
        patterns = [{
          id: `pattern-${Date.now()}`,
          name: "Pattern A",
          circulations: [],
          createdAtMs: Date.now()
        }];
      }

      setCirculationPatterns(patterns);

      const activeId = sp.activeCirculationPatternId || patterns[0]?.id;
      const validActiveId = patterns.some((p: any) => p.id === activeId) ? activeId : patterns[0]?.id;
      
      setActiveCirculationPatternId(validActiveId);
      
      const activePattern = patterns.find((p: any) => p.id === validActiveId);
      setCirculations(activePattern ? activePattern.circulations : []);
    } else if (!optionDocLoading) {
      // Complete empty state
      const defaultPattern = {
        id: `pattern-${Date.now()}`,
        name: "Pattern A",
        circulations: [],
        createdAtMs: Date.now()
      };
      setCirculationPatterns([defaultPattern]);
      setActiveCirculationPatternId(defaultPattern.id);
      setCirculations([]);
    }
  }, [
    baseDoc?.spaceProgram?.circulations,
    baseDoc?.spaceProgram?.circulationPatterns,
    baseDoc?.spaceProgram?.activeCirculationPatternId,
    baseDocLoading,
    setCirculationPatterns,
    setCirculations,
    setActiveCirculationPatternId
  ]);

  // Phase 1.6 / 1.7: Listen for quick add zone
  useEffect(() => {
    const addHandler = async (e: any) => {
      if (!baseRef) return;
      const newZone = e.detail;
      const currentZones = baseDoc?.spaceProgram?.zones || [];
      const updatedZones = [...currentZones, newZone];
      try {
        useLayoutTaskStore.getState().setZones(updatedZones);

        await updateDoc(baseRef, {
          "spaceProgram.zones": updatedZones
        });
        console.log("[LayoutShell] Added new zone via quick add.");
      } catch (err) {
        console.error("Failed to add new zone", err);
      }
    };
    
    const updateHandler = async (e: any) => {
      if (!baseRef) return;
      const { id, targetSeats, name, category, color, rect, remarks, circulations, __merge, __noPersist } = e.detail;
      
      const currentZones = baseDoc?.spaceProgram?.zones || [];
      const updatedZones = currentZones.map((z: any) => {
        if (z.id === id) {
          return {
            ...z,
            ...(targetSeats !== undefined ? { targetSeats } : {}),
            ...(name !== undefined ? { name } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(color !== undefined ? { color } : {}),
            ...(rect !== undefined ? { rect: __merge ? { ...z.rect, ...rect } : rect } : {}),
            ...(remarks !== undefined ? { remarks } : {}),
            ...(circulations !== undefined ? { circulations } : {})
          };
        }
        return z;
      });

      try {
        useLayoutTaskStore.getState().setZones(updatedZones);

        if (!__noPersist) {
          await updateDoc(baseRef, {
            "spaceProgram.zones": updatedZones
          });
          console.log(`[LayoutShell] Updated zone ${id}`);
        }
      } catch (err) {
        console.error("Failed to update zone", err);
      }
    };

    const deleteHandler = async (e: any) => {
      if (!baseRef) return;
      const { id } = e.detail;
      if (!id) return;
      const currentZones = baseDoc?.spaceProgram?.zones || [];
      const updatedZones = currentZones.filter((z: any) => z.id !== id);
      
      try {
        useLayoutTaskStore.getState().setZones(updatedZones);

        await updateDoc(baseRef, {
          "spaceProgram.zones": updatedZones
        });
        console.log(`[LayoutShell] Deleted zone ${id}`);
        if (useLayoutTaskStore.getState().activeZoneId === id) {
          useLayoutTaskStore.getState().setActiveZoneId(null);
        }
      } catch (err) {
        console.error("Failed to delete zone", err);
      }
    };

    const updateArrayHandler = async (e: Event) => {
      const customEvent = e as CustomEvent<{ zones: any[] }>;
      if (!baseRef) return;
      try {
        useLayoutTaskStore.getState().setZones(customEvent.detail.zones);
        await updateDoc(baseRef, {
          "spaceProgram.zones": customEvent.detail.zones
        });
      } catch (err) {
        console.error("Failed to update zones array", err);
      }
    };

    const updateCirculationsHandler = async (e: Event) => {
      const customEvent = e as CustomEvent<{ circulations: any[] }>;
      if (!baseRef) return;
      
      const currentActiveId = useLayoutTaskStore.getState().activeCirculationPatternId;
      const currentPatterns = useLayoutTaskStore.getState().circulationPatterns;
      
      if (!currentActiveId) return;

      const newCirculations = customEvent.detail.circulations;
      const updatedPatterns = currentPatterns.map(p => 
        p.id === currentActiveId ? { ...p, circulations: newCirculations, updatedAtMs: Date.now() } : p
      );

      try {
        useLayoutTaskStore.getState().setCirculations(newCirculations);
        useLayoutTaskStore.getState().setCirculationPatterns(updatedPatterns);
        
        await updateDoc(baseRef, {
          "spaceProgram.circulationPatterns": updatedPatterns,
          "spaceProgram.activeCirculationPatternId": currentActiveId
        });
        console.log("[LayoutShell] Updated circulation patterns.");
      } catch (err) {
        console.error("Failed to update circulation patterns", err);
      }
    };

    const updateActivePatternHandler = async (e: Event) => {
      const customEvent = e as CustomEvent<{ patternId: string, newPatterns?: any[] }>;
      if (!baseRef) return;
      
      const currentPatterns = useLayoutTaskStore.getState().circulationPatterns;
      const updatedPatterns = customEvent.detail.newPatterns || currentPatterns;
      const activeId = customEvent.detail.patternId;

      try {
        const activePattern = updatedPatterns.find((p: any) => p.id === activeId);
        if (activePattern) {
          useLayoutTaskStore.getState().setCirculations(activePattern.circulations);
        }
        useLayoutTaskStore.getState().setCirculationPatterns(updatedPatterns);
        useLayoutTaskStore.getState().setActiveCirculationPatternId(activeId);

        await updateDoc(baseRef, {
          "spaceProgram.circulationPatterns": updatedPatterns,
          "spaceProgram.activeCirculationPatternId": activeId
        });
        console.log(`[LayoutShell] Switched active pattern to ${activeId}`);
      } catch (err) {
        console.error("Failed to switch pattern", err);
      }
    };

    const saveZoneVersionHandler = async (e: any) => {
      if (!baseRef) return;
      const { zoneId } = e.detail;
      if (!zoneId) return;

      const currentZones = baseDoc?.spaceProgram?.zones || [];
      const zoneIndex = currentZones.findIndex((z: any) => z.id === zoneId);
      if (zoneIndex === -1) return;

      const zone = currentZones[zoneIndex];
      const items = layoutDraftRef.current?.items || optionDoc?.layout?.items || [];
      const zoneItems = items.filter((it: any) => it.zoneId === zoneId);

      const nextVersions = [...(zone.versions || [])];
      const newVersionId = `v_${Date.now()}`;
      const versionNumber = nextVersions.length + 1;
      
      nextVersions.push({
        id: newVersionId,
        name: `v${versionNumber}`,
        createdAtMs: Date.now(),
        items: JSON.parse(JSON.stringify(zoneItems)),
      });

      const updatedZones = [...currentZones];
      updatedZones[zoneIndex] = { ...zone, versions: nextVersions, activeVersionId: newVersionId };

      try {
        useLayoutTaskStore.getState().setZones(updatedZones);
        await updateDoc(baseRef, { "spaceProgram.zones": updatedZones });
        console.log(`[LayoutShell] Saved zone version ${newVersionId} for zone ${zoneId}`);
      } catch (err) {
        console.error("Failed to save zone version", err);
      }
    };

    const loadZoneVersionHandler = async (e: any) => {
      if (!baseRef) return;
      const { zoneId, versionId } = e.detail;
      if (!zoneId || !versionId) return;

      const currentZones = baseDoc?.spaceProgram?.zones || [];
      const zone = currentZones.find((z: any) => z.id === zoneId);
      if (!zone) return;

      const versionToLoad = (zone.versions || []).find((v: any) => v.id === versionId);
      if (!versionToLoad) return;

      applyLayoutDraft((prev) => {
        const arr = prev?.items || [];
        // Remove existing items in this zone
        const filtered = arr.filter((it: any) => it.zoneId !== zoneId && it.parentId !== zoneId); // Avoid deleting items not in this zone

        // Generate new IDs for the loaded items to prevent collisions
        const newItems = versionToLoad.items.map((it: any) => ({
          ...it,
          id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        }));

        return { ...prev, items: [...filtered, ...newItems] };
      }, { markDirty: true });

      const updatedZones = [...currentZones];
      const zoneIndex = currentZones.findIndex((z: any) => z.id === zoneId);
      if (zoneIndex !== -1) {
        updatedZones[zoneIndex] = { ...zone, activeVersionId: versionId };
        try {
          useLayoutTaskStore.getState().setZones(updatedZones);
          await updateDoc(baseRef, { "spaceProgram.zones": updatedZones });
        } catch (err) {
          console.error("Failed to set active version id", err);
        }
      }
    };

    const overwriteZoneVersionHandler = async (e: any) => {
      if (!baseRef) return;
      const { zoneId, versionId } = e.detail;
      if (!zoneId || !versionId) return;

      const currentZones = baseDoc?.spaceProgram?.zones || [];
      const zoneIndex = currentZones.findIndex((z: any) => z.id === zoneId);
      if (zoneIndex === -1) return;

      const zone = currentZones[zoneIndex];
      const versionIndex = (zone.versions || []).findIndex((v: any) => v.id === versionId);
      if (versionIndex === -1) return;

      const items = layoutDraftRef.current?.items || optionDoc?.layout?.items || [];
      const zoneItems = items.filter((it: any) => it.zoneId === zoneId);

      const nextVersions = [...zone.versions];
      nextVersions[versionIndex] = {
        ...nextVersions[versionIndex],
        items: JSON.parse(JSON.stringify(zoneItems)),
      };

      const updatedZones = [...currentZones];
      updatedZones[zoneIndex] = { ...zone, versions: nextVersions, activeVersionId: versionId };

      try {
        useLayoutTaskStore.getState().setZones(updatedZones);
        await updateDoc(baseRef, { "spaceProgram.zones": updatedZones });
        console.log(`[LayoutShell] Overwrote version ${versionId} for zone ${zoneId}`);
      } catch (err) {
        console.error("Failed to overwrite zone version", err);
      }
    };

    const deleteZoneVersionHandler = async (e: any) => {
      if (!baseRef) return;
      const { zoneId, versionId } = e.detail;
      if (!zoneId || !versionId) return;

      const currentZones = baseDoc?.spaceProgram?.zones || [];
      const zoneIndex = currentZones.findIndex((z: any) => z.id === zoneId);
      if (zoneIndex === -1) return;

      const zone = currentZones[zoneIndex];
      const nextVersions = (zone.versions || []).filter((v: any) => v.id !== versionId);

      const updatedZones = [...currentZones];
      updatedZones[zoneIndex] = { ...zone, versions: nextVersions };

      try {
        useLayoutTaskStore.getState().setZones(updatedZones);
        await updateDoc(baseRef, { "spaceProgram.zones": updatedZones });
        console.log(`[LayoutShell] Deleted version ${versionId} from zone ${zoneId}`);
      } catch (err) {
        console.error("Failed to delete zone version", err);
      }
    };

    window.addEventListener("LayoutShell:AddZone", addHandler);
    window.addEventListener("LayoutShell:UpdateZone", updateHandler);
    window.addEventListener("LayoutShell:UpdateZonesArray", updateArrayHandler);
    window.addEventListener("LayoutShell:UpdateCirculations", updateCirculationsHandler);
    window.addEventListener("LayoutShell:UpdateActivePattern", updateActivePatternHandler);
    window.addEventListener("LayoutShell:DeleteZone", deleteHandler);
    window.addEventListener("LayoutShell:SaveZoneVersion", saveZoneVersionHandler);
    window.addEventListener("LayoutShell:LoadZoneVersion", loadZoneVersionHandler);
    window.addEventListener("LayoutShell:OverwriteZoneVersion", overwriteZoneVersionHandler);
    window.addEventListener("LayoutShell:DeleteZoneVersion", deleteZoneVersionHandler);
    
    return () => {
      window.removeEventListener("LayoutShell:AddZone", addHandler);
      window.removeEventListener("LayoutShell:UpdateZone", updateHandler);
      window.removeEventListener("LayoutShell:UpdateZonesArray", updateArrayHandler);
      window.removeEventListener("LayoutShell:UpdateCirculations", updateCirculationsHandler);
      window.removeEventListener("LayoutShell:DeleteZone", deleteHandler);
      window.removeEventListener("LayoutShell:SaveZoneVersion", saveZoneVersionHandler);
      window.removeEventListener("LayoutShell:LoadZoneVersion", loadZoneVersionHandler);
      window.removeEventListener("LayoutShell:OverwriteZoneVersion", overwriteZoneVersionHandler);
      window.removeEventListener("LayoutShell:DeleteZoneVersion", deleteZoneVersionHandler);
    };
  }, [baseRef, baseDoc, applyLayoutDraft]);

  const activeZone = useMemo(() => zones.find((z) => z.id === activeZoneId), [zones, activeZoneId]);

  // =========================
  // ✅ ZoneCreateDialog 制御
  // =========================
  const pendingZoneRect = useZoningStore((s) => s.pendingZoneRect);
  const setPendingZoneRect = useZoningStore((s) => s.setPendingZoneRect);
  const setZoningMode = useZoningStore((s) => s.setZoningMode);

  const handleZoneCreateConfirm = useCallback(async (data: any) => {
    if (!baseRef) return;
    const currentZones = baseDoc?.spaceProgram?.zones || [];
    const currentRooms = baseDoc?.spaceProgram?.rooms || [];

    // 新 Room を作成する場合
    let resolvedRoomId = data.roomId;
    if (!resolvedRoomId && data.newRoomName) {
      resolvedRoomId = `room-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      const newRoom = {
        id: resolvedRoomId,
        name: data.newRoomName,
        createdAtMs: Date.now(),
      };
      await updateDoc(baseRef, {
        "spaceProgram.rooms": [...currentRooms, newRoom],
      });
      console.log("[LayoutShell] ✅ Room created:", newRoom);
    }

    const newZone = {
      id: `zone-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      roomId: resolvedRoomId ?? null,
      name: data.zoneName,
      targetSeats: data.targetSeats,
      category: data.category,
      color: data.color,
      rect: data.rect,
      createdBy: data.createdBy,
      createdAtMs: data.createdAtMs,
    };

    try {
      await updateDoc(baseRef, {
        "spaceProgram.zones": [...currentZones, newZone],
      });
      console.log("[LayoutShell] ✅ Zone created:", newZone);
      setPendingZoneRect(null);
      setZoningMode(false);
    } catch (err) {
      console.error("[LayoutShell] Failed to save zone:", err);
    }
  }, [baseRef, baseDoc, setPendingZoneRect, setZoningMode]);

  const handleZoneCreateCancel = useCallback(() => {
    setPendingZoneRect(null);
  }, [setPendingZoneRect]);

  // =========================
  // ✅ アイテムをゾーン境界に基づいて自動割り当て
  // items または zones が変わるたびに point-in-rect を評価する
  // =========================
  useEffect(() => {
    const currentItems: any[] = layoutDraft?.items ?? optionDoc?.layout?.items ?? [];
    const spatialZones = zones.filter((z) => z.rect);
    if (spatialZones.length === 0) return;

    let changed = false;
    const nextItems = currentItems.map((it) => {
      if (!it) return it;
      const px: number = it.transform?.position?.[0] ?? 0;
      const pz: number = it.transform?.position?.[2] ?? 0;

      const matched = spatialZones.find((z) => {
        const r = z.rect!;
        return (
          px >= r.x - r.width / 2 &&
          px <= r.x + r.width / 2 &&
          pz >= r.z - r.depth / 2 &&
          pz <= r.z + r.depth / 2
        );
      });

      const newZoneId = matched?.id ?? null;
      if (it.zoneId !== newZoneId) {
        changed = true;
        return { ...it, zoneId: newZoneId };
      }
      return it;
    });

    if (changed) {
      applyLayoutDraft(
        (prev: any) => ({ ...normalizeLayout(prev ?? {}), items: nextItems }),
        { markDirty: true }
      );
    }
  // 重い処理のため zones/items の変化のみで実行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, layoutDraft?.items]);

  // =========================
  // ✅ Auto Layout Pipeline（AI Studio MVP）
  // =========================
  const pendingZoneIds = useAutoLayoutStore((s) => s.pendingZoneIds);
  const clearAutoLayoutRequest = useAutoLayoutStore((s) => s.clearRequest);
  const setAutoLayoutGenerating = useAutoLayoutStore((s) => s.setGenerating);
  const progressMessage = useAutoLayoutStore((s) => s.progressMessage);

  useEffect(() => {
    if (!pendingZoneIds || pendingZoneIds.length === 0) return;

    const currentItems = layoutDraft?.items ?? optionDoc?.layout?.items ?? [];

    const run = async () => {
      setAutoLayoutGenerating(true);
      clearAutoLayoutRequest();

      try {
        const mode = useAutoLayoutStore.getState().autoLayoutMode;
        const furnitureSource = useAutoLayoutStore.getState().furnitureSource;
        
        // 再レイアウト用に保持
        setLastAutoLayoutConfig({ zoneIds: pendingZoneIds, mode, furnitureSource });

        const currentZones = useLayoutTaskStore.getState().zones;
        let availableAssets = [];
        let autoImportedMap = new Map();
        if (projectId) {
          availableAssets = await projectAssetsApi.getAssets(projectId);
        }

        const setProgressMessage = useAutoLayoutStore.getState().setProgressMessage;

        let addedAssetIds = new Set(availableAssets.map(a => a.id));

        // 1. Explicitly fetch from Following if selected or public (additive)
        if (uid && (furnitureSource === 'following' || furnitureSource === 'public')) {
          setProgressMessage("フォロー中のアセットを取得中...");
          const followingRef = collection(db, `users/${uid}/following`);
          const followingSnap = await getDocs(query(followingRef, limit(30)));
          const followIds = followingSnap.docs.map(d => d.id);
          
          if (followIds.length > 0) {
            const assetsCol = collection(db, "assets");
            const followingQuery = query(assetsCol, 
              and(
                where('type', '==', '3d-model'), 
                or(where('visibility', '==', 'public'), where('isPublic', '==', true)),
                where('ownerId', 'in', followIds)
              ),
              limit(50)
            );
            const fSnap = await getDocs(followingQuery);
            const fallbackAssets = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            fallbackAssets.forEach(a => {
              if (!addedAssetIds.has(a.id)) {
                availableAssets.push(a);
                addedAssetIds.add(a.id);
                autoImportedMap.set(a.id, a);
              }
            });
          }
        }
        
        // 2. Explicitly fetch from Public if selected (additive)
        if (furnitureSource === 'public') {
          setProgressMessage("公開アセットを取得中...");
          const assetsCol = collection(db, "assets");
          // If public is selected, fetch up to 50 public active models
          const publicQuery = query(assetsCol, 
            and(
              where('type', '==', '3d-model'), 
              or(where('visibility', '==', 'public'), where('isPublic', '==', true))
            ),
            limit(50)
          );
          const pSnap = await getDocs(publicQuery);
          const fallbackAssets = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          fallbackAssets.forEach(a => {
            if (!addedAssetIds.has(a.id)) {
              availableAssets.push(a);
              addedAssetIds.add(a.id);
              autoImportedMap.set(a.id, a);
            }
          });
        }

        // 2. Ensure we have at least 50 available recommendations for AI mode, falling back to Following and Public
        if (uid && mode === 'ai') {
          let additionalCount = 50 - availableAssets.length;
          
          if (additionalCount > 0) {
            setProgressMessage("アセット候補を拡張中...");
            const assetsCol = collection(db, "assets");
            
            // Priority 1: Following Users (might already be fetched, but check again just in case)
            const followingRef = collection(db, `users/${uid}/following`);
            const followingSnap = await getDocs(query(followingRef, limit(30)));
            const followIds = followingSnap.docs.map(d => d.id);
            
            if (followIds.length > 0) {
              const followingQuery = query(assetsCol, 
                and(
                  where('type', '==', '3d-model'), 
                  or(where('visibility', '==', 'public'), where('isPublic', '==', true)),
                  where('ownerId', 'in', followIds)
                ),
                limit(30)
              );
              const fSnap = await getDocs(followingQuery);
              const followingAssets = fSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => !addedAssetIds.has(a.id));
              
              followingAssets.forEach(a => {
                if (additionalCount > 0) {
                  availableAssets.push(a);
                  addedAssetIds.add(a.id);
                  autoImportedMap.set(a.id, a);
                  additionalCount--;
                }
              });
            }
            
            // Priority 2: Fill remaining with any public model
            if (additionalCount > 0) {
              setProgressMessage("パブリックモデルから補填中...");
              const publicQuery = query(assetsCol, 
                and(
                  where('type', '==', '3d-model'), 
                  or(where('visibility', '==', 'public'), where('isPublic', '==', true))
                ),
                limit(50)
              );
              const pSnap = await getDocs(publicQuery);
              const publicAssets = pSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(a => !addedAssetIds.has(a.id));
                
              publicAssets.forEach(a => {
                 if (additionalCount > 0) {
                   availableAssets.push(a);
                   addedAssetIds.add(a.id);
                   autoImportedMap.set(a.id, a);
                   additionalCount--;
                 }
              });
            }
          }
        }

        let allNewItems: any[] = [];
        let generatedSessionIds: string[] = [];
        
        for (const zoneId of pendingZoneIds) {
          const zoneData = extractZoneData(zoneId, currentItems, currentZones);
          const gridHeightMm = useEditorModeStore.getState().gridHeightMm;
          const { placements, sessionId } = await runAutoLayout(zoneData, [], availableAssets, gridHeightMm, { 
            userId: uid ?? null, projectId: projectId ?? null, mode, setProgressMessage 
          });

          if (sessionId) generatedSessionIds.push(sessionId);

          const now = Date.now();
          const newlyImported: any[] = [];
          const newItems = placements.map((p) => {
            // Keep track of imported assets to save later
            if (projectId && autoImportedMap.has(p.entityId)) {
              const globalDoc = autoImportedMap.get(p.entityId);
              newlyImported.push(globalDoc);
              autoImportedMap.delete(p.entityId); // prevent duplicates
            }
            return {
              id: p.id,
              kind: "model" as const,
              modelId: p.entityId,
              assetId: p.entityId,
              title: p.name || p.snapshot?.title || "Item",
              name: p.name || p.snapshot?.title || "Item",
              label: p.name || p.snapshot?.title || "Item",
              brand: p.snapshot?.brand || "",
              ownerHandle: "",
              type: "furniture_set",
              subType: "",
              group: "",
              thumbUrl: p.snapshot?.thumbnailUrl,
              glbUrl: p.glbUrl || p.snapshot?.glbUrl || "",
              transform: {
                position: [p.transform.position.x, p.transform.position.y, p.transform.position.z] as [number, number, number],
                rotation: [0, (p.transform.rotation.y * Math.PI) / 180, 0] as [number, number, number],
                scale: [1, 1, 1] as [number, number, number],
              },
              zoneId: zoneId,
              createdAtMs: now,
            };
          });
          
          if (newlyImported.length > 0) {
            setPendingSaveAssets(prev => [...prev, ...newlyImported]);
          }
          
          allNewItems = allNewItems.concat(newItems);
        }

        applyLayoutDraft(
          (prev: any) => {
            const base = normalizeLayout(prev ?? optionDoc?.layout ?? { items: [] });
            // Remove existing items that belong to the zones being re-generated
            const filteredItems = (base.items || []).filter((item: any) => !pendingZoneIds.includes(item.zoneId));
            return { ...base, items: [...filteredItems, ...allNewItems] };
          },
          { markDirty: true }
        );

        if (generatedSessionIds.length > 0) {
          useAutoLayoutStore.getState().setProgressMessage(null);
          setActiveGenerationSessions(prev => [
            ...prev,
            { sessionIds: generatedSessionIds, zoneIds: pendingZoneIds }
          ]);
          setFeedbackRating(null);
          setFeedbackComment("");
          setFeedbackSessionIds(generatedSessionIds);
        }

        console.log(`[AutoLayout] ✅ ${allNewItems.length} placeholder items added to zones ${pendingZoneIds.join()}`);
      } catch (err) {
        console.error("[AutoLayout] ❌ Failed:", err);
      } finally {
        setAutoLayoutGenerating(false);
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingZoneIds]);

  useEffect(() => {
    const items = layoutDraft?.items || optionDoc?.layout?.items || [];
    const actuals: Record<string, { actualSeats: number }> = {};
    
    // NOTE: Phase 1 Limitation
    // `zoneId` binding is logical-only based on the task context when adding an item.
    // There is no geometric (bounding box) validation yet. So physical bounding overlaps
    // are NOT calculated here. This is scheduled for Phase 2.
    for (const it of items) {
      if (it.zoneId) {
        if (!actuals[it.zoneId]) {
          actuals[it.zoneId] = { actualSeats: 0 };
        }
        
        let sc = it.planningProps?.seatCount;
        // Fallback robust parsing:
        // By handling 0 and NaN gracefully, we leave room for logs/warnings
        // in case items do not have required planningProps defined yet.
        if (typeof sc === 'string') sc = parseInt(sc, 10);
        if (typeof sc !== 'number' || isNaN(sc)) sc = 0; // fallback to 0 count silently.
        
        actuals[it.zoneId].actualSeats += sc;
      }
    }
    useLayoutTaskStore.getState().setZoneActuals(actuals);
  }, [layoutDraft?.items, optionDoc?.layout?.items]);

  // =========================
  // ✅ 二重発火ガード（DnD保険）
  // =========================
  const lastAddSigRef = useRef({ sig: "", at: 0 });
  function makeSig(payload) {
    const modelId = safeString(payload?.modelId || payload?.id || "");
    const thumb = safeString(payload?.thumbUrl || payload?.thumbnailUrl || "");
    return `${modelId}__${thumb}`;
  }

  // =========================
  // ✅ Save（Firestore書き込みはここだけ）
  // =========================
  const handleSave = useCallback(async () => {
    if (!optionRef) {
      console.warn("[handleSave] optionRef is null");
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      if (!optionDoc && !optionDocLoading) {
        const meta0 = options.find((o) => o.id === selectedOptionId) || {};
        await ensureExists({
          name: meta0.name || selectedOptionId,
          memo: meta0.memo || "",
          order: typeof meta0.order === "number" ? meta0.order : 9999,
        });
      }

      const base = layoutDraft ?? optionDoc?.layout ?? { items: [] };
      const nextLayout = normalizeLayout(base) as { items: LayoutSceneObject[] } | any;
      nextLayout.items = (nextLayout.items || []).map((it: any) => {
        const title = it.title || it.name || it.label || "";
        return {
          ...it,
          title: title || it.title,
          name: it.name || title,
          label: it.label || title,
        };
      });

      if (saveLayout) {
        await saveLayout(nextLayout, { uid });
      }

      if (activeGenerationSessions.length > 0) {
        // Record differences as modifications for learning
        for (const sessionGroup of activeGenerationSessions) {
          const modifiedItems = (nextLayout.items || []).filter((item: any) => sessionGroup.zoneIds.includes(item.zoneId));
          for (const sId of sessionGroup.sessionIds) {
            try {
              await updateDoc(doc(db, "layout_generation_logs", sId), {
                wasModified: true,
                modifiedLayoutSnapshot: modifiedItems,
                modifiedAt: serverTimestamp()
              });
            } catch (err) {
              console.warn("Failed to record modified layout diff", err);
            }
          }
        }
        setActiveGenerationSessions([]);
      }

      // 💾 Save locally to the user's document folder as a desktop fallback/cache
      if (projectId && workspaceId && selectedPlanId && selectedOptionId) {
        await layoutPersistenceService.saveLocalDraft(
          projectId,
          workspaceId,
          selectedPlanId,
          selectedOptionId,
          nextLayout
        );
      }

      // Save any pending assets imported during Auto Layout
      if (pendingSaveAssets.length > 0 && projectId && uid) {
        try {
          await Promise.all(
            pendingSaveAssets.map(asset => 
              projectAssetsApi.saveAssetToProject(projectId, asset, uid).catch(console.error)
            )
          );
          setPendingSaveAssets([]);
        } catch (err) {
          console.warn("Failed to save pending assets", err);
        }
      }

      setDirty(false);

      // ✅ トップビューサムネイル撮影 & Firebase Storage アップロード（fire-and-forget）
      // WebGLRenderTarget でオフスクリーンレンダリングするため、
      // 現在のビューポートのカメラ角度・モードに依存しない。
      if (projectId && workspaceId && effectiveLayoutId) {
        (async () => {
          try {
            const dataUrl = await captureLayoutTopView();
            // 空キャプチャは無視
            if (!dataUrl || dataUrl.length < 200) return;

            const blob = await fetch(dataUrl).then(r => r.blob());
            // thumbnails/{uid}/{allPaths=**} → isMe(uid) で write 許可済みのパス
            const path = `thumbnails/${uid}/layouts/${projectId}/${workspaceId}/${effectiveLayoutId}/thumb.jpg`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, blob, { contentType: 'image/jpeg' });
            const thumbUrl = await getDownloadURL(sRef);

            const layoutRef2 = getPlanDocRef(projectId, workspaceId, effectiveLayoutId);
            await updateDoc(layoutRef2, { thumbnailUrl: thumbUrl, updatedAt: serverTimestamp() });

            console.log('[LayoutShell] ✅ top-view thumbnail saved:', thumbUrl);
          } catch (err) {
            console.warn('[LayoutShell] thumbnail capture/upload failed (non-fatal):', err);
          }
        })();
      }
    } catch (e: any) {
      console.warn("[handleSave] failed:", e);
      alert(`保存に失敗: ${e?.code || ""} ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }, [
    optionRef,
    saving,
    setSaving,
    setDirty,
    optionDoc,
    optionDocLoading,
    ensureExists,
    options,
    selectedOptionId,
    layoutDraft,
    saveLayout,
  ]);

  // ✅ TopBar/Buttons から呼べるようにコマンド登録
  useEffect(() => {
    setCommands({
      save: handleSave,
      undo: handleUndo,
      redo: handleRedo,
    });
  }, [setCommands, handleSave, handleUndo, handleRedo]);

  // =========================
  // ✅ Tools actions (Delete / Duplicate)
  // =========================
  const handleDeleteSelected = useCallback(() => {
    const selectedItemIds = useUiSelectionStore.getState().selectedItemIds || [];
    if (!selectedItemIds.length) return;
    
    applyLayoutDraft((prev) => {
      const arr = Array.isArray(prev?.items) ? prev.items : [];
      return { 
        ...prev, 
        items: arr.filter((i) => !selectedItemIds.includes(i.id) && !selectedItemIds.includes(i.parentId)) 
      };
    }, { markDirty: true });
    
    useUiSelectionStore.getState().setSelectedItemIds([]);
  }, [applyLayoutDraft]);

  const handleDuplicateSelected = useCallback(() => {
    const selectedItemIds = useUiSelectionStore.getState().selectedItemIds || [];
    if (!selectedItemIds.length) return;

    applyLayoutDraft((prev) => {
      const arr = Array.isArray(prev?.items) ? prev.items : [];
      const newItems = [];
      const newSelectedIds = [];
      
      const toDuplicate = arr.filter(i => selectedItemIds.includes(i.id));
      const payload = buildCopyPayload(toDuplicate, arr);

      if (!payload || !payload.length) return prev;

      // naive duplication: slightly offset them
      payload.forEach(itemPayload => {
         const newId = `item_${Date.now()}_${Math.floor(Math.random()*10000)}`;
         newSelectedIds.push(newId);
         
         const dx = 1; 
         const t = itemPayload.transform || { position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] };
         
         const finalTransform = {
            ...t,
            position: [t.position[0] + dx, t.position[1], t.position[2]]
         };

         newItems.push({
            ...itemPayload,
            id: newId,
            transform: finalTransform
         });
      });

      return {
        ...prev,
        items: [...arr, ...newItems]
      };
    }, { markDirty: true });

  }, [applyLayoutDraft]);

  // Handle keyboard shortcuts for delete independently
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Only if we aren't typing in an input
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) return;
        handleDeleteSelected();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        handleDuplicateSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteSelected, handleDuplicateSelected]);


  // =========================
  // ✅ D&D で落とされたモデルを「Draftに即追加」
  // =========================
  const handleAddToLayout = useCallback(
    async (payload) => {
      console.log("[handleAddToLayout] 🔵 START", payload);
      console.log("[handleAddToLayout] Deps check:", { selectedBaseId, selectedPlanId, selectedOptionId, projectId, workspaceId });
      
      if (!selectedBaseId) { console.warn("[handleAddToLayout] ❌ Missing selectedBaseId"); return; }
      if (!selectedPlanId) { console.warn("[handleAddToLayout] ❌ Missing selectedPlanId"); return; }
      // Option is optional: when none is selected, furniture is placed/saved on the
      // Plan doc directly (effectiveLayoutId falls back to selectedPlanId).
      if (!effectiveLayoutId) { console.warn("[handleAddToLayout] ❌ Missing effectiveLayoutId"); return; }
      if (!projectId || !workspaceId) { console.warn("[handleAddToLayout] ❌ Missing projectId or workspaceId"); return; }

      const sig = makeSig(payload);
      const now = Date.now();
      const last = lastAddSigRef.current;
      console.log("[handleAddToLayout] Debounce Check:", { sig, lastSig: last.sig, diff: now - last.at });
      
      if (sig && last.sig === sig && now - last.at < 300) {
        console.log("[handleAddToLayout] 🟡 Debounced (too fast)");
        return;
      }
      lastAddSigRef.current = { sig, at: now };

      // Allow UI to fully paint the loading spinner before heavy synchronous/parsing tasks
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      console.log("[handleAddToLayout] ⏳ Resolving GLB RAW...");
      const glbRaw = await resolveGlbRaw({ payload, uid });
      console.log("[handleAddToLayout] 🟢 GLB Resolved:", glbRaw);
      
      if (!glbRaw) {
        console.warn("[handleAddToLayout] ❌ GLB not found for payload:", payload);
        alert("このモデルはGLB参照が見つかりませんでした（models/{modelId} に glbUrl を用意してください）");
        if (payload._onComplete) payload._onComplete();
        return;
      }

      console.log("[handleAddToLayout] ⏳ Preloading GLB to cache...");
      try {
        const dlUrl = await resolveUrlAsync(glbRaw);
        if (dlUrl) {
          await useGLTF.preload(dlUrl);
          console.log("[handleAddToLayout] 🟢 GLB Preload finished:", dlUrl);
        }
      } catch (preloadErr) {
        console.warn("[handleAddToLayout] 🟡 GLB Preload failed or skipped:", preloadErr);
      }

      console.log("[handleAddToLayout] ⏳ Making new item...");
      const currentGridHeight = useEditorModeStore.getState().gridHeightMm || 0;
      const item = makeNewItemFromPayload(payload, glbRaw, currentGridHeight);
      
      // ✅ 3DSS Asset 連携準備 (Phase 12: SSOT Sync)
      // ここでは同期せず、保存時のBatch処理のためのメタデータを item._assetDraft として付与
      try {
        if (payload.source === "public") {
          const existingAsset = await projectAssetsApi.findAssetBySourceModelId(projectId, payload.modelId);
          if (existingAsset) {
            console.log("[handleAddToLayout] 📦 Asset already exists in Project Library:", existingAsset.id);
            if (existingAsset.status === 'archived') {
              console.log("[handleAddToLayout] ♻️ Marked archived asset for revival:", existingAsset.id);
              item._assetDraft = { type: 'revive', assetId: existingAsset.id, payload };
            } else {
              item._assetDraft = { type: 'existing', assetId: existingAsset.id, payload };
            }
            item.assetId = existingAsset.id; // temporary mapping
          } else {
            console.log("[handleAddToLayout] 📦 Marked public model for new 3DSS Asset creation");
            item._assetDraft = { type: 'new', payload, glbRaw }; // wait for save to create
          }
        } else if (payload.source === "project" && payload.id) {
           item.assetId = payload.id;
           item._assetDraft = { type: 'existing', assetId: payload.id, payload };
        }
      } catch (assetErr) {
        console.warn("[handleAddToLayout] 🟡 Failed to check 3DSS Asset, continuing layout placement:", assetErr);
      }

      console.log("[handleAddToLayout] 🟢 Item created:", item);

      console.log("[handleAddToLayout] ⏳ Applying layout draft...");
      applyLayoutDraft(
        (prev: any) => {
          const base: any = normalizeLayout(prev ?? optionDoc?.layout ?? { items: [] });
          console.log("[handleAddToLayout] Document Layout Length was:", base.items?.length);
          return { ...base, items: [...(base.items || []), item] };
        },
        { markDirty: true }
      );
      
      console.log("[handleAddToLayout] 🟢 Setting selected item ID:", item.id);
      setSelectedItemId(item.id);

      // setBottomMode("populate");
      // setBottomOpen(true);
      console.log("[handleAddToLayout] ✅ SUCCESS finished execution.");

      logSaveDataEvent({
        userId: uid || 'anonymous',
        actionType: 'MODEL_ATTACHED',
        context: {
          projectId,
          workspaceId,
          targetType: 'layout_workspace',
          targetId: item.id || undefined,
          source: 'user',
          payload: { modelId: item.modelId || undefined }
        }
      });

      if (payload._onComplete) payload._onComplete();
    },
    [
      projectId,
      workspaceId,
      uid,
      selectedBaseId,
      selectedPlanId,
      selectedOptionId,
      effectiveLayoutId,
      optionDoc?.layout,
      setSelectedItemId,
      applyLayoutDraft,
    ]
  );

  const handleDropAsset = useCallback(async (payload) => {
    await handleAddToLayout(payload);
  }, [handleAddToLayout]);

  // ✅ 関連：Libraryからの「再度クリック」配置に対応するためのカスタムイベント
  useEffect(() => {
    const handleGlobalAdd = (e: CustomEvent) => {
      console.log("[LayoutShell] 🌐 Received add-model-to-layout event:", e.detail);
      handleAddToLayout(e.detail);
    };
    window.addEventListener("add-model-to-layout", handleGlobalAdd as EventListener);
    return () => window.removeEventListener("add-model-to-layout", handleGlobalAdd as EventListener);
  }, [handleAddToLayout]);

  // =========================
  // ✅ Base Setup Modal & WorkFile Modal
  // =========================
  const [selectBaseOpen, setSelectBaseOpen] = useState(false);
  const openSelectBase = useCallback(() => setSelectBaseOpen(true), []);
  const closeSelectBase = useCallback(() => setSelectBaseOpen(false), []);

  const [selectWorkFileOpen, setSelectWorkFileOpen] = useState(false);
  const openSelectWorkFile = useCallback(() => setSelectWorkFileOpen(true), []);
  const closeSelectWorkFile = useCallback(() => setSelectWorkFileOpen(false), []);

  const handleUploadBaseFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return false;
      if (!projectId || !workspaceId) return false;

      if (!uid) {
        alert("ログインが必要です");
        return false;
      }

      const targetLayoutId = baseDocId || effectiveLayoutId || selectedOptionId;
      if (!targetLayoutId) {
        alert("先に Layout を選択してください");
        return false;
      }

      const file = files[0];
      const fileName = safeFileName(file.name, "base.glb");

      const path = `projects/${projectId}/assets/baseModels/${workspaceId}/${targetLayoutId}/${fileName}`;
      const fref = storageRef(storage, path);

      try {
        setGlobalLoading(true, "アップロード準備中...");
        await uploadBytes(fref, file, {
          contentType: pickContentTypeForUpload(file),
          cacheControl: "public,max-age=3600",
        });

        const gsUrl = fref.toString();
        
        setGlobalLoading(true, "データを更新中...");
        const layoutRef = doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", targetLayoutId);
        if (layoutRef) {
          await updateDoc(layoutRef, {
            glbUrl: gsUrl,
            glbPath: path,
            updatedAt: serverTimestamp(),
          });
        }

        bumpBaseVersion();
        return true;
      } catch (e: any) {
        console.warn("[handleUploadBaseFiles] failed:", e);
        alert(`アップロードに失敗: ${e?.code || ""} ${e?.message || e}`);
        return false;
      } finally {
        setGlobalLoading(false);
      }
    },
    [uid, projectId, workspaceId, effectiveLayoutId, selectedOptionId, openSelectBase, bumpBaseVersion, setGlobalLoading]
  );


  const handleSelectBaseModel = useCallback(
    async (model) => {
      if (!projectId || !workspaceId) return;
      if (!model?.id) return;

      const targetLayoutId = baseDocId || effectiveLayoutId || selectedOptionId;
      if (!targetLayoutId) {
        alert("先に Layout を選択してください");
        return;
      }

      let glbRaw = pickGlbRawFromModelDocData(model);
      if (!glbRaw) glbRaw = await resolveGlbRaw({ payload: model, uid });

      if (!glbRaw) {
        alert("このモデルはGLB参照が見つかりませんでした（models/{modelId} に glbUrl 等を用意してください）");
        return;
      }

      const layoutRef = doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", targetLayoutId);
      if (!layoutRef) {
        console.warn("[handleSelectBaseModel] layoutRef is null");
        return;
      }

      const name = safeString(model?.name || model?.title || "Base");
      const thumbUrl = model?.thumbUrl || model?.thumbnailUrl || model?.coverUrl || null;

      try {
        await updateDoc(layoutRef, {
          sourceRef: {
            sourceType: "ref",
            modelId: model.id,
            ownerUid: model?.ownerUid || model?.uid || model?.ownerId || null,
          },
          glbUrl: glbRaw,
          thumbnailUrl: thumbUrl,
          // name, // do not overwrite layout name with base name
          updatedAt: serverTimestamp(),
        });

        setSelectedPlanId(null);
        bumpBaseVersion();
      } catch (e) {
        console.warn("[handleSelectBaseModel] update base failed:", e);
        alert(`躯体の適用に失敗: ${e?.code || ""} ${e?.message || e}`);
      }
    },
    [projectId, workspaceId, effectiveLayoutId, selectedOptionId, bumpBaseVersion, setSelectedPlanId, uid]
  );

  const handleConfirmSelectBase = useCallback(
    async (model) => {
      closeSelectBase();
      await handleSelectBaseModel(model);
    },
    [closeSelectBase, handleSelectBaseModel]
  );

  const handleConfirmSelectWorkFile = useCallback(
    async (workFile: any) => {
      closeSelectWorkFile();
      if (!projectId || !workspaceId) return;
      const targetLayoutId = baseDocId || effectiveLayoutId || selectedOptionId;
      if (!targetLayoutId) {
        alert("先に Layout を選択してください");
        return;
      }

      try {
        setGlobalLoading(true, "3Dモデルを準備中...");
        
        let targetStoragePath = workFile.storagePath;
        let targetLocalPath = workFile.localPath;

        if (!targetStoragePath && !targetLocalPath && workFile.currentVersionId) {
          const vRef = doc(db, `projects/${projectId}/workFiles/${workFile.id}/versions/${workFile.currentVersionId}`);
          const vSnap = await getDoc(vRef);
          if (vSnap.exists() && vSnap.data()?.storagePath) {
             targetStoragePath = vSnap.data().storagePath;
          }
        }

        if (!targetStoragePath && !targetLocalPath) {
          throw new Error("この Work File には実体の3Dデータが存在しません (storagePath/localPathが見つかりません)。バージョンの追加等でデータをアップロードしてください。");
        }

        let glbDownloadUrl = null;
        const ext = (workFile.name || '').toLowerCase().split('.').pop();
        // toolType === 'rhino' handles WorkFiles uploaded without a .3dm extension in the name
        const isRhinoFile = ext === '3dm' || workFile.toolType === 'rhino';
        const isGlbFile   = (ext === 'glb' || ext === 'gltf') && !isRhinoFile;

        if (isGlbFile && targetStoragePath) {
           glbDownloadUrl = await getDownloadURL(storageRef(storage, targetStoragePath));

           const layoutRef = doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", targetLayoutId);
           await updateDoc(layoutRef, {
             sourceRef: {
               sourceType: "workFile",
               workFileId: workFile.id,
             },
             glbUrl: glbDownloadUrl,
             thumbnailUrl: workFile.thumbnailUrl || null,
             // name: workFile.name, // do not overwrite layout name
             updatedAt: serverTimestamp(),
           });

           bumpBaseVersion();
        } else if (isRhinoFile) {
           // NOTE: read the binary via plugin-fs `readFile` (returns a Uint8Array
           // directly). The old `invoke<number[]>('read_local_binary_file')` path
           // boxed every byte into a JS number, ballooning a multi-MB 3dm into
           // hundreds of MB and crashing the renderer (STATUS_BREAKPOINT) on large files.
           let fileData: Uint8Array;
           if (targetLocalPath) {
             setGlobalLoading(true, "ローカルファイルを読み込み中...");
             const normalizedPath = targetLocalPath.replace(/\\/g, '/');
             fileData = await readFile(normalizedPath);
           } else {
             setGlobalLoading(true, "3DM ファイルをダウンロード中...");
             const downloadUrl = await getDownloadURL(storageRef(storage, targetStoragePath));

             // Cache it locally using Tauri to avoid holding big array buffer in memory
             setGlobalLoading(true, "ローカルキャッシュを準備中...");
             const cachedLocalPath = await invoke<string>('ensure_model_cached', {
               modelId: workFile.id,
               model_id: workFile.id,
               ext: '3dm',
               downloadUrl: downloadUrl
             });

             setGlobalLoading(true, "ファイルを読み込み中...");
             const normalizedPath = cachedLocalPath.replace(/\\/g, '/');
             fileData = await readFile(normalizedPath);
           }

           const blob = new Blob([fileData]);
           // Ensure the file passed to the converter always has a .3dm extension
           // so the WASM converter can detect the format correctly.
           const safeWorkFileName = (workFile.name || 'model').toLowerCase().endsWith('.3dm')
             ? workFile.name
             : `${workFile.name || 'model'}.3dm`;
           const file = new File([blob], safeWorkFileName);

           setGlobalLoading(true, "3DM から GLB に変換中... (しばらくお待ちください)");
           const glbFile = await convert3dmToGlb(file);
           if (!glbFile) throw new Error("Conversion failed");

           // Upload the converted GLB directly
           setGlobalLoading(true, "GLB アップロード中...");
           await handleUploadBaseFiles([glbFile]);

           // It updates the base doc automatically inside handleUploadBaseFiles
           const layoutRef = doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", targetLayoutId);
           await updateDoc(layoutRef, {
             sourceRef: {
               sourceType: "workFile",
               workFileId: workFile.id,
             },
             // name: workFile.name, // Rename to the workfile name - do not do this for layout
           });
        }

        // ── Auto-create Plan 1 + Option 1 if this base has no plans yet ──
        // Without a Plan the furniture drop handler (`handleAddToLayout`) will
        // always fail with "Missing selectedPlanId". We auto-create them here so
        // the user can place furniture immediately after selecting a Work File.
        {
          const store = useWorkspaceStructureStore.getState();
          const currentPlans = store.plansOfSelectedBase;
          const baseIdForPlan = selectedBaseId || targetLayoutId;
          if (baseIdForPlan && Array.isArray(currentPlans) && currentPlans.length === 0) {
            console.log("[handleConfirmSelectWorkFile] No plans under base → auto-creating Plan 1 + Option 1");
            try {
              setGlobalLoading(true, "Plan を準備中...");
              const planNode = await store.createPlan(baseIdForPlan) as any;
              if (planNode?.id) {
                await store.createOption({ baseId: baseIdForPlan, planId: planNode.id });
              }
            } catch (planErr) {
              console.warn("[handleConfirmSelectWorkFile] Auto-create plan failed (non-fatal):", planErr);
            }
          }
        }
      } catch (err: any) {
        console.error(err);
        alert(`ファイルの準備に失敗しました: ${err.message || String(err)}`);
      } finally {
        setGlobalLoading(false);
      }
    },
    [closeSelectWorkFile, handleUploadBaseFiles, projectId, workspaceId, effectiveLayoutId, selectedOptionId, selectedBaseId, plansOfSelectedBase, bumpBaseVersion, setGlobalLoading]
  );

  const handleOpenBaseBuilder = useCallback(() => {
    console.log("[handleOpenBaseBuilder] open base builder (TODO)");
  }, []);

  // =========================
  // ✅ CRUD actions（hookに移動）
  // =========================
  const {
    createBase,
    createPlan,
    createOption,
    deleteOption,
    deletePlan,
    deleteBase,
    duplicateOption,
    duplicatePlan,

    creatingBase,
    creatingPlan,
    creatingOption,
    deletingBase,
    deletingPlan,
    deletingOption,
    duplicatingPlan,
    duplicatingOption,
  } = useLayoutCrudActions({
    uid,
    projectId,
    workspaceId,

    bases,
    plansOfSelectedBase,
    options,

    selectedBaseId,
    selectedPlanId,

    setSelectedBaseId,
    setSelectedPlanId,
    setSelectedOptionId,

    bumpBaseVersion,
  });

  // =========================
  // ✅ WorkspaceStructureStore hydrate（Step1）
  // =========================
  const basesSig = useMemo(() => (Array.isArray(bases) ? bases.map((b) => b?.id ?? "").join("|") : ""), [bases]);
  const plansSig = useMemo(
    () => (Array.isArray(plansOfSelectedBase) ? plansOfSelectedBase.map((p) => p?.id ?? "").join("|") : ""),
    [plansOfSelectedBase]
  );
  const optionsSig = useMemo(() => (Array.isArray(options) ? options.map((o) => o?.id ?? "").join("|") : ""), [options]);

  useEffect(() => {
    useWorkspaceStructureStore.getState().bindExternal({
      // selection
      onSelectBase: (id) => {
        onSelectBase(id);
        const item = bases?.find((b) => b.id === id);
        setPanelSelection("layout", { baseId: id, planId: undefined, optionId: undefined, itemType: "Base", ...(item || {}) });
      },
      onSelectPlan: (id) => {
        onSelectPlan(id);
        const item = plansOfSelectedBase?.find((p) => p.id === id);
        setPanelSelection("layout", { baseId: selectedBaseId, planId: id, optionId: undefined, itemType: "Plan", ...(item || {}) });
      },
      onSelectOption: (id) => {
        setSelectedOptionId(id);
        const item = options?.find((o) => o.id === id);
        setPanelSelection("layout", { baseId: selectedBaseId, planId: selectedPlanId, optionId: id, itemType: "Option", ...(item || {}) });
      },

      // crud
      onCreateBase: createBase,
      onCreatePlan: createPlan,
      onCreateOption: createOption,
      onDeleteBase: deleteBase,
      onDeletePlan: deletePlan,
      onDeleteOption: deleteOption,
      onDuplicatePlan: duplicatePlan,
      onDuplicateOption: duplicateOption,
    });
  }, [
    bases,
    plansOfSelectedBase,
    options,
    selectedBaseId,
    selectedPlanId,
    setPanelSelection,
    onSelectBase,
    onSelectPlan,
    setSelectedOptionId,
    createBase,
    createPlan,
    createOption,
    deleteBase,
    deletePlan,
    deleteOption,
    duplicatePlan,
    duplicateOption,
  ]);

  useEffect(() => {
    useWorkspaceStructureStore.getState().hydrate({
      bases: bases ?? [],
      plansOfSelectedBase: plansOfSelectedBase ?? [],
      options: options ?? [],
      optionsLoading: !!optionsLoading,

      selectedBaseId: selectedBaseId ?? null,
      selectedPlanId: selectedPlanId ?? null,
      selectedOptionId: selectedOptionId ?? null,

      creatingBase: !!creatingBase,
      creatingPlan: !!creatingPlan,
      creatingOption: !!creatingOption,
      deletingBase: !!deletingBase,
      deletingPlan: !!deletingPlan,
      deletingOption: !!deletingOption,
      duplicatingPlan: !!duplicatingPlan,
      duplicatingOption: !!duplicatingOption,
    });
  }, [
    basesSig,
    plansSig,
    optionsSig,
    optionsLoading,
    selectedBaseId,
    selectedPlanId,
    selectedOptionId,
    creatingBase,
    creatingPlan,
    creatingOption,
    deletingBase,
    deletingPlan,
    deletingOption,
    duplicatingPlan,
    duplicatingOption,
  ]);

  // =========================
  // ✅ Header breadcrumb（LayoutShellで生成）
  // =========================
  const safeBases = useMemo(() => safeArray(bases), [bases]);
  const safePlans = useMemo(() => safeArray(plansOfSelectedBase), [plansOfSelectedBase]);
  const safeOptions = useMemo(() => safeArray(options), [options]);

  const selectedBaseIndex = useMemo(() => {
    if (!selectedBaseId) return 0;
    const idx = safeBases.findIndex((b) => b?.id === selectedBaseId);
    return idx >= 0 ? idx : 0;
  }, [safeBases, selectedBaseId]);

  const selectedPlanIndex = useMemo(() => {
    if (!selectedPlanId) return 0;
    const idx = safePlans.findIndex((p) => p?.id === selectedPlanId);
    return idx >= 0 ? idx : 0;
  }, [safePlans, selectedPlanId]);

  const selectedOptionIndex = useMemo(() => {
    if (!selectedOptionId) return 0;
    const idx = safeOptions.findIndex((o) => o?.id === selectedOptionId);
    return idx >= 0 ? idx : 0;
  }, [safeOptions, selectedOptionId]);

  const headerBreadcrumb = useMemo(() => {
    const boardLabel = safeString(workspaceName, "") || "Workspace";

    const baseObj = safeBases.find((b) => b?.id === selectedBaseId) || null;
    const planObj = safePlans.find((p) => p?.id === selectedPlanId) || null;
    const optObj = safeOptions.find((o) => o?.id === selectedOptionId) || null;

    const baseFallback = displayBaseNameByIndex(selectedBaseIndex);
    const planFallback = displayPlanNameByIndex(selectedPlanIndex);
    const optFallback = displayOptionNameByIndex(selectedOptionIndex);

    const baseLabel = safeString(baseObj?.name, "") || baseFallback;
    const planLabel = safeString(planObj?.name, "") || planFallback;

    const optLabel =
      safeString(optObj?.name, "") || safeString(optObj?.id, "") || safeString(selectedOptionId, "") || optFallback;

    return `${boardLabel}  /  ${baseLabel}  /  ${planLabel}  /  ${optLabel}`;
  }, [
    workspaceName,
    safeBases,
    safePlans,
    safeOptions,
    selectedBaseId,
    selectedPlanId,
    selectedOptionId,
    selectedBaseIndex,
    selectedPlanIndex,
    selectedOptionIndex,
  ]);

  // =========================
  // ✅ Header用の「ダミー」メニューアクション
  // =========================
  const handleClickHome = useCallback(() => console.log("[Header] Home"), []);
  const handleClickFile = useCallback(() => console.log("[Header] File"), []);
  const handleClickEdit = useCallback(() => console.log("[Header] Edit"), []);
  const handleClickHelp = useCallback(() => console.log("[Header] Help"), []);

  const handleImportLocalModel = useCallback(async () => {
    try {
      const models = await openLocalModelFiles();
      if (!models || models.length === 0) return;
      for (const m of models) {
        await handleAddToLayout(m);
      }
    } catch (e) {
      console.warn("[LayoutShell] Local import failed:", e);
    }
  }, [handleAddToLayout]);

  // =========================
  // ✅ Preview（Viewer を別タブで開く）
  // =========================
  const handleCopyShareLink = useCallback(async () => {
    if (!uid) {
      alert("共有リンク作成にはログインが必要です");
      return;
    }
    if (!selectedBaseId || !selectedPlanId || !selectedOptionId) {
      alert("Base / Plan / Option を選択してください");
      return;
    }
    if (!baseGlbUrlResolved) {
      alert("Base GLB が解決できていません");
      return;
    }
    const layout0 = layoutDraft ?? optionDoc?.layout ?? null;
    if (!layout0) {
      alert("layout がありません");
      return;
    }

    const boardName = meta?.boardName || meta?.name || "";
    const baseName = (bases || []).find((b) => b.id === selectedBaseId)?.name || "";
    const planName = (plansOfSelectedBase || []).find((p) => p.id === selectedPlanId)?.name || "";
    const optionName = (options || []).find((o) => o.id === selectedOptionId)?.name || "";

    const shareId = await createLayoutShare({
      ownerUid: uid,
      source: {
        projectId,
        workspaceId,
        baseId: selectedBaseId,
        planId: selectedPlanId,
        optionId: selectedOptionId,
      },
      snapshot: {
        boardName,
        baseName,
        planName,
        optionName,
        baseGlbUrl: baseGlbUrlResolved,
        layout: layout0,
      },
      viewerConfig: { allowBrowseAll: true, playlist: [] },
      visibility: "public",
      catalogScope: "allBases",
    });

    const url = new URL(window.location.origin);
    url.pathname = `/layout/share/${shareId}`;
    url.searchParams.set("base", selectedBaseId);
    url.searchParams.set("plan", selectedPlanId);
    url.searchParams.set("option", selectedOptionId);

    await navigator.clipboard.writeText(url.toString());
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    alert("共有リンクをコピーして、別タブで開きました");
  }, [
    uid,
    projectId,
    workspaceId,
    selectedBaseId,
    selectedPlanId,
    selectedOptionId,
    baseGlbUrlResolved,
    layoutDraft,
    optionDoc?.layout,
    meta,
    bases,
    plansOfSelectedBase,
    options,
  ]);

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        minHeight: 0,
        background: "#060914",
        overflow: "hidden",
      }}
    >
      <Header
        onClickHome={handleClickHome}
        onClickFile={handleClickFile}
        onClickEdit={handleClickEdit}
        onClickHelp={handleClickHelp}
        onClickPreview={handleCopyShareLink}
        onClickImportLocal={handleImportLocalModel}
        breadcrumb={headerBreadcrumb}
        loadingMeta={loadingMeta}
        workspaceId={workspaceId}
        workspaceName={workspaceName || meta?.boardName}
        projectSwitching={projectSwitching}
        onProjectSwitchStart={onProjectSwitchStart}
        onProjectSwitchEnd={onProjectSwitchEnd}
        baseDocLoading={baseDocLoading}
        optionDocLoading={optionDocLoading}
        optionsLoading={optionsLoading}
        rightActions={null}
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDuplicate={handleDuplicateSelected}
        showTopBar={!!(effectiveLayoutId || selectedOptionId)}
        layoutItems={layoutDraft?.items ?? optionDoc?.layout?.items ?? []}
      />

      {/* Center */}
      <Box
        sx={{
          position: "relative",
          minHeight: 0,
          height: "100%",
          display: "flex",
          flexDirection: "row",
        }}
      >


        {/* Main */}
        <Box
          sx={{
            flex: 1,
            position: "relative",
            minHeight: 0,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Render ViewportPanel always to prevent WebGL context lost from rapid unmounting.
              When not in Option mode, the Dashboards overlay on top of it. */}
          <Box sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}>
            <ViewportPanel
              projectId={projectId}
              workspaceId={workspaceId}
              optionId={effectiveLayoutId || selectedOptionId}
              optionDoc={optionDoc}
              optionDocLoading={optionDocLoading}
              meta={meta}
              onDropAsset={handleAddToLayout}
              onOpenSelectBase={openSelectBase}
              onOpenSelectWorkFile={openSelectWorkFile}
              onUploadBaseFiles={handleUploadBaseFiles}
              onOpenBaseBuilder={handleOpenBaseBuilder}
              baseDoc={baseDoc}
              baseDocLoading={baseDocLoading}
              baseGlbUrlResolved={baseGlbUrlResolved}
              layoutDraft={layoutDraft}
              onChangeLayoutDraft={applyLayoutDraft}
              saving={saving}
              onBeginHistoryBatch={beginBatch}
              onEndHistoryBatch={endBatch}
              onCancelHistoryBatch={cancelBatch}
              onMarkDirty={setDirty}
              gizmoMode={gizmoMode}
              gizmoSpace={gizmoSpace}
              snapEnabled={snapEnabled}
              materialPicking={materialPicking}
            />

          </Box>
          {/* Overlays */}
          {!effectiveLayoutId && !selectedOptionId && (
            projectId ? (
              <LayoutDashboard projectId={projectId} />
            ) : (
              <Box sx={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "auto", display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0c12' }}>
                <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>左側のサイドバーからProjectを選択してください</Typography>
              </Box>
            )
          )}
        </Box>

        {/* Right - now rendered into the robust RightPanelHost portal if ready */}
        {hasRightSidebar && portalTarget ? createPortal(
          <RightSidebar
            items={layoutDraft?.items ?? optionDoc?.layout?.items ?? []}
            onChangeLayoutDraft={(nextOrUpdater) => applyLayoutDraft(nextOrUpdater, { markDirty: true })}
            optionDoc={optionDoc}
            optionDocLoading={optionDocLoading}
            baseDoc={baseDoc}
            baseDocLoading={baseDocLoading}
            meta={meta}
            bases={bases}
            plansOfSelectedBase={plansOfSelectedBase}
            options={options}
            selectedBaseId={selectedBaseId}
            selectedPlanId={selectedPlanId}
            selectedOptionId={effectiveLayoutId || selectedOptionId}
            projectId={projectId}
            workspaceId={workspaceId}
            onSelectBase={onSelectBase}
            onSelectPlan={onSelectPlan}
            onSelectOption={setSelectedOptionId}
            onDeleteBase={deleteBase}
            onDeletePlan={deletePlan}
            onDeleteOption={deleteOption}
            onDuplicatePlan={duplicatePlan}
            onDuplicateOption={duplicateOption}
            materialSelection={materialSelection}
            materialSelectionTick={materialSelectionTick}
          />,
          portalTarget
        ) : null}
      </Box>

      {/* ✅ Shortcuts Overlay */}
      {(effectiveLayoutId || selectedOptionId) && <ViewportShortcutsOverlay />}

      {/* ✅ Bottombar */}
      {(effectiveLayoutId || selectedOptionId) && (
        <Bottombar
          mode={bottomMode}
          onChangeMode={setBottomMode}
          projectId={projectId}
          projectName={activeProjectName}
          workspaceId={workspaceId}
          baseId={selectedBaseId}
          planId={selectedPlanId}
          optionId={effectiveLayoutId || selectedOptionId}
          optionDocLoading={optionDocLoading}
          onAddToLayout={handleAddToLayout}
          onRequestOpenLeftProperties={() => {
            console.log("request open left properties");
          }}
          open={bottomOpen}
          onChangeOpen={setBottomOpen}
          layoutItems={layoutDraft?.items ?? optionDoc?.layout?.items ?? []}
          leftSidebarWidth={0}
          rightSidebarWidth={0}
        />
      )}

      {/* ✅ BottomDock (Always visible bottom strip) */}
      {(effectiveLayoutId || selectedOptionId) && (
        <BottomDock
          mode={bottomMode}
          onChangeMode={setBottomMode}
          panelOpen={bottomOpen}
          onTogglePanelOpen={toggleBottomOpen}
          globalPanelWidth={globalPanelWidth}
        />
      )}

      {/* ZoneCreateDialog */}
      <ZoneCreateDialog
        open={!!pendingZoneRect}
        pendingRect={pendingZoneRect}
        rooms={baseDoc?.spaceProgram?.rooms || []}
        existingZoneCount={zones.length}
        onConfirm={handleZoneCreateConfirm}
        onCancel={handleZoneCreateCancel}
      />

      {/* SelectBaseModal */}
      <SelectBaseModal
        open={selectBaseOpen}
        onClose={closeSelectBase}
        onConfirm={handleConfirmSelectBase}
        categoryValue="建築"
        subTypeField="subType"
        subTypeValue="建物（本体）"
        projectId={projectId}
        workspaceId={workspaceId}
        publicOnly={true}
      />

      <SelectWorkFileAsBaseModal
        open={selectWorkFileOpen}
        onClose={closeSelectWorkFile}
        onConfirm={handleConfirmSelectWorkFile}
        projectId={projectId}
        projectName={workspaceName}
      />
      
      <AutoLayoutConfigDialog projectId={projectId} />

      {/* Auto Layout Progress */}
      <Snackbar
        open={!!progressMessage}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert severity="info" icon={false} sx={{ 
          bgcolor: 'rgba(0, 0, 0, 0.8)', 
          color: '#fff', 
          border: '1px solid rgba(167, 139, 250, 0.5)',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={16} sx={{ color: '#a78bfa' }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{progressMessage}</Typography>
          </Box>
        </Alert>
      </Snackbar>

      {/* AI Evaluation Paper */}
      {feedbackSessionIds.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 60,
            left: 16,
            width: 'calc(100% - 32px)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            p: 2,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            border: '1px solid rgba(167, 139, 250, 0.5)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
          }}
        >
          <Typography variant="body2" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>
            Auto Layout が完了しました
          </Typography>
          
          <Rating
            value={feedbackRating}
            onChange={(event, newValue) => {
              setFeedbackRating(newValue);
            }}
            size="medium"
          />
          
          <TextField
            size="small"
            fullWidth
            placeholder="（任意）さらに詳しいご意見があれば..."
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value.slice(0, 200))}
            sx={{ 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              borderRadius: 1,
              '& .MuiOutlinedInput-root': { 
                color: '#fff',
                fontSize: '0.875rem',
                height: '36px'
              } 
            }}
          />

          <Box display="flex" gap={1} flexShrink={0}>
            <Button 
              size="small"
              variant="outlined" 
              sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(167, 139, 250, 0.5)', color: '#fff' }}
              onClick={async () => {
                handleUndo();
                useAutoLayoutStore.getState().setProgressMessage(null);
                setFeedbackSessionIds([]);
                setActiveGenerationSessions([]);
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                if (lastAutoLayoutConfig) {
                  useAutoLayoutStore.getState().setAutoLayoutMode(lastAutoLayoutConfig.mode);
                  useAutoLayoutStore.getState().setFurnitureSource(lastAutoLayoutConfig.furnitureSource);
                  useAutoLayoutStore.getState().requestAutoLayout(lastAutoLayoutConfig.zoneIds);
                }
              }}
            >
              再レイアウト
            </Button>
            
            <Button 
              size="small"
              variant="outlined" 
              sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(167, 139, 250, 0.5)', color: '#fff' }}
              onClick={openSwapDialog}
            >
              家具を変える
            </Button>
            
            <Button 
              size="small" 
              color="inherit"
              sx={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                handleUndo();
                useAutoLayoutStore.getState().setProgressMessage(null);
                setFeedbackSessionIds([]);
                setActiveGenerationSessions([]);
                setFeedbackRating(null);
                setFeedbackComment("");
              }}
            >
              キャンセル
            </Button>
            
            <Button 
              size="small" 
              variant="contained" 
              color="primary"
              disabled={feedbackSubmitting}
              sx={{ whiteSpace: 'nowrap' }}
              onClick={async () => {
                setFeedbackSubmitting(true);
                try {
                  if (feedbackRating) {
                    await Promise.all(feedbackSessionIds.map(sId => 
                      updateDoc(doc(db, "layout_generation_logs", sId), {
                        rating: feedbackRating,
                        ratingComment: feedbackComment || null,
                        ratedAt: serverTimestamp(),
                      })
                    ));
                  }
                  setFeedbackSessionIds([]);
                  setActiveGenerationSessions([]);
                  setFeedbackRating(null);
                  setFeedbackComment("");
                } catch (e) {
                  console.error("Failed to submit rating", e);
                } finally {
                  setFeedbackSubmitting(false);
                }
              }}
            >
              採用する
            </Button>
          </Box>
        </Paper>
      )}

      {/* 家具変更ダイアログ */}
      <FurnitureSwapDialog
        open={swapDialogOpen}
        onClose={closeSwapDialog}
        placedItems={layoutDraft?.items ?? optionDoc?.layout?.items ?? []}
        projectId={projectId}
        onApplySwap={(newLayoutItems) => {
          applyLayoutDraft(
            (prev: any) => {
              const base = prev ?? optionDoc?.layout ?? { items: [] };
              return { ...base, items: newLayoutItems };
            },
            { markDirty: true }
          );
          closeSwapDialog();
        }}
      />
    </Box>
  );
}