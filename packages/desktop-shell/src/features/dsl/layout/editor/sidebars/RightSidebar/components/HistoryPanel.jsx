import React, { useCallback, useState, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Dialog,
  DialogContent,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

import { useRenderHistoryStore } from "../../../../store/useRenderHistoryStore";

function formatDate(ts) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

const navBtnSx = {
  color: "#fff",
  bgcolor: "rgba(0,0,0,0.4)",
  backdropFilter: "blur(4px)",
  border: "1px solid rgba(255,255,255,0.15)",
  "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
  "&.Mui-disabled": { opacity: 0.2 },
};

export default function HistoryPanel() {
  const entries = useRenderHistoryStore((s) => s.entries);
  const removeEntry = useRenderHistoryStore((s) => s.removeEntry);
  const clearAll = useRenderHistoryStore((s) => s.clearAll);

  // Index into `entries` of the currently previewed item; null = closed
  const [previewIndex, setPreviewIndex] = useState(null);

  const openPreview = useCallback((idx) => setPreviewIndex(idx), []);
  const closePreview = useCallback(() => setPreviewIndex(null), []);

  const goPrev = useCallback(
    () => setPreviewIndex((i) => (i > 0 ? i - 1 : i)),
    [],
  );
  const goNext = useCallback(
    () => setPreviewIndex((i) => (i < entries.length - 1 ? i + 1 : i)),
    [entries.length],
  );

  // Keyboard navigation
  useEffect(() => {
    if (previewIndex === null) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewIndex, goPrev, goNext, closePreview]);

  const handleDownload = useCallback(
    (entry) => {
      const safe = entry.shotName.replace(/[\\/:*?"<>|]/g, "_");
      const suffix = entry.quality === "cycles" ? "_cycles" : "";
      downloadDataUrl(entry.thumbnail, `${safe}${suffix}.jpg`);
    },
    [],
  );

  const previewEntry = previewIndex !== null ? entries[previewIndex] : null;

  if (entries.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 1,
          opacity: 0.5,
          px: 2,
        }}
      >
        <Typography fontSize={12} textAlign="center">
          生成された静止画がここに表示されます
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Clear all */}
        <Box
          sx={{
            px: 1.25,
            py: 0.5,
            display: "flex",
            justifyContent: "flex-end",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Tooltip title="すべて削除" placement="left">
            <IconButton size="small" onClick={clearAll} sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}>
              <DeleteSweepRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Entry list */}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {entries.map((entry, idx) => (
            <Box
              key={entry.id}
              sx={{
                display: "flex",
                gap: 1,
                px: 1.25,
                py: 1,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
              }}
            >
              {/* Thumbnail */}
              <Box
                component="img"
                src={entry.thumbnail}
                alt={entry.shotName}
                onClick={() => openPreview(idx)}
                sx={{
                  width: 72,
                  height: 48,
                  objectFit: "cover",
                  borderRadius: 0.5,
                  flexShrink: 0,
                  bgcolor: "rgba(0,0,0,0.3)",
                  cursor: "zoom-in",
                  transition: "transform 0.15s",
                  "&:hover": { transform: "scale(1.05)" },
                }}
              />

              {/* Info */}
              <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
                <Typography fontSize={11} fontWeight={600} noWrap sx={{ lineHeight: 1.4 }}>
                  {entry.shotName}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Chip
                    label={entry.quality === "cycles" ? "Cycles" : "Standard"}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: 9,
                      fontWeight: 700,
                      bgcolor: entry.quality === "cycles"
                        ? alpha("#7c4dff", 0.25)
                        : alpha("#0288d1", 0.25),
                      color: entry.quality === "cycles" ? "#ce93d8" : "#81d4fa",
                      "& .MuiChip-label": { px: 0.75 },
                    }}
                  />
                  <Typography fontSize={10} sx={{ opacity: 0.5 }}>
                    {formatDate(entry.renderedAt)}
                  </Typography>
                </Stack>
              </Box>

              {/* Actions */}
              <Stack direction="column" spacing={0.25} sx={{ flexShrink: 0 }}>
                <Tooltip title="ダウンロード" placement="left">
                  <IconButton
                    size="small"
                    onClick={() => handleDownload(entry)}
                    sx={{ p: 0.5, opacity: 0.6, "&:hover": { opacity: 1 } }}
                  >
                    <DownloadRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="削除" placement="left">
                  <IconButton
                    size="small"
                    onClick={() => removeEntry(entry.id)}
                    sx={{ p: 0.5, opacity: 0.6, "&:hover": { opacity: 1 } }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Preview dialog ───────────────────────────────────────── */}
      <Dialog
        open={!!previewEntry}
        onClose={closePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "rgba(10, 14, 24, 0.97)", backdropFilter: "blur(8px)" },
        }}
      >
        <DialogContent sx={{ p: 0, position: "relative", userSelect: "none" }}>
          {previewEntry && (
            <>
              {/* Image */}
              <Box
                component="img"
                src={previewEntry.thumbnail}
                alt={previewEntry.shotName}
                sx={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "85vh",
                  objectFit: "contain",
                }}
              />

              {/* Top header overlay */}
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  px: 2,
                  py: 1.25,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%)",
                }}
              >
                <Typography fontSize={14} fontWeight={700} sx={{ color: "#fff" }}>
                  {previewEntry.shotName}
                </Typography>
                <Chip
                  label={previewEntry.quality === "cycles" ? "Cycles" : "Standard"}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    bgcolor: previewEntry.quality === "cycles"
                      ? alpha("#7c4dff", 0.4)
                      : alpha("#0288d1", 0.4),
                    color: "#fff",
                    "& .MuiChip-label": { px: 0.9 },
                  }}
                />
                <Typography fontSize={11} sx={{ opacity: 0.7, color: "#fff" }}>
                  {formatDate(previewEntry.renderedAt)}
                </Typography>

                {/* Counter */}
                <Typography fontSize={11} sx={{ opacity: 0.55, color: "#fff", ml: 0.5 }}>
                  {previewIndex + 1} / {entries.length}
                </Typography>

                <Box sx={{ flex: 1 }} />

                <Tooltip title="ダウンロード" placement="bottom">
                  <IconButton
                    size="small"
                    onClick={() => handleDownload(previewEntry)}
                    sx={{ color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
                  >
                    <DownloadRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="閉じる" placement="bottom">
                  <IconButton
                    size="small"
                    onClick={closePreview}
                    sx={{ color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Prev arrow */}
              <IconButton
                onClick={goPrev}
                disabled={previewIndex === 0}
                sx={{
                  ...navBtnSx,
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                <ChevronLeftRoundedIcon />
              </IconButton>

              {/* Next arrow */}
              <IconButton
                onClick={goNext}
                disabled={previewIndex === entries.length - 1}
                sx={{
                  ...navBtnSx,
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                <ChevronRightRoundedIcon />
              </IconButton>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
