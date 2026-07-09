// src/features/layout/components/RightSidebar/components/PropertiesPanel/PropertiesModelPanel.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Stack, Typography, Divider, Chip, TextField, IconButton, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";

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
  onChangeTransform, // (nextTransform)=>void
  onSelectMaterial, // (materialSelection)=>void（将来）
}) {
  const theme = useTheme();

  const itemId = item?.id;

  const t = item?.transform || {};
  const position = useMemo(() => ensureVec3(t?.position, [0, 0, 0]), [t]);
  const rotationRad = useMemo(() => ensureVec3(t?.rotation, [0, 0, 0]), [t]);
  const scale = useMemo(() => ensureScale3(t?.scale), [t]);

  const rotationDeg = useMemo(
    () => rotationRad.map((r) => toDeg(r)),
    [rotationRad]
  );

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
    (axis, valueStr) => {
      const prev = position[axis];
      const nextVal = parseOr(prev, valueStr);
      const next = position.slice();
      next[axis] = nextVal;
      onChangeTransform?.({
        position: next,
        rotation: rotationRad,
        scale,
      });
    },
    [position, rotationRad, scale, onChangeTransform]
  );

  const updateRotationAxisDeg = useCallback(
    (axis, valueStr) => {
      const prevDeg = rotationDeg[axis];
      const nextDeg = parseOr(prevDeg, valueStr);
      const nextRad = rotationRad.slice();
      nextRad[axis] = toRad(nextDeg);
      onChangeTransform?.({
        position,
        rotation: nextRad,
        scale,
      });
    },
    [position, rotationRad, rotationDeg, scale, onChangeTransform]
  );

  const updateScaleAxis = useCallback(
    (axis, valueStr) => {
      const prev = scale[axis];
      let nextVal = parseOr(prev, valueStr);
      // scale は 0以下禁止（壊れ防止）
      if (!Number.isFinite(nextVal) || nextVal <= 0) nextVal = prev > 0 ? prev : 1;

      const next = scale.slice();
      next[axis] = nextVal;

      onChangeTransform?.({
        position,
        rotation: rotationRad,
        scale: next,
      });
    },
    [position, rotationRad, scale, onChangeTransform]
  );

  const resetTransform = useCallback(() => {
    onChangeTransform?.({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });
  }, [onChangeTransform]);

  const resetPosition = useCallback(() => {
    onChangeTransform?.({ position: [0, 0, 0], rotation: rotationRad, scale });
  }, [onChangeTransform, rotationRad, scale]);

  const resetRotation = useCallback(() => {
    onChangeTransform?.({ position, rotation: [0, 0, 0], scale });
  }, [onChangeTransform, position, scale]);

  const resetScale = useCallback(() => {
    onChangeTransform?.({ position, rotation: rotationRad, scale: [1, 1, 1] });
  }, [onChangeTransform, position, rotationRad]);

  const openMaterial = useCallback(
    (slotName) => {
      // 将来：TopBarのMaterialPicker選択と同じ selection にする
      onSelectMaterial?.({
        kind: "material",
        id: `${item?.id || "item"}:${slotName || "default"}`,
        ownerItemId: item?.id,
        slot: slotName || "default",
      });
    },
    [onSelectMaterial, item]
  );

  return (
    <Box>
      {/* header */}
      <Box sx={headerSx}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 13.2 }} noWrap>
            Model
          </Typography>
          <Typography sx={smallSx} noWrap>
            itemId: {String(itemId || "").slice(0, 14)}…
          </Typography>
        </Box>

        <Chip
          size="small"
          label="Item"
          sx={{
            height: 22,
            fontSize: 11,
            fontWeight: 900,
            borderRadius: 999,
            background: alpha(theme.palette.primary.main, 0.18),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.32)}`,
            color: "#fff",
          }}
        />

        <Tooltip title="Reset all" arrow>
          <IconButton
            size="small"
            onClick={resetTransform}
            sx={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${alpha("#fff", 0.10)}`,
              background: alpha("#000", 0.14),
              color: alpha("#fff", 0.9),
              "&:hover": { background: alpha("#000", 0.22) },
            }}
          >
            <RestartAltRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ my: 1, borderColor: alpha("#fff", 0.08) }} />

      {/* transform */}
      <Typography sx={sectionTitleSx}>Transform</Typography>

      <Box sx={{ ...boxSx, mt: 0.75 }}>
        {/* Position */}
        <Stack spacing={0.75}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontWeight: 900, fontSize: 12.2 }}>Position</Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              clickable
              onClick={resetPosition}
              label="Reset"
              sx={{
                height: 20,
                fontSize: 10.5,
                fontWeight: 900,
                borderRadius: 999,
                background: alpha("#fff", 0.06),
                border: `1px solid ${alpha("#fff", 0.10)}`,
                color: alpha("#fff", 0.92),
                "&:hover": { background: alpha("#fff", 0.08) },
              }}
            />
          </Stack>

          <Stack direction="row" spacing={0.75}>
            {["X", "Y", "Z"].map((axisLabel, i) => (
              <Box key={`pos-${axisLabel}`} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography sx={axisLabelSx}>{axisLabel}</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    sx={fieldSx}
                    value={fmt(position[i], 3)}
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
                height: 20,
                fontSize: 10.5,
                fontWeight: 900,
                borderRadius: 999,
                background: alpha("#fff", 0.06),
                border: `1px solid ${alpha("#fff", 0.10)}`,
                color: alpha("#fff", 0.92),
                "&:hover": { background: alpha("#fff", 0.08) },
              }}
            />
          </Stack>

          <Stack direction="row" spacing={0.75}>
            {["X", "Y", "Z"].map((axisLabel, i) => (
              <Box key={`rot-${axisLabel}`} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography sx={axisLabelSx}>{axisLabel}</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    sx={fieldSx}
                    value={fmt(rotationDeg[i], 2)}
                    onChange={(e) => updateRotationAxisDeg(i, e.target.value)}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

          {/* Scale */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontWeight: 900, fontSize: 12.2 }}>Scale</Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              clickable
              onClick={resetScale}
              label="Reset"
              sx={{
                height: 20,
                fontSize: 10.5,
                fontWeight: 900,
                borderRadius: 999,
                background: alpha("#fff", 0.06),
                border: `1px solid ${alpha("#fff", 0.10)}`,
                color: alpha("#fff", 0.92),
                "&:hover": { background: alpha("#fff", 0.08) },
              }}
            />
          </Stack>

          <Stack direction="row" spacing={0.75}>
            {["X", "Y", "Z"].map((axisLabel, i) => (
              <Box key={`scl-${axisLabel}`} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography sx={axisLabelSx}>{axisLabel}</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    sx={fieldSx}
                    value={fmt(scale[i], 3)}
                    onChange={(e) => updateScaleAxis(i, e.target.value)}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>

      <Divider sx={{ my: 1.25, borderColor: alpha("#fff", 0.08) }} />

      {/* materials */}
      <Typography sx={sectionTitleSx}>Materials</Typography>
      <Box sx={{ ...boxSx, mt: 0.75 }}>
        <Stack spacing={0.7}>
          <Typography sx={smallSx}>
            MVP: まずは「スロット一覧（placeholder）」→ クリックで Material Panel に切替、にします。
          </Typography>

          <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
            {["Upholstery", "Wood", "Metal"].map((slot) => (
              <Chip
                key={slot}
                clickable
                onClick={() => openMaterial(slot)}
                icon={<LinkRoundedIcon sx={{ fontSize: 16, ml: 0.35 }} />}
                label={slot}
                sx={{
                  height: 24,
                  fontSize: 11,
                  fontWeight: 900,
                  borderRadius: 999,
                  background: alpha("#000", 0.14),
                  border: `1px solid ${alpha("#fff", 0.10)}`,
                  color: alpha("#fff", 0.92),
                  "&:hover": {
                    background: alpha("#000", 0.20),
                    borderColor: alpha(theme.palette.primary.main, 0.28),
                  },
                }}
              />
            ))}
          </Stack>

          <Typography sx={{ ...smallSx, opacity: 0.6 }}>
            ※ 実際のGLB内マテリアル抽出は後で。まずはUI導線を固めます。
          </Typography>
        </Stack>
      </Box>

      <Divider sx={{ my: 1.25, borderColor: alpha("#fff", 0.08) }} />

      {/* meta */}
      <Typography sx={sectionTitleSx}>Meta</Typography>
      <Box sx={{ ...boxSx, mt: 0.75 }}>
        <Typography sx={smallSx}>kind: {selection?.kind || "item"} / id: {selection?.id}</Typography>
        <Typography sx={{ ...smallSx, mt: 0.35 }}>
          modelId: {item?.modelId || "—"} / type: {item?.type || "—"} / subType: {item?.subType || "—"}
        </Typography>
      </Box>
    </Box>
  );
}
