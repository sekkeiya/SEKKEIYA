// src/features/layout/components/RightSidebar/components/PropertiesPanel.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { alpha } from "@mui/material/styles";

import PropertiesModelPanel from "./PropertiesPanel/PropertiesModelPanel";
import PropertiesMaterialPanel from "./PropertiesPanel/PropertiesMaterialPanel";
import PropertiesLibraryModelPanel from "./PropertiesPanel/PropertiesLibraryModelPanel";
import PropertiesLightPanel from "./PropertiesPanel/PropertiesLightPanel";
import PropertiesLandscapePanel from "./PropertiesPanel/PropertiesLandscapePanel";

import { Select, MenuItem, Button, CircularProgress } from "@mui/material";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import { useAutoLayoutStore } from "@desktop/features/dsl/layout/store/useAutoLayoutStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";

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
      color: alpha("#fff", 0.92),
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
  const autoLayoutMode = useAutoLayoutStore((s) => s.autoLayoutMode);
  const openConfigDialog = useAutoLayoutStore((s) => s.openConfigDialog);
  const selectedZoneIds = useLayoutTaskStore((s) => s.selectedZoneIds);
  const zones = useLayoutTaskStore((s) => s.zones);
  const hasZones = zones.length > 0;

  const handleAutoLayout = useCallback(() => {
    if (selectedZoneIds.length === 0) {
      alert("ゾーンを1つ以上選択してください"); // TODO: Use a proper alert store if needed
      return;
    }
    openConfigDialog(selectedZoneIds);
  }, [selectedZoneIds, openConfigDialog]);

  // Usage state
  const [usage, setUsage] = React.useState("residential");

  // =========================
  // Content based on Selection State
  // =========================
  if (isEmpty) {
    return (
      <Box sx={{ ...panelSx, display: "flex", flexDirection: "column" }}>
        {/* Top: Global Settings */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 12, color: alpha("#fff", 0.7), mb: 0.5 }}>用途 (Usage)</Typography>
          <Select
            size="small"
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
            sx={{
              width: "100%",
              height: 32,
              color: "#fff",
              fontSize: 13,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.2) },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.4) },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.6) },
              mb: 2,
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: "#1e293b",
                  border: `1px solid ${alpha("#fff", 0.1)}`,
                  "& .MuiMenuItem-root": { fontSize: 13, color: "#fff" }
                }
              }
            }}
          >
            <MenuItem value="residential">住宅 (Residential)</MenuItem>
            <MenuItem value="restaurant">レストラン (Restaurant)</MenuItem>
            <MenuItem value="office">オフィス (Office)</MenuItem>
            <MenuItem value="retail">店舗 (Retail)</MenuItem>
          </Select>


        </Box>

        <Divider sx={{ mb: 2, borderColor: alpha("#fff", 0.1) }} />

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

        <Divider sx={{ mt: 2, mb: 2, borderColor: alpha("#fff", 0.1) }} />

        {/* Bottom: Auto Layout fixed action */}
        <Box sx={{ mt: "auto", pt: 1 }}>
          <Button
            fullWidth
            variant="contained"
            disabled={!hasZones || isGenerating}
            onClick={handleAutoLayout}
            startIcon={isGenerating ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <AutoFixHighRoundedIcon />}
            sx={{
              py: 1,
              textTransform: "none",
              fontWeight: 700,
              bgcolor: "#7c3aed",
              color: "#fff",
              "&:hover": { bgcolor: "#6d28d9" },
              "&.Mui-disabled": { bgcolor: alpha("#7c3aed", 0.3), color: alpha("#fff", 0.5) }
            }}
          >
            {isGenerating ? "生成中..." : "Layout 生成"}
          </Button>
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
