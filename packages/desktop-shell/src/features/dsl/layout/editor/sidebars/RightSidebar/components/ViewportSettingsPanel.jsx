// ViewportSettingsPanel — 右ドックの歯車アイコンで開く「ビューポート設定」パネル。
// 旧 ViewportQuickMenu（目アイコンの浮動メニュー）に内包していた
// 断面 Clipping / フロアグリッド / 背景 / 移動速度 を 1 つの常設パネルに集約し、
// さらに俯瞰レベル線の表示トグルもここに置く。サイドバー幅に収まるようコンパクトにまとめる。
//   - 断面 Clipping は「断面で高さを設定」のミニマップ UX を踏襲（SectionClipPlanControl）。
//   - 移動速度はアイコンを横並びにして縦方向の専有を抑える。
import React from "react";
import { Box, Typography, Switch, Divider, Stack, IconButton, Tooltip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import DirectionsBikeIcon from "@mui/icons-material/DirectionsBike";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import SearchIcon from "@mui/icons-material/Search";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";

import SectionClipPlanControl from "../../../../canvas/SectionClipPlanControl.jsx";
import GridSettingsDock from "../../../../canvas/menu/GridSettingsDock.jsx";
import BackgroundSettingsDock from "../../../../canvas/menu/BackgroundSettingsDock.jsx";
import { SPEED_MODES } from "../../../../canvas/menu/MoveSpeedDock.jsx";

import { useViewportUiStore } from "../../../../store/viewportUiStore";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import { useLevelLinesStore } from "../../../../store/useLevelLinesStore";
import { useViewportDisplayStore } from "../../../../store/useViewportDisplayStore";

const SPEED_ICONS = [
  { id: SPEED_MODES.FLY, label: "Fly", icon: <FlightTakeoffIcon sx={{ fontSize: 16 }} /> },
  { id: SPEED_MODES.DRIVE, label: "Drive", icon: <DirectionsCarIcon sx={{ fontSize: 16 }} /> },
  { id: SPEED_MODES.CYCLE, label: "Cycle", icon: <DirectionsBikeIcon sx={{ fontSize: 16 }} /> },
  { id: SPEED_MODES.WALK, label: "Walk", icon: <DirectionsWalkIcon sx={{ fontSize: 16 }} /> },
  { id: SPEED_MODES.INSPECT, label: "Inspect", icon: <SearchIcon sx={{ fontSize: 16 }} /> },
];

function SubHeader({ children, action }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22, mb: 0.6 }}>
      <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>
        {children}
      </Typography>
      {action}
    </Box>
  );
}

