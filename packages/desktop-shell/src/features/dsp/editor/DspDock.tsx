import React from 'react';
import { Box, IconButton, Tooltip, Divider } from '@mui/material';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import { useDspStore } from '../store/useDspStore';

const ACCENT = '#29b6f6';

type TabKey = 'slides' | 'assets' | 'outline';

const TABS: { key: TabKey; icon: React.ReactNode; label: string }[] = [
  { key: 'slides',  icon: <ViewModuleRoundedIcon sx={{ fontSize: 19 }} />,           label: 'スライド' },
  { key: 'assets',  icon: <ImageRoundedIcon sx={{ fontSize: 19 }} />,                label: '素材' },
  { key: 'outline', icon: <FormatListBulletedRoundedIcon sx={{ fontSize: 19 }} />,   label: 'アウトライン' },
];

/**
 * DspDock — 3DSL の BottomDock 左セクションに相当する縦型アクティビティバー。
 * 常に表示され、クリックでパネルの切り替え / 折りたたみを行う。
 * - アクティブなタブアイコンをもう一度クリック → パネルを閉じる（VS Code スタイル）
 * - 非アクティブなタブをクリック → パネルを開いてそのタブへ切り替え
 */
export const DspDock: React.FC = () => {
  const {
    leftPanelActiveTab,
    setLeftPanelActiveTab,
    isSlidesPanelOpen,
    setSlidesPanelOpen,
  } = useDspStore();

  const handleClick = (tab: TabKey) => {
    if (tab === leftPanelActiveTab && isSlidesPanelOpen) {
      // アクティブタブ再クリック → 折りたたむ
      setSlidesPanelOpen(false);
    } else {
      // 別タブをクリック or パネルが閉じている → 開いて切り替え
      setLeftPanelActiveTab(tab);
      setSlidesPanelOpen(true);
    }
  };

  return (
    <Box
      sx={{
        width: 48,
        flexShrink: 0,
        bgcolor: 'light-dark(rgba(255, 255, 255, 0.95), rgba(8, 10, 18, 0.97))',
        borderRight: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1.5,
        gap: 0.5,
        zIndex: 10,
      }}
    >
      {TABS.map((t, idx) => {
        const isActive = isSlidesPanelOpen && leftPanelActiveTab === t.key;
        return (
          <React.Fragment key={t.key}>
            {/* アウトラインの前にセパレーター */}
            {idx === 2 && (
              <Divider
                sx={{ width: 24, borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', my: 0.5 }}
              />
            )}
            <Tooltip title={t.label} placement="right" arrow>
              <IconButton
                size="small"
                onClick={() => handleClick(t.key)}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  color: isActive ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.38)',
                  bgcolor: isActive ? 'rgba(41,182,246,0.13)' : 'transparent',
                  position: 'relative',
                  transition: 'color 0.15s, background-color 0.15s',
                  '&:hover': {
                    color: isActive ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.85)',
                    bgcolor: isActive
                      ? 'rgba(41,182,246,0.18)'
                      : 'rgb(var(--brand-fg-rgb) / 0.07)',
                  },
                  // アクティブインジケーター（左端の縦バー）
                  '&::before': isActive
                    ? {
                        content: '""',
                        position: 'absolute',
                        left: -6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 3,
                        height: 18,
                        borderRadius: 4,
                        bgcolor: ACCENT,
                      }
                    : {},
                }}
              >
                {t.icon}
              </IconButton>
            </Tooltip>
          </React.Fragment>
        );
      })}
    </Box>
  );
};
