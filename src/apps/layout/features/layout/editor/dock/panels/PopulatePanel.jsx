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

import { useModelTitleMap } from "@layout/features/layout/hooks/useModelTitleMap";
import { getItemDisplayLabel, isUuidLike } from "@layout/features/layout/utils/labels/itemLabelUtils";

// ✁Eselection store
import { useUiSelectionStore } from "@layout/features/layout/store/uiSelectionStore";

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

  // ✁E左サイドバー Properties を開く合図だけ残す
  onRequestOpenLeftProperties,
}) {
  const theme = useTheme();

  // ============================================================
  // ✁ESelection�E�Eustand�E�E
  // ============================================================
  const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
  const setSelectedItemId = useUiSelectionStore((s) => s.setSelectedItemId);

  const selectedItemId = selectedItemIds[0] ?? null;

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
  const requestSelect = useCallback(
    (itemId) => {
      if (!itemId) return;
      setSelectedItemId(itemId);
      onRequestOpenLeftProperties?.();
    },
    [setSelectedItemId, onRequestOpenLeftProperties]
  );

  const toggleGroupExpanded = useCallback((key) => {
    setExpandedGroupKeys((m) => ({ ...m, [key]: !m[key] }));
  }, []);

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <Box sx={{ p: 1.1, display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Header */}
      <Stack direction="row" spacing={0.8} alignItems="center">
        <Typography sx={{ fontWeight: 900, fontSize: 12.8 }}>
          Populate
        </Typography>

        <Chip
          size="small"
          sx={{ height: 22 }}
          label={`${instanceFiltered.length}/${placedItems.length}`}
        />

        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          size="small"
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: <SearchRoundedIcon sx={{ mr: 0.5 }} />,
            endAdornment: q ? (
              <IconButton size="small" onClick={() => setQ("")}>
                <ClearRoundedIcon fontSize="small" />
              </IconButton>
            ) : null,
          }}
        />
      </Stack>

      {/* Grid */}
      <Box
        sx={{
          maxHeight: 280,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 1,
        }}
      >
        {grouped.map((g) => {
          const repId = g.rep?.id;
          const active = repId && repId === selectedItemId;
          const open = expandedGroupKeys[g.groupKey];

          return (
            <Box
              key={g.groupKey}
              sx={{
                borderRadius: 2,
                border: `1px solid ${alpha("#fff", 0.1)}`,
                background: alpha("#0b1026", 0.7),
                cursor: "pointer",
                ...(active && {
                  borderColor: alpha(theme.palette.primary.main, 0.6),
                }),
              }}
              onClick={() => !disabled && requestSelect(repId)}
            >
              <Box sx={{ height: 80, background: alpha("#000", 0.2) }}>
                {g.thumb ? (
                  <img
                    src={g.thumb}
                    alt={g.label}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </Box>

              <Box sx={{ p: 0.8 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 900 }} noWrap>
                  {g.label}
                </Typography>
                <Typography sx={{ fontSize: 11, opacity: 0.7 }}>
                  x{g.items.length}
                </Typography>

                <Chip
                  size="small"
                  label={open ? "Hide" : "Show"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupExpanded(g.groupKey);
                  }}
                  sx={{ mt: 0.5 }}
                />
              </Box>

              {open && (
                <Box sx={{ p: 0.6, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {g.items.map((it, i) => {
                    const id = it?.id;
                    const isActive = id && id === selectedItemId;
                    return (
                      <Chip
                        key={id || i}
                        size="small"
                        label={`#${i + 1}`}
                        clickable
                        onClick={(e) => {
                          e.stopPropagation();
                          requestSelect(id);
                        }}
                        sx={{
                          background: alpha("#000", isActive ? 0.35 : 0.15),
                        }}
                      />
                    );
                  })}
                </Box>
              )}
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
