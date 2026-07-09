import React, { useState } from 'react';
import { Box, Tooltip, Menu, MenuItem, Divider, Typography } from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
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
  bgcolor: BRAND.glass,
  backdropFilter: 'blur(16px)',
  border: `1px solid ${BRAND.line}`,
  color: BRAND.text,
  minWidth: 200,
  borderRadius: 1.5,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  py: 0.5,
};

// ── コンポーネント ───────────────────────────────────────────
const AIToolbar: React.FC = () => {
  const [openMenu, setOpenMenu] = useState<{ name: string; anchor: HTMLElement } | null>(null);

  const toggleProjectSidebar = useAppStore(s => s.toggleProjectSidebar);

  // 右端の AI 機能ボタン群（Chat / Drive / Project Chat / Render / 3D Generate / AI Studio）は
  // 右下ピルのホバーランチャー（Chat/Drive/DM/Render/3D）＋左レール（AI Studio）へ集約したため撤去。

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
            color: BRAND.sub2,
            '&:hover': { color: BRAND.text, bgcolor: BRAND.panel },
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
              color: openMenu?.name === menu.name ? BRAND.text : BRAND.sub2,
              bgcolor: openMenu?.name === menu.name ? BRAND.panel2 : 'transparent',
              fontSize: 12, fontWeight: 500,
              '&:hover': { color: BRAND.text, bgcolor: BRAND.panel },
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
              item.dividerBefore ? <Divider key={`${item.label}-divider`} sx={{ borderColor: BRAND.line, my: 0.5 }} /> : null,
              <MenuItem
                key={item.label}
                onClick={() => handleAction(item.action)}
                sx={{
                  fontSize: 13, py: 0.75, px: 2,
                  display: 'flex', justifyContent: 'space-between', gap: 4,
                  '&:hover': { bgcolor: BRAND.panel },
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <Typography component="span" sx={{ fontSize: 11, color: BRAND.sub2, flexShrink: 0 }}>
                    {item.shortcut}
                  </Typography>
                )}
              </MenuItem>,
            ].filter(Boolean))}
          </Menu>
        </React.Fragment>
      ))}

      {/* 右端の AI 機能ボタン群は撤去（右下ピル／左レールへ集約）。 */}
      <Box sx={{ flex: 1 }} />
    </Box>
  );
};

// チャットのホバー開閉などで親（MainLayout）が再描画されても、
// 自身の購読状態が変わらない限り再描画しない（開閉のもたつき防止）。
export default React.memo(AIToolbar);
