// PropertiesLandscapePanel.jsx — Landscape (Flat / Sky) の設定
import React from "react";
import {
  Box,
  Typography,
  Slider,
  Switch,
  Divider,
  Stack,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import LandscapeRoundedIcon from "@mui/icons-material/LandscapeRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";

import { useEnvironmentStore } from "../../../../../store/useEnvironmentStore";

const SKY_PRESETS = [
  { id: "park", label: "Park (緑地・昼)" },
  { id: "sunset", label: "Sunset (夕焼け)" },
  { id: "dawn", label: "Dawn (朝焼け)" },
  { id: "night", label: "Night (夜)" },
  { id: "forest", label: "Forest (森)" },
  { id: "city", label: "City (都市)" },
  { id: "apartment", label: "Apartment (室内)" },
  { id: "studio", label: "Studio" },
  { id: "warehouse", label: "Warehouse" },
  { id: "lobby", label: "Lobby" },
];

const SKY_RESOLUTIONS = [
  { value: 256, label: "256 (低)" },
  { value: 512, label: "512" },
  { value: 1024, label: "1024" },
  { value: 2048, label: "2048 (標準)" },
  { value: 4096, label: "4096 (高画質)" },
];

const TERRAIN_PRESETS = [
  { id: "grass", label: "Grass (芝生)" },
  { id: "dirt", label: "Dirt (土)" },
  { id: "concrete", label: "Concrete (コンクリート)" },
  { id: "stone", label: "Stone (石)" },
  { id: "snow", label: "Snow (雪)" },
  { id: "water", label: "Water (水)" },
];

function Row({ label, children }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 12, opacity: 0.7, minWidth: 88 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}

function SectionHeader({ icon, title, visible, onToggleVisible }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ mb: 1.25, mt: 0.5 }}
    >
      <Box sx={{ display: "grid", placeItems: "center", opacity: 0.9 }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
        {title}
      </Typography>
      <IconButton
        size="small"
        onClick={onToggleVisible}
        sx={{ p: 0.5, opacity: visible ? 0.85 : 0.4 }}
        title={visible ? "Hide" : "Show"}
      >
        {visible ? (
          <VisibilityRoundedIcon sx={{ fontSize: 16 }} />
        ) : (
          <VisibilityOffRoundedIcon sx={{ fontSize: 16 }} />
        )}
      </IconButton>
    </Stack>
  );
}

