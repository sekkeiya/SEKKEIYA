// src/features/layout/components/RightSidebar/components/PropertiesPanel.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { alpha } from "@mui/material/styles";

import PropertiesModelPanel from "./PropertiesPanel/PropertiesModelPanel";
import PropertiesMaterialPanel from "./PropertiesPanel/PropertiesMaterialPanel";
import PropertiesLibraryModelPanel from "./PropertiesPanel/PropertiesLibraryModelPanel";
import PropertiesLightPanel from "./PropertiesPanel/PropertiesLightPanel";
import PropertiesLandscapePanel from "./PropertiesPanel/PropertiesLandscapePanel";
import FaceMaterialPanel from "./ContextPanels/FaceMaterialPanel";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";

import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import { useAutoLayoutStore } from "../../../../store/useAutoLayoutStore";
import { useLayoutTaskStore } from "../../../../store/useLayoutTaskStore";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function ensureVec3(v, fallback = [0, 0, 0]) {
  if (!Array.isArray(v) || v.length !== 3) return fallback;
  return [
    Number.isFinite(Number(v[0])) ? Number(v[0]) : fallback[0],
    Number.isFinite(Number(v[1])) ? Number(v[1]) : fallback[1],
    Number.isFinite(Number(v[2])) ? Number(v[2]) : fallback[2],
  ];
}

function ensureScale3(v) {
  const a = ensureVec3(v, [1, 1, 1]);
  return a.map((n) => (n <= 0 ? 1 : n));
}

