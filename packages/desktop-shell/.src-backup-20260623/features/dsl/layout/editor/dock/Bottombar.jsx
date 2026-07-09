// src/features/layout/components/Bottombar/Bottombar.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  IconButton,
  Divider,
  Chip,
  Button,
  CircularProgress,
  Tooltip,
  Slide,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";

import PopulatePanel from "./panels/PopulatePanel";

// ✅ NEW panels
import TextureLibraryPanel from "./panels/TextureLibraryPanel";
import MaterialLibraryPanel from "./panels/MaterialLibraryPanel";
import MediaPanel from "./panels/MediaPanel";

// ✅ Picker store（※あなたの現行パスに合わせる）
import { useMaterialPickerStore } from "@desktop/features/dsl/layout/store/materialPickerStore";

const MODE_LABEL = {
  import: "Import",
  textures: "Textures",
  materials: "Materials",
  populate: "配置アイテム",
  media: "Media",
  export: "Export",
};

export default function Bottombar({
  mode = "media",
  onChangeMode,

  // context
  projectId,
  projectName,
  workspaceId,
  baseId,
  planId,
  optionId,

  optionDocLoading = false,

  layoutItems = [],

  onRenderImage,
  onRenderMovie,

  onAddToLayout,

  onRequestOpenLeftProperties,

  open = false,
  onChangeOpen,

  leftSidebarWidth = 300,
  rightSidebarWidth = 0,

  // ✅ Optional: ライブラリのデータ（後でFirestoreから渡す想定）
  textures = [],
  materials = [],
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const pickerOpenPanel = useMaterialPickerStore((s) => s.openPanel);
  const pickerMode = useMaterialPickerStore((s) => s.mode);
  const pickerClose = useMaterialPickerStore((s) => s.close);

  // ✅ store.openPanel が立ったら BottomBar を開いて mode を合わせる
  useEffect(() => {
    if (!pickerOpenPanel) return;

    // openPanel: "textureLibrary" | "materialLibrary"
    const nextMode = pickerOpenPanel === "textureLibrary" ? "textures" : "materials";
    onChangeMode?.(nextMode);
    onChangeOpen?.(true);
  }, [pickerOpenPanel, onChangeMode, onChangeOpen]);

  const handleClose = useCallback(() => {
    onChangeOpen?.(false);
    // picker起動中なら閉じる
    if (pickerOpenPanel) pickerClose?.();
  }, [onChangeOpen, pickerOpenPanel, pickerClose]);

  const canContext = Boolean((projectId || workspaceId) && baseId && planId && optionId);

  const short = useCallback((v, n = 8) => {
    const s = String(v || "");
    if (!s) return "-";
    return s.length > n ? `${s.slice(0, n)}…` : s;
  }, []);

  const ctxChips = useMemo(() => {
    return [
      { label: `Base: ${short(baseId, 10)}`, key: "ba" },
      { label: `Plan: ${short(planId, 10)}`, key: "p" },
      { label: `Option: ${String(optionId || "-")}`, key: "o", highlight: true },
    ];
  }, [baseId, planId, optionId, short]);

  const wrapperSx = useMemo(
    () => ({
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 84, // 16px above the center 56px dock (which is at bottom: 12)
      zIndex: 70,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none",
    }),
    []
  );

  const [panelHeight, setPanelHeight] = useState(320);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startH = useRef(320);

  const handlePointerDown = useCallback((e) => {
    isResizing.current = true;
    startY.current = e.clientY;
    startH.current = panelHeight;
    e.target.setPointerCapture(e.pointerId);
  }, [panelHeight]);

  const handlePointerMove = useCallback((e) => {
    if (!isResizing.current) return;
    const dy = startY.current - e.clientY; // moved up = positive dy
    setPanelHeight(Math.max(160, Math.min(800, startH.current + dy)));
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (isResizing.current) {
      isResizing.current = false;
      e.target.releasePointerCapture(e.pointerId);
    }
  }, []);

  const barSx = useMemo(
    () => ({
      width: "calc(100% - 32px)",
      height: panelHeight,
      display: "flex",
      flexDirection: "column",
      borderRadius: "24px",
      background: alpha("#070b18", 0.74),
      border: `1px solid ${alpha("#ffffff", 0.12)}`,
      boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset, 0 18px 60px rgba(0,0,0,0.45)",
      overflow: "hidden",
      pointerEvents: "auto",
      backdropFilter: "blur(12px)",
      position: "relative",
    }),
    [panelHeight]
  );

  const chipSx = useMemo(
    () => ({
      height: 22,
      fontSize: 11,
      background: alpha("#fff", 0.08),
      border: `1px solid ${alpha("#fff", 0.12)}`,
      color: alpha("#fff", 0.92),
      "& .MuiChip-label": { px: 1.0 },
    }),
    []
  );

  const actionBtnSx = useMemo(
    () => ({
      borderRadius: 2,
      textTransform: "none",
      fontWeight: 900,
      boxShadow: "none",
    }),
    []
  );

  const run = useCallback(
    async (fn) => {
      if (!canContext) return;
      if (busy) return;

      try {
        setBusy(true);
        await Promise.resolve(fn?.());
      } catch (e) {
        console.warn("[Bottombar] action failed:", e);
        alert("処理に失敗しました（MVP）。console を確認してください。");
      } finally {
        setBusy(false);
      }
    },
    [canContext, busy]
  );

  const handleRenderImage = useCallback(() => {
    run(onRenderImage || (() => alert("Render Image (MVP)")));
  }, [run, onRenderImage]);

  const handleRenderMovie = useCallback(() => {
    run(onRenderMovie || (() => alert("Render Movie (MVP)")));
  }, [run, onRenderMovie]);

  const handleQuality = useCallback(() => {
    if (!canContext) return;
    alert("Quality settings (MVP) — 将来ここに品質/解像度/AAなどを置く");
  }, [canContext]);

  const handleRefresh = useCallback(() => {
    alert("Refresh (MVP) — 将来 job/結果の再取得に使う");
  }, []);

  const title = MODE_LABEL?.[mode] || "Panel";

  return (
    <Box sx={wrapperSx}>
      <Slide direction="up" in={open} mountOnEnter unmountOnExit timeout={{ enter: 220, exit: 160 }}>
        <Paper variant="outlined" sx={barSx}>
        {/* Resize Handle */}
        <Box
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          sx={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: 14,
            cursor: "row-resize",
            zIndex: 10,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            pt: 0.6,
            "&:hover .handle-bar": { background: alpha("#fff", 0.4) },
          }}
        >
          <Box className="handle-bar" sx={{ width: 48, height: 4, borderRadius: 2, background: alpha("#fff", 0.15), transition: "all 0.2s" }} />
        </Box>

        {/* body */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {mode === "populate" ? (
            <PopulatePanel
              disabled={!canContext}
              placedItems={layoutItems}
              onRequestOpenLeftProperties={onRequestOpenLeftProperties}
              onClose={handleClose}
              // ✅ もし PopulatePanel が “Store起点に一本化済み” なら
              // selectedItemId / onSelectItemId は渡さない
            />
          ) : null}

          {/* ✅ NEW: textures mode */}
          {mode === "textures" ? <TextureLibraryPanel textures={textures} onClose={handleClose} /> : null}

          {/* ✅ materials mode → MaterialLibraryPanel */}
          {mode === "materials" ? <MaterialLibraryPanel materials={materials} onClose={handleClose} /> : null}

          {mode === "media" ? <MediaPanel onClose={handleClose} projectId={projectId} projectName={projectName} workspaceId={workspaceId} planId={planId} /> : null}

          {mode === "export" ? (
            <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${alpha("#fff", 0.08)}` }}>
                <Typography sx={{ fontWeight: 900, fontSize: 13.5, letterSpacing: 0.2, minWidth: 100 }}>Export</Typography>
                <Box sx={{ flex: 1 }} />
                <IconButton size="small" onClick={handleClose} sx={{ borderRadius: 1.5 }}>
                  <ExpandMoreRoundedIcon />
                </IconButton>
              </Stack>
              <Box sx={{ p: 1.25, pt: 1, flex: 1, overflowY: "auto" }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Tooltip title={canContext ? "画像をレンダリング" : "Base / Plan / Option を選択してください"}>
                    <span>
                      <Button
                        disabled={!canContext || busy}
                        startIcon={<ImageRoundedIcon />}
                        variant="contained"
                        onClick={handleRenderImage}
                        sx={{
                          ...actionBtnSx,
                          background: alpha(theme.palette.primary.main, 0.92),
                          "&:hover": { background: alpha(theme.palette.primary.main, 1) },
                        }}
                      >
                        Render Image
                      </Button>
                    </span>
                  </Tooltip>

                  <Tooltip title={canContext ? "動画をレンダリング" : "Base / Plan / Option を選択してください"}>
                    <span>
                      <Button
                        disabled={!canContext || busy}
                        startIcon={<MovieRoundedIcon />}
                        variant="outlined"
                        onClick={handleRenderMovie}
                        sx={{
                          ...actionBtnSx,
                          borderColor: alpha("#fff", 0.18),
                          color: alpha("#fff", 0.92),
                        }}
                      >
                        Render Movie
                      </Button>
                    </span>
                  </Tooltip>

                  <Tooltip title="品質 / 解像度 / AA（将来）">
                    <span>
                      <Button
                        disabled={!canContext || busy}
                        startIcon={<AutoFixHighRoundedIcon />}
                        variant="outlined"
                        onClick={handleQuality}
                        sx={{
                          ...actionBtnSx,
                          borderColor: alpha("#fff", 0.18),
                          color: alpha("#fff", 0.92),
                        }}
                      >
                        Quality
                      </Button>
                    </span>
                  </Tooltip>

                  <Box sx={{ flex: 1 }} />

                  <Tooltip title="再取得 / 再同期（将来）">
                    <span>
                      <Button
                        disabled={busy}
                        startIcon={<RefreshRoundedIcon />}
                        variant="text"
                        onClick={handleRefresh}
                        sx={{
                          ...actionBtnSx,
                          color: alpha("#fff", 0.88),
                          "&:hover": { background: alpha("#fff", 0.08) },
                        }}
                      >
                        Refresh
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>

                {!canContext ? (
                  <Box
                    sx={{
                      borderRadius: 2,
                      p: 1,
                      background: alpha("#000", 0.14),
                      border: `1px solid ${alpha("#fff", 0.10)}`,
                    }}
                  >
                    <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>Export を有効にするには</Typography>
                    <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.35 }}>
                      Base / Plan / Option を選択してください。
                    </Typography>
                  </Box>
                ) : (
                  <Typography sx={{ opacity: 0.65, fontSize: 12 }}>
                    ※ MVP: ボタンはダミーです。将来ここから Render Job を発行して進捗と履歴を表示します。
                  </Typography>
                )}
              </Stack>
            </Box>
            </Box>
          ) : null}


        </Box>
      </Paper>
    </Slide>
   </Box>
  );
}
