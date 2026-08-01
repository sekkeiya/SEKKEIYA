import React, { useMemo, useCallback } from "react";
import { Box, Stack, Typography, Divider, Chip, TextField, CircularProgress, Checkbox, FormControlLabel, Switch } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../../../../../../lib/firebase/client";
import EditItemDialog from "./EditItemDialog";
import { DISPLAY_TO_DATA, dataToDisplayVec3 } from "../../../../../utils/axisConvention";
import { useEditorModeStore } from "../../../../../store/useEditorModeStore";
import { usePlanModelOverridesStore } from "../../../../../store/planModelOverridesStore";
import { resolveModelOverride } from "../../../../../utils/planModelOverrides";
import { setPlanModelOverride } from "../../../../../api/planModelOverridesApi";

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

  // ── このプランでの提案候補（プラン別上書き。仕様: 2026-08-01-plan-model-overrides-design.md §6）──
  const planCtx = useEditorModeStore((s) => s.dslPlanContext);
  const overrideChain = usePlanModelOverridesStore((s) => s.chain);
  // 現在の層（開いているプラン doc）に既にあるエントリ。無ければ null。
  const currentLayerOverride = useMemo(() => {
    if (!modelId) return null;
    const cur = overrideChain[0];
    return cur?.modelOverrides?.[modelId] || null;
  }, [overrideChain, modelId]);
  // チェーン全体で効いている上書き（親プラン由来の可能性がある）。
  const effectiveOverride = useMemo(
    () => (modelId ? resolveModelOverride(overrideChain, modelId) : null),
    [overrideChain, modelId]
  );
  const inheritedFromParent = !!effectiveOverride && !currentLayerOverride;

  // デフォルト候補（グローバル資産の materialVariants / swapModels）。
  const defaultVariants = Array.isArray(globalAsset?.materialVariants) ? globalAsset.materialVariants : [];
  const defaultSwaps = Array.isArray(globalAsset?.extendedMetadata?.swapModels) ? globalAsset.extendedMetadata.swapModels : [];

  const saveOverride = useCallback(async (next) => {
    if (!planCtx?.projectId || !planCtx?.planId || !modelId) return;
    // 正規化: 全選択（=絞り込みなし）はフィールドを外す。全フィールド未設定なら解除。
    const norm = { ...next };
    if (Array.isArray(norm.materialVariantIds) &&
        (norm.materialVariantIds.length === 0 || norm.materialVariantIds.length === defaultVariants.length)) {
      delete norm.materialVariantIds;
    }
    if (Array.isArray(norm.swapModelIds) &&
        (norm.swapModelIds.length === 0 || norm.swapModelIds.length === defaultSwaps.length)) {
      delete norm.swapModelIds;
    }
    if (norm.anim === undefined) delete norm.anim;
    const isEmpty = Object.keys(norm).length === 0;
    try {
      await setPlanModelOverride(planCtx.projectId, planCtx.workspaceId, planCtx.planId, modelId, isEmpty ? null : norm);
    } catch (e) {
      console.error("[PropertiesModelPanel] プラン上書きの保存に失敗", e);
    }
  }, [planCtx, modelId, defaultVariants.length, defaultSwaps.length]);

  const toggleId = useCallback((field, id, allIds) => {
    const base = currentLayerOverride?.[field] ?? effectiveOverride?.[field] ?? allIds; // 未設定=全選択から開始
    const set = new Set(base.map(String));
    if (set.has(String(id))) set.delete(String(id)); else set.add(String(id));
    void saveOverride({ ...(currentLayerOverride || effectiveOverride || {}), [field]: allIds.filter((x) => set.has(String(x))) });
  }, [currentLayerOverride, effectiveOverride, saveOverride]);

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
      background: "color-mix(in srgb, var(--brand-bg) 14%, transparent)",
      border: `1px solid ${alpha("#fff", 0.10)}`,
    }),
    []
  );

  const fieldSx = useMemo(
    () => ({
      "& .MuiInputBase-root": {
        height: 34,
        borderRadius: 1.6,
        background: "color-mix(in srgb, var(--brand-bg) 18%, transparent)",
        border: `1px solid ${alpha("#fff", 0.10)}`,
        color: "color-mix(in srgb, var(--brand-fg) 92%, transparent)",
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
                <CircularProgress size={10} sx={{ color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }} />
                <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", fontWeight: 700 }}>SYNCING</Typography>
              </Stack>
            )}
          </Box>
          <Box sx={{ ...boxSx, mb: 1.25, display: "flex", gap: 1 }}>
            {displayItem.thumbUrl ? (
              <Box sx={{ width: 64, height: 64, borderRadius: 1, overflow: "hidden", bgcolor: "color-mix(in srgb, var(--brand-bg) 20%, transparent)", flexShrink: 0 }}>
                <img src={displayItem.thumbUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="thumb" />
              </Box>
            ) : (
              <Box sx={{ width: 64, height: 64, borderRadius: 1, bgcolor: "color-mix(in srgb, var(--brand-bg) 20%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Inventory2RoundedIcon sx={{ opacity: 0.3 }} />
              </Box>
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "var(--brand-fg)", lineHeight: 1.2, mb: 0.5, wordBreak: "break-all" }}>
                {displayItem.title || "Unnamed Model"}
              </Typography>
              <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }}>
                {displayItem.brand || ""}{displayItem.ownerHandle ? ` @${displayItem.ownerHandle}` : ""}
              </Typography>
              {displayItem.dimensionsMm && (
                <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", mt: 0.5 }}>
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
              color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
              "& .MuiChip-icon": { color: "light-dark(#0875a6, #4fc3f7)" },
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
                color: "color-mix(in srgb, var(--brand-fg) 92%, transparent)", "&:hover": { background: alpha("#fff", 0.08) },
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
                color: "color-mix(in srgb, var(--brand-fg) 92%, transparent)", "&:hover": { background: alpha("#fff", 0.08) },
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

      {/* ===== このプランでの提案候補（プラン別上書き） ===== */}
      {!isMulti && (defaultVariants.length > 0 || defaultSwaps.length > 0 || !!globalAsset?.extendedMetadata?.anim) && (
        <Box sx={{ mt: 1.5 }}>
          <Divider sx={{ mb: 1, borderColor: alpha("#fff", 0.08) }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>このプランでの提案候補</Typography>
          {inheritedFromParent && (
            <Typography sx={{ fontSize: 10.5, color: "warning.main", mb: 0.5 }}>
              親プランの設定を引き継いでいます。変更するとこのプラン専用の設定になります。
            </Typography>
          )}
          {defaultVariants.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 11, opacity: 0.7 }}>素材パターン</Typography>
              {defaultVariants.map((v) => {
                const ids = currentLayerOverride?.materialVariantIds ?? effectiveOverride?.materialVariantIds;
                const checked = !Array.isArray(ids) || ids.map(String).includes(String(v.id));
                return (
                  <FormControlLabel
                    key={v.id}
                    sx={{ display: "block", ml: 0, "& .MuiTypography-root": { fontSize: 12 } }}
                    control={<Checkbox size="small" checked={checked}
                      onChange={() => toggleId("materialVariantIds", v.id, defaultVariants.map((x) => String(x.id)))} />}
                    label={v.title || "パターン"}
                  />
                );
              })}
            </Box>
          )}
          {defaultSwaps.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 11, opacity: 0.7 }}>置き換え候補</Typography>
              {defaultSwaps.map((s) => {
                const ids = currentLayerOverride?.swapModelIds ?? effectiveOverride?.swapModelIds;
                const checked = !Array.isArray(ids) || ids.map(String).includes(String(s.id));
                return (
                  <FormControlLabel
                    key={s.id}
                    sx={{ display: "block", ml: 0, "& .MuiTypography-root": { fontSize: 12 } }}
                    control={<Checkbox size="small" checked={checked}
                      onChange={() => toggleId("swapModelIds", s.id, defaultSwaps.map((x) => String(x.id)))} />}
                    label={s.title || s.id}
                  />
                );
              })}
            </Box>
          )}
          {!!globalAsset?.extendedMetadata?.anim && (
            <FormControlLabel
              sx={{ ml: 0, "& .MuiTypography-root": { fontSize: 12 } }}
              control={<Switch size="small"
                checked={(currentLayerOverride ?? effectiveOverride)?.anim !== null}
                onChange={(e) => void saveOverride({ ...(currentLayerOverride || effectiveOverride || {}), anim: e.target.checked ? undefined : null })} />}
              label="常時アニメ（OFF=このプランでは切る）"
            />
          )}
        </Box>
      )}

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