function FlatProperties() {
  const flatVisible = useEnvironmentStore((s) => s.flatVisible);
  const setFlatVisible = useEnvironmentStore((s) => s.setFlatVisible);
  const flatPreset = useEnvironmentStore((s) => s.flatPreset);
  const setFlatPreset = useEnvironmentStore((s) => s.setFlatPreset);
  const flatColor = useEnvironmentStore((s) => s.flatColor);
  const setFlatColor = useEnvironmentStore((s) => s.setFlatColor);
  const flatRoughness = useEnvironmentStore((s) => s.flatRoughness);
  const setFlatRoughness = useEnvironmentStore((s) => s.setFlatRoughness);
  const flatTextureEnabled = useEnvironmentStore((s) => s.flatTextureEnabled);
  const setFlatTextureEnabled = useEnvironmentStore(
    (s) => s.setFlatTextureEnabled
  );
  const flatTileScale = useEnvironmentStore((s) => s.flatTileScale);
  const setFlatTileScale = useEnvironmentStore((s) => s.setFlatTileScale);
  const flatAntiTile = useEnvironmentStore((s) => s.flatAntiTile);
  const setFlatAntiTile = useEnvironmentStore((s) => s.setFlatAntiTile);

  return (
    <Box>
      <SectionHeader
        icon={
          <LandscapeRoundedIcon
            sx={{ fontSize: 18, color: "light-dark(#497637, #9bc88a)" }}
          />
        }
        title="Flat (地面)"
        visible={flatVisible}
        onToggleVisible={() => setFlatVisible(!flatVisible)}
      />

      <Row label="Preset">
        <Select
          size="small"
          fullWidth
          value={flatPreset}
          onChange={(e) => setFlatPreset(e.target.value)}
          sx={{
            height: 30,
            fontSize: 12.5,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha("#fff", 0.18),
            },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: "var(--brand-surface2)",
                border: `1px solid ${alpha("#fff", 0.1)}`,
                "& .MuiMenuItem-root": { fontSize: 12.5, color: "var(--brand-fg)" },
              },
            },
          }}
        >
          {TERRAIN_PRESETS.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </Row>

      <Row label="Color">
        <Stack direction="row" spacing={1} alignItems="center">
          <input
            type="color"
            value={flatColor}
            onChange={(e) => setFlatColor(e.target.value)}
            style={{
              width: 32,
              height: 24,
              border: "1px solid rgb(var(--brand-fg-rgb) / 0.15)",
              borderRadius: 4,
              background: "transparent",
              cursor: "pointer",
            }}
          />
          <Typography sx={{ fontSize: 12, opacity: 0.8, fontFamily: "monospace" }}>
            {flatColor.toUpperCase()}
          </Typography>
        </Stack>
      </Row>

      <Row label="Roughness">
        <Stack direction="row" spacing={1} alignItems="center">
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.01}
            value={flatRoughness}
            onChange={(_, v) => setFlatRoughness(Number(v))}
            sx={{ flex: 1 }}
          />
          <Typography sx={{ fontSize: 12, opacity: 0.75, minWidth: 32 }}>
            {flatRoughness.toFixed(2)}
          </Typography>
        </Stack>
      </Row>

      <Row label="Texture">
        <Stack direction="row" spacing={1} alignItems="center">
          <Switch
            size="small"
            checked={flatTextureEnabled}
            onChange={(e) => setFlatTextureEnabled(e.target.checked)}
          />
          <Typography sx={{ fontSize: 12, opacity: 0.6 }}>
            {flatTextureEnabled ? "Grass" : "Solid"}
          </Typography>
        </Stack>
      </Row>

      <Row label="Tile Scale">
        <Stack direction="row" spacing={1} alignItems="center">
          <Slider
            size="small"
            min={0.2}
            max={3}
            step={0.05}
            value={flatTileScale}
            onChange={(_, v) => setFlatTileScale(Number(v))}
            disabled={!flatTextureEnabled}
            sx={{ flex: 1 }}
          />
          <Typography sx={{ fontSize: 12, opacity: 0.75, minWidth: 32 }}>
            {flatTileScale.toFixed(2)}x
          </Typography>
        </Stack>
      </Row>

      <Row label="Random">
        <Stack direction="row" spacing={1} alignItems="center">
          <Switch
            size="small"
            checked={flatAntiTile}
            onChange={(e) => setFlatAntiTile(e.target.checked)}
            disabled={!flatTextureEnabled}
          />
          <Typography sx={{ fontSize: 12, opacity: 0.6 }}>
            {flatAntiTile ? "ON (タイル感解消)" : "OFF"}
          </Typography>
        </Stack>
      </Row>
    </Box>
  );
}

