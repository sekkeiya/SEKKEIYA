import React, { useState, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Slider,
  Switch,
  Divider,
  Collapse,
  Button,
  TextField,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import HighlightRoundedIcon from "@mui/icons-material/HighlightRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import CropPortraitRoundedIcon from "@mui/icons-material/CropPortraitRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { useLightingStore } from "@desktop/features/dsl/layout/store/useLightingStore";

// ─────────────────────────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────────────────────────

const TYPE_ICON = {
  hemisphere: <LightModeRoundedIcon sx={{ fontSize: 14 }} />,
  directional: <WbSunnyRoundedIcon sx={{ fontSize: 14 }} />,
  spot: <HighlightRoundedIcon sx={{ fontSize: 14 }} />,
  rect: <CropPortraitRoundedIcon sx={{ fontSize: 14 }} />,
};

const TYPE_LABEL = {
  hemisphere: "Hemisphere",
  directional: "Directional",
  spot: "Spot",
  rect: "Rect Area",
};

// ─────────────────────────────────────────────────────────────────
// LightingPanel
// ─────────────────────────────────────────────────────────────────

export default function LightingPanel({ onClose }) {
  const lights = useLightingStore((s) => s.lights);
  const addLight = useLightingStore((s) => s.addLight);

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* ── ヘッダー ────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: `1px solid ${alpha("#fff", 0.08)}`,
          flexShrink: 0,
          gap: 0.5,
        }}
      >
        <Typography sx={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>Lighting</Typography>
        <Typography sx={{ fontSize: 11, opacity: 0.4 }}>{lights.length}</Typography>
        <Box sx={{ flex: 1 }} />

        {/* ライト追加ボタン群 */}
        <Tooltip title="Directional Light を追加">
          <IconButton size="small" onClick={() => addLight("directional")} sx={addBtnSx}>
            <WbSunnyRoundedIcon sx={{ fontSize: 13 }} />
            <AddRoundedIcon sx={{ fontSize: 10, ml: -0.25 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Spot Light を追加">
          <IconButton size="small" onClick={() => addLight("spot")} sx={addBtnSx}>
            <HighlightRoundedIcon sx={{ fontSize: 13 }} />
            <AddRoundedIcon sx={{ fontSize: 10, ml: -0.25 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Rect Area Light を追加">
          <IconButton size="small" onClick={() => addLight("rect")} sx={addBtnSx}>
            <CropPortraitRoundedIcon sx={{ fontSize: 13 }} />
            <AddRoundedIcon sx={{ fontSize: 10, ml: -0.25 }} />
          </IconButton>
        </Tooltip>

        <IconButton size="small" onClick={onClose} sx={{ borderRadius: 1.5 }}>
          <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      {/* ── ライトリスト ─────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 1.25 }}>
        {lights.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              opacity: 0.35,
              userSelect: "none",
            }}
          >
            <Typography sx={{ fontSize: 12 }}>上のボタンからライトを追加</Typography>
          </Box>
        ) : (
          <Stack spacing={0.75}>
            {lights.map((light) => (
              <LightCard key={light.id} light={light} />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

const addBtnSx = {
  borderRadius: 1.25,
  background: alpha("#fff", 0.06),
  "&:hover": { background: alpha("#fff", 0.12) },
  px: 0.6,
  gap: 0,
};

// ─────────────────────────────────────────────────────────────────
// LightCard — 1ライトの折りたたみカード
// ─────────────────────────────────────────────────────────────────

function LightCard({ light }) {
  const [expanded, setExpanded] = useState(true);
  const updateLight = useLightingStore((s) => s.updateLight);
  const removeLight = useLightingStore((s) => s.removeLight);

  const update = useCallback((patch) => updateLight(light.id, patch), [light.id, updateLight]);

  const canDelete = light.id !== "ambience" && light.id !== "sun";

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${alpha("#fff", light.visible ? 0.1 : 0.05)}`,
        background: alpha("#fff", light.visible ? 0.03 : 0.01),
        overflow: "hidden",
        transition: "opacity 0.2s",
        opacity: light.visible ? 1 : 0.5,
      }}
    >
      {/* カードヘッダー */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{ px: 1.25, py: 0.75, cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Box sx={{ color: alpha("#fff", 0.55), display: "flex" }}>{TYPE_ICON[light.type]}</Box>
        <Typography sx={{ fontSize: 12, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {light.name}
        </Typography>
        <Typography sx={{ fontSize: 10, opacity: 0.4 }}>{TYPE_LABEL[light.type]}</Typography>

        {/* 表示トグル */}
        <Box onClick={(e) => e.stopPropagation()}>
          <Switch
            size="small"
            checked={light.visible}
            onChange={(e) => update({ visible: e.target.checked })}
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": { color: "#6c87ff" },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: alpha("#6c87ff", 0.4) },
            }}
          />
        </Box>

        {canDelete && (
          <Box onClick={(e) => e.stopPropagation()}>
            <Tooltip title="削除">
              <IconButton
                size="small"
                onClick={() => removeLight(light.id)}
                sx={{ p: 0.3, color: alpha("#fff", 0.4), "&:hover": { color: "#ff7070" } }}
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <ExpandMoreRoundedIcon
          sx={{
            fontSize: 16,
            opacity: 0.4,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </Stack>

      {/* プロパティ */}
      <Collapse in={expanded}>
        <Divider sx={{ borderColor: alpha("#fff", 0.07) }} />
        <Box sx={{ px: 1.5, py: 1.25 }}>
          {light.type === "hemisphere" && <HemisphereProps light={light} update={update} />}
          {light.type === "directional" && <DirectionalProps light={light} update={update} />}
          {light.type === "spot" && <SpotProps light={light} update={update} />}
          {light.type === "rect" && <RectProps light={light} update={update} />}
        </Box>
      </Collapse>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────
// 共通サブコンポーネント
// ─────────────────────────────────────────────────────────────────

function PropRow({ label, children }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75, minHeight: 26 }}>
      <Typography sx={{ fontSize: 11, opacity: 0.55, minWidth: 76, flexShrink: 0 }}>{label}</Typography>
      {children}
    </Stack>
  );
}

function ColorInput({ value, onChange }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box
        component="input"
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          width: 24,
          height: 18,
          border: `1px solid ${alpha("#fff", 0.18)}`,
          borderRadius: "4px",
          cursor: "pointer",
          padding: 0,
          background: "none",
          flexShrink: 0,
        }}
      />
      <Typography sx={{ fontSize: 10, opacity: 0.45, fontFamily: "monospace" }}>{value}</Typography>
    </Stack>
  );
}

function IntensitySlider({ value, onChange, max = 3 }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
      <Slider
        size="small"
        min={0}
        max={max}
        step={0.05}
        value={value}
        onChange={(_, v) => onChange(v)}
        sx={{
          flex: 1,
          color: "#6c87ff",
          "& .MuiSlider-thumb": { width: 10, height: 10 },
          "& .MuiSlider-rail": { opacity: 0.3 },
        }}
      />
      <Typography sx={{ fontSize: 11, opacity: 0.6, minWidth: 28, textAlign: "right" }}>
        {value.toFixed(1)}
      </Typography>
    </Stack>
  );
}

function AngleDegSlider({ label, value, min = 0, max = 360, step = 1, onChange }) {
  return (
    <PropRow label={label}>
      <Slider
        size="small"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(_, v) => onChange(v)}
        sx={{
          flex: 1,
          color: "#6c87ff",
          "& .MuiSlider-thumb": { width: 10, height: 10 },
          "& .MuiSlider-rail": { opacity: 0.3 },
        }}
      />
      <Typography sx={{ fontSize: 11, opacity: 0.6, minWidth: 32, textAlign: "right" }}>
        {value}°
      </Typography>
    </PropRow>
  );
}

function XYZInput({ label, value, onChange, step = 0.1 }) {
  return (
    <PropRow label={label}>
      {["X", "Y", "Z"].map((axis, i) => (
        <Stack key={axis} direction="row" alignItems="center" spacing={0.25}>
          <Typography sx={{ fontSize: 10, opacity: 0.4, minWidth: 10 }}>{axis}</Typography>
          <Box
            component="input"
            type="number"
            value={value[i]}
            step={step}
            onChange={(e) => {
              const next = [...value];
              next[i] = parseFloat(e.target.value) || 0;
              onChange(next);
            }}
            sx={{
              width: 52,
              background: alpha("#fff", 0.06),
              border: `1px solid ${alpha("#fff", 0.1)}`,
              borderRadius: "6px",
              color: "#fff",
              fontSize: 11,
              px: 0.75,
              py: 0.3,
              outline: "none",
              "&:focus": { borderColor: alpha("#6c87ff", 0.6) },
              MozAppearance: "textfield",
              "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
            }}
          />
        </Stack>
      ))}
    </PropRow>
  );
}

// ─────────────────────────────────────────────────────────────────
// 型別プロパティ
// ─────────────────────────────────────────────────────────────────

function HemisphereProps({ light, update }) {
  return (
    <>
      <PropRow label="Sky Color">
        <ColorInput value={light.color} onChange={(v) => update({ color: v })} />
      </PropRow>
      <PropRow label="Ground Color">
        <ColorInput value={light.groundColor ?? "#7a6a58"} onChange={(v) => update({ groundColor: v })} />
      </PropRow>
      <PropRow label="Intensity">
        <IntensitySlider value={light.intensity} onChange={(v) => update({ intensity: v })} />
      </PropRow>
    </>
  );
}

function DirectionalProps({ light, update }) {
  return (
    <>
      <PropRow label="Color">
        <ColorInput value={light.color} onChange={(v) => update({ color: v })} />
      </PropRow>
      <PropRow label="Intensity">
        <IntensitySlider value={light.intensity} onChange={(v) => update({ intensity: v })} />
      </PropRow>
      <AngleDegSlider
        label="Azimuth"
        value={light.azimuth ?? 45}
        min={0} max={360}
        onChange={(v) => update({ azimuth: v })}
      />
      <AngleDegSlider
        label="Elevation"
        value={light.elevation ?? 50}
        min={0} max={90}
        onChange={(v) => update({ elevation: v })}
      />
      <PropRow label="Distance">
        <Slider
          size="small"
          min={1} max={100} step={1}
          value={light.distance ?? 13}
          onChange={(_, v) => update({ distance: v })}
          sx={{ flex: 1, color: "#6c87ff", "& .MuiSlider-thumb": { width: 10, height: 10 }, "& .MuiSlider-rail": { opacity: 0.3 } }}
        />
        <Typography sx={{ fontSize: 11, opacity: 0.6, minWidth: 28, textAlign: "right" }}>
          {light.distance ?? 13}
        </Typography>
      </PropRow>
      <PropRow label="Cast Shadow">
        <Switch
          size="small"
          checked={light.castShadow ?? false}
          onChange={(e) => update({ castShadow: e.target.checked })}
          sx={{
            "& .MuiSwitch-switchBase.Mui-checked": { color: "#6c87ff" },
            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: alpha("#6c87ff", 0.4) },
          }}
        />
      </PropRow>
    </>
  );
}

function SpotProps({ light, update }) {
  const rad2deg = (r) => Math.round((r * 180) / Math.PI);
  const deg2rad = (d) => (d * Math.PI) / 180;

  return (
    <>
      <PropRow label="Color">
        <ColorInput value={light.color} onChange={(v) => update({ color: v })} />
      </PropRow>
      <PropRow label="Intensity">
        <IntensitySlider value={light.intensity} max={10} onChange={(v) => update({ intensity: v })} />
      </PropRow>
      <XYZInput
        label="Position"
        value={light.position ?? [0, 5, 0]}
        onChange={(v) => update({ position: v })}
      />
      <XYZInput
        label="Target"
        value={light.targetPosition ?? [0, 0, 0]}
        onChange={(v) => update({ targetPosition: v })}
      />
      <AngleDegSlider
        label="Angle"
        value={rad2deg(light.angle ?? Math.PI / 6)}
        min={1} max={89}
        onChange={(v) => update({ angle: deg2rad(v) })}
      />
      <PropRow label="Penumbra">
        <Slider
          size="small" min={0} max={1} step={0.01}
          value={light.penumbra ?? 0.2}
          onChange={(_, v) => update({ penumbra: v })}
          sx={{ flex: 1, color: "#6c87ff", "& .MuiSlider-thumb": { width: 10, height: 10 }, "& .MuiSlider-rail": { opacity: 0.3 } }}
        />
        <Typography sx={{ fontSize: 11, opacity: 0.6, minWidth: 28, textAlign: "right" }}>
          {(light.penumbra ?? 0.2).toFixed(2)}
        </Typography>
      </PropRow>
      <PropRow label="Distance">
        <Slider
          size="small" min={0.5} max={50} step={0.5}
          value={light.spotDistance ?? 20}
          onChange={(_, v) => update({ spotDistance: v })}
          sx={{ flex: 1, color: "#6c87ff", "& .MuiSlider-thumb": { width: 10, height: 10 }, "& .MuiSlider-rail": { opacity: 0.3 } }}
        />
        <Typography sx={{ fontSize: 11, opacity: 0.6, minWidth: 28, textAlign: "right" }}>
          {light.spotDistance ?? 20}
        </Typography>
      </PropRow>
      <PropRow label="Cast Shadow">
        <Switch
          size="small"
          checked={light.castShadow ?? false}
          onChange={(e) => update({ castShadow: e.target.checked })}
          sx={{
            "& .MuiSwitch-switchBase.Mui-checked": { color: "#6c87ff" },
            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: alpha("#6c87ff", 0.4) },
          }}
        />
      </PropRow>
    </>
  );
}

function RectProps({ light, update }) {
  return (
    <>
      <PropRow label="Color">
        <ColorInput value={light.color} onChange={(v) => update({ color: v })} />
      </PropRow>
      <PropRow label="Intensity">
        <IntensitySlider value={light.intensity} max={20} onChange={(v) => update({ intensity: v })} />
      </PropRow>
      <XYZInput
        label="Position"
        value={light.rectPosition ?? [0, 3, 0]}
        onChange={(v) => update({ rectPosition: v })}
      />
      <AngleDegSlider
        label="Rotation X"
        value={light.rectRotationX ?? -90}
        min={-180} max={180}
        onChange={(v) => update({ rectRotationX: v })}
      />
      <PropRow label="Width">
        <Slider
          size="small" min={0.1} max={20} step={0.1}
          value={light.width ?? 4}
          onChange={(_, v) => update({ width: v })}
          sx={{ flex: 1, color: "#6c87ff", "& .MuiSlider-thumb": { width: 10, height: 10 }, "& .MuiSlider-rail": { opacity: 0.3 } }}
        />
        <Typography sx={{ fontSize: 11, opacity: 0.6, minWidth: 28, textAlign: "right" }}>
          {(light.width ?? 4).toFixed(1)}
        </Typography>
      </PropRow>
      <PropRow label="Height">
        <Slider
          size="small" min={0.1} max={20} step={0.1}
          value={light.height ?? 4}
          onChange={(_, v) => update({ height: v })}
          sx={{ flex: 1, color: "#6c87ff", "& .MuiSlider-thumb": { width: 10, height: 10 }, "& .MuiSlider-rail": { opacity: 0.3 } }}
        />
        <Typography sx={{ fontSize: 11, opacity: 0.6, minWidth: 28, textAlign: "right" }}>
          {(light.height ?? 4).toFixed(1)}
        </Typography>
      </PropRow>
    </>
  );
}
