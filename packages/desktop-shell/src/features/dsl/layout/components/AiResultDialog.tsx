// AiResultDialog.tsx
// 「AI実行（おまかせ）」完了時に、各工程の生成結果・成果物（パース/動画）・
// 自動レイアウトの評価/採用をまとめて表示するダイアログ。
import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Stack, Typography, IconButton, Divider, Rating, Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import RemoveCircleOutlineRoundedIcon from "@mui/icons-material/RemoveCircleOutlineRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded";

import { useAiResultStore, type AiResultStatus } from "../store/useAiResultStore";

const ACCENT = "#c084fc";

export interface AiLayoutFeedback {
  active: boolean;
  rating: number | null;
  onRate: (v: number | null) => void;
  onAdopt: () => void;
  onDismiss: () => void;
  submitting?: boolean;
}

function statusIcon(status: AiResultStatus) {
  switch (status) {
    case "success": return <CheckCircleRoundedIcon sx={{ fontSize: 18, color: "#34d399" }} />;
    case "warning": return <WarningAmberRoundedIcon sx={{ fontSize: 18, color: "#fbbf24" }} />;
    case "skip":    return <RemoveCircleOutlineRoundedIcon sx={{ fontSize: 18, color: alpha("#fff", 0.4) }} />;
    default:        return <InfoRoundedIcon sx={{ fontSize: 18, color: "#60a5fa" }} />;
  }
}

const sectionLabel = (text: string) => (
  <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: 0.5, color: alpha("#fff", 0.5), mt: 1.5, mb: 0.75 }}>
    {text}
  </Typography>
);