function SkyProperties() {
  const skyVisible = useEnvironmentStore((s) => s.skyVisible);
  const setSkyVisible = useEnvironmentStore((s) => s.setSkyVisible);
  const skyPreset = useEnvironmentStore((s) => s.skyPreset);
  const setSkyPreset = useEnvironmentStore((s) => s.setSkyPreset);
  const skyBlur = useEnvironmentStore((s) => s.skyBlur);
  const setSkyBlur = useEnvironmentStore((s) => s.setSkyBlur);
  const skyResolution = useEnvironmentStore((s) => s.skyResolution);
  const setSkyResolution = useEnvironmentStore((s) => s.setSkyResolution);
  const skyBackgroundColor = useEnvironmentStore((s) => s.skyBackgroundColor);
  const setSkyBackgroundColor = useEnvironmentStore(
    (s) => s.setSkyBackgroundColor
  );

  // discrete slider にしたいので、index ↔ value 変換
  const resolutionValues = SKY_RESOLUTIONS.map((r) => r.value);
  const resolutionIndex = Math.max(
    0,
    resolutionValues.indexOf(skyResolution)
  );
  const currentResolutionLabel =
    SKY_RESOLUTIONS[resolutionIndex]?.label ?? `${skyResolution}`;

  return (
    <Box>
      <SectionHeader
        icon={
          <CloudRoundedIcon sx={{ fontSize: 18, color: "light-dark(#1a5793, #9fc7ee)" }} />
        }
        title="Sky (空 / HDR Environment)"
        visible={skyVisible}
        onToggleVisible={() => setSkyVisible(!skyVisible)}
      />

      <Row label="Preset">
        <Select
          size="small"
          fullWidth
          value={skyPreset}
          onChange={(e) => setSkyPreset(e.target.value)}
          disabled={!skyVisible}
          sx={{
            height: 30,
            fontSize: 12.5,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha("#fff", 0.18),
            },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: "var(--brand-surface2)",
                border: `1px solid ${alpha("#fff", 0.1)}`,
                "& .MuiMenuItem-root": { fontSize: 12.5, color: "var(--brand-fg)" },
              },
            },
          }}
        >
          {SKY_PRESETS.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </Row>

      <Row label="Blur">
        <Stack direction="row" spacing={1} alignItems="center">
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.01}
            value={skyBlur}
            onChange={(_, v) => setSkyBlur(Number(v))}
            disabled={!skyVisible}
            sx={{ flex: 1 }}
          />
          <Typography sx={{ fontSize: 12, opacity: 0.75, minWidth: 32 }}>
            {skyBlur.toFixed(2)}
          </Typography>
        </Stack>
      </Row>

      <Row label="Resolution">
        <Stack direction="row" spacing={1} alignItems="center">
          <Slider
            size="small"
            min={0}
            max={SKY_RESOLUTIONS.length - 1}
            step={1}
            marks
            value={resolutionIndex}
            onChange={(_, v) => {
              const idx = Math.max(0, Math.min(SKY_RESOLUTIONS.length - 1, Number(v)));
              setSkyResolution(resolutionValues[idx]);
            }}
            disabled={!skyVisible}
            sx={{ flex: 1 }}
          />
          <Typography sx={{ fontSize: 11.5, opacity: 0.75, minWidth: 72, textAlign: "right" }}>
            {currentResolutionLabel}
          </Typography>
        </Stack>
      </Row>

      <Row label="BG Color">
        <Stack direction="row" spacing={1} alignItems="center">
          <input
            type="color"
            value={skyBackgroundColor}
            onChange={(e) => setSkyBackgroundColor(e.target.value)}
            disabled={skyVisible}
            style={{
              width: 32,
              height: 24,
              border: "1px solid rgb(var(--brand-fg-rgb) / 0.15)",
              borderRadius: 4,
              background: "transparent",
              cursor: skyVisible ? "not-allowed" : "pointer",
              opacity: skyVisible ? 0.4 : 1,
            }}
          />
          <Typography sx={{ fontSize: 11.5, opacity: 0.55 }}>
            {skyVisible ? "HDR有効時は無効" : skyBackgroundColor.toUpperCase()}
          </Typography>
        </Stack>
      </Row>
    </Box>
  );
}

export default function PropertiesLandscapePanel({ target }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 11,
          opacity: 0.45,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          fontWeight: 600,
          mb: 1.25,
        }}
      >
        Landscape · {target === "sky" ? "Sky" : "Flat"}
      </Typography>

      {target === "sky" ? <SkyProperties /> : <FlatProperties />}

      <Divider sx={{ my: 2, borderColor: alpha("#fff", 0.08) }} />

      {/* 反対側も表示しておくとアウトライナを開き直さず両方触れる */}
      <Box sx={{ opacity: 0.8 }}>
        {target === "sky" ? <FlatProperties /> : <SkyProperties />}
      </Box>
    </Box>
  );
}
