// src/features/dsl/layout/editor/sidebars/RightSidebar/components/ContextPanels/MediaSettingsPanel.jsx
//
// ボトムの Media パネルを開いている間、右サイドバー Properties に表示される
// Media 用の設定パネル。設定値は useMediaSettingsStore でボトムパネルと共有。
import React, { useState, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Slider,
  CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import MovieCreationRoundedIcon from "@mui/icons-material/MovieCreationRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import { CAMERA_PATH_PRESETS } from "../../../../../services/cameraPaths";
import { useMediaSettingsStore } from "../../../../../store/useMediaSettingsStore";
import { useVideoRenderStore } from "../../../../../store/useVideoRenderStore";
import { useShotStore } from "../../../../../store/useShotStore";
import { useMediaRenderStore } from "../../../../../store/useMediaRenderStore";
import AngleSetManager from "./AngleSetManager";
import AngleSettings from "./AngleSettings";
import AutoAngleSettings from "./AutoAngleSettings";

const SectionLabel = ({ children }) => (
  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: alpha("#fff", 0.45), letterSpacing: 0.4, mb: 0.6 }}>
    {children}
  </Typography>
);

const VIDEO_MODE_DESC = {
  fast: "影なし・ビューポート同等の品質で最速",
  quality: "影あり・アンチエイリアス強化",
  cycles: "Blender Cycles によるフォトリアル",
};

