// PropertiesLightPanel.jsx — Properties for a selected scene light
import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Slider,
  IconButton,
  Switch,
  Tooltip,
  Divider,
  Stack,
  Select,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DISPLAY_TO_DATA, DISPLAY_AXIS_LABELS } from "../../../../../utils/axisConvention";

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import SettingsBrightnessRoundedIcon from "@mui/icons-material/SettingsBrightnessRounded";

import { useLightingStore } from "../../../../../store/useLightingStore";
import { useUiPropertiesSelectionStore } from "../../../../../store/uiPropertiesSelectionStore";
import { useUiVisibilityStore } from "../../../../../store/uiVisibilityStore";
import { useViewportEnvStore } from "../../../../../store/useViewportEnvStore";

// ─── Light Use-Case Presets ───────────────────────────────────────────────────
// 「ユースケース」を選ぶと位置 Y・回転・サイズ・強度などをまとめて切り替える。
// X / Z は維持してユーザーの配置を尊重する (preset apply 時に preserveXZ で処理)。

const SPOT_PRESETS = [
  {
    id: "downlight",
    label: "ダウンライト",
    desc: "天井埋め込み・床面を均等照射",
    config: { posY: 2700, angle: Math.PI / 7, penumbra: 0.35, intensity: 2.0, spotDistance: 6000 },
  },
  {
    id: "wallwash",
    label: "ウォールウォッシャー",
    desc: "壁面を均等にウォッシュ",
    config: { posY: 2600, angle: Math.PI / 4, penumbra: 0.55, intensity: 1.6, spotDistance: 6000 },
  },
  {
    id: "accent",
    label: "アクセントスポット",
    desc: "美術品・什器のハイライト",
    config: { posY: 2700, angle: Math.PI / 12, penumbra: 0.1, intensity: 4.0, spotDistance: 7000 },
  },
  {
    id: "flood",
    label: "フラッドライト",
    desc: "広範囲を柔らかく照射",
    config: { posY: 3000, angle: Math.PI / 3, penumbra: 0.65, intensity: 1.2, spotDistance: 10000 },
  },
];

const NEON_PRESETS = [
  {
    id: "cove_ceiling",
    label: "コーブ照明 (天井)",
    desc: "天井際に上向き、間接光メイン",
    config: { posY: 2600, rotX: 90, rotY: 0, length: 3, thickness: 0.05, intensity: 10.0 },
  },
  {
    id: "ceiling_line",
    label: "天井ライン照明",
    desc: "天井埋め込み・下方向メイン",
    config: { posY: 2700, rotX: -90, rotY: 0, length: 2, thickness: 0.05, intensity: 8.0 },
  },
  {
    id: "floor_uplight",
    label: "床アップライト",
    desc: "床際に上向き、壁面を照射",
    config: { posY: 100, rotX: 90, rotY: 0, length: 2, thickness: 0.08, intensity: 7.0 },
  },
  {
    id: "under_cabinet",
    label: "キャビネット下",
    desc: "キャビネット下の作業灯",
    config: { posY: 900, rotX: -90, rotY: 0, length: 1.2, thickness: 0.05, intensity: 4.0 },
  },
  {
    id: "wall_line",
    label: "壁面ライン",
    desc: "壁付け・水平方向に拡散",
    config: { posY: 1600, rotX: 0, rotY: 0, length: 1.5, thickness: 0.1, intensity: 6.0 },
  },
];

// Sun (Directional) — 時間帯・気象プリセット。Azimuth は維持してユーザーの方位設定を尊重する。
const SUN_PRESETS = [
  {
    id: "morning",
    label: "朝 (Morning)",
    desc: "低い太陽・暖かい光",
    config: { elevation: 20, color: "#ffd9a8", intensity: 0.9, castShadow: true },
  },
  {
    id: "noon",
    label: "正午 (Noon)",
    desc: "高い太陽・白色光",
    config: { elevation: 75, color: "#ffffff", intensity: 1.5, castShadow: true },
  },
  {
    id: "evening",
    label: "夕方 (Evening)",
    desc: "低い太陽・オレンジ光",
    config: { elevation: 12, color: "#ff9d5e", intensity: 0.9, castShadow: true },
  },
  {
    id: "overcast",
    label: "曇天 (Overcast)",
    desc: "拡散光・低コントラスト",
    config: { elevation: 55, color: "#d8dde2", intensity: 0.5, castShadow: false },
  },
  {
    id: "night",
    label: "月光 (Moonlight)",
    desc: "夜間・寒色低輝度",
    config: { elevation: 45, color: "#7392c8", intensity: 0.15, castShadow: true },
  },
];

