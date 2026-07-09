/**
 * LayoutRulesDialog.tsx
 * セット家具の管理ダイアログ。
 * Auto Layout はセット家具＋セット配置ルールを主軸に動作する（セット中心方針）。
 * 旧・配置ルール/カテゴリ関係タブは廃止（エンジン側フォールバックはデフォルトルールで動作）。
 */

import React from 'react';
import {
  Dialog, DialogTitle, DialogContent,
  Box, IconButton, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';

import { useAutoLayoutStore } from '../store/useAutoLayoutStore';
import { DssSetFurnitureGrid } from '../../../dss/components/DssSetFurnitureGrid';

const LINE = 'rgba(255,255,255,0.1)';

interface Props {
  projectId?: string | null;
}

export function LayoutRulesDialog({ projectId: _projectId }: Props) {
  const open = useAutoLayoutStore((s) => s.rulesDialogOpen);
  const onClose = useAutoLayoutStore((s) => s.closeRulesDialog);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: '#16161e',
          border: `1px solid ${LINE}`,
          color: '#fff',
          height: '90vh',
          width: '95vw',
          maxWidth: 1400,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* ヘッダー */}
      <DialogTitle
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: `1px solid ${alpha('#fff', 0.08)}`,
          py: 1.5, px: 2.5, flexShrink: 0,
        }}
      >
        <TuneRoundedIcon sx={{ fontSize: 20, color: '#a78bfa' }} />
        <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>
          レイアウトルール設定
        </Typography>
        <Typography sx={{ fontSize: 12, color: alpha('#fff', 0.4), mr: 1 }}>
          セット家具と配置ルールを管理する — Auto Layout はここで定義したセットを使用します
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: alpha('#fff', 0.5), '&:hover': { color: '#fff' } }}
        >
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      {/* コンテンツ: セット家具グリッド */}
      <DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <DssSetFurnitureGrid items={[]} canCreate={true} />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
