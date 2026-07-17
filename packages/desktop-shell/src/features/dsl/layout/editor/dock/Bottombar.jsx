// src/features/layout/components/Bottombar/Bottombar.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Slide,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

// ✅ panels
import TextureLibraryPanel from "./panels/TextureLibraryPanel";
import MaterialLibraryPanel from "./panels/MaterialLibraryPanel";

// ✅ Picker store（※あなたの現行パスに合わせる）
import { useMaterialPickerStore } from "../../store/materialPickerStore";

// すべての自動アクションは★メニューの下部ギャラリー＋右サイドバーで完結するため、
// このボトムパネル（スライドアップ）は Properties のマテリアルピッカー専用。タブは出さない。
const MODE_TABS = [];

export default function Bottombar({
  mode = "textures",
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

  // パネル高さ（LayoutShell が所有 → ビューポートの押し上げ量と同期）。
  // 未指定なら内部 state にフォールバックする。
  panelHeight: panelHeightProp,
  onChangePanelHeight,

  leftSidebarWidth = 300,
  rightSidebarWidth = 0,

  // ✅ Optional: ライブラリのデータ（後でFirestoreから渡す想定）
  textures = [],
  materials = [],
}) {
  const theme = useTheme();

  const pickerOpenPanel = useMaterialPickerStore((s) => s.openPanel);
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

  // モードタブのクリック: アクティブタブ再クリックで閉じる、他はモード切替。
  const handleTabClick = useCallback((next) => {
    if (next === mode) { handleClose(); return; }
    onChangeMode?.(next);
    onChangeOpen?.(true);
  }, [mode, onChangeMode, onChangeOpen, handleClose]);

  // 全幅ヘッダー化: 左右サイドバーが LayoutShell 内へ埋め込まれたため、
  // ボトムパネルはサイドバー幅ぶん内側（＝ビューポート直下）にドッキングする。
  const wrapperSx = useMemo(
    () => ({
      position: "absolute",
      left: leftSidebarWidth,
      right: rightSidebarWidth,
      bottom: 0, // 下端フラットにドッキング（赤枠の無駄スペースを解消）
      zIndex: 70,
      display: "flex",
      justifyContent: "stretch",
      pointerEvents: "none",
      transition: "left 0.22s cubic-bezier(0.4,0,0.2,1), right 0.22s cubic-bezier(0.4,0,0.2,1)",
    }),
    [leftSidebarWidth, rightSidebarWidth]
  );

  // 制御 prop があればそれを使い、無ければ内部 state（後方互換）。
  const [panelHeightLocal, setPanelHeightLocal] = useState(320);
  const panelHeight = panelHeightProp ?? panelHeightLocal;
  const setPanelHeight = useCallback((next) => {
    if (onChangePanelHeight) onChangePanelHeight(next);
    else setPanelHeightLocal(next);
  }, [onChangePanelHeight]);

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
  }, [setPanelHeight]);

  const handlePointerUp = useCallback((e) => {
    if (isResizing.current) {
      isResizing.current = false;
      e.target.releasePointerCapture(e.pointerId);
    }
  }, []);

  const barSx = useMemo(
    () => ({
      width: "100%",
      height: panelHeight,
      display: "flex",
      flexDirection: "column",
      borderRadius: "18px 18px 0 0", // 上端のみ丸める（下端は画面端にフラット）
      background: "color-mix(in srgb, var(--brand-bg) 82%, transparent)",
      borderTop: `1px solid ${alpha("#ffffff", 0.14)}`,
      borderLeft: `1px solid ${alpha("#ffffff", 0.08)}`,
      borderRight: `1px solid ${alpha("#ffffff", 0.08)}`,
      boxShadow: "0 0 0 1px rgb(var(--brand-fg-rgb) / 0.04) inset, 0 -8px 40px rgba(0,0,0,0.5)",
      overflow: "hidden",
      pointerEvents: "auto",
      backdropFilter: "blur(14px)",
      position: "relative",
    }),
    [panelHeight]
  );

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

        {/* モードタブ（Textures / Materials / 配置アイテム / Media / Export）+ 閉じる */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{
            flexShrink: 0,
            px: 1.5,
            pt: 1.5,
            pb: 0.75,
            borderBottom: `1px solid ${alpha("#fff", 0.07)}`,
            overflowX: "auto",
            "&::-webkit-scrollbar": { height: 0 },
          }}
        >
          {MODE_TABS.map((m) => {
            const active = m.key === mode;
            return (
              <Tooltip key={m.key} title={active ? "クリックで閉じる" : m.label} placement="top">
                <Box
                  onClick={() => handleTabClick(m.key)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.6,
                    px: 1.25,
                    height: 30,
                    borderRadius: 2,
                    cursor: "pointer",
                    flexShrink: 0,
                    color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 62%, transparent)",
                    background: active ? alpha(theme.palette.primary.main, 0.9) : alpha("#fff", 0.05),
                    border: `1px solid ${active ? theme.palette.primary.main : alpha("#fff", 0.08)}`,
                    boxShadow: active ? `0 0 12px ${alpha(theme.palette.primary.main, 0.45)}` : "none",
                    transition: "all 0.15s",
                    "&:hover": { background: active ? theme.palette.primary.main : alpha("#fff", 0.1), color: "var(--brand-fg)" },
                  }}
                >
                  {m.icon}
                  <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.2, whiteSpace: "nowrap" }}>
                    {m.label}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="パネルを閉じる" placement="top">
            <IconButton size="small" onClick={handleClose} sx={{ color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)", "&:hover": { color: "var(--brand-fg)" } }}>
              <ExpandMoreRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* body：Properties のマテリアルピッカー起動時のみ開く（Textures / Materials） */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {mode === "textures" ? <TextureLibraryPanel textures={textures} onClose={handleClose} /> : null}
          {mode === "materials" ? <MaterialLibraryPanel materials={materials} onClose={handleClose} /> : null}
        </Box>
      </Paper>
    </Slide>
   </Box>
  );
}
