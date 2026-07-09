import React from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Stack,
} from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SkipNextIcon from "@mui/icons-material/SkipNext";

const GRAD = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";

// 初回 /workspace 訪問時のみ表示するウェルカムモーダル。
// 「ツアーを始める」→ driver.js ツアー起動
// 「スキップ」→ モーダルを閉じてチェックリストのみ残す
export default function WelcomeModal({ open, onStartTour, onSkip }) {
  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: "#0D0B1E",
          border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: 3,
          overflow: "visible",
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* ヘッダーグラデーション帯 */}
        <Box
          sx={{
            background: GRAD,
            borderRadius: "12px 12px 0 0",
            py: 3,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RocketLaunchIcon sx={{ fontSize: 32, color: "#fff" }} />
          </Box>
        </Box>

        <Stack spacing={2} sx={{ p: 3.5 }}>
          <Box>
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ color: "#fff", textAlign: "center" }}
            >
              SEKKEIYAへようこそ！
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "rgba(255,255,255,0.6)", textAlign: "center", mt: 1, lineHeight: 1.7 }}
            >
              AIが空間設計をサポートする統合OSです。
              <br />
              まず主な機能を2分でご案内します。
            </Typography>
          </Box>

          {/* 機能ハイライト */}
          <Stack spacing={1}>
            {[
              { icon: "🤖", label: "AIが自動でインテリアをレイアウト" },
              { icon: "🏗", label: "3Dモデルを空間に配置" },
              { icon: "📽", label: "プレゼン資料を自動生成" },
            ].map(({ icon, label }) => (
              <Box
                key={label}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <Typography sx={{ fontSize: "1.1rem" }}>{icon}</Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 500 }}
                >
                  {label}
                </Typography>
              </Box>
            ))}
          </Stack>

          {/* ボタン */}
          <Stack spacing={1.2} sx={{ pt: 0.5 }}>
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<RocketLaunchIcon />}
              onClick={onStartTour}
              sx={{
                background: GRAD,
                fontWeight: 700,
                borderRadius: "100px",
                textTransform: "none",
                py: 1.3,
                "&:hover": {
                  background: "linear-gradient(135deg, #6D28D9 0%, #1D4ED8 100%)",
                },
              }}
            >
              ツアーを始める（2分）
            </Button>

            <Button
              variant="text"
              fullWidth
              size="small"
              startIcon={<SkipNextIcon />}
              onClick={onSkip}
              sx={{
                color: "rgba(255,255,255,0.4)",
                textTransform: "none",
                fontSize: "0.8rem",
                "&:hover": { color: "rgba(255,255,255,0.7)" },
              }}
            >
              スキップしてチェックリストだけ使う
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
