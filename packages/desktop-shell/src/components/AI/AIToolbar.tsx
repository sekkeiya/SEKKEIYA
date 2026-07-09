import React, { useState, useRef } from 'react';
import { Box, Tooltip, Menu, MenuItem, Divider, Typography } from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { useAppStore } from '../../store/useAppStore';
import { BRAND } from '../../styles/theme';

const BAR_H = 30;

// ── キーボードショートカットをエミュレート ──────────────────
const shortcut = (key: string, ctrl = true, shift = false) => {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key, ctrlKey: ctrl, shiftKey: shift, bubbles: true, cancelable: true,
  }));
};

// ── メニュー定義 ────────────────────────────────────────────
type MenuDef = { label: string; shortcut?: string; action: () => void; dividerBefore?: boolean };

const FILE_ITEMS: MenuDef[] = [
  { label: 'New',                  shortcut: 'Ctrl+N', action: () => shortcut('n') },
  { label: 'Save',                 shortcut: 'Ctrl+S', action: () => shortcut('s') },
  { label: 'Import Local Files…',  action: () => shortcut('i') },
  { label: 'Export',               action: () => shortcut('e') },
];

const EDIT_ITEMS: MenuDef[] = [
  { label: 'Undo',  shortcut: 'Ctrl+Z', action: () => shortcut('z') },
  { label: 'Redo',  shortcut: 'Ctrl+Y', action: () => shortcut('y') },
  { label: 'Copy',  shortcut: 'Ctrl+C', action: () => shortcut('c'), dividerBefore: true },
  { label: 'Paste', shortcut: 'Ctrl+V', action: () => shortcut('v') },
];

const HELP_ITEMS: MenuDef[] = [
  { label: 'About SEKKEIYA', action: () => alert('SEKKEIYA Desktop\nBuilt with Tauri + React') },
  { label: 'Docs',           action: () => {} },
];

const MENUS = [
  { name: 'File', items: FILE_ITEMS },
  { name: 'Edit', items: EDIT_ITEMS },
  { name: 'Help', items: HELP_ITEMS },
];

const menuPaperSx = {
  bgcolor: 'rgba(18,20,26,0.97)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff',
  minWidth: 200,
  borderRadius: 1.5,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  py: 0.5,
};

