// MediaStillSettingsPanel.jsx
// 右サイドバー：自動パース生成（静止画）専用の設定パネル。
// 動画用の MediaSettingsPanel とは別物（静止画の品質・解像度のみ）。
// 生成自体は下部のカメラアングル・ギャラリーで Enter / Space。
import React from "react";
import { Box, Stack, Typography, ToggleButtonGroup, ToggleButton, Button, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import { useMediaSettingsStore } from "../../../../../store/useMediaSettingsStore";
import { useShotStore } from "../../../../../store/useShotStore";
import { useMediaRenderStore } from "../../../../../store/useMediaRenderStore";
import AngleSetManager from "./AngleSetManager";
import AngleSettings from "./AngleSettings";
import AutoAngleSettings from "./AutoAngleSettings";
import SidePanelSection from "./SidePanelSection";

const ACCENT = "#6c87ff";

const STILL_QUALITY_DESC = {
  standard: "ビューポート同等で速い（影なし）",
  cycles: "Blender Cycles でフォトリアル（時間がかかります）",
};

export default function MediaStillSettingsPanel() {
  const stillQuality    = useMediaSettingsStore((s) => s.stillQuality);
  const setStillQuality = useMediaSettingsStore((s) => s.setStillQuality);

  // 下部ギャラリーで選択中のアングル（still）。あればその個別設定を表示。
  const activeShotId = useShotStore((s) => s.activeShotId);
  const focusedShot  = useShotStore((s) => s.shots.find((x) => x.id === s.activeShotId));
  const showAngle = focusedShot && (focusedShot.kind ?? "still") === "still";

  // 「生成」ボタン：選択中アングルを一括レンダリング（下部ギャラリーが処理）
  const selectedCount = useMediaSettingsStore((s) => s.selectedShotIds.length);
  const rendering = useMediaRenderStore((s) => s.rendering);
  const requestRender = useMediaRenderStore((s) => s.requestRender);

  const toggleSx = {
    width: "100%",
    "& .MuiToggleButton-root": {
      flex: 1, py: 0.4, fontSize: 10.5, textTransform: "none", fontWeight: 600,
      border: `1px solid ${alpha("#fff", 0.12)}`, color: alpha("#fff", 0.45),
      "&.Mui-selected": { color: "#fff", background: alpha(ACCENT, 0.25), borderColor: alpha(ACCENT, 0.5) },
    },
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", color: alpha("#fff", 0.92) }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 1.5 }}>
      {/* ヘッダー（コンパクト・1行ヒント） */}
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.4 }}>
        <PhotoCameraRoundedIcon sx={{ fontSize: 15, color: ACCENT }} />
        <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>自動パース生成</Typography>
      </Stack>
      <Typography sx={{ fontSize: 9.5, opacity: 0.42, mb: 1.25, lineHeight: 1.5 }}>
        下のギャラリーでアングルを選び ← → ＋ Enter / Space で生成。
      </Typography>

      {/* 選択中アングルの個別設定（名前・レンズ）— 文脈表示で最上部 */}
      {showAngle && <AngleSettings shotId={activeShotId} accent={ACCENT} />}

      {/* 自動アングル生成（撮影スタイル・数・高さ・寄り・家具回避） */}
      <AutoAngleSettings accent={ACCENT} />

      {/* アングルセット（部屋・外観/内観で管理） */}
      <AngleSetManager kind="still" accent={ACCENT} />

      {/* 出力設定（品質・解像度をまとめて） */}
      <SidePanelSection icon={<TuneRoundedIcon />} title="出力設定" accent={ACCENT} defaultOpen={false}>
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: alpha("#fff", 0.45), mb: 0.5 }}>品質</Typography>
        <ToggleButtonGroup value={stillQuality} exclusive size="small" onChange={(_, v) => v && setStillQuality(v)} sx={toggleSx}>
          <ToggleButton value="standard">標準</ToggleButton>
          <ToggleButton value="cycles">Cycles</ToggleButton>
        </ToggleButtonGroup>
        <Typography sx={{ fontSize: 9, opacity: 0.42, mt: 0.4, mb: 1 }}>
          {STILL_QUALITY_DESC[stillQuality]}
        </Typography>

        <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: alpha("#fff", 0.45), mb: 0.5 }}>解像度</Typography>
        <Box sx={{ px: 1, py: 0.5, borderRadius: 1.5, border: `1px solid ${alpha("#fff", 0.1)}`, background: alpha("#fff", 0.03) }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>1920 × 1080（Full HD）</Typography>
          <Typography sx={{ fontSize: 9.5, opacity: 0.45 }}>16:9 横向き</Typography>
        </Box>
      </SidePanelSection>
      </Box>

      {/* 固定フッター：生成ボタン（選択中アングルを一括レンダリング） */}
      <Box sx={{ flexShrink: 0, p: 1.25, borderTop: `1px solid ${alpha("#fff", 0.1)}`, background: alpha("#0b1020", 0.4) }}>
        <Button
          fullWidth
          variant="contained"
          disabled={rendering}
          onClick={requestRender}
          startIcon={rendering ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <PhotoCameraRoundedIcon />}
          sx={{
            textTransform: "none", fontWeight: 900, fontSize: 12.5, py: 0.9, borderRadius: 2,
            background: ACCENT, "&:hover": { background: "#5a78f0" },
            "&.Mui-disabled": { background: alpha(ACCENT, 0.3), color: alpha("#fff", 0.5) },
          }}
        >
          {rendering ? "生成中…" : selectedCount > 0 ? `生成（${selectedCount}）` : "生成"}
        </Button>
        <Typography sx={{ fontSize: 9, opacity: 0.4, textAlign: "center", mt: 0.5 }}>
          {selectedCount > 0 ? `選択中 ${selectedCount} アングルをレンダリング` : "下のギャラリーでアングルを選択（未選択時はフォーカス中を生成）"}
        </Typography>
      </Box>
    </Box>
  );
}
