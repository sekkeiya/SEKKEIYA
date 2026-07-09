// チャット・サイドバー最下部に置く「グローバル・ショートカット一覧」。
// App.tsx で登録している Tauri global-shortcut（Ctrl+Alt+○）を一目で分かるようにまとめる。
// Web 版ではグローバルショートカットが効かない（shim で no-op）ため表示しない。
import React, { useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import { isTauri } from '../lib/platform';

// App.tsx の登録と対応（D=Drive / C=Chat / S=Search / R=Reader / F=スクショ）。
const SHORTCUTS: { label: string; keys: string }[] = [
  { label: 'SEKKEIYA OS（チャット）', keys: 'Ctrl+Alt+C' },
  { label: 'SEKKEIYA Search（検索）', keys: 'Ctrl+Alt+S' },
  { label: 'SEKKEIYA Drive（保管庫）', keys: 'Ctrl+Alt+D' },
  { label: 'SEKKEIYA Reader（記事）', keys: 'Ctrl+Alt+R' },
  { label: 'スクリーンショット', keys: 'Ctrl+Alt+F' },
];

// キー表記の小さなキーキャップ。
const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="span"
    sx={{
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 10, lineHeight: 1.4, whiteSpace: 'nowrap',
      color: 'rgb(var(--brand-fg-rgb) / 0.85)',
      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)',
      border: '1px solid rgb(var(--brand-fg-rgb) / 0.14)',
      borderRadius: '5px', px: 0.6, py: '1px', flexShrink: 0,
    }}
  >
    {children}
  </Box>
);

export const ShortcutsFooter: React.FC = () => {
  const [open, setOpen] = useState(true);
  // Web 版はグローバルショートカットが効かないので出さない（誤解防止）。フック呼び出し後に return する。
  if (!isTauri()) return null;

  return (
    <Box sx={{ flexShrink: 0, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', px: 1, pt: 0.5, pb: 0.75 }}>
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.4, borderRadius: 1, cursor: 'pointer',
          color: 'rgb(var(--brand-fg-rgb) / 0.5)',
          '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.8)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
        }}
      >
        <KeyboardRoundedIcon sx={{ fontSize: '0.95rem', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, flex: 1 }}>
          ショートカット
        </Typography>
        {open
          ? <KeyboardArrowUpRoundedIcon sx={{ fontSize: '1rem', flexShrink: 0 }} />
          : <KeyboardArrowDownRoundedIcon sx={{ fontSize: '1rem', flexShrink: 0 }} />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, px: 0.5, pt: 0.5 }}>
          {SHORTCUTS.map(s => (
            <Box key={s.keys} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75 }}>
              <Typography noWrap sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)', minWidth: 0 }}>
                {s.label}
              </Typography>
              <Kbd>{s.keys}</Kbd>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default ShortcutsFooter;