// Rect Area Light — 用途別パネル形状プリセット
const RECT_PRESETS = [
  {
    id: "ceiling_panel",
    label: "天井パネル",
    desc: "オフィス・住宅の主照明",
    config: { posY: 2700, rotX: -90, width: 1.2, height: 0.6, intensity: 8.0 },
  },
  {
    id: "lightbox",
    label: "ライトボックス",
    desc: "小型・高輝度の点的照明",
    config: { posY: 2600, rotX: -90, width: 0.6, height: 0.6, intensity: 15.0 },
  },
  {
    id: "softbox",
    label: "ソフトボックス",
    desc: "大型・拡散柔光",
    config: { posY: 2800, rotX: -90, width: 2.0, height: 2.0, intensity: 4.0 },
  },
  {
    id: "window_south",
    label: "窓 (採光)",
    desc: "壁付け・水平方向に光",
    config: { posY: 1500, rotX: 0, width: 1.8, height: 1.5, intensity: 6.0 },
  },
  {
    id: "cove_panel",
    label: "コーブパネル (間接)",
    desc: "壁際に上向き、天井を照射",
    config: { posY: 2400, rotX: 90, width: 3.0, height: 0.5, intensity: 10.0 },
  },
];

/** プリセットを current light に適用する patch を作成。X/Z は維持する。 */
function buildSpotPresetPatch(currentLight, preset) {
  const px = currentLight?.position?.[0] ?? 0;
  const pz = currentLight?.position?.[2] ?? 0;
  return {
    position: [px, preset.config.posY, pz],
    targetPosition: [px, 0, pz], // 真下に投光
    angle: preset.config.angle,
    penumbra: preset.config.penumbra,
    intensity: preset.config.intensity,
    spotDistance: preset.config.spotDistance,
  };
}

function buildNeonPresetPatch(currentLight, preset) {
  const px = currentLight?.neonPosition?.[0] ?? 0;
  const pz = currentLight?.neonPosition?.[2] ?? 0;
  return {
    neonPosition: [px, preset.config.posY, pz],
    neonRotationX: preset.config.rotX,
    neonRotationY: preset.config.rotY,
    length: preset.config.length,
    thickness: preset.config.thickness,
    intensity: preset.config.intensity,
  };
}

function buildSunPresetPatch(currentLight, preset) {
  // Azimuth (方位) はユーザーの建物向き設定なので維持する。
  return {
    elevation: preset.config.elevation,
    color: preset.config.color,
    intensity: preset.config.intensity,
    castShadow: preset.config.castShadow,
  };
}

function buildRectPresetPatch(currentLight, preset) {
  const px = currentLight?.rectPosition?.[0] ?? 0;
  const pz = currentLight?.rectPosition?.[2] ?? 0;
  return {
    rectPosition: [px, preset.config.posY, pz],
    rectRotationX: preset.config.rotX,
    width: preset.config.width,
    height: preset.config.height,
    intensity: preset.config.intensity,
  };
}

// ─── Preset Selector UI ───────────────────────────────────────────────────────

function PresetSelector({ presets, currentPresetId, onApply }) {
  // currentPresetId が一致するプリセットがあれば選択中として表示。
  // 手動編集後 (currentPresetId === null/undefined) は "Custom" 表示。
  const activePreset = currentPresetId
    ? presets.find((p) => p.id === currentPresetId) ?? null
    : null;

  return (
    <Select
      value={activePreset?.id ?? ""}
      displayEmpty
      size="small"
      fullWidth
      onChange={(e) => {
        const id = e.target.value;
        const preset = presets.find((p) => p.id === id);
        if (preset) onApply(preset);
      }}
      renderValue={() => {
        if (activePreset) {
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 13, color: "#7eb3ff" }} />
              <Typography sx={{ fontSize: 11.5, color: "#fff", fontWeight: 600 }}>
                {activePreset.label}
              </Typography>
            </Box>
          );
        }
        if (currentPresetId === null) {
          // 過去にプリセット適用 → その後手動編集
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: alpha("#fff", 0.55) }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 13 }} />
              <Typography sx={{ fontSize: 11.5, fontStyle: "italic" }}>Custom (手動調整)</Typography>
            </Box>
          );
        }
        // 初期状態 (undefined) — まだプリセット未選択
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: alpha("#fff", 0.55) }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 13 }} />
            <Typography sx={{ fontSize: 11.5 }}>プリセットを適用…</Typography>
          </Box>
        );
      }}
      sx={{
        fontSize: 12,
        background: activePreset ? alpha("#7eb3ff", 0.1) : alpha("#fff", 0.04),
        "& .MuiSelect-select": { py: 0.5, px: 1 },
        "& fieldset": {
          borderColor: activePreset ? alpha("#7eb3ff", 0.4) : alpha("#fff", 0.12),
        },
        "&:hover fieldset": { borderColor: alpha("#fff", 0.25) },
      }}
      MenuProps={{
        PaperProps: {
          sx: {
            mt: 0.5,
            bgcolor: "rgba(22, 22, 26, 0.96)",
            color: "rgba(255, 255, 255, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(8px)",
          },
        },
      }}
    >
      {presets.map((p) => (
        <MenuItem
          key={p.id}
          value={p.id}
          sx={{
            py: 0.75,
            alignItems: "flex-start",
            ...(p.id === activePreset?.id && {
              background: alpha("#7eb3ff", 0.18),
              "&:hover": { background: alpha("#7eb3ff", 0.25) },
            }),
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{p.label}</Typography>
            <Typography sx={{ fontSize: 10.5, opacity: 0.55, mt: 0.1 }}>{p.desc}</Typography>
          </Box>
        </MenuItem>
      ))}
    </Select>
  );
}

