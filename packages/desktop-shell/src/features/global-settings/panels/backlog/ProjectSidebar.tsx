// SEKKEIYA Code の左サイドバー: プロジェクト（クラウド＋ローカル）の一覧・切替・追加・削除。
// - クラウド（SEKKEIYA 本体の開発バックログ）は固定 1 件で削除不可。
//   要件74: 管理者だけの領域なので、一般ユーザーには項目ごと出さない（showCloud=false）。
// - ローカルは登録一覧（localStorage）。「削除」は一覧から外すだけで、フォルダはディスクに残る。
// - Tauri 専用（呼び出し側が isTauri() でガードする。Web は従来どおりクラウド固定・サイドバー無し）。
import React from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, IconButton, Tooltip, Divider } from '@mui/material';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { ProjectRef } from './createBacklogStore';

export interface ProjectSidebarProps {
  projectRef: ProjectRef | null;         // null = プロジェクト未選択（作成を促す状態）
  projects: string[];                    // 登録済みローカルプロジェクトのパス一覧（安定順）
  showCloud: boolean;                    // 要件74: クラウド（SEKKEIYA 本体）を出すか
  onSelectCloud: () => void;
  onSelectLocal: (path: string) => void;
  onRemove: (path: string) => void;      // 一覧から外すだけ（フォルダは残る）
  onCreateNew: () => void;
  onOpenFolder: () => void;
}

const itemSx = {
  borderRadius: 1.5,
  py: 0.5,
  minHeight: 36,
  '&.Mui-selected': { bgcolor: 'light-dark(rgba(8,117,166,0.12), rgba(79,195,247,0.14))' },
  '&:hover .proj-del': { opacity: 1 },
} as const;

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projectRef, projects, showCloud, onSelectCloud, onSelectLocal, onRemove, onCreateNew, onOpenFolder,
}) => (
  <Box sx={{
    width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
    borderRight: '1px solid', borderColor: 'divider', bgcolor: 'light-dark(rgba(0,0,0,0.02), rgba(255,255,255,0.02))',
  }}>
    <List dense sx={{ px: 1, pt: 1.5, flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {showCloud && (
        <ListItemButton selected={projectRef?.kind === 'cloud'} onClick={onSelectCloud} sx={itemSx}>
          <ListItemIcon sx={{ minWidth: 30 }}><CloudRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="SEKKEIYA" secondary="クラウド"
            primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
            secondaryTypographyProps={{ fontSize: 10 }} />
        </ListItemButton>
      )}

      <Typography variant="caption" sx={{ display: 'block', px: 1.5, pt: showCloud ? 1.5 : 0, pb: 0.5, color: 'text.disabled', fontWeight: 600 }}>
        プロジェクト
      </Typography>
      {projects.length === 0 && (
        <Typography variant="caption" sx={{ display: 'block', px: 1.5, color: 'text.disabled' }}>
          （まだありません。下の「新規プロジェクトを作成」から始められます）
        </Typography>
      )}
      {projects.map(p => {
        const name = p.split(/[\\/]/).pop() || p;
        return (
          <ListItemButton key={p} selected={projectRef?.kind === 'local' && projectRef.path === p}
            onClick={() => onSelectLocal(p)} sx={itemSx}>
            <ListItemIcon sx={{ minWidth: 30 }}><FolderRoundedIcon fontSize="small" /></ListItemIcon>
            <Tooltip title={p} arrow placement="right">
              <ListItemText primary={name} primaryTypographyProps={{ fontSize: 13, noWrap: true }} />
            </Tooltip>
            <Tooltip title="一覧から外す（フォルダは残ります）" arrow>
              <IconButton
                className="proj-del" size="small" edge="end"
                onClick={(e) => { e.stopPropagation(); onRemove(p); }}
                sx={{ opacity: 0, p: 0.25, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
              >
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </ListItemButton>
        );
      })}
    </List>

    <Divider />
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <ListItemButton onClick={onCreateNew} sx={{ ...itemSx, py: 0.75 }}>
        <ListItemIcon sx={{ minWidth: 30 }}><AddRoundedIcon fontSize="small" /></ListItemIcon>
        <ListItemText primary="新規プロジェクトを作成" primaryTypographyProps={{ fontSize: 12.5 }} />
      </ListItemButton>
      <ListItemButton onClick={onOpenFolder} sx={{ ...itemSx, py: 0.75 }}>
        <ListItemIcon sx={{ minWidth: 30 }}><FolderOpenRoundedIcon fontSize="small" /></ListItemIcon>
        <ListItemText primary="フォルダを開く…" primaryTypographyProps={{ fontSize: 12.5 }} />
      </ListItemButton>
    </Box>
  </Box>
);