export default function MediaSettingsPanel() {
  const selectedShotIds = useMediaSettingsStore((s) => s.selectedShotIds);
  const videoMode       = useMediaSettingsStore((s) => s.videoMode);
  const setVideoMode    = useMediaSettingsStore((s) => s.setVideoMode);
  const videoPreset            = useMediaSettingsStore((s) => s.videoPreset);
  const setVideoPreset         = useMediaSettingsStore((s) => s.setVideoPreset);
  const selectPresetAndPreview = useMediaSettingsStore((s) => s.selectPresetAndPreview);
  const videoDuration    = useMediaSettingsStore((s) => s.videoDuration);
  const setVideoDuration = useMediaSettingsStore((s) => s.setVideoDuration);
  const videoIntensity    = useMediaSettingsStore((s) => s.videoIntensity);
  const setVideoIntensity = useMediaSettingsStore((s) => s.setVideoIntensity);
  const previewPlaying  = useMediaSettingsStore((s) => s.previewPlaying);
  const togglePreview   = useMediaSettingsStore((s) => s.togglePreview);

  const videoStatus = useVideoRenderStore((s) => s.status);
  const videoRendering = videoStatus === "rendering";

  // 下部ギャラリーで選択中のアングル（movie）。あればその個別設定を表示。
  const activeShotId = useShotStore((s) => s.activeShotId);
  const focusedShot  = useShotStore((s) => s.shots.find((x) => x.id === s.activeShotId));
  const showAngle = focusedShot && (focusedShot.kind ?? "still") === "movie";

  const [error, setError] = useState(null);

  const selectedCount = selectedShotIds.length;
  const requestRender = useMediaRenderStore((s) => s.requestRender);

  const handlePreview = useCallback(() => {
    const err = togglePreview();
    setError(err);
  }, [togglePreview]);

  // 予想時間（MediaPanel と同じ実測ベース概算）
  const frames = videoDuration * 30;
  const perFrame = videoMode === "fast" ? 0.25 : videoMode === "quality" ? 1.2 : 19;
  const estSec = Math.round(frames * perFrame);
  const estText = estSec < 90 ? `約${estSec}秒` : `約${Math.round(estSec / 60)}分`;

  const toggleSx = {
    width: "100%",
    "& .MuiToggleButton-root": {
      flex: 1,
      py: 0.4,
      fontSize: 10.5,
      textTransform: "none",
      fontWeight: 600,
      border: `1px solid ${alpha("#fff", 0.12)}`,
      color: alpha("#fff", 0.45),
      "&.Mui-selected": {
        color: "#c4b5fd",
        background: alpha("#a78bfa", 0.18),
        borderColor: alpha("#a78bfa", 0.5),
      },
      "&.Mui-disabled": { opacity: 0.3 },
    },
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", color: alpha("#fff", 0.92) }}>
    <Box
      sx={{
        flex: 1, minHeight: 0, p: 1.5, overflowY: "auto",
        "&::-webkit-scrollbar": { width: 8 },
        "&::-webkit-scrollbar-thumb": { background: alpha("#fff", 0.14), borderRadius: 20 },
      }}
    >
      {/* ── ヘッダー ── */}
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
        <MovieCreationRoundedIcon sx={{ fontSize: 15, color: "#c4b5fd" }} />
        <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>自動動画生成 設定</Typography>
      </Stack>
      <Typography sx={{ fontSize: 10, opacity: 0.42, mb: 1.5 }}>
        {selectedCount > 0
          ? `${selectedCount} Shot 選択中`
          : "下のカメラアングル・ギャラリーで選び ← → ＋ Enter / Space で生成"}
      </Typography>

      {/* 選択中アングルの個別設定（名前・レンズ） */}
      {showAngle && <AngleSettings shotId={activeShotId} accent="#a78bfa" />}

      {/* アングルセット（部屋・外観/内観で管理） */}
      <AngleSetManager kind="movie" accent="#a78bfa" />

      {/* 自動アングル生成 設定（家具・高さ考慮） */}
      <AutoAngleSettings accent="#a78bfa" />

      {/* ── 動画品質 ── */}
      <SectionLabel>動画品質</SectionLabel>
      <ToggleButtonGroup
        value={videoMode}
        exclusive
        onChange={(_, v) => v && setVideoMode(v)}
        size="small"
        disabled={videoRendering}
        sx={toggleSx}
      >
        <ToggleButton value="fast">速い</ToggleButton>
        <ToggleButton value="quality">高品質</ToggleButton>
        <ToggleButton value="cycles">Cycles</ToggleButton>
      </ToggleButtonGroup>
      <Typography sx={{ fontSize: 10, opacity: 0.42, mt: 0.5, mb: 1.5 }}>
        {VIDEO_MODE_DESC[videoMode]} ─ {estText}
      </Typography>

      {/* ── カメラの動き ── */}
      <SectionLabel>カメラの動き</SectionLabel>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        {CAMERA_PATH_PRESETS.map((p) => {
          const active = p.id === videoPreset;
          const needsMore = selectedCount < p.minShots;
          return (
            <Box
              key={p.id}
              onClick={() => {
                if (videoRendering) return;
                const err = selectPresetAndPreview(p.id);
                if (err) setError(err);
              }}
              sx={{
                px: 1,
                py: 0.6,
                borderRadius: 1.5,
                cursor: videoRendering ? "default" : "pointer",
                border: `1px solid ${active ? alpha("#a78bfa", 0.55) : alpha("#fff", 0.08)}`,
                background: active ? alpha("#a78bfa", 0.12) : "transparent",
                transition: "border-color 0.12s, background 0.12s",
                "&:hover": videoRendering ? {} : {
                  borderColor: active ? alpha("#a78bfa", 0.7) : alpha("#fff", 0.2),
                  background: active ? alpha("#a78bfa", 0.16) : alpha("#fff", 0.04),
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: active ? 800 : 600,
                    color: active ? "#c4b5fd" : alpha("#fff", 0.8),
                    flex: 1,
                  }}
                >
                  {p.label}
                </Typography>
                {p.minShots > 1 && (
                  <Typography
                    sx={{
                      fontSize: 8.5,
                      px: 0.5,
                      py: 0.1,
                      borderRadius: "6px",
                      background: alpha(needsMore ? "#f87171" : "#fff", 0.12),
                      color: needsMore ? alpha("#f87171", 0.9) : alpha("#fff", 0.5),
                    }}
                  >
                    {p.minShots} Shot 以上
                  </Typography>
                )}
                {active && <CheckRoundedIcon sx={{ fontSize: 13, color: "#c4b5fd" }} />}
              </Stack>
              <Typography sx={{ fontSize: 9.5, opacity: 0.48, lineHeight: 1.4 }}>{p.hint}</Typography>
            </Box>
          );
        })}
      </Stack>

      {/* ── 長さ ── */}
      <SectionLabel>長さ</SectionLabel>
      <ToggleButtonGroup
        value={videoDuration}
        exclusive
        onChange={(_, v) => v && setVideoDuration(v)}
        size="small"
        disabled={videoRendering}
        sx={{ ...toggleSx, mb: 1.5 }}
      >
        {[4, 6, 8, 10, 15].map((d) => (
          <ToggleButton key={d} value={d}>{d}秒</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* ── 動きの強さ ── */}
      <SectionLabel>動きの強さ</SectionLabel>
      <Box sx={{ px: 1, mb: 1 }}>
        <Slider
          value={videoIntensity}
          onChange={(_, v) => setVideoIntensity(Number(v))}
          min={0.4}
          max={1.6}
          step={0.2}
          disabled={videoRendering || videoPreset === "shots"}
          marks={[
            { value: 0.4, label: "控えめ" },
            { value: 1.0, label: "標準" },
            { value: 1.6, label: "大きく" },
          ]}
          sx={{
            color: "#a78bfa",
            "& .MuiSlider-markLabel": { fontSize: 9, color: alpha("#fff", 0.4) },
            "& .MuiSlider-thumb": { width: 12, height: 12 },
            "& .MuiSlider-rail": { opacity: 0.2 },
          }}
        />
      </Box>
      {videoPreset === "shots" && (
        <Typography sx={{ fontSize: 9.5, opacity: 0.38, mb: 1 }}>
          Shot間フライスルーでは強さ設定は使用されません
        </Typography>
      )}

      {/* ── プレビュー ── */}
      <Button
        fullWidth
        size="small"
        onClick={handlePreview}
        disabled={videoRendering || selectedCount === 0}
        startIcon={
          previewPlaying
            ? <StopRoundedIcon sx={{ fontSize: 15 }} />
            : <PlayArrowRoundedIcon sx={{ fontSize: 15 }} />
        }
        sx={{
          borderRadius: 1.5,
          textTransform: "none",
          fontWeight: 800,
          fontSize: 11.5,
          py: 0.6,
          color: previewPlaying ? "#f87171" : "#c4b5fd",
          background: alpha(previewPlaying ? "#f87171" : "#a78bfa", 0.14),
          "&:hover": { background: alpha(previewPlaying ? "#f87171" : "#a78bfa", 0.26) },
          "&:disabled": { color: alpha("#fff", 0.25), background: alpha("#fff", 0.05) },
        }}
      >
        {previewPlaying ? "プレビューを停止" : "プレビュー"}
      </Button>
      <Typography sx={{ fontSize: 9.5, opacity: 0.38, mt: 0.5, textAlign: "center" }}>
        {previewPlaying
          ? "再生中…（終了後カメラは元の位置に戻ります）"
          : "カメラの動きをビューポートで再生して確認"}
      </Typography>
      {error && (
        <Typography sx={{ fontSize: 10, color: "#f87171", mt: 0.75 }}>{error}</Typography>
      )}
    </Box>

      {/* 固定フッター：生成ボタン（選択中アングルで動画を生成） */}
      <Box sx={{ flexShrink: 0, p: 1.25, borderTop: `1px solid ${alpha("#fff", 0.1)}`, background: alpha("#0b1020", 0.4) }}>
        <Button
          fullWidth
          variant="contained"
          disabled={videoRendering}
          onClick={requestRender}
          startIcon={videoRendering ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <MovieCreationRoundedIcon />}
          sx={{
            textTransform: "none", fontWeight: 900, fontSize: 12.5, py: 0.9, borderRadius: 2,
            background: "#a78bfa", "&:hover": { background: "#9170f0" },
            "&.Mui-disabled": { background: alpha("#a78bfa", 0.3), color: alpha("#fff", 0.5) },
          }}
        >
          {videoRendering ? "生成中…" : selectedCount > 0 ? `動画を生成（${selectedCount}）` : "動画を生成"}
        </Button>
        <Typography sx={{ fontSize: 9, opacity: 0.4, textAlign: "center", mt: 0.5 }}>
          {selectedCount > 0 ? `選択中 ${selectedCount} アングルで動画を生成` : "下のギャラリーでアングルを選択"}
        </Typography>
      </Box>
    </Box>
  );
}
