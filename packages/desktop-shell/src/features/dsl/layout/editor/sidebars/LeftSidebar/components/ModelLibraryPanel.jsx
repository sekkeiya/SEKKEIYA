// src/features/layout/components/LeftSidebar/components/ModelLibraryPanel.jsx
import React, { useMemo, useState, useCallback } from "react";
import {
  Paper,
  Stack,
  Box,
  Typography,
  Divider,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Grid,
  Tooltip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";

import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import WeekendRoundedIcon from "@mui/icons-material/WeekendRounded";
import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import BedRoundedIcon from "@mui/icons-material/BedRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import ChildCareRoundedIcon from "@mui/icons-material/ChildCareRounded";
import ParkRoundedIcon from "@mui/icons-material/ParkRounded";
import WbShadeRoundedIcon from "@mui/icons-material/WbShadeRounded";

import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import LocalHospitalRoundedIcon from "@mui/icons-material/LocalHospitalRounded";
import HotTubRoundedIcon from "@mui/icons-material/HotTubRounded";
import HotelRoundedIcon from "@mui/icons-material/HotelRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";

import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import TrafficRoundedIcon from "@mui/icons-material/TrafficRounded";

import { usePublicModels } from "../../../../hooks/usePublicModels";
import { useWorkspaceModelRefs } from "../../../../hooks/useWorkspaceModelRefs";

// ✅ 3DSS taxonomy
import { TYPES, getCategoryTree, SUBTYPES } from "../../../../../../../shared/data/Categories";

// ✅ 共通：モデル名補完 & 表示名
import { useModelTitleMap } from "../../../../hooks/useModelTitleMap";
import { getItemDisplayLabel } from "../../../../utils/labels/itemLabelUtils";
import { useUiPropertiesSelectionStore } from "../../../../store/uiPropertiesSelectionStore";

function safeStr(v, fb = "") {
  return typeof v === "string" && v.trim() ? v : fb;
}
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

// ✅ Setとして安全に扱う（hook戻り値が undefined / 配列でも落ちない）
function safeSet(v) {
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v);
  return new Set();
}

// -------------------------
// model taxonomy getters（壊れにくく）
// -------------------------
function getModelType(m) {
  const t =
    safeStr(m?.type, "") ||
    safeStr(m?.categoryType, "") ||
    safeStr(m?.modelType, "");
  const tl = t.toLowerCase();

  if (tl === TYPES.FURNITURE) return TYPES.FURNITURE;
  if (tl === TYPES.ARCHITECTURE) return TYPES.ARCHITECTURE;

  // fallback: 何も無い場合は null（絞り込みで弾かない）
  return null;
}

function getModelSubType(m) {
  // 建築: "全体" / "パーツ" / "外構" が入っている想定
  // 家具: "既製品家具" / "造作家具" が入ってるなら拾う（無くてもOK）
  return safeStr(m?.subType, "") || safeStr(m?.archSubType, "") || "";
}

function getModelGroupLabel(m) {
  // 例： "チェア" / "ソファ・ロビーチェア" / "住宅" / "ドア" など
  return (
    safeStr(m?.group, "") ||
    safeStr(m?.categoryGroup, "") ||
    safeStr(m?.category, "") ||
    ""
  );
}

