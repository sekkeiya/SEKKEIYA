// src/features/layout/components/Bottombar/Bottombar.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
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

import PopulatePanel from "./panels/PopulatePanel";

// ✅ NEW panels
import TextureLibraryPanel from "./panels/TextureLibraryPanel";
import MaterialLibraryPanel from "./panels/MaterialLibraryPanel";

// ✅ Picker store（※あなたの現行パスに合わせる）
import { useMaterialPickerStore } from "@layout/features/layout/store/materialPickerStore";

const MODE_LABEL = {
  import: "Import",
  textures: "Textures",
  materials: "Materials",
  populate: "Populate",
  media: "Media",
  export: "Export",
};

export default function Bottombar({
  mode = "media",
  onChangeMode,

  // context
  boardId,
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

  const canContext = Boolean(boardId && baseId && planId && optionId);

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

  const dockH = 64;
  const gap = 8;
  const baseBottom = dockH + 10;

  const barSx = useMemo(
    () => ({
      position: "fixed",
      left: `calc(${Math.max(0, leftSidebarWidth)}px + ${gap}px)`,
      right: `calc(${Math.max(0, rightSidebarWidth)}px + ${gap}px)`,
      bottom: baseBottom,
      width: "auto",
      zIndex: 70,

      borderRadius: 0,
      background: alpha("#0a0f24", 0.74),
      border: `1px solid ${alpha("#fff", 0.12)}`,
      boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset, 0 18px 60px rgba(0,0,0,0.45)",
      overflow: "hidden",
      pointerEvents: "auto",
      backdropFilter: "blur(10px)",
      transformOrigin: "bottom center",
    }),
    [leftSidebarWidth, rightSidebarWidth, gap, baseBottom]
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
    <Slide direction="up" in={open} mountOnEnter unmountOnExit timeout={{ enter: 220, exit: 160 }}>
      <Paper variant="outlined" sx={barSx}>
        {/* header */}
        <Box sx={{ px: 1.5, py: 1.1, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 13.5, letterSpacing: 0.2 }}>
            {title}
            {pickerMode ? (
              <Typography component="span" sx={{ ml: 1, fontSize: 11, opacity: 0.7 }}>
                /{" "}
                {pickerOpenPanel === "materialLibrary"
                  ? "Material Library"
                  : pickerOpenPanel === "textureLibrary"
                    ? "Texture Library"
                    : ""}
              </Typography>
            ) : null}
          </Typography>

          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            {ctxChips.map((c) => (
              <Chip
                key={c.key}
                size="small"
                sx={
                  c.highlight
                    ? {
                        ...chipSx,
                        background: alpha(theme.palette.primary.main, 0.16),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                      }
                    : chipSx
                }
                label={c.label}
              />
            ))}
          </Stack>

          <Box sx={{ flex: 1 }} />

          {optionDocLoading || busy ? <CircularProgress size={16} /> : null}

          <IconButton size="small" onClick={handleClose} sx={{ borderRadius: 1.5 }}>
            <ExpandMoreRoundedIcon />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        {/* body */}
        <>
          {mode === "populate" ? (
            <PopulatePanel
              disabled={!canContext}
              placedItems={layoutItems}
              onRequestOpenLeftProperties={onRequestOpenLeftProperties}
              // ✅ もし PopulatePanel が “Store起点に一本化済み” なら
              // selectedItemId / onSelectItemId は渡さない
            />
          ) : null}

          {/* ✅ NEW: textures mode */}
          {mode === "textures" ? <TextureLibraryPanel textures={textures} /> : null}

          {/* ✅ materials mode → MaterialLibraryPanel */}
          {mode === "materials" ? <MaterialLibraryPanel materials={materials} /> : null}

          {mode === "media" ? (
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>Media（MVP）</Typography>
              <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.35 }}>
                将来：Twinmotionのように「カメラ（Shot）」を保存・管理するパネルをここに実装します。
              </Typography>

              {!canContext ? (
                <Box
                  sx={{
                    mt: 1,
                    borderRadius: 2,
                    p: 1,
                    background: alpha("#000", 0.14),
                    border: `1px solid ${alpha("#fff", 0.10)}`,
                  }}
                >
                  <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>有効にするには</Typography>
                  <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.35 }}>
                    Base / Plan / Option を選択してください。
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ opacity: 0.65, fontSize: 12, mt: 1 }}>
                  ※ MVP: まずは Shot のデータ構造を決めて保存するところから始めるのがおすすめです。
                </Typography>
              )}
            </Box>
          ) : null}

          {mode === "export" ? (
            <Box sx={{ p: 1.25, pt: 1 }}>
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
          ) : null}

          {mode === "import" ? (
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>Import（MVP）</Typography>
              <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.35 }}>
                将来：GLBアップロードや取り込み履歴をここに置きます。
              </Typography>
            </Box>
          ) : null}
        </>
      </Paper>
    </Slide>
  );
}
