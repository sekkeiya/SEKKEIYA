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

import { usePublicModels } from "@layout/features/layout/hooks/usePublicModels";
import { useWorkspaceModelRefs } from "@layout/features/layout/hooks/useWorkspaceModelRefs";

// ✅ 3DSS taxonomy
import { TYPES, getCategoryTree, SUBTYPES } from "@layout/shared/data/Categories";

// ✅ 共通：モデル名補完 & 表示名
import { useModelTitleMap } from "@layout/features/layout/hooks/useModelTitleMap";
import { getItemDisplayLabel } from "@layout/features/layout/utils/labels/itemLabelUtils";

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
        e.dataTransfer.setData("application/json", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", payload.modelId);
      } catch (err) {
        console.warn("[ModelLibraryPanel] dragStart failed:", err);
      }
    },
    [buildDragPayload]
  );

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
      background: alpha("#0b1020", 0.72),
      borderColor: alpha("#ffffff", 0.10),
      boxShadow: "none",
    }),
    []
  );

  const headerAreaSx = useMemo(
    () => ({
      px: 1.25,
      pt: 1.1,
      pb: 1,
      position: "sticky",
      top: 0,
      zIndex: 2,
      background: alpha("#0b1020", 0.92),
      backdropFilter: "blur(10px)",
      borderBottom: `1px solid ${alpha("#fff", 0.08)}`,
    }),
    []
  );

  const chipSx = useMemo(
    () => ({
      height: 20,
      fontSize: 10.5,
      background: alpha("#fff", 0.08),
      border: `1px solid ${alpha("#fff", 0.12)}`,
      color: alpha("#fff", 0.92),
      "& .MuiChip-label": { px: 0.9 },
    }),
    []
  );

  const typeBtnSx = useCallback(
    (active) => ({
      borderRadius: 1.6,
      px: 1.0,
      py: 0.7,
      display: "flex",
      alignItems: "center",
      gap: 0.7,
      background: alpha("#000", active ? 0.22 : 0.12),
      border: `1px solid ${alpha("#fff", active ? 0.16 : 0.08)}`,
      color: active ? "#fff" : alpha("#fff", 0.82),
      cursor: "pointer",
      userSelect: "none",
      "&:hover": {
        background: alpha("#000", 0.20),
        borderColor: alpha(theme.palette.primary.main, 0.22),
      },
    }),
    [theme]
  );

  const iconTileSx = useCallback(
    (active) => ({
      width: "100%",
      borderRadius: 1.6,
      p: 0.9,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: alpha("#000", active ? 0.22 : 0.12),
      border: `1px solid ${alpha("#fff", active ? 0.16 : 0.08)}`,
      color: active ? "#fff" : alpha("#fff", 0.82),
      "&:hover": {
        background: alpha("#000", 0.20),
        borderColor: alpha(theme.palette.primary.main, 0.22),
      },
    }),
    [theme]
  );

  const modelCardSx = useCallback(
    (active) => ({
      borderRadius: 1.8,
      p: 1,
      background: alpha("#000", active ? 0.22 : 0.12),
      border: `1px solid ${alpha("#fff", active ? 0.16 : 0.08)}`,
      cursor: "grab",
      userSelect: "none",
      "&:active": { cursor: "grabbing" },
      "&:hover": {
        background: alpha("#000", 0.20),
        borderColor: alpha(theme.palette.primary.main, 0.22),
      },
    }),
    [theme]
  );

  const thumbBoxSx = useMemo(
    () => ({
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: 1.4,
      background: alpha("#fff", 0.06),
      border: `1px solid ${alpha("#fff", 0.10)}`,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: alpha("#fff", 0.65),
      fontWeight: 900,
      fontSize: 12,
    }),
    []
  );

  const subTypesForSelected = useMemo(() => safeArray(SUBTYPES?.[selectedType]), [selectedType]);

  return (
    <Paper variant="outlined" sx={panelSx}>
      {/* Header (sticky) */}
      <Box sx={headerAreaSx}>
        <Stack spacing={0.9}>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 13.5, letterSpacing: 0.2 }}>
              Library
            </Typography>
            <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.15 }}>
              カテゴリ → モデルをドラッグ＆ドロップ
            </Typography>
          </Box>

          {/* All / Project tabs */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Tabs
              value={tab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons={false}
              sx={{
                minHeight: 32,
                "& .MuiTab-root": {
                  minHeight: 32,
                  textTransform: "none",
                  fontWeight: 900,
                  fontSize: 12,
                  px: 1.0,
                  borderRadius: 1.5,
                  color: alpha("#fff", 0.78),
                },
                "& .Mui-selected": { color: "#fff" },
                "& .MuiTabs-indicator": { height: 0 },
              }}
            >
              <Tab
                value="all"
                disableRipple
                icon={<PublicRoundedIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label="All"
                sx={{
                  mr: 0.6,
                  background: tab === "all" ? alpha("#fff", 0.10) : alpha("#fff", 0.06),
                  border: `1px solid ${tab === "all" ? alpha("#fff", 0.16) : alpha("#fff", 0.10)}`,
                }}
              />
              <Tab
                value="project"
                disableRipple
                icon={<DashboardRoundedIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label="Project"
                sx={{
                  background: tab === "project" ? alpha(theme.palette.primary.main, 0.18) : alpha("#fff", 0.06),
                  border: `1px solid ${
                    tab === "project" ? alpha(theme.palette.primary.main, 0.32) : alpha("#fff", 0.10)
                  }`,
                }}
              />
            </Tabs>

            <Box sx={{ flex: 1 }} />
            {loadingAny ? <CircularProgress size={16} /> : null}
          </Stack>

          {/* Search */}
          <TextField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "project" ? "Search project models…" : "Search all models…"}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                height: 36,
                background: alpha("#000", 0.16),
              },
            }}
          />

          {/* Stats */}
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            <Chip size="small" sx={chipSx} label={`All: ${totalAll}`} />
            <Chip size="small" sx={chipSx} label={`In Project: ${totalInProject}`} />
            <Chip
              size="small"
              sx={{
                ...chipSx,
                background: alpha(theme.palette.primary.main, 0.16),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
              }}
              label={`In Plan: ${totalInPlan}`}
            />
          </Stack>

          {/* Type switch */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box
              role="button"
              tabIndex={0}
              sx={typeBtnSx(selectedType === TYPES.FURNITURE)}
              onClick={() => handleSelectType(TYPES.FURNITURE)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelectType(TYPES.FURNITURE);
              }}
            >
              <WeekendRoundedIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>家具</Typography>
            </Box>

            <Box
              role="button"
              tabIndex={0}
              sx={typeBtnSx(selectedType === TYPES.ARCHITECTURE)}
              onClick={() => handleSelectType(TYPES.ARCHITECTURE)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelectType(TYPES.ARCHITECTURE);
              }}
            >
              <HomeRoundedIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>建築</Typography>
            </Box>

            <Box sx={{ flex: 1 }} />

            <Chip
              size="small"
              sx={{
                ...chipSx,
                background: alpha("#fff", 0.06),
                border: `1px solid ${alpha("#fff", 0.10)}`,
              }}
              label={`showing: ${filtered.length}`}
            />
          </Stack>

          {/* SubType (architecture only) */}
          {selectedType === TYPES.ARCHITECTURE ? (
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.25 }}>
              {subTypesForSelected.map((st) => {
                const active = st === selectedSubType;
                return (
                  <Chip
                    key={st}
                    size="small"
                    clickable
                    onClick={() => handleSelectSubType(st)}
                    sx={{
                      height: 24,
                      fontSize: 11.5,
                      fontWeight: 900,
                      borderRadius: 999,
                      background: alpha("#000", active ? 0.22 : 0.10),
                      border: `1px solid ${alpha("#fff", active ? 0.16 : 0.08)}`,
                      color: active ? "#fff" : alpha("#fff", 0.82),
                    }}
                    label={st}
                  />
                );
              })}
            </Stack>
          ) : null}
        </Stack>
      </Box>

      {/* Body */}
      <Box sx={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", overflowX: "hidden" }}>
        {/* Group icon grid */}
        <Box sx={{ px: 1, pt: 1, pb: 0.75 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 12.5, opacity: 0.9, mb: 0.8 }}>
            Categories
          </Typography>

          <Grid container spacing={0.75}>
            {/* All */}
            <Grid item xs={3}>
              <Tooltip title="All" placement="top" arrow>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedGroupLabel("__ALL__")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedGroupLabel("__ALL__");
                  }}
                  sx={iconTileSx(selectedGroupLabel === "__ALL__")}
                >
                  <CategoryRoundedIcon sx={{ fontSize: 20 }} />
                </Box>
              </Tooltip>
            </Grid>

            {/* Groups from TAXONOMY */}
            {groupLabels.map((g) => {
              const active = g === selectedGroupLabel;
              const icon = getGroupIconByLabel(
                selectedType,
                selectedType === TYPES.ARCHITECTURE ? selectedSubType : "",
                g
              );

              return (
                <Grid item xs={3} key={g}>
                  <Tooltip title={g} placement="top" arrow>
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedGroupLabel(g)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedGroupLabel(g);
                      }}
                      sx={iconTileSx(active)}
                    >
                      {React.cloneElement(icon, { sx: { fontSize: 20 } })}
                    </Box>
                  </Tooltip>
                </Grid>
              );
            })}
          </Grid>

          <Typography sx={{ mt: 0.9, opacity: 0.65, fontSize: 11.5 }}>
            選択中: <b>{selectedGroupLabel === "__ALL__" ? "All" : selectedGroupLabel}</b>
            {selectedType === TYPES.ARCHITECTURE && selectedSubType ? <>（{selectedSubType}）</> : null}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.06) }} />

        {/* Models grid */}
        <Box sx={{ px: 1, py: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5, opacity: 0.9 }}>Models</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ opacity: 0.55, fontSize: 11.5 }}>Drag → Viewport</Typography>
          </Stack>

          {loadingAny ? (
            <Typography sx={{ opacity: 0.7, fontSize: 12.5 }}>loading models...</Typography>
          ) : filtered.length === 0 ? (
            <Box
              sx={{
                borderRadius: 1.75,
                p: 1.1,
                background: alpha("#000", 0.12),
                border: `1px solid ${alpha("#fff", 0.08)}`,
              }}
            >
              <Typography sx={{ fontWeight: 900, fontSize: 12.8 }}>該当モデルがありません</Typography>
              <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.35 }}>
                カテゴリ/検索/All-Project/Type/SubType を変えてください。
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={0.75}>
              {filtered.map((m) => {
                const modelId = m?.id;
                if (!modelId) return null;

                const inBoard = workspaceIds.has(modelId);
                const inPlan = planIds.has(modelId);

                const thumbUrl = m?.thumbUrl || m?.thumbnailUrl || null;

                const displayName = getItemDisplayLabel(
                  { id: modelId, modelId, name: m?.name, title: m?.title },
                  modelTitleMap
                );

                return (
                  <Grid item xs={6} key={modelId}>
                    <Box
                      draggable
                      onDragStart={(e) => handleDragStart(e, m)}
                      sx={modelCardSx(inPlan)}
                      title="Drag to Viewport"
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <Box sx={thumbBoxSx}>
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={displayName || modelId}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            draggable={false}
                          />
                        ) : (
                          <Box sx={{ textAlign: "center", px: 1 }}>
                            <Typography sx={{ fontWeight: 900, fontSize: 12 }} noWrap>
                              {String(displayName || "MODEL").slice(0, 12)}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                        <Stack direction="row" spacing={0.6} alignItems="center">
                          <Typography sx={{ fontWeight: 900, fontSize: 12.3 }} noWrap>
                            {displayName || modelId}
                          </Typography>

                          {inPlan ? (
                            <Chip
                              size="small"
                              label="Plan"
                              sx={{
                                height: 18,
                                fontSize: 10.5,
                                background: alpha(theme.palette.primary.main, 0.22),
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.38)}`,
                              }}
                            />
                          ) : inBoard ? (
                            <Chip
                              size="small"
                              label="Project"
                              sx={{
                                height: 18,
                                fontSize: 10.5,
                                background: alpha("#fff", 0.08),
                                border: `1px solid ${alpha("#fff", 0.12)}`,
                              }}
                            />
                          ) : null}
                        </Stack>

                        <Typography sx={{ opacity: 0.72, fontSize: 11.5 }} noWrap>
                          {m?.brand ? `${m.brand}` : "—"} {m?.ownerHandle ? `• @${m.ownerHandle}` : ""}
                        </Typography>

                        <Typography sx={{ opacity: 0.55, fontSize: 10.8 }} noWrap>
                          {selectedType === TYPES.ARCHITECTURE ? `建築 / ${selectedSubType || "—"}` : "家具"}
                          {selectedGroupLabel !== "__ALL__" ? ` / ${selectedGroupLabel}` : ""}
                        </Typography>

                        <Typography sx={{ opacity: 0.45, fontSize: 10.8 }} noWrap>
                          id: {String(modelId).slice(0, 14)}…
                        </Typography>
                      </Stack>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          )}

          <Typography sx={{ opacity: 0.5, fontSize: 11.5, mt: 1 }}>
            ※ 現状は「モデル側の type/subType/group の保存状況」に依存します。未保存でも壊れないように緩めに判定しています。
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
