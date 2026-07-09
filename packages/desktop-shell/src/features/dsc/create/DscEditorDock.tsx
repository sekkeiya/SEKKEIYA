import React from 'react';
import { Box, IconButton, Tooltip, Divider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useDscStore } from '../store/useDscStore';

const ACCENT = '#ffa726';
const DOCK_BG = alpha('#070b18', 0.78);

/**
 * DscEditorDock — 3DSC スタジオキャンバス左端に浮くフローティングドック。
 * 3DSP の DspEditorDock / 3DSL の BottomDock 左セクションに相当。
 *
 * - 「デフォルト左サイドバー」ボタン: DscSidebar（プロジェクトブラウザ）表示に切り替え
 * - 「パーツ / レイヤー」ボタン: DscEditorSidebar のタブを切り替え
 */
export const DscEditorDock: React.FC = () => {
  const { showDscProjectBrowser, setShowDscProjectBrowser, showDscRightSidebar, setShowDscRightSidebar } = useDscStore();

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
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
            onClick={() => setShowDscProjectBrowser(!showDscProjectBrowser)}
            sx={{
              width: 32, height: 32, borderRadius: 1.5,
              color: showDscProjectBrowser ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.45)',
              bgcolor: showDscProjectBrowser ? 'rgba(255,167,38,0.14)' : 'transparent',
              transition: 'all 0.15s',
              '&:hover': {
                color: showDscProjectBrowser ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.85)',
                bgcolor: showDscProjectBrowser ? 'rgba(255,167,38,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
              },
            }}
          >
            <ViewSidebarRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: 20, borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', my: 0.25 }} />

        {/* パーツタブ */}
        <Tooltip title="パーツ" placement="right" arrow>
          <IconButton
            size="small"
            onClick={() => setShowDscProjectBrowser(false)}
            sx={{
              width: 32, height: 32, borderRadius: 1.5,
              color: !showDscProjectBrowser ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.4)',
              bgcolor: !showDscProjectBrowser ? 'rgba(255,167,38,0.14)' : 'transparent',
              transition: 'all 0.15s',
              '&:hover': {
                color: !showDscProjectBrowser ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.85)',
                bgcolor: !showDscProjectBrowser ? 'rgba(255,167,38,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
              },
            }}
          >
            <ViewInArIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        {/* レイヤータブ（将来拡張用 - 現在は同じ DscEditorSidebar を開くだけ） */}
        <Tooltip title="レイヤー" placement="right" arrow>
          <IconButton
            size="small"
            onClick={() => setShowDscProjectBrowser(false)}
            sx={{
              width: 32, height: 32, borderRadius: 1.5,
              color: 'rgb(var(--brand-fg-rgb) / 0.4)',
              bgcolor: 'transparent',
              transition: 'all 0.15s',
              '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.85)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
            }}
          >
            <LayersRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
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
        <Tooltip title="プロパティパネル" placement="left" arrow>
          <IconButton
            size="small"
            onClick={() => setShowDscRightSidebar(!showDscRightSidebar)}
            sx={{
              width: 32, height: 32, borderRadius: 1.5,
              color: showDscRightSidebar ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.45)',
              bgcolor: showDscRightSidebar ? 'rgba(255,167,38,0.14)' : 'transparent',
              transition: 'all 0.15s',
              '&:hover': {
                color: showDscRightSidebar ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.85)',
                bgcolor: showDscRightSidebar ? 'rgba(255,167,38,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
              },
            }}
          >
            <TuneRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};
