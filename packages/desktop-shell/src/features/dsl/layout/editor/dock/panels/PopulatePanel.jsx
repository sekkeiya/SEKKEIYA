// src/features/layout/components/BottomBar/panels/PopulatePanel.jsx
import React, { useMemo, useState, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { useModelTitleMap } from "../../../hooks/useModelTitleMap";
import { getItemDisplayLabel, isUuidLike } from "../../../utils/labels/itemLabelUtils";

// ✁Eselection store
import { useUiSelectionStore } from "../../../store/uiSelectionStore";
import { useUiRightSidebarStore } from "../../../store/uiRightSidebarStore";
import { useUiPropertiesSelectionStore } from "../../../store/uiPropertiesSelectionStore";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function pickThumbFromItem(it) {
  return (
    it?.thumbUrl ||
    it?.thumbnailUrl ||
    it?.coverUrl ||
    it?.asset?.thumbUrl ||
    it?.thumbnailFilePath?.url ||
    ""
  );
}

/**
 * PopulatePanel
 * - 配置済みアイチE��の一覧
 * - クリチE��で selection store を更新
 */
export default function PopulatePanel({
  disabled = false,
  placedItems = [],
  onClose,
  onRequestOpenLeftProperties,
}) {
  const theme = useTheme();

  // ============================================================
  // ✁ESelection�E�Eustand�E�E
  // ============================================================
  const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
  const setSelectedItemIds = useUiSelectionStore((s) => s.setSelectedItemIds);

  const selectedItemId = selectedItemIds[0] ?? null;
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);
  const setSelection = useUiPropertiesSelectionStore((s) => s.setSelection);
  const selectItem = useUiPropertiesSelectionStore((s) => s.selectItem);

  // header state
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState("grouped"); // grouped | instances
  const [expandedGroupKeys, setExpandedGroupKeys] = useState({});
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const [sortKey, setSortKey] = useState("added");

  // ------------------------------------------------------------
  // title 補宁E
  // ------------------------------------------------------------
  const neededModelIds = useMemo(() => {
    const set = new Set();
    for (const it of safeArray(placedItems)) {
      const modelId = String(it?.modelId || it?.id || "").trim();
      if (!modelId) continue;

      const direct =
        it?.title ||
        it?.name ||
        it?.label ||
        it?.modelName ||
        it?.meta?.name;

      const hasGoodName =
        direct && !isUuidLike(direct) && direct !== modelId;

      if (!hasGoodName) set.add(modelId);
    }
    return Array.from(set);
  }, [placedItems]);

  const modelTitleMap = useModelTitleMap(neededModelIds);

  // ------------------------------------------------------------
  // filter
  // ------------------------------------------------------------
  const instanceFiltered = useMemo(() => {
    const list = safeArray(placedItems);
    const s = q.trim().toLowerCase();
    if (!s) return list;

    return list.filter((it) => {
      const title = getItemDisplayLabel(it, modelTitleMap).toLowerCase();
      return title.includes(s);
    });
  }, [placedItems, q, modelTitleMap]);

  // ------------------------------------------------------------
  // grouped
  // ------------------------------------------------------------
  const grouped = useMemo(() => {
    const map = new Map();
    instanceFiltered.forEach((it, idx) => {
      const modelId = String(it?.modelId || it?.id || "");
      const key = modelId || `__no_model_${idx}`;

      if (!map.has(key)) {
        map.set(key, {
          groupKey: key,
          rep: it,
          items: [],
        });
      }
      map.get(key).items.push(it);
    });

    const arr = Array.from(map.values());
    arr.forEach((g) => {
      g.label = getItemDisplayLabel(g.rep, modelTitleMap);
      g.thumb = pickThumbFromItem(g.rep);
    });

    return arr;
  }, [instanceFiltered, modelTitleMap]);

  // ------------------------------------------------------------
  // handlers
  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // handlers
  // ------------------------------------------------------------
  const requestSelect = useCallback(
    (groupItems) => {
      if (!groupItems || groupItems.length === 0) return;
      
      const targetIds = groupItems.map(it => it.id);
      
      setSelectedItemIds(targetIds);
      
      setTimeout(() => {
        selectItem(targetIds[0]);
        setRightPanel("properties", true);
      }, 0);
      onRequestOpenLeftProperties?.();
    },
    [setSelectedItemIds, selectItem, setRightPanel, onRequestOpenLeftProperties]
  );

  const toggleGroupExpanded = useCallback((key) => {
    setExpandedGroupKeys((m) => ({ ...m, [key]: !m[key] }));
  }, []);

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <Box sx={{ p: 1.1, pt: 0, display: "flex", flexDirection: "column", gap: 1.5, height: "100%", flex: 1 }}>
      {/* Header unified into a single line */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ px: 1.5, py: 1.5, borderBottom: `1px solid ${alpha("#fff", 0.08)}` }}>
        <Typography sx={{ fontWeight: 900, fontSize: 13.5, letterSpacing: 0.2, minWidth: 100 }}>
          配置アイテム
        </Typography>

        {/* Search */}
        <Box sx={{ 
          display: "flex", alignItems: "center", background: alpha("#fff", 0.04), border: `1px solid ${alpha("#fff", 0.1)}`, 
          borderRadius: 24, px: 2, height: 34, width: 220
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", mr: 1 }} />
          <TextField
             variant="standard"
             placeholder="Search items..."
             value={q}
             onChange={(e) => setQ(e.target.value)}
             InputProps={{ disableUnderline: true, style: { fontSize: 12, color: "var(--brand-fg)", fontWeight: 600 } }}
             sx={{ flex: 1 }}
          />
          {q && (
            <IconButton size="small" onClick={() => setQ("")} sx={{ mr: -1 }}>
              <ClearRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>

        <Box sx={{ flex: 1 }} />
        
        {/* Total Badge */}
        <Typography sx={{ fontWeight: 800, fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", mr: 1 }}>
          TOTAL: {placedItems.length}
        </Typography>


        {onClose && (
          <IconButton size="small" onClick={onClose} sx={{ borderRadius: 1.5 }}>
            <ExpandMoreRoundedIcon />
          </IconButton>
        )}
      </Stack>

      {/* Grid */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 1.5,
          px: 0.5,
          pb: 2,
        }}
      >
        {grouped.map((g) => {
          const repId = g.rep?.id;
          const active = selectedItemIds?.length > 0 && g.items.some(it => selectedItemIds.includes(it.id));

          return (
            <Box
              key={g.groupKey}
              sx={{
                position: "relative",
                borderRadius: "12px",
                background: "linear-gradient(180deg, rgb(var(--brand-fg-rgb) / 0.04) 0%, rgb(var(--brand-fg-rgb) / 0.01) 100%)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                border: active ? `1px solid ${theme.palette.primary.main}` : `1px solid ${alpha("#fff", 0.03)}`,
                overflow: "hidden",
                cursor: "pointer",
                aspectRatio: "1 / 1",
                transition: "all 0.2s",
                ...(active && {
                  background: "linear-gradient(180deg, rgb(var(--brand-fg-rgb) / 0.08) 0%, rgb(var(--brand-fg-rgb) / 0.02) 100%)",
                }),
                "&:hover": {
                  background: active 
                    ? "linear-gradient(180deg, rgb(var(--brand-fg-rgb) / 0.1) 0%, rgb(var(--brand-fg-rgb) / 0.03) 100%)"
                    : "linear-gradient(180deg, rgb(var(--brand-fg-rgb) / 0.07) 0%, rgb(var(--brand-fg-rgb) / 0.02) 100%)",
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                },
                "&:hover .add-btn-overlay": {
                  opacity: 1,
                  transform: "scale(1)",
                  pointerEvents: "auto",
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) requestSelect(g.items);
              }}
            >
              <Box sx={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {g.thumb ? (
                  <img
                    src={g.thumb}
                    alt={g.label}
                    style={{ 
                      width: "100%", 
                      height: "100%", 
                      objectFit: "contain", 
                      transform: "scale(2.2)",
                      filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.6))" 
                    }}
                  />
                ) : null}
              </Box>

              {/* Add to Layout Button Overlay */}
              <Box
                className="add-btn-overlay"
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  bgcolor: theme.palette.primary.main,
                  color: "var(--brand-fg)",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                  zIndex: 2,
                  opacity: 0,
                  pointerEvents: "none",
                  transition: "all 0.2s",
                  transform: "scale(0.8)",
                  "&:hover": {
                    transform: "scale(1.1)",
                    bgcolor: theme.palette.primary.light,
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()} // prevent card selection
                onPointerUp={(e) => {
                  e.stopPropagation();
                  const payload = {
                    kind: "model",
                    modelId: g.rep.modelId || g.rep.id,
                    type: g.rep.type || "unknown",
                    dragId: `drag_${g.rep.modelId || g.rep.id}_${Date.now()}`
                  };
                  console.log("[PopulatePanel] 🔵 Dispatched add-model-to-layout via Button:", payload);
                  window.dispatchEvent(new CustomEvent("add-model-to-layout", { detail: payload }));
                }}
                title="Add to Layout again"
              >
                <AddRoundedIcon sx={{ fontSize: 16 }} />
              </Box>

              {/* Bottom Gradient Overlay */}
              <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%", background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, light-dark(rgba(15,23,42,0), rgba(0,0,0,0)) 100%)", pointerEvents: "none", zIndex: 1 }} />

              {/* Count Badge (Top Left) */}
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  bgcolor: "color-mix(in srgb, var(--brand-bg) 60%, transparent)",
                  backdropFilter: "blur(4px)",
                  color: "var(--brand-fg)",
                  px: 1,
                  py: 0.25,
                  borderRadius: "10px",
                  fontSize: 10,
                  fontWeight: 800,
                  zIndex: 2,
                  border: `1px solid ${alpha("#fff", 0.1)}`,
                }}
              >
                ×{g.items.length}
              </Box>

              {/* Title (Bottom Left) */}
              <Box sx={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", alignItems: "center", zIndex: 2 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "rgb(var(--brand-fg-rgb) / 0.95)", textShadow: "0 2px 6px rgba(0,0,0,0.8)" }} noWrap>
                  {g.label}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Typography sx={{ fontSize: 11, opacity: 0.55 }}>
        クリチE���E�選択！Eroperties 表示�E�E
      </Typography>
    </Box>
  );
}
