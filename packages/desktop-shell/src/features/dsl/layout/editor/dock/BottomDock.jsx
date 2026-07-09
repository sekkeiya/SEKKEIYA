// src/features/layout/components/BottomBar/BottomDock.jsx
import React, { useMemo, useCallback } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import ViewSidebarRoundedIcon from "@mui/icons-material/ViewSidebarRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";

// ✅ Twinmotion式 Right Panels
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded"; // Scene
import TuneRoundedIcon from "@mui/icons-material/TuneRounded"; // Properties
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded"; // Board
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded"; // History
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded"; // Viewport Settings

// ✅ NEW: Zustand
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useUiLeftSidebarStore } from "../../store/uiLeftSidebarStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { toggleMapMode } from "../../utils/mapMode";

// ✅ 自動アクション：左ドックの★メニュー＋下部スタイルギャラリー
import AutoActionStarMenu from "./AutoActionStarMenu";
import AutoActionGalleryBar from "./AutoActionGalleryBar";

export default function BottomDock({
  mode = "autoLayout",
  onChangeMode,

  panelOpen = false,
  onTogglePanelOpen,
  globalPanelWidth = 0,
  // 右側に展開図カラムなどが開いているときの右オフセット（px）。
  // ルートの right をこの分内側に寄せると、中央ツールバー(left:50%)も右レール(right:16)も
  // 自動的にビューポート側へ収まる。
  rightInset = 0,
}) {
  const theme = useTheme();

  // ✅ RightSidebar表示状態（Zustandから直読み）
  const rightPanels = useUiRightSidebarStore((s) => s.rightPanels);
  const toggleRightPanel = useUiRightSidebarStore((s) => s.toggleRightPanel);

  // Map ボタン：Map モードへ入退（トップツールバーの Map タブと同じ挙動）。
  const handleToggleMap = useCallback(() => toggleMapMode(), []);

  // ✅ LeftSidebar表示状態
  const leftPanels = useUiLeftSidebarStore((s) => s.leftPanels);
  const toggleLeftPanel = useUiLeftSidebarStore((s) => s.toggleLeftPanel);

  const editorMode = useEditorModeStore((s) => s.editorMode);

  const rootSx = useMemo(
    () => ({
      position: "absolute",
      left: 0,
      right: rightInset,
      top: 0,
      bottom: 0,
      zIndex: 60,
      pointerEvents: "none", // root is click-through
      transition: "right 0.22s cubic-bezier(0.4,0,0.2,1)",
    }),
    [rightInset]
  );

  // Vertical layout for left/right islands
  const glassBoxVerticalSx = useMemo(
    () => ({
      pointerEvents: "auto",
      position: "absolute",
      top: 160,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1.5,
      py: 2,
      width: 56,
      borderRadius: "28px",
      background: "color-mix(in srgb, var(--brand-bg) 70%, transparent)",
      backdropFilter: "blur(12px)",
      border: `1px solid ${alpha("#ffffff", 0.1)}`,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      transition: "all 0.3s ease",
      opacity: 0.15, // dim normally
      "&:hover": {
        opacity: 1, // reveal on hover
        background: "color-mix(in srgb, var(--brand-bg) 80%, transparent)",
      }
    }),
    []
  );

  const pillBtn = useCallback(
    (active) => ({
      width: 40,
      height: 40,
      borderRadius: 2.25,
      background: active ? alpha(theme.palette.primary.main, 0.85) : "transparent",
      border: `1px solid ${
        active ? theme.palette.primary.main : alpha("#fff", 0.10)
      }`,
      color: active ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 82%, transparent)",
      boxShadow: active ? `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}` : "none",
      "&:hover": { background: active ? theme.palette.primary.main : alpha("#fff", 0.06) },
    }),
    [theme.palette.primary.main]
  );

  const isSceneOn = !!rightPanels?.scene;
  const isPropsOn = !!rightPanels?.properties;
  const isHistoryOn = !!rightPanels?.history;
  const isMapOn = !!rightPanels?.map;
  const isViewportSettingsOn = !!rightPanels?.viewportSettings;

  // 選択中（オン）のボタンを持つドックは未ホバーでも薄くしすぎない（状態が一目で分かるように）。
  const leftActive = !!(leftPanels?.dashboard || leftPanels?.project || leftPanels?.library);
  const rightActive = isSceneOn || isPropsOn || isHistoryOn || isViewportSettingsOn;
  const activeDockOpacity = 0.9;

  // ウォークスルー中は編集用ドック（左右の浮動ツールバー・モード切替）を隠して
  // 没入させる。これにより情報パネルの閉じるボタンが右側の浮動メニュー（目アイコン）と
  // 重なってクリックできない問題も解消する。
  if (editorMode === "walkthrough") return null;

  return (
    <Box sx={rootSx}>
      {/* Left Vertical Dock: Project, Structure, Library */}
      {/* top: 右ドックと上端を揃える（160）。選択中ボタンがあれば薄くしすぎない。 */}
      <Box sx={{ ...glassBoxVerticalSx, left: 16, top: 160, ...(leftActive ? { opacity: activeDockOpacity } : {}) }}>
            <Tooltip title="デフォルト左サイドバー (Default Sidebar)" placement="right">
              <IconButton onClick={() => toggleLeftPanel('dashboard')} sx={pillBtn(!!leftPanels?.dashboard)}>
                <ViewSidebarRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Layout Tasks is deprecated in Phase 2 (Retroactive Space Programming) */}
            {/* <Tooltip title="レイアウトタスク (Layout Tasks)" placement="right"> ... </Tooltip> */}

            <Tooltip title="Project Hierarchy" placement="right">
              <IconButton onClick={() => toggleLeftPanel('project')} sx={pillBtn(!!leftPanels?.project)}>
                <DashboardCustomizeRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

        <Tooltip title="ライブラリ (Models Library)" placement="right">
          <IconButton onClick={() => toggleLeftPanel('library')} sx={pillBtn(!!leftPanels?.library)}>
            <FolderOpenRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 左ドック下部の★メニュー（自動アクションのランチャー）。
          ピッカー等でボトムパネルが開いている間は下部ギャラリーと干渉しないよう★も隠す。 */}
      {!panelOpen && <AutoActionStarMenu />}

      {/* 自動レイアウト/マテリアル等のスタイル選択ギャラリー（←→＋Enter/Space） */}
      {!panelOpen && <AutoActionGalleryBar />}

      {/* Right Vertical Dock: Scene, Properties, Auto Layout, History, QuickMenu */}
      <Box sx={{ ...glassBoxVerticalSx, right: 16, top: 160, ...(rightActive ? { opacity: activeDockOpacity } : {}) }}>
        <Tooltip title="Scene（アウトライナー）" placement="left">
          <IconButton onClick={() => toggleRightPanel("scene")} sx={pillBtn(isSceneOn)}>
            <AccountTreeRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Properties（Ambience等）" placement="left">
          <IconButton onClick={() => toggleRightPanel("properties")} sx={pillBtn(isPropsOn)}>
            <TuneRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="History（生成履歴）" placement="left">
          <IconButton onClick={() => toggleRightPanel("history")} sx={pillBtn(isHistoryOn)}>
            <PhotoLibraryRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="マップ（敷地に航空写真）" placement="left">
          <IconButton onClick={handleToggleMap} sx={pillBtn(isMapOn)}>
            <MapRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* ビューポート設定（断面 Clipping / 俯瞰レベル線 / グリッド / 背景 / 移動速度）。
            旧 ViewportQuickMenu の目アイコン浮動メニューを、右サイドバーの常設パネルに集約。 */}
        <Tooltip title="ビューポート設定（断面 / レベル線 / グリッド / 背景 / 速度）" placement="left">
          <IconButton onClick={() => toggleRightPanel("viewportSettings")} sx={pillBtn(isViewportSettingsOn)}>
            <SettingsRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
