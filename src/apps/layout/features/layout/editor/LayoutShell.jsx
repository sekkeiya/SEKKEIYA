// src/features/layout/components/LayoutShell.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Box } from "@mui/material";

import Header from "./header/Header.jsx";
import ViewportPanel from "../canvas/ViewportPanel.jsx";
import Bottombar from "./dock/Bottombar.jsx";
import BottomDock from "./dock/BottomDock.jsx";
import RightSidebar from "./sidebars/RightSidebar/RightSidebar.jsx";
import LeftDock from "./sidebars/LeftDock/LeftDock.jsx";
import SelectBaseModal from "./modals/SelectBaseModal.jsx";

// ✅ 2D/3D エディターモード
import { useEditorModeStore, EDITOR_MODES } from "@layout/features/layout/store/useEditorModeStore";

import { useWorkspaceTabTitleSync } from "@layout/features/layout/contexts/WorkspaceTabsContext";

import { onSnapshot, serverTimestamp, updateDoc, getDoc, doc, setDoc, collectionGroup, query, where, limit, getDocs } from "firebase/firestore";
import { db, storage } from "@layout/shared/lib/firebase/config";
import { useAuth } from "@layout/features/auth/AuthContext";
import { useOptionDoc } from "@layout/features/layout/hooks/useOptionDoc";

import { ref as storageRef, uploadBytes } from "firebase/storage";

import { getPlanDocRef } from "@layout/shared/api/workspaces/workspaces";
import { useResolvedUrl } from "../hooks/useResolvedUrl.js";

// ✅ hooks
import { useWorkspaceSync } from "@layout/features/layout/hooks/useWorkspaceSync";
import { useOptionRealtime } from "@layout/features/layout/hooks/useOptionRealtime";
import { useLayoutCrudActions } from "@layout/features/layout/hooks/useLayoutCrudActions";
import { createLayoutShare } from "@layout/features/layout/utils/layoutShareUtils";

// ✅ history / shortcuts（新規）
import { useLayoutHistory } from "@layout/features/layout/hooks/useLayoutHistory";
import { useUndoRedoShortcuts } from "@layout/features/layout/hooks/useUndoRedoShortcuts";

import { UI_SIZES } from "@layout/features/layout/constants/layoutUiSizes";
import { useUiRightSidebarStore } from "@layout/features/layout/store/uiRightSidebarStore";
import { useUiSelectionStore } from "@layout/features/layout/store/uiSelectionStore";

// ✅ tools store（TopBar/Buttonsのpropsバケツリレー削減）
import { useToolsStore } from "@layout/features/layout/store/toolsStore/useToolsStore";

// ✅ MaterialPicker store（Scene pick を集約）
import { useMaterialPickerStore } from "@layout/features/layout/store/materialPickerStore";

import { useWorkspaceStructureStore } from "@layout/features/layout/store/useWorkspaceStructureStore";
import { useGlobalPanelStore } from "@sekkeiya/global-panel";

// ---------------------------
// utils
// ---------------------------
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeString(v, fb = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fb;
}
function safeNumber(n, fb = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : fb;
}
function safeVec3(v, fb = [0, 0, 0]) {
  if (!Array.isArray(v) || v.length < 3) return fb;
  return [safeNumber(v[0], fb[0]), safeNumber(v[1], fb[1]), safeNumber(v[2], fb[2])];
}

// ✅ LayoutShell 側では「layout 正規化」だけ残す（Save / DnD で使う）
function normalizeLayout(l) {
  const base = l && typeof l === "object" ? l : {};
  const items = Array.isArray(base.items) ? base.items : [];
  return { ...base, items };
}

