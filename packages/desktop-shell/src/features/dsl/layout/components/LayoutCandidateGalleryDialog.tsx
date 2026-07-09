// LayoutCandidateGalleryDialog.tsx
// 自動レイアウトの複数案を平面図サムネで一覧し、案ごとに「採用する／不採用」を選ぶギャラリー。
import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Stack, Typography, IconButton, Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";

import { useLayoutCandidateStore, type LayoutCandidate } from "../store/useLayoutCandidateStore";

const ACCENT = "#a78bfa";

export interface LayoutCandidateGalleryProps {
  onAdopt: (cand: LayoutCandidate) => void;
  onReject: (cand: LayoutCandidate) => void;
  onRegenerate?: () => void;
}

export default function LayoutCandidateGalleryDialog({ onAdopt, onReject, onRegenerate }: LayoutCandidateGalleryProps) {
  const open = useLayoutCandidateStore((s) => s.open);
  const candidates = useLayoutCandidateStore((s) => s.candidates);
  const setOpen = useLayoutCandidateStore((s) => s.setOpen);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: "#0b1020", color: "#fff", borderRadius: 2, border: `1px solid ${alpha(ACCENT, 0.4)}`, backgroundImage: "none" } }}
    >
      <DialogTitle sx={{ p: 2, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoFixHighRoundedIcon sx={{ fontSize: 20, color: ACCENT }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 800 }}>レイアウト候補</Typography>
            <Typography sx={{ fontSize: "0.68rem", color: alpha("#fff", 0.55) }}>
              {candidates.length} 案。平面図を比較して採用する案を選んでください。
            </Typography>
          </Box>
          <IconButton onClick={() => setOpen(false)} size="small" sx={{ color: alpha("#fff", 0.6) }}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

      <DialogContent sx={{ p: 1.5 }}>
        {candidates.length === 0 ? (
          <Typography sx={{ fontSize: "0.8rem", color: alpha("#fff", 0.6), p: 2, textAlign: "center" }}>
            候補がありません。自動レイアウトを実行すると、生成した案がここに表示されます。
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1.5 }}>
            {candidates.map((c) => (
              <Box key={c.id} sx={{ borderRadius: 1.5, overflow: "hidden", border: `1px solid ${alpha("#fff", 0.12)}`, background: alpha("#fff", 0.03) }}>
                {/* 平面図サムネ（白背景なので明色で表示） */}
                <Box sx={{ width: "100%", aspectRatio: "1.414 / 1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {c.image
                    ? <Box component="img" src={c.image} alt={c.label} sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <Typography sx={{ fontSize: "0.7rem", color: "#888" }}>平面図なし</Typography>}
                </Box>
                <Stack sx={{ p: 1 }} spacing={0.75}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>
                    {c.label}
                    <Typography component="span" sx={{ fontSize: "0.64rem", color: alpha("#fff", 0.45), ml: 0.75 }}>
                      {c.items.length}点
                    </Typography>
                  </Typography>
                  <Stack direction="row" spacing={0.75}>
                    <Button
                      fullWidth size="small" variant="contained" startIcon={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
                      onClick={() => onAdopt(c)}
                      sx={{ textTransform: "none", fontWeight: 800, fontSize: "0.72rem", bgcolor: ACCENT, color: "#1a0f2e", "&:hover": { bgcolor: alpha(ACCENT, 0.85) } }}
                    >
                      採用する
                    </Button>
                    <IconButton
                      size="small" onClick={() => onReject(c)} title="不採用（削除）"
                      sx={{ color: alpha("#fff", 0.5), border: `1px solid ${alpha("#fff", 0.15)}`, borderRadius: 1, "&:hover": { color: "#f87171", borderColor: alpha("#f87171", 0.5) } }}
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 1.5, pt: 0.5, gap: 1 }}>
        {onRegenerate && (
          <Button
            onClick={onRegenerate}
            variant="outlined" startIcon={<ReplayRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", color: alpha("#fff", 0.8), borderColor: alpha("#fff", 0.2) }}
          >
            もう一度生成
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setOpen(false)} sx={{ textTransform: "none", color: alpha("#fff", 0.7) }}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
}