// ─── Time / Sun Conversion ────────────────────────────────────────────────────

/** elevation (0–90°) → hour of day (0–24) */
function elevationToHour(el) {
  if (el <= 0) return 6;
  const clamped = Math.min(1, el / 90);
  return 6 + (Math.asin(clamped) * 12) / Math.PI;
}

/** hour of day (0–24) → elevation (0–90°) */
function hourToElevation(h) {
  return Math.max(0, Math.min(90, 90 * Math.sin(((h - 6) * Math.PI) / 12)));
}

function formatTime(h) {
  const hrs = Math.floor(Math.min(23, Math.max(0, h)));
  const rawMins = Math.round((h - hrs) * 60);
  const mins = rawMins >= 60 ? 0 : rawMins;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// ─── Compass direction ────────────────────────────────────────────────────────

function azimuthToCompass(az) {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const idx = Math.round(((az % 360) + 360) % 360 / 22.5) % 16;
  return dirs[idx];
}

// ─── Layout atoms ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        mt: 1.75,
        mb: 0.5,
        pb: 0.6,
        borderBottom: `1px solid ${alpha("#fff", 0.07)}`,
      }}
    >
      <Box sx={{ color: alpha("#fff", 0.5), display: "flex" }}>{icon}</Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.2 }}>{label}</Typography>
    </Box>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography
      sx={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.7,
        textTransform: "uppercase",
        opacity: 0.38,
        mt: 1.25,
        mb: 0.25,
      }}
    >
      {children}
    </Typography>
  );
}

function Row({ label, children }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 28 }}>
      <Typography sx={{ fontSize: 12, opacity: 0.58, minWidth: 80, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Box>
  );
}

function ColorInput({ value, onChange }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        component="input"
        type="color"
        value={value || "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          width: 26,
          height: 20,
          border: `1px solid ${alpha("#fff", 0.2)}`,
          borderRadius: 1,
          background: "transparent",
          cursor: "pointer",
          p: 0,
          flexShrink: 0,
        }}
      />
      <Typography sx={{ fontSize: 11.5, opacity: 0.5, fontFamily: "monospace" }}>
        {(value || "#ffffff").toUpperCase()}
      </Typography>
    </Box>
  );
}

// ─── Smooth sliders — local draft prevents thumb jumping on re-render ─────────
//
// Pattern: the slider's `value` is the local `draft` state (updated immediately
// on every onChange for responsive display + live 3D).  External `value` prop
// changes only sync back when the user is NOT dragging, so store re-renders
// can't cause the thumb to jump mid-drag.

/**
 * Labeled slider with gradient rail and value readout.
 */
const LabeledSlider = React.memo(function LabeledSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  formatValue,
  thumbColor,
  railGradient,
}) {
  const tc = thumbColor ?? alpha("#fff", 0.92);
  const [draft, setDraft] = useState(value);
  const isDragging = useRef(false);

  // Sync from outside only when the user is not holding the slider
  useEffect(() => {
    if (!isDragging.current) setDraft(value);
  }, [value]);

  const handleChange = useCallback(
    (_, v) => {
      isDragging.current = true;
      setDraft(v);
      onChange(v); // live 3D update
    },
    [onChange]
  );

  const handleCommitted = useCallback(
    (_, v) => {
      isDragging.current = false;
      setDraft(v);
      onChange(v);
    },
    [onChange]
  );

  return (
    <Box>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.15 }}
      >
        <Typography sx={{ fontSize: 12, opacity: 0.58 }}>{label}</Typography>
        <Typography
          sx={{
            fontSize: 12,
            opacity: 0.9,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: 0.2,
          }}
        >
          {formatValue ? formatValue(draft) : draft}
        </Typography>
      </Box>
      <Slider
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={handleChange}
        onChangeCommitted={handleCommitted}
        size="small"
        sx={{
          py: 0.6,
          "& .MuiSlider-rail": {
            background: railGradient ?? alpha("#fff", 0.18),
            opacity: 1,
            height: 6,
            borderRadius: 3,
          },
          "& .MuiSlider-track": { background: "transparent", border: "none" },
          "& .MuiSlider-thumb": {
            width: 14,
            height: 14,
            bgcolor: tc,
            border: `2px solid ${alpha("#fff", 0.55)}`,
            boxShadow: "0 1px 6px rgba(0,0,0,0.55)",
            "&:hover, &.Mui-focusVisible": {
              boxShadow: "0 0 0 6px rgba(255,255,255,0.12)",
            },
          },
        }}
      />
    </Box>
  );
});