export default function AiResultDialog({ layoutFeedback }: { layoutFeedback?: AiLayoutFeedback }) {
  const open = useAiResultStore((s) => s.open);
  const results = useAiResultStore((s) => s.results);
  const media = useAiResultStore((s) => s.media);
  const styleLabel = useAiResultStore((s) => s.styleLabel);
  const hadError = useAiResultStore((s) => s.hadError);
  const close = useAiResultStore((s) => s.close);

  const okCount = results.filter((r) => r.status === "success").length;
  const perspectives = media?.perspectives ?? [];
  const videos = media?.videos ?? [];
  const hasMedia = perspectives.length > 0 || videos.length > 0;
  const showFeedback = !!layoutFeedback?.active;

  const tileSx = {
    position: "relative" as const,
    width: 116, height: 78, flexShrink: 0,
    borderRadius: 1.5, overflow: "hidden",
    border: `1px solid ${alpha("#fff", 0.12)}`,
    background: alpha("#fff", 0.04),
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { bgcolor: "#0b1020", color: "#fff", borderRadius: 2, border: `1px solid ${alpha(ACCENT, 0.4)}`, backgroundImage: "none" },
      }}
    >
      <DialogTitle sx={{ p: 2, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 20, color: ACCENT }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 800 }}>
              AIおまかせ {hadError ? "完了（一部スキップ）" : "完了"}
            </Typography>
            <Typography sx={{ fontSize: "0.68rem", color: alpha("#fff", 0.55) }}>
              {styleLabel ? `テイスト: ${styleLabel}・` : ""}{okCount}/{results.length} 工程が完了
            </Typography>
          </Box>
          <IconButton onClick={close} size="small" sx={{ color: alpha("#fff", 0.6) }}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      <DialogContent sx={{ p: 1.5 }}>
        {/* 工程サマリ */}
        {results.length === 0 ? (
          <Typography sx={{ fontSize: "0.78rem", color: alpha("#fff", 0.6), p: 1 }}>
            実行された工程はありませんでした。
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {results.map((r, i) => (
              <Stack key={i} direction="row" alignItems="flex-start" spacing={1}
                sx={{ px: 1, py: 0.75, borderRadius: 1, background: alpha("#fff", 0.03) }}>
                <Box sx={{ mt: "1px" }}>{statusIcon(r.status)}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>{r.label}</Typography>
                  {r.detail && (
                    <Typography sx={{ fontSize: "0.7rem", color: alpha("#fff", 0.6), lineHeight: 1.4 }}>{r.detail}</Typography>
                  )}
                </Box>
              </Stack>
            ))}
          </Stack>
        )}

        {/* 成果物（パース／動画） */}
        {hasMedia && (
          <>
            {sectionLabel(`成果物（パース ${perspectives.length} / 動画 ${videos.length}）`)}
            <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5 }}>
              {perspectives.map((p, i) => (
                <Box key={`p${i}`} sx={tileSx} title={p.name}>
                  {p.thumbnail
                    ? <Box component="img" src={p.thumbnail} alt={p.name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: alpha("#fff", 0.4) }}>パース</Box>}
                  <Chip label="パース" size="small" sx={{ position: "absolute", left: 4, bottom: 4, height: 16, fontSize: "0.55rem", bgcolor: alpha("#000", 0.6), color: "#fff" }} />
                </Box>
              ))}
              {videos.map((v, i) => (
                <Box key={`v${i}`} sx={tileSx} title={v.name}>
                  {v.poster
                    ? <Box component="img" src={v.poster} alt={v.name} sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
                    : <Box sx={{ width: "100%", height: "100%", background: alpha(ACCENT, 0.1) }} />}
                  <PlayCircleFilledRoundedIcon sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 26, color: alpha("#fff", 0.85) }} />
                  <Chip label={`動画・${v.status}`} size="small" sx={{ position: "absolute", left: 4, bottom: 4, height: 16, fontSize: "0.55rem", bgcolor: alpha(ACCENT, 0.7), color: "#fff" }} />
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: "0.6rem", color: alpha("#fff", 0.4), mt: 0.5 }}>
              パースは History（生成履歴）、動画は完了後に履歴へ保存されます。
            </Typography>
          </>
        )}

        {/* 自動レイアウトの評価・採用 */}
        {showFeedback && (
          <>
            {sectionLabel("自動レイアウトの評価")}
            <Stack direction="row" alignItems="center" spacing={1.5}
              sx={{ px: 1, py: 1, borderRadius: 1.5, background: alpha(ACCENT, 0.08), border: `1px solid ${alpha(ACCENT, 0.25)}` }}>
              <Typography sx={{ fontSize: "0.74rem", color: alpha("#fff", 0.85) }}>このレイアウトの満足度</Typography>
              <Rating
                value={layoutFeedback?.rating ?? null}
                onChange={(_e, v) => layoutFeedback?.onRate(v)}
                size="small"
              />
            </Stack>
            <Typography sx={{ fontSize: "0.6rem", color: alpha("#fff", 0.4), mt: 0.5 }}>
              「採用する」で評価を記録し、使用したセット家具の採用率に反映します。
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 1.5, pt: 0.5, gap: 1 }}>
        {showFeedback ? (
          <>
            <Button
              onClick={() => { layoutFeedback?.onDismiss(); close(); }}
              variant="outlined"
              sx={{ textTransform: "none", color: alpha("#fff", 0.75), borderColor: alpha("#fff", 0.2) }}
            >
              あとで
            </Button>
            <Button
              onClick={() => { layoutFeedback?.onAdopt(); close(); }}
              disabled={layoutFeedback?.submitting}
              variant="contained"
              sx={{ textTransform: "none", fontWeight: 800, bgcolor: ACCENT, color: "#1a0f2e", "&:hover": { bgcolor: alpha(ACCENT, 0.85) } }}
            >
              採用する
            </Button>
          </>
        ) : (
          <Button
            onClick={close}
            variant="contained"
            fullWidth
            sx={{ textTransform: "none", fontWeight: 800, bgcolor: ACCENT, color: "#1a0f2e", "&:hover": { bgcolor: alpha(ACCENT, 0.85) } }}
          >
            閉じる
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