// -------------------------
// icons（グループ名→アイコン）
// -------------------------
function getGroupIconByLabel(type, subTypeLabel, groupLabel) {
  const g = String(groupLabel || "").trim();
  if (!g) return <CategoryRoundedIcon />;

  // 家具
  if (type === TYPES.FURNITURE) {
    if (g.includes("ソファ") || g.includes("ロビー")) return <WeekendRoundedIcon />;
    if (g.includes("チェア") || g.includes("椅子")) return <ChairRoundedIcon />;
    if (g.includes("テーブル") || g.includes("卓")) return <TableRestaurantRoundedIcon />;
    if (g.includes("ベッド")) return <BedRoundedIcon />;
    if (g.includes("キャビネット") || g.includes("ロッカー") || g.includes("食器棚"))
      return <Inventory2RoundedIcon />;
    if (g.includes("キッズ")) return <ChildCareRoundedIcon />;
    if (g.includes("アウトドア")) return <ParkRoundedIcon />;
    if (g.includes("備品")) return <WbShadeRoundedIcon />;
    return <CategoryRoundedIcon />;
  }

  // 建築（subType ごとに代表アイコン）
  if (type === TYPES.ARCHITECTURE) {
    if (subTypeLabel === "パーツ") {
      if (g.includes("ドア")) return <DoorFrontRoundedIcon />;
      if (g.includes("窓")) return <WindowRoundedIcon />;
      return <CategoryRoundedIcon />;
    }
    if (subTypeLabel === "外構") {
      if (g.includes("信号")) return <TrafficRoundedIcon />;
      if (g.includes("店")) return <StorefrontRoundedIcon />;
      return <CategoryRoundedIcon />;
    }

    // 全体
    if (g.includes("住宅")) return <HomeRoundedIcon />;
    if (g.includes("カフェ")) return <StorefrontRoundedIcon />;
    if (g.includes("オフィス")) return <ApartmentRoundedIcon />;
    if (g.includes("医療") || g.includes("高齢")) return <LocalHospitalRoundedIcon />;
    if (g.includes("温浴")) return <HotTubRoundedIcon />;
    if (g.includes("宿泊")) return <HotelRoundedIcon />;
    if (g.includes("公共") || g.includes("福利") || g.includes("文教"))
      return g.includes("文教") ? <SchoolRoundedIcon /> : <AccountBalanceRoundedIcon />;
    return <CategoryRoundedIcon />;
  }

  return <CategoryRoundedIcon />;
}

function matchesTaxonomy({ m, selectedType, selectedSubType, selectedGroupLabel }) {
  // type
  const mt = getModelType(m);
  if (selectedType && mt && mt !== selectedType) return false;

  // subtype（選択されてる場合のみ厳密に）
  if (selectedSubType) {
    const ms = getModelSubType(m);
    // 空なら弾かない（データ移行途中でも壊さない）
    if (ms && ms !== selectedSubType) return false;
  }

  // group
  if (selectedGroupLabel && selectedGroupLabel !== "__ALL__") {
    const mg = getModelGroupLabel(m);
    if (!mg) return false;
    if (mg === selectedGroupLabel) return true;
    if (mg.includes(selectedGroupLabel) || selectedGroupLabel.includes(mg)) return true;
    return false;
  }

  return true;
}

/**
 * ModelLibraryPanel（Twinmotion寄せ）
 * - TAXONOMY に沿って、アイコンのグリッド → モデルグリッド
 *
 * ✅ D&D: left -> viewport
 * - application/json に payload を詰めて drop 先で拾えるようにする
 */