/** Compact intensity slider (no label header, inline value). */
const IntensitySlider = React.memo(function IntensitySlider({ value, onChange, max = 10 }) {
  const [draft, setDraft] = useState(value ?? 1);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current) setDraft(value ?? 1);
  }, [value]);

  const handleChange = useCallback(
    (_, v) => {
      isDragging.current = true;
      setDraft(v);
      onChange(v);
    },
    [onChange]
  );

  const handleCommitted = useCallback(
    (_, v) => {
      isDragging.current = false;
      setDraft(v);
      onChange(v);
    },
    [onChange]
  );

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Slider
        value={draft}
        onChange={handleChange}
        onChangeCommitted={handleCommitted}
        min={0}
        max={max}
        step={0.05}
        size="small"
        sx={{ flex: 1, color: alpha("#fff", 0.6) }}
      />
      <Typography sx={{ fontSize: 12, opacity: 0.7, minWidth: 32, textAlign: "right" }}>
        {draft.toFixed(2)}
      </Typography>
    </Box>
  );
});

/** Angle slider inside a Row. */
const AngleSlider = React.memo(function AngleSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "°",
}) {
  const [draft, setDraft] = useState(value ?? 0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current) setDraft(value ?? 0);
  }, [value]);

  const handleChange = useCallback(
    (_, v) => {
      isDragging.current = true;
      setDraft(v);
      onChange(v);
    },
    [onChange]
  );

  const handleCommitted = useCallback(
    (_, v) => {
      isDragging.current = false;
      setDraft(v);
      onChange(v);
    },
    [onChange]
  );

  return (
    <Row label={label}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Slider
          value={draft}
          onChange={handleChange}
          onChangeCommitted={handleCommitted}
          min={min}
          max={max}
          step={step ?? 1}
          size="small"
          sx={{ flex: 1, color: alpha("#fff", 0.6) }}
        />
        <Typography sx={{ fontSize: 12, opacity: 0.7, minWidth: 38, textAlign: "right" }}>
          {draft.toFixed(unit === "rad" ? 2 : 0)}
          {unit !== "rad" ? unit : ""}
        </Typography>
      </Box>
    </Row>
  );
});

function NumberInput({ value, onChange, step = 0.1, min }) {
  return (
    <Box
      component="input"
      type="number"
      value={value ?? ""}
      step={step}
      min={min}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      sx={{
        width: "100%",
        background: alpha("#fff", 0.06),
        border: `1px solid ${alpha("#fff", 0.14)}`,
        borderRadius: 1,
        color: "#fff",
        fontSize: 12,
        px: 0.75,
        py: 0.4,
        outline: "none",
        "&:focus": { borderColor: alpha("#fff", 0.3) },
        "-moz-appearance": "textfield",
        "&::-webkit-inner-spin-button": { "-webkit-appearance": "none" },
      }}
    />
  );
}

