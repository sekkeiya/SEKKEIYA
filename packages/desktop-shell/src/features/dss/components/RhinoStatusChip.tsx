import React from 'react';
import { Chip, Tooltip, Box } from '@mui/material';
import { useDccStore, type DccConnectionStatus } from '../../../store/useDccStore';

// 要件50: S.Model ヘッダーに常時表示する Rhino 接続インジケータ。
// rhinoStatus（App.tsx が startPolling で 10 秒ごとに更新）を読み、状態を色つきチップで表示する。
// 未接続系はクリックでセットアップ、接続中はクリックで即時再確認。

interface StatusView {
  label: string;
  dot: string;   // ドット色
  fg: string;    // 文字色
  bg: string;    // 背景色
}

// light-dark(明, 暗) で両テーマに対応。
const VIEW: Record<DccConnectionStatus, StatusView> = {
  connected:     { label: 'Rhino 接続中', dot: '#16a34a', fg: 'light-dark(#15803d, #86efac)', bg: 'light-dark(rgba(22,163,74,0.12), rgba(22,163,74,0.20))' },
  not_running:   { label: 'Rhino 未起動', dot: '#f59e0b', fg: 'light-dark(#b45309, #fcd34d)', bg: 'light-dark(rgba(245,158,11,0.12), rgba(245,158,11,0.20))' },
  not_installed: { label: 'Rhino 未設定', dot: '#f59e0b', fg: 'light-dark(#b45309, #fcd34d)', bg: 'light-dark(rgba(245,158,11,0.12), rgba(245,158,11,0.20))' },
  checking:      { label: 'Rhino 確認中…', dot: '#94a3b8', fg: 'text.secondary', bg: 'action.hover' },
  unknown:       { label: 'Rhino 未確認', dot: '#94a3b8', fg: 'text.secondary', bg: 'action.hover' },
  error:         { label: 'Rhino エラー', dot: '#ef4444', fg: 'light-dark(#b91c1c, #fca5a5)', bg: 'light-dark(rgba(239,68,68,0.12), rgba(239,68,68,0.20))' },
};

export const RhinoStatusChip: React.FC = () => {
  const rhinoStatus = useDccStore(s => s.rhinoStatus);
  const rhinoMessage = useDccStore(s => s.rhinoMessage);
  const openSetupModal = useDccStore(s => s.openSetupModal);
  const checkRhinoConnection = useDccStore(s => s.checkRhinoConnection);

  const v = VIEW[rhinoStatus] ?? VIEW.unknown;
  const connected = rhinoStatus === 'connected';

  const tip = connected
    ? '接続中のRhinoにモデルをワンクリックでインポートできます. クリックで再確認'
    : (rhinoMessage || 'Rhinoが未接続です. クリックでセットアップ');

  const handleClick = () => {
    void checkRhinoConnection();
    if (!connected) openSetupModal('rhino');
  };

  return (
    <Tooltip title={tip} placement="bottom" arrow>
      <Chip
        size="small"
        onClick={handleClick}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: v.dot, flexShrink: 0 }} />
            {v.label}
          </Box>
        }
        sx={{
          height: 26,
          fontSize: 12,
          fontWeight: 600,
          color: v.fg,
          bgcolor: v.bg,
          border: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
          '& .MuiChip-label': { px: 1 },
          '&:hover': { borderColor: v.dot },
        }}
      />
    </Tooltip>
  );
};
