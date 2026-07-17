// src/features/layout/components/BottomBar/BottomDock.jsx
import React, { useMemo, useCallback } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";

// ✅ Twinmotion式 Right Panels
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded"; // Project Hierarchy
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded"; // Scene
import TuneRoundedIcon from "@mui/icons-material/TuneRounded"; // Properties
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded"; // History
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded"; // Viewport Settings

// ✅ NEW: Zustand
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
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
  // 全幅ヘッダー化: 左サイドバーが LayoutShell 内へ埋め込まれたため、
  // 左レール(left:16)がサイドバーに重ならないよう左オフセットも受ける。
  leftInset = 0,
}) {
  const theme = useTheme();

  // ✅ RightSidebar表示状態（Zustandから直読み）
  const rightPanels = useUiRightSidebarStore((s) => s.rightPanels);
  // 右ドックは「一度に1枚だけ開く」排他トグル（将来 2 枚同時に開きたくなったら toggleRightPanel に戻す）。
  const toggleRightPanel = useUiRightSidebarStore((s) => s.toggleRightPanelExclusive);

  // Map ボタン：Map モードへ入退（トップツールバーの Map タブと同じ挙動）。
  const handleToggleMap = useCallback(() => toggleMapMode(), []);

  const editorMode = useEditorModeStore((s) => s.editorMode);

  // ✅ 2D/3D グループでレールのボタンを絞る（Map=2Dのみ / History(生成履歴)=3Dのみ）
  const viewGroup = useEditorModeStore((s) => s.editorViewGroup);
  const isViewGroup2D = viewGroup === "2d";

  const rootSx = useMemo(
    () => ({
      position: "absolute",
      left: leftInset,
      right: rightInset,
      top: 0,
      bottom: 0,
      zIndex: 60,
      pointerEvents: "none", // root is click-through
      transition: "left 0.22s cubic-bezier(0.4,0,0.2,1), right 0.22s cubic-bezier(0.4,0,0.2,1)",
    }),
    [leftInset, rightInset]
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

  const isProjectHierarchyOn = !!rightPanels?.projectHierarchy;
  const isSceneOn = !!rightPanels?.scene;
  const isPropsOn = !!rightPanels?.properties;
  const isLibraryOn = !!rightPanels?.library;
  const isHistoryOn = !!rightPanels?.history;
  const isMapOn = !!rightPanels?.map;
  const isViewportSettingsOn = !!rightPanels?.viewportSettings;

  // 選択中（オン）のボタンを持つドックは未ホバーでも薄くしすぎない（状態が一目で分かるように）。
  const rightActive = isProjectHierarchyOn || isSceneOn || isPropsOn || isLibraryOn || isHistoryOn || isViewportSettingsOn;
  const activeDockOpacity = 0.9;

  // ウォークスルー中は編集用ドック（左右の浮動ツールバー・モード切替）を隠して
  // 没入させる。これにより情報パネルの閉じるボタンが右側の浮動メニュー（目アイコン）と
  // 重なってクリックできない問題も解消する。
  if (editorMode === "walkthrough") return null;

  return (
    <Box sx={rootSx}>
      {/* 全幅ヘッダー化: エディタの左サイドバー（デフォルト/Project Hierarchy/Library）は廃止。
          Library は右サイドバーのパネルとして開く（右レールにトグルを追加）。 */}

      {/* 左ドック下部の★メニュー（自動アクションのランチャー）。
          ピッカー等でボトムパネルが開いている間は下部ギャラリーと干渉しないよう★も隠す。 */}
      {!panelOpen && <AutoActionStarMenu />}

      {/* 自動レイアウト/マテリアル等のスタイル選択ギャラリー（←→＋Enter/Space） */}
      {!panelOpen && <AutoActionGalleryBar />}

      {/* 右の縦ドックは廃止。パネル切替は右サイドバー上部の切替タブへ移設した。 */}
    </Box>
  );
}