export default function ModelLibraryPanel({ projectId, workspaceId, planId }) {
  const theme = useTheme();

  const [tab, setTab] = useState("all"); // "all" | "project"
  const [q, setQ] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const [loadingCardId, setLoadingCardId] = useState(null);

  const { selection, setSelection } = useUiPropertiesSelectionStore();

  // ✅ taxonomy state
  const [selectedType, setSelectedType] = useState(TYPES.FURNITURE);
  const [selectedSubType, setSelectedSubType] = useState(""); // 建築: "全体"|"パーツ"|"外構" / 家具: 任意（空でOK）
  const [selectedGroupLabel, setSelectedGroupLabel] = useState("__ALL__"); // "__ALL__" or group label

  // ✅ 公開モデル（MVP）
  const { models: publicModels, loading: publicLoading } = usePublicModels({
    enabled: true,
    limit: 240,
  });

  // ✅ In Workspace / In Plan
  const { workspaceModelIds, planModelIds, workspaceLoading, planLoading } = useWorkspaceModelRefs({
    projectId,
    workspaceId,
    planId,
    enabled: Boolean(projectId && workspaceId),
  });

  const workspaceIds = useMemo(() => safeSet(workspaceModelIds), [workspaceModelIds]);
  const planIds = useMemo(() => safeSet(planModelIds), [planModelIds]);

  const loadingAny = Boolean(publicLoading || workspaceLoading || planLoading);

  const totalAll = Array.isArray(publicModels) ? publicModels.length : 0;
  const totalInProject = workspaceIds.size;
  const totalInPlan = planIds.size;

  const handleTabChange = useCallback((_e, next) => setTab(next), []);

  // ✅ type を変えたときの初期化（建築なら subType を先頭に）
  const handleSelectType = useCallback((t) => {
    const nextType = t === TYPES.ARCHITECTURE ? TYPES.ARCHITECTURE : TYPES.FURNITURE;
    setSelectedType(nextType);

    const subtypes = safeArray(SUBTYPES?.[nextType]);
    const first = subtypes[0] || "";
    setSelectedSubType(nextType === TYPES.ARCHITECTURE ? first : "");
    setSelectedGroupLabel("__ALL__");
  }, []);

  const handleSelectSubType = useCallback((st) => {
    setSelectedSubType(st || "");
    setSelectedGroupLabel("__ALL__");
  }, []);

  // ✅ 今の type/subType のカテゴリツリーから “グループ一覧” を作る
  const groupLabels = useMemo(() => {
    if (selectedType === TYPES.ARCHITECTURE) {
      const st = selectedSubType || safeArray(SUBTYPES?.[TYPES.ARCHITECTURE])?.[0] || "全体";
      const tree = getCategoryTree(TYPES.ARCHITECTURE, st);
      return Object.keys(tree || {});
    }
    const tree = getCategoryTree(TYPES.FURNITURE, "default");
    return Object.keys(tree || {});
  }, [selectedType, selectedSubType]);

  // ✅ tab 切替: 表示元リスト
  const modelsByTab = useMemo(() => {
    const list = Array.isArray(publicModels) ? publicModels : [];
    if (tab === "project") return list.filter((m) => workspaceIds.has(m?.id));
    return list;
  }, [publicModels, tab, workspaceIds]);

  // --------------------------------------------------
  // ✅ 共通：モデル名補完（models/{id}.title）
  // - ModelLibraryは "m.id" が modelId
  // - ただし m.name が無い / 変な値のときだけ補完が必要
  // - 判定は getItemDisplayLabel と同じルールに寄せたいので
  //   「itemsっぽい形」にして getItemDisplayLabel を使う
  // --------------------------------------------------
  const neededModelIds = useMemo(() => {
    const set = new Set();

    for (const m of modelsByTab || []) {
      const modelId = String(m?.id || "").trim();
      if (!modelId) continue;

      // ここは「Outlinerと同じ判定」に寄せる
      // m.name が UUIDっぽい / modelIdそのもの / 空なら補完対象
      const directStr = String(m?.name || "").trim();
      const hasGoodName = !!directStr && directStr !== modelId;
      const directLooksBad = !hasGoodName; // m.nameが無い/同一IDなど

      // もし UUIDっぽい名前も弾きたい場合はここで弾く
      // （getItemDisplayLabelは UUIDっぽいなら悪い名前扱い）
      // ただ ModelLibraryはUUID形式のm.nameはほぼ無い想定なので緩めでOK
      if (directLooksBad) set.add(modelId);
    }

    return Array.from(set);
  }, [modelsByTab]);

  const modelTitleMap = useModelTitleMap(neededModelIds);

  // ✅ 検索テキスト（表示名も含める）
  const makeSearchText = useCallback(
    (m) => {
      const modelId = safeStr(m?.id, "");
      const displayName = getItemDisplayLabel({ id: modelId, modelId, name: m?.name, title: m?.title }, modelTitleMap);

      const brand = safeStr(m?.brand, "");
      const owner = safeStr(m?.ownerHandle, "");
      const type = safeStr(m?.type, "");
      const subType = safeStr(m?.subType, "");
      const group = safeStr(m?.group, "") || safeStr(m?.categoryGroup, "");
      const category = safeStr(m?.category, "");
      const tags = safeArray(m?.tags).join(" ");

      return `${displayName} ${brand} ${owner} ${modelId} ${type} ${subType} ${group} ${category} ${tags}`.toLowerCase();
    },
    [modelTitleMap]
  );

  // ✅ taxonomy + search
  const filtered = useMemo(() => {
    const list = modelsByTab;

    const s = String(q || "").trim().toLowerCase();
    const bySearch = s ? list.filter((m) => makeSearchText(m).includes(s)) : list;

    const byTax = bySearch.filter((m) =>
      matchesTaxonomy({
        m,
        selectedType,
        selectedSubType:
          selectedType === TYPES.ARCHITECTURE ? (selectedSubType || "") : (selectedSubType || ""),
        selectedGroupLabel,
      })
    );

    // ✅ 左サイドバーなので無制限にしない（重い場合の保険）
    return byTax.slice(0, 240);
  }, [modelsByTab, q, selectedType, selectedSubType, selectedGroupLabel, makeSearchText]);

  // ✅ D&D payload（ViewportPanel が読む application/json）
  const buildDragPayload = useCallback(
    (m) => {
      const modelId = m?.id;
      const displayName = getItemDisplayLabel(
        { id: modelId, modelId, name: m?.name, title: m?.title },
        modelTitleMap
      );

      return {
        ...m, // Provide raw data for resolveGlbRaw to find the URL
        kind: "model",
        dragId: `drag_${modelId || "unknown"}_${Date.now()}`,
        modelId,
        label: displayName || modelId,
        name: displayName || modelId,
        brand: m?.brand || "",
        ownerHandle: m?.ownerHandle || "",
        source: tab === "project" ? "project" : "public",
        type: getModelType(m) || selectedType,
        subType: getModelSubType(m) || (selectedType === TYPES.ARCHITECTURE ? selectedSubType : ""),
        group: getModelGroupLabel(m) || (selectedGroupLabel !== "__ALL__" ? selectedGroupLabel : ""),
        thumbUrl: m?.thumbUrl || m?.thumbnailUrl || null,
      };
    },
    [tab, selectedType, selectedSubType, selectedGroupLabel, modelTitleMap]
  );

  const handleDragStart = useCallback(
    (e, m) => {
      if (!e?.dataTransfer) return;
      const payload = buildDragPayload(m);
      if (!payload.modelId) return;

      try {
        const jsonString = JSON.stringify(payload);
        e.dataTransfer.setData("application/json", jsonString);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", jsonString);

        // Visual feedback
        if (e.currentTarget) {
          e.currentTarget.dataset.dragging = "true";
        }
      } catch (err) {
        console.warn("[ModelLibraryPanel] dragStart failed:", err);
      }
    },
    [buildDragPayload]
  );

  const handleDragEnd = useCallback((e) => {
    if (e.currentTarget) {
      e.currentTarget.dataset.dragging = "false";
      e.currentTarget.removeAttribute("data-dragging");
    }
  }, []);

  // -------------------------
  // styles（Twinmotion寄せ）
  // -------------------------
  const panelSx = useMemo(
    () => ({
      borderRadius: 0,
      p: 0,
      minHeight: 0,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      width: "100%",
      background: "transparent",
      borderColor: "transparent",
      boxShadow: "none",
    }),
    []
  );

  const headerAreaSx = useMemo(
    () => ({
      px: 1,
      pt: 1,
      pb: 0.5,
      position: "sticky",
      top: 0,
      zIndex: 2,
      background: "transparent",
      backdropFilter: "blur(10px)",
      borderBottom: `1px solid ${alpha("#fff", 0.05)}`,
    }),
    []
  );

  const scopeToggleSx = useCallback(
    (active) => ({
      width: 28,
      height: 28,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "50%",
      background: active ? alpha(theme.palette.primary.main, 0.8) : "transparent",
      color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
      cursor: "pointer",
      transition: "all 0.15s ease",
      "&:hover": {
        background: active ? alpha(theme.palette.primary.main, 1) : alpha("#fff", 0.1),
        color: "var(--brand-fg)",
      },
    }),
    [theme]
  );

  const typeToggleSx = useCallback(
    (active) => ({
      flex: 1,
      height: 28,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 1.5,
      background: active ? alpha("#fff", 0.15) : "transparent",
      color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
      cursor: "pointer",
      transition: "all 0.15s ease",
      "&:hover": {
        background: active ? alpha("#fff", 0.2) : alpha("#fff", 0.08),
        color: "var(--brand-fg)",
      },
    }),
    []
  );

  const categoryIconTileSx = useCallback(
    (active) => ({
      width: 32,
      height: 32,
      flexShrink: 0,
      borderRadius: 2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: active ? alpha(theme.palette.primary.main, 0.2) : alpha("#000", 0.2),
      border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.4) : alpha("#fff", 0.05)}`,
      color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 50%, transparent)",
      cursor: "pointer",
      transition: "all 0.15s ease",
      "&:hover": {
        background: active ? alpha(theme.palette.primary.main, 0.3) : alpha("#000", 0.4),
        borderColor: active ? theme.palette.primary.main : alpha("#fff", 0.15),
        transform: "scale(1.05)",
        color: "var(--brand-fg)",
      },
    }),
    [theme]
  );

  const subTypeChipSx = useCallback(
    (active) => ({
      height: 22,
      fontSize: 10.5,
      fontWeight: 700,
      px: 0.5,
      borderRadius: 999,
      background: active ? alpha(theme.palette.primary.main, 0.2) : "transparent",
      border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.4) : alpha("#fff", 0.1)}`,
      color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 50%, transparent)",
      cursor: "pointer",
      transition: "all 0.15s ease",
      "&:hover": {
        borderColor: alpha("#fff", 0.3),
        color: "var(--brand-fg)",
      },
    }),
    [theme]
  );

  const modelCardSx = useCallback(
    (active) => ({
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: 2,
      background: active ? alpha(theme.palette.primary.main, 0.15) : alpha("#000", 0.2),
      border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.3) : alpha("#fff", 0.05)}`,
      overflow: "hidden",
      cursor: "grab",
      userSelect: "none",
      transition: "all 0.15s ease",
      position: "relative",
      "&:active": { cursor: "grabbing" },
      "&:hover": {
        borderColor: alpha(theme.palette.primary.main, 0.4),
        transform: "scale(1.02)",
      },
      "&[data-dragging='true']": {
        opacity: 0.5,
      }
    }),
    [theme]
  );

  const subTypesForSelected = useMemo(() => safeArray(SUBTYPES?.[selectedType]), [selectedType]);

  return (
    <Paper variant="outlined" sx={panelSx}>
      {/* ===================================== */}
      {/* ① Top Bar (最少構成サーチ＋スコープ) */}
      {/* ===================================== */}
      <Box sx={headerAreaSx}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Search Input */}
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 16, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: 32,
                  fontSize: 12,
                  color: "var(--brand-fg)",
                  background: "color-mix(in srgb, var(--brand-bg) 30%, transparent)",
                  borderRadius: 2,
                  "& fieldset": { border: "none" },
                  "&:hover fieldset": { border: "none" },
                  "&.Mui-focused fieldset": { border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}` },
                },
                "& .MuiInputBase-input::placeholder": {
                  color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)",
                  opacity: 1,
                },
              }}
            />

            {/* Scope Toggle (All / Project) */}
            <Stack
              direction="row"
              spacing={0.25}
              sx={{
                p: 0.25,
                background: "color-mix(in srgb, var(--brand-bg) 30%, transparent)",
                borderRadius: 999,
              }}
            >
              <Tooltip title="All Models" placement="bottom" arrow>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTabChange(null, "all")}
                  sx={scopeToggleSx(tab === "all")}
                >
                  <PublicRoundedIcon sx={{ fontSize: 16 }} />
                </Box>
              </Tooltip>
              <Tooltip title="Project Models" placement="bottom" arrow>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTabChange(null, "project")}
                  sx={scopeToggleSx(tab === "project")}
                >
                  <DashboardRoundedIcon sx={{ fontSize: 16 }} />
                </Box>
              </Tooltip>
            </Stack>
          </Stack>

          {/* ===================================== */}
          {/* ② Category Section (アイコンのみ) */}
          {/* ===================================== */}
          {/* Root Type Toggle (Furniture / Architecture) */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              p: 0.5,
              background: "color-mix(in srgb, var(--brand-bg) 20%, transparent)",
              borderRadius: 2,
            }}
          >
            <Tooltip title="Furniture" placement="bottom" arrow>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => handleSelectType(TYPES.FURNITURE)}
                sx={typeToggleSx(selectedType === TYPES.FURNITURE)}
              >
                <WeekendRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
            </Tooltip>
            <Tooltip title="Architecture" placement="bottom" arrow>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => handleSelectType(TYPES.ARCHITECTURE)}
                sx={typeToggleSx(selectedType === TYPES.ARCHITECTURE)}
              >
                <HomeRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
            </Tooltip>
          </Stack>

          {/* SubTypes (if architecture) */}
          {selectedType === TYPES.ARCHITECTURE && subTypesForSelected.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ overflowX: "auto", pb: 0.25, '&::-webkit-scrollbar': { display: 'none' } }}>
              {subTypesForSelected.map((st) => (
                <Box
                  key={st}
                  component="span"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectSubType(st)}
                  sx={{
                    ...subTypeChipSx(st === selectedSubType),
                    display: 'inline-flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {st}
                </Box>
              ))}
            </Stack>
          )}

          {/* Groups Horizontal Icon Scroll */}
          <Stack 
            direction="row" 
            spacing={0.75} 
            sx={{ 
              overflowX: "auto", 
              py: 0.5,
              mx: -1,
              px: 1,
              "&::-webkit-scrollbar": { height: 4 },
              "&::-webkit-scrollbar-thumb": { background: alpha("#fff", 0.1), borderRadius: 2 },
            }}
          >
            <Tooltip title="All Categories" placement="top" arrow>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGroupLabel("__ALL__")}
                sx={categoryIconTileSx(selectedGroupLabel === "__ALL__")}
              >
                <CategoryRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
            </Tooltip>
            {groupLabels.map((g) => {
              const active = g === selectedGroupLabel;
              const icon = getGroupIconByLabel(
                selectedType,
                selectedType === TYPES.ARCHITECTURE ? selectedSubType : "",
                g
              );
              return (
                <Tooltip title={g} placement="top" arrow key={g}>
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedGroupLabel(g)}
                    sx={categoryIconTileSx(active)}
                  >
                    {React.cloneElement(icon, { sx: { fontSize: 18 } })}
                  </Box>
                </Tooltip>
              );
            })}
          </Stack>
        </Stack>
      </Box>

      {/* ===================================== */}
      {/* ③ Model Grid (100% サムネイル主体) */}
      {/* ===================================== */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: 1, py: 1 }}>
        {loadingAny ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={24} sx={{ color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }} />
          </Box>
        ) : filtered.length === 0 ? (
          // 空状態も文字を極力減らし、アイコンと薄いテキストのみ
          <Stack alignItems="center" justifyContent="center" sx={{ height: 100, opacity: 0.3 }}>
            <Inventory2RoundedIcon sx={{ fontSize: 32, mb: 1 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>No Elements Found</Typography>
          </Stack>
        ) : (
          <Grid container spacing={0.75}>
            {filtered.map((m) => {
              const modelId = m?.id;
              if (!modelId) return null;

              const inPlan = planIds.has(modelId);
              const thumbUrl = m?.thumbUrl || m?.thumbnailUrl || null;

              const displayName = getItemDisplayLabel(
                { id: modelId, modelId, name: m?.name, title: m?.title },
                modelTitleMap
              );

              // Selection state check
              const isSelected = selection?.kind === "libraryModel" && selection?.model?.id === modelId;

              return (
                <Grid item xs={6} key={modelId}>
                  <Box
                    className="model-card-wrapper"
                    draggable
                    onDragStart={(e) => handleDragStart(e, m)}
                    onDragEnd={handleDragEnd}
                    onMouseEnter={() => {
                      console.log("Hovered card:", modelId);
                      setHoveredId(modelId);
                    }}
                    onMouseLeave={() => {
                      console.log("Un-hovered card:", modelId);
                      setHoveredId(null);
                    }}
                    onPointerDown={(e) => {
                      const tgt = e.currentTarget;
                      tgt.dataset.startX = String(e.clientX);
                      tgt.dataset.startY = String(e.clientY);
                    }}
                    onPointerUp={(e) => {
                      const tgt = e.currentTarget;
                      const startX = parseFloat(tgt.dataset.startX || "0");
                      const startY = parseFloat(tgt.dataset.startY || "0");
                      const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
                      
                      if (dist < 5) {
                        setSelection({ kind: "libraryModel", model: m });
                      }
                    }}
                    sx={modelCardSx(isSelected || inPlan)}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {/* Background Wrapper (Same as PopulatePanel) */}
                    <Box sx={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 0 }}>
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={displayName || modelId}
                          style={{ 
                            width: "100%", 
                            height: "100%", 
                            objectFit: "contain",
                          }}
                          draggable={false}
                        />
                      ) : (
                        <Stack alignItems="center" justifyContent="center" sx={{ width: "100%", height: "100%", opacity: 0.3 }}>
                          <Inventory2RoundedIcon sx={{ fontSize: 24, mb: 0.5 }} />
                          <Typography sx={{ fontSize: 9, fontWeight: 800, textAlign: "center", px: 0.5, lineHeight: 1.1 }} title={displayName || modelId}>
                            {String(displayName || "MODEL").slice(0, 16)}
                          </Typography>
                        </Stack>
                      )}
                    </Box>

                    {/* ✅ Add to Layout Button Overlay (Forced Always Visible for Debugging) */}
                    <Box
                      className="add-btn-overlay"
                      sx={{
                        position: "absolute",
                        top: 4,
                        left: 4,
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
                        zIndex: 9999, // Overkill z-index to break through everything
                        transition: "all 0.2s ease",
                        opacity: 1, // FORCE ALWAYS ON
                        transform: "scale(1)",
                        pointerEvents: "auto",
                        "&:hover": {
                          transform: "scale(1.1)",
                        }
                      }}
                      onPointerDown={(e) => e.stopPropagation()} // prevent card selection
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (loadingCardId === modelId) return;
                        setLoadingCardId(modelId);
                        // 100% force clear hover so it doesn't get stuck after placement
                        setHoveredId(null);
                        const payload = buildDragPayload(m);
                        console.log("[ModelLibraryPanel] 🔵 Dispatched add-model-to-layout via Button:", payload);
                        window.dispatchEvent(new CustomEvent("add-model-to-layout", { 
                          detail: {
                            ...payload,
                            _onComplete: () => setLoadingCardId(null)
                          }
                        }));
                      }}
                      title={loadingCardId === modelId ? "Loading..." : "Add to Layout"}
                    >
                      {loadingCardId === modelId ? (
                         <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                             <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                           </svg>
                         </Box>
                      ) : (
                         <AddRoundedIcon sx={{ fontSize: 16 }} />
                      )}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Paper>
  );
}
