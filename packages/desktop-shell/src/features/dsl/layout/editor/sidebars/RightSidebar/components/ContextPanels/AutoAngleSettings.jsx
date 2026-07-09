// AutoAngleSettings.jsx
// 右サイドバー（パース/動画 設定）に置く「自動アングル生成」の設定 UI。
// 撮影スタイルのプリセット＋詳細（アングル数 / 目線の高さ / 構図の寄り / 家具回避）。
// 値は useAutoAngleSettingsStore に保存され、generateAutoAngles() が家具配置・高さと
// 合わせてプロ品質のアングルを生成する。
import React from "react";
import { Box, Stack, Typography, ToggleButtonGroup, ToggleButton, Slider, Switch, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CameraIndoorRoundedIcon from "@mui/icons-material/CameraIndoorRounded";

import SidePanelSection from "./SidePanelSection";
import {
  useAutoAngleSettingsStore,
  ANGLE_STYLE_LABEL,
  EYE_HEIGHT_LABEL,
  FRAMING_LABEL,
} from "../../../../../store/useAutoAngleSettingsStore";

const STYLE_DESC = {
  realestate: "立位アイレベル・広めで部屋の広さが伝わる王道",
  magazine: "座位・標準で家具を主役にしたドラマ性のある構図",
  catalog: "座位・寄りで家具ディテールを中心に",
};

export default function AutoAngleSettings({ accent = "#6c87ff" }) {
  const style = useAutoAngleSettingsStore((s) => s.style);
  const count = useAutoAngleSettingsStore((s) => s.count);
  const eyeHeight = useAutoAngleSettingsStore((s) => s.eyeHeight);
  const framing = useAutoAngleSettingsStore((s) => s.framing);
  const avoidFurniture = useAutoAngleSettingsStore((s) => s.avoidFurniture);
  const setStyle = useAutoAngleSettingsStore((s) => s.setStyle);
  const setCount = useAutoAngleSettingsStore((s) => s.setCount);
  const setEyeHeight = useAutoAngleSettingsStore((s) => s.setEyeHeight);
  const setFraming = useAutoAngleSettingsStore((s) => s.setFraming);
  const setAvoidFurniture = useAutoAngleSettingsStore((s) => s.setAvoidFurniture);

  const Label = ({ children }) => (
    <Typography sx={{ fontSize: 10, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", letterSpacing: 0.3, mb: 0.5 }}>
      {children}
    </Typography>
  );

  const groupSx = {
    width: "100%",
    mb: 1.1,
    "& .MuiToggleButton-root": {
      flex: 1, py: 0.35, fontSize: 10, textTransform: "none", fontWeight: 600,
      border: `1px solid ${alpha("#fff", 0.12)}`, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)",
      "&.Mui-selected": { color: "var(--brand-fg)", background: alpha(accent, 0.25), borderColor: alpha(accent, 0.5) },
    },
  };

  return (
    <SidePanelSection icon={<CameraIndoorRoundedIcon />} title="自動アングル生成" accent={accent} defaultOpen>
      {/* 撮影スタイル */}
      <Label>撮影スタイル</Label>
      <ToggleButtonGroup value={style} exclusive size="small" sx={groupSx}
        onChange={(_, v) => v && setStyle(v)}>
        {Object.entries(ANGLE_STYLE_LABEL).map(([k, label]) => (
          <ToggleButton key={k} value={k}>{label}</ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography sx={{ fontSize: 9, opacity: 0.42, mt: -0.6, mb: 1.1, lineHeight: 1.5 }}>
        {STYLE_DESC[style]}
      </Typography>

      {/* アングル数 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Label>アングル数</Label>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: accent }}>{count}</Typography>
      </Stack>
      <Slider
        value={count} min={2} max={10} step={1} size="small"
        onChange={(_, v) => setCount(Array.isArray(v) ? v[0] : v)}
        sx={{ color: accent, mb: 1, "& .MuiSlider-thumb": { width: 11, height: 11 } }}
      />

      {/* 目線の高さ */}
      <Label>目線の高さ</Label>
      <ToggleButtonGroup value={eyeHeight} exclusive size="small" sx={groupSx}
        onChange={(_, v) => v && setEyeHeight(v)}>
        {Object.entries(EYE_HEIGHT_LABEL).map(([k, label]) => (
          <ToggleButton key={k} value={k} sx={{ fontSize: "8.5px !important", px: "2px !important" }}>{label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* 構図の寄り */}
      <Label>構図の寄り</Label>
      <ToggleButtonGroup value={framing} exclusive size="small" sx={groupSx}
        onChange={(_, v) => v && setFraming(v)}>
        {Object.entries(FRAMING_LABEL).map(([k, label]) => (
          <ToggleButton key={k} value={k}>{label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* 家具を避ける */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Tooltip title="カメラを家具の内側に置かず、遮蔽が少ない位置から狙います" placement="left">
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" }}>家具を避けて配置</Typography>
        </Tooltip>
        <Switch
          size="small"
          checked={avoidFurniture}
          onChange={(e) => setAvoidFurniture(e.target.checked)}
          sx={{ "& .Mui-checked": { color: accent }, "& .Mui-checked + .MuiSwitch-track": { backgroundColor: `${accent} !important` } }}
        />
      </Stack>
    </SidePanelSection>
  );
}