function pickFirstString(...candidates) {
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickGlbRawFromPayload(payload) {
  return pickFirstString(
    payload?.glbUrl,
    payload?.modelGlbUrl,
    payload?.viewerGlbUrl,
    payload?.asset?.glbUrl,

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

function pickGlbRawFromModelDocData(data) {
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

async function resolveGlbRaw({ payload, uid }) {
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
    } catch (e) {
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
  } catch (e) {
    console.warn("[resolveGlbRaw] collectionGroup read failed:", e?.code || e, e?.message || "");
  }

  return "";
}

function makeNewItemFromPayload(payload, glbRaw) {
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

    transform: {
      position: safeVec3(payload?.transform?.position, [0, 0.3, 0]),
      rotation: safeVec3(payload?.transform?.rotation, [0, 0, 0]),
      scale: safeVec3(payload?.transform?.scale, [1, 1, 1]),
    },

    createdAtMs: now,
  };
}


/** ファイル名を最低限安全化 */
function safeFileName(name, fallback = "base.glb") {
  const n = String(name || "").trim();
  if (!n) return fallback;
  return n.replace(/[\\/:*?"<>|]/g, "_");
}

/** contentType が空でも弾かれないように必ず付与 */
function pickContentTypeForUpload(file) {
  const t = String(file?.type || "").trim();
  if (t) return t;
  return "model/gltf-binary";
}

// ---------------------------
// breadcrumb helpers（LayoutShellで生成してHeaderへ渡す）
// ---------------------------
function numToAlpha(n) {
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
function displayBaseNameByIndex(i0) {
  return `Base-${numToAlpha(i0 + 1)}`;
}
function displayPlanNameByIndex(i0) {
  return `Plan-${numToAlpha(i0 + 1)}`;
}
function displayOptionNameByIndex(i0) {
  return `A-${i0 + 1}`;
}

export default function LayoutShell({
  projectId,
  workspaceId,
  workspaceName,
  initialBaseId,
  initialPlanId,
  meta,
  loadingMeta,
}) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const activeGlobalPanel = useGlobalPanelStore((s) => s.activePanel);
  const globalPanelWidth = activeGlobalPanel === "chat" ? 400 : activeGlobalPanel === "drive" ? 800 : 0;
  
  const hasRightSidebar = useUiRightSidebarStore((s) => (s.visibleSections?.length ?? 0) > 0);

  // ============================================================
  // ✅ 2D/3D エディターモード
  // ============================================================
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const leftDockOpen = useEditorModeStore((s) => s.leftDockOpen);
  const leftDockWidth = leftDockOpen ? UI_SIZES.LEFT_SIDEBAR_W : 30;

  // 初回マウント時：現在モード（初期=2D）のビュー制約を適用（TOP固定）
  useEffect(() => {
    useEditorModeStore.getState().enforceViewportForCurrentMode();
  }, []);

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

  const setCommands = useToolsStore((s) => s.setCommands);

  // ✅ LeftSidebar に拾った情報を渡す（そのままでOK）
  const [pickedMaterialInfo, setPickedMaterialInfo] = useState(null);

  // ✅ RightSidebar(=Properties) に渡す “確定した materialSelection” を持つ
  const [materialSelection, setMaterialSelection] = useState(null);
  const [materialSelectionTick, setMaterialSelectionTick] = useState(0);

  // ============================================================
  // ✅ Material Picker: Scene pick を受けるハンドラ（ここが “購読側”）
  // ============================================================
  const handlePickMaterial = useCallback(
    (info) => {
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

      // ✅ Libraryを開く（RightSidebar）
      useUiRightSidebarStore.getState().setRightPanel("library", true);
    },
    []
  );

  // ✅ ScenePick を store から購読
  useEffect(() => {
    useMaterialPickerStore.getState().setSceneOnPick(handlePickMaterial);
    return () => useMaterialPickerStore.getState().setSceneOnPick(null);
  }, [handlePickMaterial]);

  useWorkspaceTabTitleSync(workspaceId, workspaceName || meta?.boardName);

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
  // ✅ Base/Plan selection + realtime
  // =========================
  const {
    bases,
    plansOfSelectedBase,
    selectedBaseId,
    selectedPlanId,
    setSelectedBaseId,
    setSelectedPlanId,
    onSelectBase,
    onSelectPlan,
    syncWorkspaceCurrent,
  } = useWorkspaceSync({
    uid,
    projectId,
    workspaceId,
    initialBaseId,
    initialPlanId,
  });

  const isBaseReady = !!selectedBaseId;

  // =========================
  // ✅ BaseDoc 購読
  // =========================
  const baseDoc = useMemo(() => {
    if (!bases || !selectedBaseId) return null;
    return bases.find(b => b.id === selectedBaseId) || null;
  }, [bases, selectedBaseId]);
  
  const baseDocLoading = false; // Synchronized with WorkspaceSync


  // =========================
  // ✅ baseGlbUrl 解決
  // =========================
  const currentBaseMeta = bases?.find(b => b.id === selectedBaseId);

  const baseGlbUrlRaw =
    baseDoc?.asset?.glbUrl ||
    baseDoc?.glbUrl ||
    baseDoc?.viewerGlbUrl ||
    baseDoc?.modelGlbUrl ||
    baseDoc?.asset?.viewerGlbUrl ||
    baseDoc?.files?.glb?.fullPath ||
    baseDoc?.files?.glb?.storagePath ||
    currentBaseMeta?.baseAsset?.glbUrl ||
    currentBaseMeta?.baseAsset?.viewerGlbUrl ||
    currentBaseMeta?.baseAsset?.fullPath ||
    "";

  const [baseGlbVersion, setBaseGlbVersion] = useState(0);
  const bumpBaseVersion = useCallback(() => setBaseGlbVersion((v) => v + 1), []);
  const baseGlbUrlResolved = useResolvedUrl(baseGlbUrlRaw, baseGlbVersion);

  // =========================
  // ✅ BottomDock mode
  // =========================
  const [bottomMode, setBottomMode] = useState("media");
  const [bottomOpen, setBottomOpen] = useState(false);
  const toggleBottomOpen = useCallback(() => setBottomOpen((v) => !v), []);

  // ✅ 2D 配置モードに入ったら下部パネルは閉じる（2Dの下部機能は左ドックへ移動済み）
  useEffect(() => {
    if (editorMode === EDITOR_MODES.LAYOUT_2D) setBottomOpen(false);
  }, [editorMode]);

  // =========================
  // ✅ Options realtime + selection
  // =========================
  // =========================
  // ✅ Options realtime + selection
  // =========================
  const { options, optionsLoading, selectedOptionId, setSelectedOptionId, nextAIdFromOptions } = useOptionRealtime({
    uid,
    projectId,
    workspaceId,
    baseId: selectedBaseId,
    planId: selectedPlanId,
    defaultOptionId: "A-1",
  });

  // =========================
  // ✅ OptionDoc（選択中）
  // =========================
  const { data: optionDoc, loading: optionDocLoading, ref: optionRef, ensureExists, saveLayout } = useOptionDoc({
    projectId,
    workspaceId,
    baseId: selectedBaseId,
    planId: selectedPlanId,
  });

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
    handleUndo,
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

  // ✅ Ctrl/Cmd + Z/Y（hookへ移動）
  useUndoRedoShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
  });

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
      const nextLayout = normalizeLayout(base);
      nextLayout.items = (nextLayout.items || []).map((it) => {
        const title = it.title || it.name || it.label || "";
        return {
          ...it,
          title: title || it.title,
          name: it.name || title,
          label: it.label || title,
        };
      });

      if (saveLayout) {
        await saveLayout(nextLayout);
      }

      setDirty(false);
    } catch (e) {
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
  // ✅ D&D で落とされたモデルを「Draftに即追加」
  // =========================
  const handleAddToLayout = useCallback(
    async (payload) => {
      if (!isBaseReady) return;
      if (!selectedPlanId) return;
      if (!selectedOptionId) return;
      if (!projectId || !workspaceId) return;

      const sig = makeSig(payload);
      const now = Date.now();
      const last = lastAddSigRef.current;
      if (sig && last.sig === sig && now - last.at < 300) return;
      lastAddSigRef.current = { sig, at: now };

      const glbRaw = await resolveGlbRaw({ payload, uid });
      if (!glbRaw) {
        console.warn("[handleAddToLayout] GLB not found for payload:", payload);
        alert("このモデルはGLB参照が見つかりませんでした（models/{modelId} に glbUrl を用意してください）");
        return;
      }

      const item = makeNewItemFromPayload(payload, glbRaw);

      applyLayoutDraft(
        (prev) => {
          const base = normalizeLayout(prev ?? optionDoc?.layout ?? { items: [] });
          return { ...base, items: [...base.items, item] };
        },
        { markDirty: true }
      );
      setSelectedItemId(item.id);

      // ✅ 配置直後は「選択 + Properties」へ（Populate自動起動は廃止）
      useUiRightSidebarStore.getState().setRightPanel("properties", true);
    },
    [
      projectId,
      workspaceId,
      uid,
      isBaseReady,
      selectedPlanId,
      selectedOptionId,
      optionDoc?.layout,
      setSelectedItemId,
      applyLayoutDraft,
    ]
  );

  const handleDropAsset = useCallback(async (payload) => {
    await handleAddToLayout(payload);
  }, [handleAddToLayout]);

  // =========================
  // ✅ Base Setup
  // =========================
  const [selectBaseOpen, setSelectBaseOpen] = useState(false);
  const openSelectBase = useCallback(() => setSelectBaseOpen(true), []);
  const closeSelectBase = useCallback(() => setSelectBaseOpen(false), []);

  const handleSelectBaseModel = useCallback(
    async (model) => {
      if (!projectId || !workspaceId) return;
      if (!model?.id) return;

      if (!selectedBaseId) {
        alert("先に TopBar から Base を作成・選択してください");
        return;
      }

      let glbRaw = pickGlbRawFromModelDocData(model);
      if (!glbRaw) glbRaw = await resolveGlbRaw({ payload: model, uid });

      if (!glbRaw) {
        alert("このモデルはGLB参照が見つかりませんでした（models/{modelId} に glbUrl 等を用意してください）");
        return;
      }

      const baseRef = getPlanDocRef(projectId, workspaceId, selectedBaseId);
      if (!baseRef) {
        console.warn("[handleSelectBaseModel] baseRef is null");
        return;
      }

      const name = safeString(model?.name || model?.title || "Base");
      const thumbUrl = model?.thumbUrl || model?.thumbnailUrl || model?.coverUrl || null;

      try {
        await updateDoc(baseRef, {
          sourceRef: {
            sourceType: "ref",
            modelId: model.id,
            ownerUid: model?.ownerUid || model?.uid || model?.ownerId || null,
          },
          glbUrl: glbRaw,
          thumbnailUrl: thumbUrl,
          name,
          updatedAt: serverTimestamp(),
        });

        setSelectedPlanId(null);
        bumpBaseVersion();
      } catch (e) {
        console.warn("[handleSelectBaseModel] update base failed:", e);
        alert(`躯体の適用に失敗: ${e?.code || ""} ${e?.message || e}`);
      }
    },
    [projectId, workspaceId, selectedBaseId, bumpBaseVersion, setSelectedPlanId, uid]
  );

  const handleConfirmSelectBase = useCallback(
    async (model) => {
      closeSelectBase();
      await handleSelectBaseModel(model);
    },
    [closeSelectBase, handleSelectBaseModel]
  );

  const handleUploadBaseFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return false;
      if (!projectId || !workspaceId) return false;

      if (!uid) {
        alert("ログインが必要です");
        return false;
      }

      if (!selectedBaseId) {
        alert("先に TopBar から Base を作成・選択してください");
        openSelectBase();
        return false;
      }

      const file = Array.isArray(files) ? files[0] : files?.[0];
      if (!file) return false;

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ext !== "glb" && ext !== "gltf") {
        alert("MVPでは .glb(または.gltf) のみ対応しています");
        return false;
      }

      const folder = "workspaces";
      const fileName = safeFileName(file.name, "base.glb");

      const path = `baseModels/${projectId}/${folder}/${workspaceId}/${selectedBaseId}/${fileName}`;
      const fref = storageRef(storage, path);

      try {
        await uploadBytes(fref, file, {
          contentType: pickContentTypeForUpload(file),
          cacheControl: "public,max-age=3600",
        });

        const gsUrl = fref.toString();
        
        const baseRef = getPlanDocRef(projectId, workspaceId, selectedBaseId);
        if (baseRef) {
          await updateDoc(baseRef, {
            glbUrl: gsUrl,
            glbPath: path,
            updatedAt: serverTimestamp(),
          });
        }

        bumpBaseVersion();
        return true;
      } catch (e) {
        console.warn("[handleUploadBaseFiles] failed:", e);
        alert(`アップロードに失敗: ${e?.code || ""} ${e?.message || e}`);
        return false;
      }
    },
    [uid, projectId, workspaceId, selectedBaseId, openSelectBase, bumpBaseVersion]
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
      onSelectBase,
      onSelectPlan,
      onSelectOption: setSelectedOptionId,

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
        height: "100%",
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
      />

      {/* Center */}
      <Box
        sx={{
          minHeight: 0,
          height: "100%",
          display: "grid",
          gridTemplateColumns: `${leftDockWidth}px 1fr ${
            hasRightSidebar ? `${UI_SIZES.RIGHT_SIDEBAR_W}px` : "0px"
          } ${globalPanelWidth}px`,
          gap: 0.5,
          p: 0.5,
          pb: "84px",
          transition: "grid-template-columns 160ms ease",
        }}
      >
        {/* ✅ Left Dock（持ち込むもの: 2D=モデル/一括配置, 3D=マテリアル/テクスチャ） */}
        <Box sx={{ minHeight: 0, height: "100%", overflow: "hidden" }}>
          <LeftDock
            projectId={projectId}
            workspaceId={workspaceId}
            planId={selectedPlanId}
            layoutItems={layoutDraft?.items ?? optionDoc?.layout?.items ?? []}
            canContext={!!(selectedBaseId && selectedPlanId && selectedOptionId)}
          />
        </Box>

        {/* Main */}
        <Box
          sx={{
            minHeight: 0,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ViewportPanel
            projectId={projectId}
            workspaceId={workspaceId}
            baseId={selectedBaseId}
            planId={selectedPlanId}
            optionId={selectedOptionId}
            optionDoc={optionDoc}
            optionDocLoading={optionDocLoading}
            meta={meta}
            onDropAsset={handleDropAsset}
            onOpenSelectBase={openSelectBase}
            onUploadBaseFiles={handleUploadBaseFiles}
            onOpenBaseBuilder={handleOpenBaseBuilder}
            baseDoc={baseDoc}
            baseDocLoading={baseDocLoading}
            baseGlbUrlResolved={baseGlbUrlResolved}
            layoutDraft={layoutDraft}
            onChangeLayoutDraft={applyLayoutDraft}
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

        {/* Right */}
        <Box sx={{ minHeight: 0, height: "100%", overflow: "hidden" }}>
          {hasRightSidebar ? (
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
              selectedOptionId={selectedOptionId}
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
            />
          ) : null}
        </Box>

        {/* GlobalPanel Spacer */}
        <Box sx={{ width: "100%", height: "100%" }} />
      </Box>

      {/* ✅ Bottombar */}
      <Bottombar
        mode={bottomMode}
        onChangeMode={setBottomMode}
        projectId={projectId}
        workspaceId={workspaceId}
        baseId={selectedBaseId}
        planId={selectedPlanId}
        optionId={selectedOptionId}
        optionDocLoading={optionDocLoading}
        onAddToLayout={handleAddToLayout}
        onRequestOpenLeftProperties={() => {
          console.log("request open left properties");
        }}
        open={bottomOpen}
        onChangeOpen={setBottomOpen}
        layoutItems={layoutDraft?.items ?? optionDoc?.layout?.items ?? []}
        leftSidebarWidth={leftDockWidth}
        rightSidebarWidth={(hasRightSidebar ? UI_SIZES.RIGHT_SIDEBAR_W : 0) + globalPanelWidth}
      />

      {/* ✅ BottomDock (Always visible bottom strip) */}
      <BottomDock
        mode={bottomMode}
        onChangeMode={setBottomMode}
        panelOpen={bottomOpen}
        onTogglePanelOpen={toggleBottomOpen}
        globalPanelWidth={globalPanelWidth}
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
    </Box>
  );
}