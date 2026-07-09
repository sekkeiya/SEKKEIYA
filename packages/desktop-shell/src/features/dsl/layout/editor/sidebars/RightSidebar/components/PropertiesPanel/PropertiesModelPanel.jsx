import React, { useMemo, useCallback } from "react";
import { Box, Stack, Typography, Divider, Chip, TextField, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../../../../../../lib/firebase/client";
import EditItemDialog from "./EditItemDialog";
import { DISPLAY_TO_DATA, dataToDisplayVec3 } from "../../../../../utils/axisConvention";

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

function toDeg(rad) {
  const n = Number(rad);
  if (!Number.isFinite(n)) return 0;
  return (n * 180) / Math.PI;
}
function toRad(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  return (n * Math.PI) / 180;
}

function fmt(n, digits = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  // 0.000 の "-0" 対策
  const s = x.toFixed(digits);
  return s === "-0.000" ? "0.000" : s;
}

function parseOr(prev, s) {
  // 途中入力（"-" や ""）は prev 維持
  const str = String(s ?? "");
  if (str.trim() === "" || str === "-" || str === "." || str === "-.") return prev;
  const n = Number(str);
  return Number.isFinite(n) ? n : prev;
}

export default function PropertiesModelPanel({
  selection,
  item, // ✅ 選択された配置 item（layoutDraft.items から引いたもの）
  selectedItemIds = [],
  onChangeTransform, // (nextTransform)=>void
  onChangeZone, // (zoneId)=>void  ※ 将来用に prop は残す
  onSelectMaterial, // (materialSelection)=>void（将来）
  onDeleteItems, // ()=>void
  onApplyDimensions, // (dims)=>void  選択インスタンスの寸法を上書き
  onApplyMaterials, // (bindings)=>void  選択インスタンスのマテリアル上書き
  onApplyActions, // ({gimmicks, anim})=>void  選択インスタンスの動き上書き
  onApplyInfo, // (info)=>void  選択インスタンスの情報上書き
}) {
  const theme = useTheme();
  const [editOpen, setEditOpen] = React.useState(false);

  const itemId = item?.id;
  const modelId = item?.modelId || null;
  const isMulti = selectedItemIds.length > 1;

  // Real-time sync for global asset metadata (Properties Panel Source of Truth)
  const [globalAsset, setGlobalAsset] = React.useState(null);
  const [assetSyncing, setAssetSyncing] = React.useState(false);

  React.useEffect(() => {
    if (!modelId || isMulti) {
      setGlobalAsset(null);
      setAssetSyncing(false);
      return;
    }
    setAssetSyncing(true);
    const ref = doc(db, "assets", modelId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setGlobalAsset({ id: snap.id, ...snap.data() });
      } else {
        setGlobalAsset(null);
      }
      setAssetSyncing(false);
    }, (err) => {
      console.warn("Global asset sync error:", err);
      setAssetSyncing(false);
    });
    return () => unsub();
  }, [modelId, isMulti]);

  // Merge the layout item snapshot with the real-time global asset data
  // Global asset takes precedence for deep metadata (brand, dimensions, ai, thumbUrl)
  const displayItem = useMemo(() => {
    if (!item) return null;
    if (isMulti || !globalAsset) return item;
    return {
      ...item,
      title: globalAsset.title || globalAsset.name || item.title,
      brand: globalAsset.brand || item.brand,
      ownerHandle: globalAsset.ownerHandle || item.ownerHandle,
      thumbUrl: globalAsset.thumbUrl || globalAsset.thumbnailUrl || globalAsset.coverUrl || item.thumbUrl,
      dimensionsMm: globalAsset.dimensions || item.dimensionsMm,
      ai: globalAsset.ai || item.ai,
      dimensionSource: globalAsset.dimensionSource || item.dimensionSource,
      group: globalAsset.group || globalAsset.category || item.group,
      subType: globalAsset.subType || item.subType,
      type: globalAsset.modelType || globalAsset.type || item.type,
    };
  }, [item, globalAsset, isMulti]);

  // 新規モデル保存に使う、取得可能な GLB URL（最新の globalAsset を優先）
  const sourceGlbUrl = useMemo(() => (
    globalAsset?.glbUrl || globalAsset?.downloadUrl ||
    item?.glbUrl || item?.modelGlbUrl || item?.downloadUrl || ""
  ), [globalAsset, item]);

  const t = displayItem?.transform || {};
  const position = useMemo(() => ensureVec3(t?.position, [0, 0, 0]), [t]);
  const rotationRad = useMemo(() => ensureVec3(t?.rotation, [0, 0, 0]), [t]);
  const scale = useMemo(() => ensureScale3(t?.scale), [t]);

  // Z-up 表示規約（共有: utils/axisConvention）。エンジンは Y-up のまま、表示のみ Z-up。
  const posDisplay = useMemo(() => dataToDisplayVec3(position), [position]);

  const rotationDeg = useMemo(
    () => rotationRad.map((r) => toDeg(r)),
    [rotationRad]
  );
  const rotDegDisplay = useMemo(() => dataToDisplayVec3(rotationDeg), [rotationDeg]);

  const headerSx = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 1,
      mb: 1,
    }),
    []
  );

  const sectionTitleSx = useMemo(
    () => ({
      fontWeight: 900,
      fontSize: 12.5,
      letterSpacing: 0.2,
    }),
    []
  );

  const smallSx = useMemo(
    () => ({
      opacity: 0.72,
      fontSize: 11.5,
    }),
    []
  );

  const boxSx = useMemo(
    () => ({
      borderRadius: 2,
      p: 1,
      background: alpha("#000", 0.14),
      border: `1px solid ${alpha("#fff", 0.10)}`,
    }),
    []
  );

  const fieldSx = useMemo(
    () => ({
      "& .MuiInputBase-root": {
        height: 34,
        borderRadius: 1.6,
        background: alpha("#000", 0.18),
        border: `1px solid ${alpha("#fff", 0.10)}`,
        color: alpha("#fff", 0.92),
      },
      "& input": { fontSize: 12.5, padding: "8px 10px" },
      "& .MuiOutlinedInput-notchedOutline": { border: "none" },
    }),
    []
  );

  const axisLabelSx = useMemo(
    () => ({
      width: 18,
      fontSize: 11,
      fontWeight: 900,
      opacity: 0.85,
    }),
    []
  );

  const updatePositionAxis = useCallback(
    (displayIdx, valueStr) => {
      const dataIdx = DISPLAY_TO_DATA[displayIdx];
      const prev = position[dataIdx];
      const nextVal = parseOr(prev, valueStr);
      const next = position.slice();
      next[dataIdx] = nextVal;
      onChangeTransform?.({
        position: next,
        rotation: rotationRad,
        scale,
      });
    },
    [position, rotationRad, scale, onChangeTransform]
  );

  const updateRotationAxisDeg = useCallback(
    (displayIdx, valueStr) => {
      const dataIdx = DISPLAY_TO_DATA[displayIdx];
      const prevDeg = rotationDeg[dataIdx];
      const nextDeg = parseOr(prevDeg, valueStr);
      const nextRad = rotationRad.slice();
      nextRad[dataIdx] = toRad(nextDeg);
      onChangeTransform?.({
        position,
        rotation: nextRad,
        scale,
      });
    },
    [position, rotationRad, rotationDeg, scale, onChangeTransform]
  );

  const resetPosition = useCallback(() => {
    onChangeTransform?.({ position: [0, 0, 0], rotation: rotationRad, scale });
  }, [onChangeTransform, rotationRad, scale]);

  const resetRotation = useCallback(() => {
    onChangeTransform?.({ position, rotation: [0, 0, 0], scale });
  }, [onChangeTransform, position, scale]);

  return (
    <Box>
      {/* ===== ヘッダー ===== */}
      <Box sx={headerSx}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 13.2 }} noWrap>
            {isMulti ? `Multiple Models (${selectedItemIds.length})` : (item?.title || "Model")}
          </Typography>
          {isMulti && (
            <Typography sx={smallSx} noWrap>Bulk editing enabled</Typography>
          )}
        </Box>
      </Box>

      <Divider sx={{ my: 1, borderColor: alpha("#fff", 0.08) }} />

      {/* ===== Item Info ===== */}
      {!isMulti && displayItem && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1, mb: 0.75 }}>
            <Typography sx={sectionTitleSx}>Item Info</Typography>
            {assetSyncing && !globalAsset && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <CircularProgress size={10} sx={{ color: alpha("#fff", 0.5) }} />
                <Typography sx={{ fontSize: 9, color: alpha("#fff", 0.5), fontWeight: 700 }}>SYNCING</Typography>
              </Stack>
            )}
          </Box>
          <Box sx={{ ...boxSx, mb: 1.25, display: "flex", gap: 1 }}>
            {displayItem.thumbUrl ? (
              <Box sx={{ width: 64, height: 64, borderRadius: 1, overflow: "hidden", bgcolor: alpha("#000", 0.2), flexShrink: 0 }}>
                <img src={displayItem.thumbUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="thumb" />
              </Box>
            ) : (
              <Box sx={{ width: 64, height: 64, borderRadius: 1, bgcolor: alpha("#000", 0.2), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Inventory2RoundedIcon sx={{ opacity: 0.3 }} />
              </Box>
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#fff", lineHeight: 1.2, mb: 0.5, wordBreak: "break-all" }}>
                {displayItem.title || "Unnamed Model"}
              </Typography>
              <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.6) }}>
                {displayItem.brand || ""}{displayItem.ownerHandle ? ` @${displayItem.ownerHandle}` : ""}
              </Typography>
              {displayItem.dimensionsMm && (
                <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.4), mt: 0.5 }}>
                  W{displayItem.dimensionsMm.width} D{displayItem.dimensionsMm.depth} H{displayItem.dimensionsMm.height}
                </Typography>
              )}
            </Box>
          </Box>

          {/* アイテムを編集（寸法を変更 / 新規モデルとして保存） */}
          <Chip
            size="small"
            clickable
            onClick={() => setEditOpen(true)}
            icon={<TuneRoundedIcon sx={{ fontSize: 14 }} />}
            label="アイテムを編集"
            sx={{
              width: "100%", justifyContent: "flex-start", height: 30, mb: 1.25,
              fontSize: 11.5, fontWeight: 900, borderRadius: 1,
              background: alpha("#4fc3f7", 0.14),
              border: `1px solid ${alpha("#4fc3f7", 0.38)}`,
              color: alpha("#cbeafe", 0.95),
              "& .MuiChip-icon": { color: "#4fc3f7" },
              "&:hover": { background: alpha("#4fc3f7", 0.24) },
            }}
          />

          <Divider sx={{ borderColor: alpha("#fff", 0.08), mb: 1.25 }} />

          <EditItemDialog
            open={editOpen}
            onClose={() => setEditOpen(false)}
            sourceAsset={globalAsset || displayItem}
            glbUrl={sourceGlbUrl}
            initialDimensions={displayItem.dimensionsMm}
            initialTitle={displayItem.title}
            initialMaterialBindings={item?.materialBindings || null}
            initialGimmicks={item?.gimmicks || null}
            initialAnim={item?.anim || null}
            initialInfo={item?.info || null}
            onApplyDimensions={onApplyDimensions}
            onApplyMaterials={onApplyMaterials}
            onApplyActions={onApplyActions}
            onApplyInfo={onApplyInfo}
          />
        </>
      )}

      {/* ===== Transform ===== */}
      <Typography sx={sectionTitleSx}>Transform</Typography>
      <Box sx={{ ...boxSx, mt: 0.75, mb: 1.25 }}>
        <Stack spacing={0.75}>

          {/* Position */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontWeight: 900, fontSize: 12.2 }}>Position</Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              clickable
              onClick={resetPosition}
              label="Reset"
              sx={{
                height: 20, fontSize: 10.5, fontWeight: 900, borderRadius: 999,
                background: alpha("#fff", 0.06), border: `1px solid ${alpha("#fff", 0.10)}`,
                color: alpha("#fff", 0.92), "&:hover": { background: alpha("#fff", 0.08) },
              }}
            />
          </Stack>
          <Stack direction="row" spacing={0.75}>
            {["X", "Y", "Z"].map((axisLabel, i) => (
              <Box key={`pos-${axisLabel}`} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography sx={axisLabelSx}>{axisLabel}</Typography>
                  <TextField
                    fullWidth size="small" sx={fieldSx}
                    value={fmt(posDisplay[i], 3)}
                    onChange={(e) => updatePositionAxis(i, e.target.value)}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

          {/* Rotation */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontWeight: 900, fontSize: 12.2 }}>Rotation</Typography>
            <Typography sx={{ fontSize: 11.2, opacity: 0.65 }}>deg</Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              clickable
              onClick={resetRotation}
              label="Reset"
              sx={{
                height: 20, fontSize: 10.5, fontWeight: 900, borderRadius: 999,
                background: alpha("#fff", 0.06), border: `1px solid ${alpha("#fff", 0.10)}`,
                color: alpha("#fff", 0.92), "&:hover": { background: alpha("#fff", 0.08) },
              }}
            />
          </Stack>
          <Stack direction="row" spacing={0.75}>
            {["X", "Y", "Z"].map((axisLabel, i) => (
              <Box key={`rot-${axisLabel}`} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography sx={axisLabelSx}>{axisLabel}</Typography>
                  <TextField
                    fullWidth size="small" sx={fieldSx}
                    value={fmt(rotDegDisplay[i], 2)}
                    onChange={(e) => updateRotationAxisDeg(i, e.target.value)}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>

        </Stack>
      </Box>

      <Divider sx={{ my: 1.25, borderColor: alpha("#fff", 0.08) }} />

      {/* ===== Delete ===== */}
      <Chip
        size="small"
        clickable
        onClick={onDeleteItems}
        icon={<DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />}
        label={isMulti ? "Delete Selected Items" : "Delete Item"}
        sx={{
          height: 28, fontSize: 11.5, fontWeight: 900, borderRadius: 1,
          background: alpha(theme.palette.error.main, 0.15),
          border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
          color: alpha(theme.palette.error.light, 0.9),
          "&:hover": { background: alpha(theme.palette.error.main, 0.25) },
        }}
      />
    </Box>
  );
}