export default function ViewportSettingsPanel() {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  const speedMode = useViewportUiStore((s) => s.speedMode);
  const setSpeedMode = useViewportUiStore((s) => s.setSpeedMode);
  const speedMul = useViewportUiStore((s) => s.speedMul);

  const isSectionClipEnabled = useEditorModeStore((s) => s.isSectionClipEnabled);
  const setIsSectionClipEnabled = useEditorModeStore((s) => s.setIsSectionClipEnabled);
  const sectionClipYEnabled = useEditorModeStore((s) => s.sectionClipYEnabled);
  const setSectionClipYEnabled = useEditorModeStore((s) => s.setSectionClipYEnabled);
  const sectionClipXEnabled = useEditorModeStore((s) => s.sectionClipXEnabled);
  const sectionClipZEnabled = useEditorModeStore((s) => s.sectionClipZEnabled);

  const overviewVisible = useLevelLinesStore((s) => s.overviewVisible);
  const setOverviewVisible = useLevelLinesStore((s) => s.setOverviewVisible);

  // カメラビュー（俯瞰パース / 真上Top）は layoutCameraTilt で表現。モードに依らず保持。
  const layoutCameraTilt = useEditorModeStore((s) => s.layoutCameraTilt);
  const setLayoutCameraTilt = useEditorModeStore((s) => s.setLayoutCameraTilt);
  const cameraView = layoutCameraTilt === "top" || layoutCameraTilt === "ceiling" ? "top" : "persp";

  // 家具を半透明（ゴースト）— モードではなくビューポート設定で制御。
  const ghostFurniture = useViewportDisplayStore((s) => s.ghostFurniture);
  const setGhostFurniture = useViewportDisplayStore((s) => s.setGhostFurniture);

  // 断面マスタ ON 時、軸が全部 OFF だと何も切れないので高さ軸を有効化（直感的に効くように）。
  const toggleSection = (on) => {
    setIsSectionClipEnabled(on);
    if (on && !sectionClipYEnabled && !sectionClipXEnabled && !sectionClipZEnabled) {
      setSectionClipYEnabled(true);
    }
  };

  return (
    <Box
      sx={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        px: 1.25,
        py: 1.1,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      {/* カメラビュー（俯瞰パース / 真上Top）。全モード共通でここから切替（モード跨ぎ保持）。 */}
      <Box>
        <SubHeader>カメラビュー</SubHeader>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={cameraView}
          onChange={(_e, v) => { if (v) setLayoutCameraTilt(v === "top" ? "top" : "default"); }}
          sx={{
            width: "100%",
            "& .MuiToggleButton-root": {
              flex: 1, py: 0.5, gap: 0.5, fontSize: 11, fontWeight: 800, textTransform: "none",
              color: "color-mix(in srgb, var(--brand-fg) 65%, transparent)", border: `1px solid ${alpha("#fff", 0.14)}`,
              "&.Mui-selected": { color: "var(--brand-fg)", background: alpha(accent, 0.22), borderColor: alpha(accent, 0.6),
                "&:hover": { background: alpha(accent, 0.3) } },
            },
          }}
        >
          <ToggleButton value="persp"><ViewInArRoundedIcon sx={{ fontSize: 15 }} />俯瞰パース</ToggleButton>
          <ToggleButton value="top"><GridViewRoundedIcon sx={{ fontSize: 15 }} />真上 Top</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      {/* 家具を半透明（面マテリアル/面ラベル時に床・壁・天井を選びやすく） */}
      <Box>
        <SubHeader
          action={
            <Switch size="small" checked={ghostFurniture} onChange={(e) => setGhostFurniture(e.target.checked)} />
          }
        >
          家具を半透明
        </SubHeader>
        <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.5 }}>
          家具をゴースト表示にして、奥の床・壁・天井の面を選びやすくします（Material/面ラベル作業向け）。
        </Typography>
      </Box>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      {/* 断面 Clipping（最頻用）— ミニマップで直感操作 */}
      <Box>
        <SubHeader
          action={
            <Switch
              size="small"
              checked={isSectionClipEnabled}
              onChange={(e) => toggleSection(e.target.checked)}
            />
          }
        >
          断面 Clipping
        </SubHeader>
        <Box
          sx={{
            opacity: isSectionClipEnabled ? 1 : 0.4,
            pointerEvents: isSectionClipEnabled ? "auto" : "none",
            transition: "opacity 0.15s",
          }}
        >
          <SectionClipPlanControl />
        </Box>
      </Box>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      {/* 俯瞰レベル線（表示専用） */}
      <Box>
        <SubHeader
          action={
            <Switch
              size="small"
              checked={overviewVisible}
              onChange={(e) => setOverviewVisible(e.target.checked)}
            />
          }
        >
          俯瞰レベル線（GL / 各階FL）
        </SubHeader>
        <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.5 }}>
          俯瞰ビューに GL・各階の床レベル線を表示専用で重ねます（編集は「自動ラベル → 断面で高さを設定」）。
        </Typography>
      </Box>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      {/* フロアグリッド */}
      <Box>
        <SubHeader>フロアグリッド</SubHeader>
        <GridSettingsDock />
      </Box>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      {/* 背景色 */}
      <Box>
        <SubHeader>背景</SubHeader>
        <BackgroundSettingsDock />
      </Box>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      {/* 移動速度（横並びでコンパクトに） */}
      <Box>
        <SubHeader>移動速度（ナビゲーション）</SubHeader>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {SPEED_ICONS.map((m) => {
            const active = speedMode === m.id;
            return (
              <Tooltip key={m.id} title={m.label} placement="top">
                <IconButton
                  size="small"
                  onClick={() => setSpeedMode?.(m.id)}
                  sx={{
                    width: 34, height: 34, borderRadius: 1,
                    color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 72%, transparent)",
                    bgcolor: active ? alpha(accent, 0.85) : alpha("#fff", 0.05),
                    border: `1px solid ${active ? accent : alpha("#fff", 0.12)}`,
                    "&:hover": { bgcolor: active ? accent : alpha("#fff", 0.1) },
                  }}
                >
                  {m.icon}
                </IconButton>
              </Tooltip>
            );
          })}
          <Box sx={{ ml: 0.5, px: 0.85, py: 0.35, borderRadius: 0.8, bgcolor: "color-mix(in srgb, var(--brand-bg) 35%, transparent)" }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 900, opacity: 0.85 }}>
              x{Number(speedMul || 1).toFixed(1)}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