// ── コンポーネント ───────────────────────────────────────────
const AIToolbar: React.FC = () => {
  const [openMenu, setOpenMenu] = useState<{ name: string; anchor: HTMLElement } | null>(null);

  const isAIDriveOpen    = useAppStore(s => s.isAIDriveOpen);
  const isAIChatOpen     = useAppStore(s => s.isAIChatOpen);
  const isTeamChatOpen   = useAppStore(s => s.isTeamChatOpen);
  const isAIRenderOpen   = useAppStore(s => s.isAIRenderOpen);
  const isAI3DCreateOpen = useAppStore(s => s.isAI3DCreateOpen);
  const currentMainView  = useAppStore(s => s.currentMainView);
  const isAIDriveExpanded = useAppStore(s => s.isAIDriveExpanded);
  const toggleProjectSidebar = useAppStore(s => s.toggleProjectSidebar);

  // AI Studio を開く直前の画面を覚えておき、もう一度押したらそこへ戻して閉じる。
  const prevViewBeforeStudio = useRef<typeof currentMainView>('my-site');

  const aiButtons = [
    {
      icon: <FolderRoundedIcon sx={{ fontSize: 18 }} />, label: 'AI ドライブ', active: isAIDriveOpen,
      onClick: () => { const s = useAppStore.getState(); s.setAIRenderOpen(false); s.setAI3DCreateOpen(false); s.toggleAIDrive(); },
    },
    {
      icon: <ChatRoundedIcon sx={{ fontSize: 18 }} />, label: 'SEKKEIYA Chat', active: isAIChatOpen,
      onClick: () => { const s = useAppStore.getState(); if (!isAIDriveExpanded) s.setAIDriveOpen(false); s.setAIRenderOpen(false); s.setAI3DCreateOpen(false); s.toggleAIChat(); },
    },
    {
      icon: <ForumRoundedIcon sx={{ fontSize: 18 }} />, label: 'Project Chat（メンバー間）', active: isTeamChatOpen,
      onClick: () => { const s = useAppStore.getState(); if (!isAIDriveExpanded) s.setAIDriveOpen(false); s.setAIRenderOpen(false); s.setAI3DCreateOpen(false); s.toggleTeamChat(); },
    },
    {
      icon: <WallpaperRoundedIcon sx={{ fontSize: 18 }} />, label: 'AI Render', active: isAIRenderOpen,
      onClick: () => { const s = useAppStore.getState(); if (!isAIDriveExpanded) s.setAIDriveOpen(false); s.setAI3DCreateOpen(false); s.toggleAIRender(); },
    },
    {
      icon: <BrushRoundedIcon sx={{ fontSize: 18 }} />, label: 'AI 3D Generate', active: isAI3DCreateOpen,
      onClick: () => { const s = useAppStore.getState(); if (!isAIDriveExpanded) s.setAIDriveOpen(false); s.setAIRenderOpen(false); s.toggleAI3DCreate(); },
    },
    {
      icon: <SchoolRoundedIcon sx={{ fontSize: 18 }} />, label: 'AI Studio', active: currentMainView === 'ai-studio',
      onClick: () => {
        const s = useAppStore.getState();
        if (s.currentMainView === 'ai-studio') {
          s.setCurrentMainView(prevViewBeforeStudio.current || 'my-site');
        } else {
          prevViewBeforeStudio.current = s.currentMainView;
          s.setCurrentMainView('ai-studio');
        }
      },
    },
  ];

  const handleMenuOpen = (name: string, e: React.MouseEvent<HTMLElement>) => {
    setOpenMenu({ name, anchor: e.currentTarget });
  };

  const handleMenuClose = () => setOpenMenu(null);

  const handleAction = (action: () => void) => {
    handleMenuClose();
    action();
  };

  return (
    <Box
      sx={{
        height: BAR_H,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        bgcolor: BRAND.bg,
        borderBottom: `1px solid ${BRAND.line}`,
        userSelect: 'none',
      }}
    >
      {/* ── プロジェクトバー開閉（ハンバーガー） ──
          下のミニサイドバー（幅 56px）のアカウントボタン中心に揃えるため、
          コンテナ幅も 56px にして中央寄せ。右の Divider が左レール右端と縦に揃う。 */}
      <Tooltip title="プロジェクトバーを開閉" placement="bottom" arrow>
        <Box
          onClick={() => toggleProjectSidebar()}
          sx={{
            height: BAR_H,
            width: 56,
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
          }}
        >
          <MenuRoundedIcon sx={{ fontSize: 18 }} />
        </Box>
      </Tooltip>
      <Divider orientation="vertical" flexItem sx={{ borderColor: BRAND.line, my: 0.5 }} />

      {/* ── File / Edit / Help ── */}
      {MENUS.map(menu => (
        <React.Fragment key={menu.name}>
          <Box
            onClick={e => handleMenuOpen(menu.name, e)}
            sx={{
              height: BAR_H, px: 1.5,
              display: 'flex', alignItems: 'center',
              cursor: 'pointer',
              color: openMenu?.name === menu.name ? '#fff' : 'rgba(255,255,255,0.6)',
              bgcolor: openMenu?.name === menu.name ? 'rgba(255,255,255,0.08)' : 'transparent',
              fontSize: 12, fontWeight: 500,
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            {menu.name}
          </Box>
          <Menu
            anchorEl={openMenu?.name === menu.name ? openMenu.anchor : null}
            open={openMenu?.name === menu.name}
            onClose={handleMenuClose}
            anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'left', vertical: 'top' }}
            slotProps={{ paper: { sx: menuPaperSx } }}
          >
            {menu.items.flatMap((item) => [
              item.dividerBefore ? <Divider key={`${item.label}-divider`} sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 0.5 }} /> : null,
              <MenuItem
                key={item.label}
                onClick={() => handleAction(item.action)}
                sx={{
                  fontSize: 13, py: 0.75, px: 2,
                  display: 'flex', justifyContent: 'space-between', gap: 4,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <Typography component="span" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                    {item.shortcut}
                  </Typography>
                )}
              </MenuItem>,
            ].filter(Boolean))}
          </Menu>
        </React.Fragment>
      ))}

      {/* ── 右端：AI ツールボタン群 ── */}
      <Box sx={{ flex: 1 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', borderLeft: `1px solid ${BRAND.line}` }}>
        {aiButtons.map(({ icon, label, active, onClick }) => (
          <Tooltip key={label} title={label} placement="bottom" arrow>
            <Box
              onClick={onClick}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: BAR_H, px: 1.5,
                color: active ? '#3498db' : 'rgba(255,255,255,0.4)',
                bgcolor: active ? 'rgba(52,152,219,0.12)' : 'transparent',
                cursor: 'pointer',
                borderRight: `1px solid ${BRAND.line}`,
                transition: 'color 0.15s, background-color 0.15s',
                '&:hover': { color: active ? '#3498db' : '#fff', bgcolor: active ? 'rgba(52,152,219,0.18)' : 'rgba(255,255,255,0.06)' },
              }}
            >
              {icon}
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
};

// チャットのホバー開閉などで親（MainLayout）が再描画されても、
// 自身の購読状態が変わらない限り再描画しない（開閉のもたつき防止）。
export default React.memo(AIToolbar);
