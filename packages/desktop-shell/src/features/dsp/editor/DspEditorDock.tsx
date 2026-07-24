import React from 'react';
import { Box, IconButton, Tooltip, Divider } from '@mui/material';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import { useDspStore } from '../store/useDspStore';

const ACCENT = '#29b6f6';
const DOCK_BG = 'light-dark(rgba(255,255,255,0.88), rgba(7,11,24,0.78))';

type TabKey = 'slides' | 'outline';

const TABS: { key: TabKey; icon: React.ReactNode; label: string }[] = [
  { key: 'slides',  icon: <ViewModuleRoundedIcon sx={{ fontSize: 18 }} />,         label: 'スライド' },
  { key: 'outline', icon: <FormatListBulletedRoundedIcon sx={{ fontSize: 18 }} />, label: 'アウトライン' },
];

/**
 * DspEditorDock — キャンバス左端に重なるフローティングドック。
 * 3DSL の BottomDock 左セクションに相当する。
 *
 * - 「デフォルト左サイドバー」ボタン: DspSidebar（プロジェクトブラウザ）表示に切り替え
 * - 「スライド / アウトライン」ボタン: DspEditorSidebar のタブを切り替え
 */
export const DspEditorDock: React.FC = () => {
  const {
    leftPanelActiveTab,
    setLeftPanelActiveTab,
    showProjectBrowser,
    setShowProjectBrowser,
    showRightSidebar,
    setShowRightSidebar,
    inspectorActiveTopTab,
    setInspectorActiveTopTab,
  } = useDspStore();

  const handleTabClick = (tab: TabKey) => {
    setLeftPanelActiveTab(tab);
    setShowProjectBrowser(false);
  };

  const handleToggleProjectBrowser = () => {
    setShowProjectBrowser(!showProjectBrowser);
  };

  const handleRightTabClick = (tab: 'properties' | 'deck' | 'parts' | 'layers') => {
    if (showRightSidebar && inspectorActiveTopTab === tab) {
      setShowRightSidebar(false);
    } else {
      setShowRightSidebar(true);
      setInspectorActiveTopTab(tab);
    }
  };

  return (
    /* 全画面ポインターイベント無効オーバーレイ（3DSL の BottomDock と同じ手法） */
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
      {/* 左縦型ドック — キャンバス左端・縦中央 */}
      <Box
        sx={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          p: 0.75,
          bgcolor: DOCK_BG,
          backdropFilter: 'blur(14px)',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
          borderRadius: 2.5,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}
      >
        {/* デフォルト左サイドバー（プロジェクトブラウザ）トグル */}
        <Tooltip title="デフォルト左サイドバー" placement="right" arrow>
          <IconButton
            size="small"
            onClick={handleToggleProjectBrowser}
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              color: showProjectBrowser ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.45)',
              bgcolor: showProjectBrowser ? 'rgba(41,182,246,0.14)' : 'transparent',
              '&:hover': {
                color: showProjectBrowser ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.85)',
                bgcolor: showProjectBrowser ? 'rgba(41,182,246,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
              },
              transition: 'all 0.15s',
            }}
          >
            <ViewSidebarRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: 20, borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', my: 0.25 }} />

        {/* タブ切り替えボタン */}
        {TABS.map(t => {
          const isActive = !showProjectBrowser && leftPanelActiveTab === t.key;
          return (
            <Tooltip key={t.key} title={t.label} placement="right" arrow>
              <IconButton
                size="small"
                onClick={() => handleTabClick(t.key)}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  color: isActive ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.4)',
                  bgcolor: isActive ? 'rgba(41,182,246,0.14)' : 'transparent',
                  '&:hover': {
                    color: isActive ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.85)',
                    bgcolor: isActive ? 'rgba(41,182,246,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
                  },
                  transition: 'all 0.15s',
                }}
              >
                {t.icon}
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>

      {/* 右縦型ドック — キャンバス右端・縦中央 */}
      <Box
        sx={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          p: 0.75,
          bgcolor: DOCK_BG,
          backdropFilter: 'blur(14px)',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
          borderRadius: 2.5,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}
      >
        {([
          { tab: 'properties' as const, icon: <TuneRoundedIcon    sx={{ fontSize: 16 }} />, label: 'プロパティ' },
          { tab: 'deck'       as const, icon: <DashboardRoundedIcon sx={{ fontSize: 16 }} />, label: 'デッキテンプレート' },
          { tab: 'parts'      as const, icon: <CategoryRoundedIcon  sx={{ fontSize: 16 }} />, label: 'パーツテンプレート' },
        ] as const).map(({ tab, icon, label }) => {
          const isActive = showRightSidebar && inspectorActiveTopTab === tab;
          return (
            <Tooltip key={tab} title={label} placement="left" arrow>
              <IconButton
                size="small"
                onClick={() => handleRightTabClick(tab)}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  color: isActive ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: isActive ? 'rgba(41,182,246,0.14)' : 'transparent',
                  '&:hover': {
                    color: isActive ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.85)',
                    bgcolor: isActive ? 'rgba(41,182,246,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
                  },
                  transition: 'all 0.15s',
                }}
              >
                {icon}
              </IconButton>
            </Tooltip>
          );
        })}

        <Divider sx={{ width: 20, borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', my: 0.25 }} />

        <Tooltip title="レイヤー" placement="left" arrow>
          <IconButton
            size="small"
            onClick={() => handleRightTabClick('layers')}
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              color: showRightSidebar && inspectorActiveTopTab === 'layers' ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.45)',
              bgcolor: showRightSidebar && inspectorActiveTopTab === 'layers' ? 'rgba(41,182,246,0.14)' : 'transparent',
              '&:hover': {
                color: showRightSidebar && inspectorActiveTopTab === 'layers' ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.85)',
                bgcolor: showRightSidebar && inspectorActiveTopTab === 'layers' ? 'rgba(41,182,246,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
              },
              transition: 'all 0.15s',
            }}
          >
            <LayersRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};