export default function PropertiesPanel({
  selection, // {kind:"item"|"material", id, ...}
  selectedItemIds = [],

  // ✅ 追加：今の配置 items（LayoutShellから渡す）
  items = [],

  // ✅ 追加：items を更新して layoutDraft に反映する
  onChangeItems, // (nextItems)=>void

  // ✅ 将来：material selection切替
  onSelectMaterial, // ({ kind:"material", ... })=>void

  contextPanel,
}) {
  const panelSx = useMemo(
    () => ({
      height: "100%",
      width: "100%",
      p: 1.25,
      color: "color-mix(in srgb, var(--brand-fg) 92%, transparent)",
      overflow: "auto",
      "&::-webkit-scrollbar": { width: 10 },
      "&::-webkit-scrollbar-thumb": {
        background: alpha("#fff", 0.14),
        borderRadius: 20,
      },
    }),
    []
  );

  // ✅ kind 確定（先に決める）
  const kind = selection?.kind || "item";

  const isEmpty = useMemo(() => {
    if (kind === "material" || kind === "libraryModel" || kind === "light" || kind === "landscape") {
      return !selection; // selection自体が無ければ空
    }
    return !selection?.id;
  }, [kind, selection]);

  // ✅ 選択 item を引く
  const selectedItem = useMemo(() => {
    if (kind !== "item") return null;
    if (!selection?.id) return null;
    return safeArray(items).find((it) => it?.id === selection.id) ?? null;
  }, [kind, selection, items]);

  // ✅ items更新ユーティリティ（複数ID対応）
  const patchItem = useCallback(
    (itemIdsMap, patch) => {
      const targetIds = Array.isArray(itemIdsMap) ? itemIdsMap : [itemIdsMap];
      if (targetIds.length === 0) return;

      const list = safeArray(items);
      let nextItems = list.slice();
      let changed = false;

      targetIds.forEach(id => {
        if (!id) return;
        const idx = nextItems.findIndex((it) => it?.id === id);
        if (idx < 0) return;

        const prev = nextItems[idx] || {};
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        nextItems[idx] = next;
        changed = true;
      });

      if (changed) onChangeItems?.(nextItems);
    },
    [items, onChangeItems]
  );

  // ✅ transform更新（position/rotation/scale を安全に維持）
  const handleChangeTransform = useCallback(
    (itemIdsMap, nextTransform) => {
      patchItem(itemIdsMap, (prev) => {
        const t = prev?.transform || {};
        const next = {
          position: ensureVec3(nextTransform?.position, ensureVec3(t?.position, [0, 0, 0])),
          rotation: ensureVec3(nextTransform?.rotation, ensureVec3(t?.rotation, [0, 0, 0])),
          scale: ensureScale3(nextTransform?.scale ?? t?.scale),
        };
        return { ...prev, transform: next };
      });
    },
    [patchItem]
  );

  const handleDeleteItems = useCallback((itemIdsMap) => {
    const targetIds = Array.isArray(itemIdsMap) ? itemIdsMap : [itemIdsMap];
    if (targetIds.length === 0) return;
    const idSet = new Set(targetIds);
    const list = safeArray(items);
    const nextItems = list.filter(it => !idSet.has(it?.id));
    onChangeItems?.(nextItems);
  }, [items, onChangeItems]);

  // === Auto Layout Logic ===
  const isGenerating = useAutoLayoutStore((s) => s.isGenerating);

  // Material モード：躯体面のマテリアル設定パネルを最優先で表示する。
  const editorMode = useEditorModeStore((s) => s.editorMode);
  if (editorMode === "material") {
    return (
      <Box sx={{ ...panelSx, display: "flex", flexDirection: "column" }}>
        <FaceMaterialPanel />
      </Box>
    );
  }

  // =========================
  // Content based on Selection State
  // =========================
  if (isEmpty) {
    return (
      <Box sx={{ ...panelSx, display: "flex", flexDirection: "column" }}>
        {/* 用途セレクタは contextPanel（OptionDetailPanel）側に統合済み。
            旧ドロップダウンはローカル state のみで保存されない死にUIだったため撤去した。 */}
        {/* Middle: Selection Details */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", display: 'flex', flexDirection: 'column' }}>
          {contextPanel || (
            <>
              <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>No selection</Typography>
              <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.5 }}>
                Scene / 配置アイテム からアイテムを選択してください。
              </Typography>
            </>
          )}
        </Box>

      </Box>
    );
  }

  // When an item IS selected, show its properties WITHOUT the global Layout Dashboard
  let content = null;
  if (kind === "landscape") {
    content = <PropertiesLandscapePanel target={selection?.target} />;
  } else if (kind === "light") {
    content = <PropertiesLightPanel lightId={selection?.lightId} />;
  } else if (kind === "material") {
    content = <PropertiesMaterialPanel selection={selection} />;
  } else if (kind === "libraryModel") {
    content = <PropertiesLibraryModelPanel selection={selection} />;
  } else {
    if (!selectedItem) {
      content = (
        <>
          <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>Selection</Typography>
          <Typography sx={{ opacity: 0.75, fontSize: 12, mt: 0.5 }}>kind: {kind}</Typography>
          <Typography sx={{ opacity: 0.75, fontSize: 12 }}>id: {selection?.id}</Typography>
          <Divider sx={{ my: 1, borderColor: alpha("#fff", 0.08) }} />
          <Typography sx={{ opacity: 0.7, fontSize: 12 }}>
            選択された item が items に見つかりませんでした（同期待ちの可能性）。
          </Typography>
        </>
      );
    } else {
      content = (
        <PropertiesModelPanel
          selection={selection}
          item={selectedItem}
          selectedItemIds={selectedItemIds}
          onChangeTransform={(nextTransform) => handleChangeTransform(selectedItemIds?.length > 0 ? selectedItemIds : selectedItem.id, nextTransform)}
          onChangeZone={(zoneId) => patchItem(selectedItemIds?.length > 0 ? selectedItemIds : selectedItem.id, { zoneId: zoneId || null })}
          onSelectMaterial={onSelectMaterial}
          onDeleteItems={() => handleDeleteItems(selectedItemIds?.length > 0 ? selectedItemIds : selectedItem.id)}
          onApplyDimensions={(dims) => patchItem(selectedItemIds?.length > 0 ? selectedItemIds : selectedItem.id, { dimensionsMm: dims })}
          onApplyMaterials={(bindings) => patchItem(selectedItemIds?.length > 0 ? selectedItemIds : selectedItem.id, { materialBindings: bindings })}
          onApplyActions={({ gimmicks, anim }) => patchItem(selectedItemIds?.length > 0 ? selectedItemIds : selectedItem.id, { gimmicks: gimmicks || [], anim: anim || null })}
          onApplyInfo={(info) => patchItem(selectedItemIds?.length > 0 ? selectedItemIds : selectedItem.id, { info: info || null })}
        />
      );
    }
  }

  return (
    <Box sx={{ ...panelSx, display: "flex", flexDirection: "column" }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", display: 'flex', flexDirection: 'column' }}>
        {content}
      </Box>
    </Box>
  );
}