function XYZInput({ value = [0, 0, 0], onChange }) {
  // Z-up 表示規約: 表示列 i → データ index DISPLAY_TO_DATA[i]（[0,2,1]）。
  // 値は Three.js の [x,y,z](Y-up) のまま保持し、表示・編集だけ Rhino 式 Z-up にする。
  return (
    <Box sx={{ display: "flex", gap: 0.5 }}>
      {DISPLAY_AXIS_LABELS.map((l, i) => {
        const di = DISPLAY_TO_DATA[i];
        return (
          <Box key={l} sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 10, opacity: 0.4, textAlign: "center", mb: 0.25 }}>{l}</Typography>
            <NumberInput
              value={value[di] ?? 0}
              step={0.1}
              onChange={(n) => {
                const next = [...value];
                next[di] = n;
                onChange(next);
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Ambience panel (Twinmotion-style) ───────────────────────────────────────

// ─── Ambience Tabs (Twinmotion 風: Env / Camera / Render) ────────────────────

function AmbienceTabBar({ active, onChange }) {
  const TABS = [
    { id: "env", label: "Env", Icon: PublicRoundedIcon },
    { id: "camera", label: "Camera", Icon: CameraAltRoundedIcon },
    { id: "render", label: "Render", Icon: SettingsBrightnessRoundedIcon },
  ];
  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        mb: 1.25,
        p: 0.4,
        background: alpha("#fff", 0.03),
        border: `1px solid ${alpha("#fff", 0.06)}`,
        borderRadius: 1,
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const selected = active === id;
        return (
          <Box
            key={id}
            onClick={() => onChange(id)}
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.2,
              py: 0.6,
              borderRadius: 0.5,
              cursor: "pointer",
              userSelect: "none",
              background: selected ? alpha("#7eb3ff", 0.15) : "transparent",
              border: `1px solid ${selected ? alpha("#7eb3ff", 0.4) : "transparent"}`,
              color: selected ? "#fff" : alpha("#fff", 0.55),
              transition: "all 0.12s",
              "&:hover": {
                background: selected ? alpha("#7eb3ff", 0.18) : alpha("#fff", 0.04),
                color: "#fff",
              },
            }}
          >
            <Icon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4 }}>
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function EnvTab({ light, onPatch }) {
  // Also controls the 'sun' directional light
  const sunLight = useLightingStore((s) => s.lights.find((l) => l.id === "sun"));
  const updateLight = useLightingStore((s) => s.updateLight);

  const sunElevation = sunLight?.elevation ?? 50;
  const sunAzimuth = sunLight?.azimuth ?? 45;
  const timeOfDay = elevationToHour(sunElevation);

  const handleTimeOfDay = useCallback(
    (h) => updateLight("sun", { elevation: hourToElevation(h) }),
    [updateLight]
  );

  const handleNorthOffset = useCallback(
    (v) => updateLight("sun", { azimuth: v }),
    [updateLight]
  );

  return (
    <>
      {/* ── Sun ── */}
      <SectionHeader icon={<WbSunnyRoundedIcon sx={{ fontSize: 15 }} />} label="Sun" />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        <LabeledSlider
          label="Time of day"
          value={timeOfDay}
          onChange={handleTimeOfDay}
          min={0}
          max={24}
          step={0.25}
          formatValue={formatTime}
          thumbColor="#ffd580"
          railGradient={[
            "linear-gradient(to right,",
            "#070c1c 0%,",
            "#070c1c 19%,",
            "#c45200 25%,",
            "#ffab40 37%,",
            "#ffd580 50%,",
            "#ffab40 63%,",
            "#c45200 75%,",
            "#070c1c 81%,",
            "#070c1c 100%",
            ")",
          ].join(" ")}
        />
        <LabeledSlider
          label="North offset"
          value={sunAzimuth}
          onChange={handleNorthOffset}
          min={0}
          max={360}
          step={1}
          formatValue={(v) => `${Math.round(v)}°  ${azimuthToCompass(v)}`}
          thumbColor="#60a8e0"
          railGradient="linear-gradient(to right, #1a3a8f, #3a78d0, #80c0ff, #3a78d0, #1a3a8f)"
        />
      </Box>

      {/* ── Appearance ── */}
      <SectionHeader icon={<TuneRoundedIcon sx={{ fontSize: 15 }} />} label="Appearance" />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <LabeledSlider
          label="Intensity"
          value={light.intensity ?? 0.6}
          onChange={(v) => onPatch({ intensity: v })}
          min={0}
          max={5}
          step={0.05}
          formatValue={(v) => v.toFixed(2)}
          thumbColor={alpha("#fff", 0.92)}
          railGradient={`linear-gradient(to right, ${alpha("#fff", 0.06)}, ${alpha("#fff", 0.55)})`}
        />
        <Row label="Sky">
          <ColorInput value={light.color} onChange={(v) => onPatch({ color: v })} />
        </Row>
        <Row label="Ground">
          <ColorInput value={light.groundColor} onChange={(v) => onPatch({ groundColor: v })} />
        </Row>
      </Box>
    </>
  );
}

function CameraTab() {
  const exposure = useViewportEnvStore((s) => s.exposure);
  const whiteBalance = useViewportEnvStore((s) => s.whiteBalance);
  const focalLength = useViewportEnvStore((s) => s.focalLength);
  const setExposure = useViewportEnvStore((s) => s.setExposure);
  const setWhiteBalance = useViewportEnvStore((s) => s.setWhiteBalance);
  const setFocalLength = useViewportEnvStore((s) => s.setFocalLength);
  const resetCamera = useViewportEnvStore((s) => s.resetCamera);

  return (
    <>
      <SectionHeader icon={<CameraAltRoundedIcon sx={{ fontSize: 15 }} />} label="Exposure" />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        <LabeledSlider
          label="Exposure"
          value={exposure}
          onChange={setExposure}
          min={0.1}
          max={4.0}
          step={0.05}
          formatValue={(v) => v.toFixed(2)}
          thumbColor="#ffd580"
          railGradient={`linear-gradient(to right, ${alpha("#000", 0.7)}, ${alpha("#fff", 0.85)})`}
        />
        <LabeledSlider
          label="White bal."
          value={whiteBalance}
          onChange={setWhiteBalance}
          min={2500}
          max={10000}
          step={50}
          formatValue={(v) => `${Math.round(v)}K`}
          thumbColor="#ffe8b0"
          railGradient="linear-gradient(to right, #ff8030, #ffb060, #ffe0b0, #ffffff, #c8d8ff, #6090e0, #3060c8)"
        />
      </Box>

      <SectionHeader icon={<TuneRoundedIcon sx={{ fontSize: 15 }} />} label="Lens" />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        <LabeledSlider
          label="Focal length"
          value={focalLength}
          onChange={setFocalLength}
          min={15}
          max={135}
          step={1}
          formatValue={(v) => `${Math.round(v)} mm`}
          thumbColor="#fff"
          railGradient={`linear-gradient(to right, ${alpha("#fff", 0.55)}, ${alpha("#fff", 0.12)})`}
        />
        <Typography sx={{ fontSize: 10, opacity: 0.4, mt: 0.25, lineHeight: 1.4 }}>
          15mm 超広角 / 35mm 標準 / 50mm 中庸 / 100mm 望遠
        </Typography>
      </Box>

      <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
        <Typography
          onClick={resetCamera}
          sx={{
            fontSize: 10.5,
            opacity: 0.5,
            cursor: "pointer",
            "&:hover": { opacity: 0.9, color: "#7eb3ff" },
          }}
        >
          Reset to defaults
        </Typography>
      </Box>
    </>
  );
}

function RenderTab() {
  const toneMapping = useViewportEnvStore((s) => s.toneMapping);
  const shadowQuality = useViewportEnvStore((s) => s.shadowQuality);
  const setToneMapping = useViewportEnvStore((s) => s.setToneMapping);
  const setShadowQuality = useViewportEnvStore((s) => s.setShadowQuality);
  const resetRender = useViewportEnvStore((s) => s.resetRender);

  const TONE_OPTIONS = [
    { value: "none", label: "None (Linear)" },
    { value: "aces", label: "ACES Filmic" },
    { value: "reinhard", label: "Reinhard" },
    { value: "cineon", label: "Cineon" },
    { value: "agx", label: "AgX (Blender 4)" },
  ];

  const SHADOW_OPTIONS = [
    { value: "low", label: "Low (1024)" },
    { value: "medium", label: "Medium (2048)" },
    { value: "high", label: "High (4096)" },
  ];

  return (
    <>
      <SectionHeader icon={<SettingsBrightnessRoundedIcon sx={{ fontSize: 15 }} />} label="Tone Mapping" />
      <Box sx={{ mb: 1 }}>
        <Select
          value={toneMapping}
          onChange={(e) => setToneMapping(e.target.value)}
          size="small"
          fullWidth
          sx={{
            fontSize: 12,
            background: alpha("#fff", 0.04),
            "& .MuiSelect-select": { py: 0.5, px: 1 },
            "& fieldset": { borderColor: alpha("#fff", 0.12) },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                mt: 0.5,
                bgcolor: "rgba(22, 22, 26, 0.96)",
                color: "rgba(255, 255, 255, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              },
            },
          }}
        >
          {TONE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <SectionHeader icon={<TuneRoundedIcon sx={{ fontSize: 15 }} />} label="Shadow Quality" />
      <Box sx={{ mb: 1 }}>
        <Select
          value={shadowQuality}
          onChange={(e) => setShadowQuality(e.target.value)}
          size="small"
          fullWidth
          sx={{
            fontSize: 12,
            background: alpha("#fff", 0.04),
            "& .MuiSelect-select": { py: 0.5, px: 1 },
            "& fieldset": { borderColor: alpha("#fff", 0.12) },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                mt: 0.5,
                bgcolor: "rgba(22, 22, 26, 0.96)",
                color: "rgba(255, 255, 255, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              },
            },
          }}
        >
          {SHADOW_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
        <Typography
          onClick={resetRender}
          sx={{
            fontSize: 10.5,
            opacity: 0.5,
            cursor: "pointer",
            "&:hover": { opacity: 0.9, color: "#7eb3ff" },
          }}
        >
          Reset to defaults
        </Typography>
      </Box>

      <Typography sx={{ fontSize: 10, opacity: 0.42, mt: 1, lineHeight: 1.45 }}>
        ※ Shadow Quality はライト変更時に再生成されます。トーンマッピングは表示モードの「レンダリング」で常時適用されます。
      </Typography>
    </>
  );
}

function AmbienceProps({ light, onPatch }) {
  const [tab, setTab] = useState("env");
  return (
    <>
      <AmbienceTabBar active={tab} onChange={setTab} />
      {tab === "env" && <EnvTab light={light} onPatch={onPatch} />}
      {tab === "camera" && <CameraTab />}
      {tab === "render" && <RenderTab />}
    </>
  );
}

// ─── Directional Light props ──────────────────────────────────────────────────

function DirectionalProps({ light, onPatch }) {
  return (
    <>
      <SectionLabel>Use Case</SectionLabel>
      <Box sx={{ mb: 0.75 }}>
        <PresetSelector
          presets={SUN_PRESETS}
          currentPresetId={light.presetId}
          onApply={(preset) =>
            onPatch({ ...buildSunPresetPatch(light, preset), presetId: preset.id })
          }
        />
      </Box>
      <SectionLabel>Appearance</SectionLabel>
      <Row label="Color">
        <ColorInput value={light.color} onChange={(v) => onPatch({ color: v })} />
      </Row>
      <Row label="Intensity">
        <IntensitySlider value={light.intensity} max={10} onChange={(v) => onPatch({ intensity: v })} />
      </Row>
      <AngleSlider
        label="Azimuth"
        value={light.azimuth}
        min={0}
        max={360}
        step={1}
        onChange={(v) => onPatch({ azimuth: v })}
      />
      <AngleSlider
        label="Elevation"
        value={light.elevation}
        min={0}
        max={90}
        step={1}
        onChange={(v) => onPatch({ elevation: v })}
      />
      <Row label="Distance">
        <NumberInput value={light.distance} step={0.5} min={1} onChange={(v) => onPatch({ distance: v })} />
      </Row>
      <Row label="Shadow">
        <Switch
          size="small"
          checked={light.castShadow ?? false}
          onChange={(e) => onPatch({ castShadow: e.target.checked })}
          sx={{
            "& .MuiSwitch-thumb": { width: 14, height: 14 },
            "& .MuiSwitch-track": { borderRadius: 7 },
          }}
        />
      </Row>
    </>
  );
}

// ─── Spot Light props ─────────────────────────────────────────────────────────

function SpotProps({ light, onPatch }) {
  const angleDeg = (light.angle ?? Math.PI / 6) * (180 / Math.PI);
  return (
    <>
      <SectionLabel>Use Case</SectionLabel>
      <Box sx={{ mb: 0.75 }}>
        <PresetSelector
          presets={SPOT_PRESETS}
          currentPresetId={light.presetId}
          onApply={(preset) =>
            onPatch({ ...buildSpotPresetPatch(light, preset), presetId: preset.id })
          }
        />
      </Box>
      <SectionLabel>Appearance</SectionLabel>
      <Row label="Color">
        <ColorInput value={light.color} onChange={(v) => onPatch({ color: v })} />
      </Row>
      <Row label="Intensity">
        <IntensitySlider value={light.intensity} max={10} onChange={(v) => onPatch({ intensity: v })} />
      </Row>
      <SectionLabel>Transform</SectionLabel>
      <Row label="Position">
        <XYZInput
          value={light.position ?? [3, 4, 3]}
          onChange={(v) => onPatch({ position: v })}
        />
      </Row>
      <Row label="Target">
        <XYZInput
          value={light.targetPosition ?? [0, 0, 0]}
          onChange={(v) => onPatch({ targetPosition: v })}
        />
      </Row>
      <SectionLabel>Light</SectionLabel>
      <AngleSlider
        label="Cone"
        value={angleDeg}
        min={1}
        max={89}
        step={1}
        onChange={(v) => onPatch({ angle: v * (Math.PI / 180) })}
      />
      <AngleSlider
        label="Softness"
        value={(light.penumbra ?? 0.2) * 100}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v) => onPatch({ penumbra: v / 100 })}
      />
      <Row label="Range">
        <NumberInput
          value={light.spotDistance}
          step={0.5}
          min={0}
          onChange={(v) => onPatch({ spotDistance: v })}
        />
      </Row>
      <Row label="Shadow">
        <Switch
          size="small"
          checked={light.castShadow ?? false}
          onChange={(e) => onPatch({ castShadow: e.target.checked })}
          sx={{
            "& .MuiSwitch-thumb": { width: 14, height: 14 },
            "& .MuiSwitch-track": { borderRadius: 7 },
          }}
        />
      </Row>
    </>
  );
}

// ─── Rect Area Light props ────────────────────────────────────────────────────

function RectProps({ light, onPatch }) {
  return (
    <>
      <SectionLabel>Use Case</SectionLabel>
      <Box sx={{ mb: 0.75 }}>
        <PresetSelector
          presets={RECT_PRESETS}
          currentPresetId={light.presetId}
          onApply={(preset) =>
            onPatch({ ...buildRectPresetPatch(light, preset), presetId: preset.id })
          }
        />
      </Box>
      <SectionLabel>Appearance</SectionLabel>
      <Row label="Color">
        <ColorInput value={light.color} onChange={(v) => onPatch({ color: v })} />
      </Row>
      <Row label="Intensity">
        <IntensitySlider value={light.intensity} max={10} onChange={(v) => onPatch({ intensity: v })} />
      </Row>
      <SectionLabel>Transform</SectionLabel>
      <Row label="Position">
        <XYZInput
          value={light.rectPosition ?? [0, 3.2, 0]}
          onChange={(v) => onPatch({ rectPosition: v })}
        />
      </Row>
      <AngleSlider
        label="Tilt (X)"
        value={light.rectRotationX ?? -90}
        min={-180}
        max={180}
        step={1}
        onChange={(v) => onPatch({ rectRotationX: v })}
      />
      <SectionLabel>Size</SectionLabel>
      <Row label="Width">
        <NumberInput
          value={light.width}
          step={0.25}
          min={0.1}
          onChange={(v) => onPatch({ width: v })}
        />
      </Row>
      <Row label="Height">
        <NumberInput
          value={light.height}
          step={0.25}
          min={0.1}
          onChange={(v) => onPatch({ height: v })}
        />
      </Row>
    </>
  );
}

// ─── Neon Light props (linear LED strip) ─────────────────────────────────────

function NeonProps({ light, onPatch }) {
  return (
    <>
      <SectionLabel>Use Case</SectionLabel>
      <Box sx={{ mb: 0.75 }}>
        <PresetSelector
          presets={NEON_PRESETS}
          currentPresetId={light.presetId}
          onApply={(preset) =>
            onPatch({ ...buildNeonPresetPatch(light, preset), presetId: preset.id })
          }
        />
      </Box>
      <SectionLabel>Appearance</SectionLabel>
      <Row label="Color">
        <ColorInput value={light.color} onChange={(v) => onPatch({ color: v })} />
      </Row>
      <Row label="Intensity">
        <IntensitySlider value={light.intensity} max={10} onChange={(v) => onPatch({ intensity: v })} />
      </Row>
      <SectionLabel>Transform</SectionLabel>
      <Row label="Position">
        <XYZInput
          value={light.neonPosition ?? [0, 3000, 0]}
          onChange={(v) => onPatch({ neonPosition: v })}
        />
      </Row>
      <AngleSlider
        label="Tilt (X)"
        value={light.neonRotationX ?? -90}
        min={-180}
        max={180}
        step={1}
        onChange={(v) => onPatch({ neonRotationX: v })}
      />
      <AngleSlider
        label="Yaw (Z)"
        value={light.neonRotationY ?? 0}
        min={-180}
        max={180}
        step={1}
        onChange={(v) => onPatch({ neonRotationY: v })}
      />
      <SectionLabel>Size</SectionLabel>
      <Row label="Length">
        <NumberInput
          value={light.length}
          step={0.25}
          min={0.1}
          onChange={(v) => onPatch({ length: v })}
        />
      </Row>
      <Row label="Thickness">
        <NumberInput
          value={light.thickness}
          step={0.05}
          min={0.02}
          onChange={(v) => onPatch({ thickness: v })}
        />
      </Row>
    </>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function PropertiesLightPanel({ lightId }) {
  const lights = useLightingStore((s) => s.lights);
  const updateLight = useLightingStore((s) => s.updateLight);
  const removeLight = useLightingStore((s) => s.removeLight);
  const togglePin = useLightingStore((s) => s.togglePin);
  const clearSelection = useUiPropertiesSelectionStore((s) => s.clearSelection);

  const light = lights.find((l) => l.id === lightId) ?? null;

  // Visibility is managed through uiVisibilityStore (same as scene outliner eye icon)
  const nodeId =
    light?.type === "hemisphere" ? "scene:ambience" : lightId ? `light:${lightId}` : null;
  const isNodeVisible = useUiVisibilityStore(
    (s) => (nodeId ? !s.hiddenNodeIds[nodeId] : true)
  );
  const toggleNodeVisibility = useUiVisibilityStore((s) => s.toggleNodeVisibility);

  const onPatch = useCallback(
    (patch) => {
      if (!lightId) return;
      // presetId が patch に含まれていない場合は手動編集と見なし、presetId を null に。
      // プリセット適用時は patch に { presetId: preset.id } が明示的に含まれる。
      const finalPatch = "presetId" in patch ? patch : { ...patch, presetId: null };
      updateLight(lightId, finalPatch);
    },
    [lightId, updateLight]
  );

  const handleDelete = useCallback(() => {
    if (!lightId) return;
    removeLight(lightId);
    clearSelection();
  }, [lightId, removeLight, clearSelection]);

  const handleToggleVisible = useCallback(() => {
    if (!nodeId) return;
    toggleNodeVisibility(nodeId);
  }, [nodeId, toggleNodeVisibility]);

  if (!light) {
    return (
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontSize: 12, opacity: 0.5 }}>Light not found.</Typography>
      </Box>
    );
  }

  const isAmbience = light.type === "hemisphere";

  return (
    <Box sx={{ p: 1.5, display: "flex", flexDirection: "column" }}>
      {/* ── Header ── */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{light.name}</Typography>
          <Typography sx={{ fontSize: 11, opacity: 0.42, textTransform: "capitalize" }}>
            {light.type === "hemisphere"
              ? "Hemisphere Light"
              : light.type === "rect"
              ? "Rect Area Light"
              : light.type === "neon"
              ? "Neon Light"
              : `${light.type.charAt(0).toUpperCase() + light.type.slice(1)} Light`}
          </Typography>
        </Box>
        <Tooltip title={light.pinned ? "ピン留め解除（自動ライティングで置換される）" : "ピン留め（自動ライティングで保持）"}>
          <IconButton
            size="small"
            onClick={() => togglePin(lightId)}
            sx={{ opacity: light.pinned ? 1 : 0.4, color: light.pinned ? "#fbbf24" : "inherit" }}
          >
            {light.pinned ? (
              <PushPinRoundedIcon sx={{ fontSize: 18 }} />
            ) : (
              <PushPinOutlinedIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={isNodeVisible ? "Hide" : "Show"}>
          <IconButton
            size="small"
            onClick={handleToggleVisible}
            sx={{ opacity: isNodeVisible ? 0.8 : 0.28 }}
          >
            {isNodeVisible ? (
              <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
            ) : (
              <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
        {!isAmbience && (
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={handleDelete}
              sx={{ opacity: 0.55, "&:hover": { opacity: 1, color: "error.main" } }}
            >
              <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Divider sx={{ borderColor: alpha("#fff", 0.07), mb: 1.25 }} />

      {/* ── Per-type content ── */}
      {light.type === "hemisphere" && <AmbienceProps light={light} onPatch={onPatch} />}
      {light.type === "directional" && <DirectionalProps light={light} onPatch={onPatch} />}
      {light.type === "spot" && <SpotProps light={light} onPatch={onPatch} />}
      {light.type === "rect" && <RectProps light={light} onPatch={onPatch} />}
      {light.type === "neon" && <NeonProps light={light} onPatch={onPatch} />}
    </Box>
  );
}
