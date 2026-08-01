// SEKKEIYA Code の左サイドバー: プロジェクト（クラウド＋ローカル）の一覧・切替・追加・削除。
// - クラウド（SEKKEIYA 本体の開発バックログ）は固定 1 件で削除不可。
//   要件74: 管理者だけの領域なので、一般ユーザーには項目ごと出さない（showCloud=false）。
// - ローカルは登録一覧（localStorage）。「削除」は一覧から外すだけで、フォルダはディスクに残る。
// - Tauri 専用（呼び出し側が isTauri() でガードする。Web は従来どおりクラウド固定・サイドバー無し）。
// - 選択中プロジェクト配下には「バックログ / 全スプリント / ＋ スプリント作成」のスプリント管理ハブを
//   ネストする（サイドバーから作成・期間編集・削除・アーカイブ解除まで完結させる）。
import React, { useState } from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, IconButton, Tooltip, Divider, Menu, MenuItem } from '@mui/material';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import type { ProjectRef } from './createBacklogStore';
import type { Sprint } from '../DevStatusPanel';
import type { SidebarSel } from './sprintViewLogic';

export interface ProjectSidebarProps {
  projectRef: ProjectRef | null;         // null = プロジェクト未選択（作成を促す状態）
  projects: string[];                    // 登録済みローカルプロジェクトのパス一覧（安定順）
  showCloud: boolean;                    // 要件74: クラウド（SEKKEIYA 本体）を出すか
  onSelectCloud: () => void;
  onSelectLocal: (path: string) => void;
  onRemove: (path: string) => void;      // 一覧から外すだけ（フォルダは残る）
  onCreateNew: () => void;
  onOpenFolder: () => void;
  sprints: Sprint[];                     // 選択中プロジェクトの全スプリント（seq 降順）
  sel: SidebarSel;                       // サイドバー選択状態（全表示/バックログ/特定スプリント）
  onSelect: (sel: SidebarSel) => void;
  onCreateSprint: () => void;
  onEditSprint: (s: Sprint) => void;     // 期間編集ダイアログを開く
  onRemoveSprint: (s: Sprint) => void;   // 既存の確認ダイアログ経由
  onUnarchiveSprint: (s: Sprint) => void;
  /** フッターに置く環境ステータス（Claude Code の導入状況など）。
   *  状態やラベル生成は呼び出し側の責務で、ここは置き場所だけを提供する。 */
  statusSlot?: React.ReactNode;
  /** サイドバーを畳む。渡されたときだけホバーで «ボタンを出す。 */
  onCollapse?: () => void;
}

const itemSx = {
  borderRadius: 1.5,
  py: 0.5,
  minHeight: 36,
  '&.Mui-selected': { bgcolor: 'light-dark(rgba(8,117,166,0.12), rgba(79,195,247,0.14))' },
  '&:hover .proj-del': { opacity: 1 },
  '&:hover .sprint-menu-btn': { opacity: 1 },
} as const;

const subItemSx = { ...itemSx, minHeight: 30, py: 0.25 } as const;

/** 選択中プロジェクト配下のネスト（バックログ / 全スプリント / ＋ スプリント作成）。 */
const SprintSubList: React.FC<{
  sprints: Sprint[];
  sel: SidebarSel;
  onSelect: (sel: SidebarSel) => void;
  onCreateSprint: () => void;
  onEditSprint: (s: Sprint) => void;
  onRemoveSprint: (s: Sprint) => void;
  onUnarchiveSprint: (s: Sprint) => void;
}> = ({ sprints, sel, onSelect, onCreateSprint, onEditSprint, onRemoveSprint, onUnarchiveSprint }) => {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; sprint: Sprint } | null>(null);
  const closeMenu = () => setMenu(null);
  return (
    <List dense disablePadding sx={{ pl: 2.5 }}>
      <ListItemButton selected={sel.kind === 'backlog'} onClick={() => onSelect({ kind: 'backlog' })} sx={subItemSx}>
        <ListItemIcon sx={{ minWidth: 24 }}><InboxRoundedIcon sx={{ fontSize: 15 }} /></ListItemIcon>
        <ListItemText primary="バックログ" primaryTypographyProps={{ fontSize: 12.5 }} />
      </ListItemButton>
      {sprints.map(s => {
        const archived = !!s.archived;
        return (
          <ListItemButton
            key={s.id}
            selected={sel.kind === 'sprint' && sel.id === s.id}
            onClick={() => onSelect({ kind: 'sprint', id: s.id })}
            sx={subItemSx}
          >
            <ListItemIcon sx={{ minWidth: 24 }}>
              {archived
                ? <HistoryRoundedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                : <FlagRoundedIcon sx={{ fontSize: 15 }} />}
            </ListItemIcon>
            <ListItemText
              primary={`スプリント${s.seq}`} secondary={s.endDate}
              primaryTypographyProps={{ fontSize: 12.5, color: archived ? 'text.disabled' : 'text.primary' }}
              secondaryTypographyProps={{ fontSize: 10 }}
            />
            <IconButton
              className="sprint-menu-btn" size="small" edge="end"
              onClick={(e) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, sprint: s }); }}
              sx={{ opacity: 0, p: 0.25, color: 'text.disabled', '&:hover': { color: 'text.primary' } }}
            >
              <MoreVertRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </ListItemButton>
        );
      })}
      <ListItemButton onClick={onCreateSprint} sx={subItemSx}>
        <ListItemIcon sx={{ minWidth: 24 }}><AddRoundedIcon sx={{ fontSize: 15 }} /></ListItemIcon>
        <ListItemText primary="スプリント作成" primaryTypographyProps={{ fontSize: 12.5 }} />
      </ListItemButton>

      <Menu
        anchorEl={menu?.anchor} open={!!menu} onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {menu && !menu.sprint.archived && [
          <MenuItem key="edit" sx={{ fontSize: 13 }} onClick={() => { onEditSprint(menu.sprint); closeMenu(); }}>
            期間を編集
          </MenuItem>,
          <MenuItem key="remove" sx={{ fontSize: 13, color: 'error.main' }} onClick={() => { onRemoveSprint(menu.sprint); closeMenu(); }}>
            削除
          </MenuItem>,
        ]}
        {menu && menu.sprint.archived && [
          <MenuItem key="unarchive" sx={{ fontSize: 13 }} onClick={() => { onUnarchiveSprint(menu.sprint); closeMenu(); }}>
            アーカイブ解除
          </MenuItem>,
          <MenuItem key="remove" sx={{ fontSize: 13, color: 'error.main' }} onClick={() => { onRemoveSprint(menu.sprint); closeMenu(); }}>
            削除
          </MenuItem>,
        ]}
      </Menu>
    </List>
  );
};

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projectRef, projects, showCloud, onSelectCloud, onSelectLocal, onRemove, onCreateNew, onOpenFolder,
  sprints, sel, onSelect, onCreateSprint, onEditSprint, onRemoveSprint, onUnarchiveSprint, statusSlot,
  onCollapse,
}) => (
  <Box sx={{
    width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
    position: 'relative',
    borderRight: '1px solid', borderColor: 'divider', bgcolor: 'light-dark(rgba(0,0,0,0.02), rgba(255,255,255,0.02))',
    '&:hover .sidebar-collapse': { opacity: 1 },
  }}>
    {onCollapse && (
      <Tooltip title="サイドバーを畳む" arrow placement="right">
        <IconButton
          className="sidebar-collapse" size="small" onClick={onCollapse}
          sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, opacity: 0, p: 0.25,
                color: 'text.disabled', '&:hover': { color: 'text.primary' } }}
        >
          <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    )}
    <List dense sx={{ px: 1, pt: 1.5, flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {showCloud && (
        <>
          <ListItemButton selected={projectRef?.kind === 'cloud'} onClick={onSelectCloud} sx={itemSx}>
            <ListItemIcon sx={{ minWidth: 30 }}><CloudRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="SEKKEIYA" secondary="クラウド"
              primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
              secondaryTypographyProps={{ fontSize: 10 }} />
          </ListItemButton>
          {projectRef?.kind === 'cloud' && (
            <SprintSubList
              sprints={sprints} sel={sel} onSelect={onSelect} onCreateSprint={onCreateSprint}
              onEditSprint={onEditSprint} onRemoveSprint={onRemoveSprint} onUnarchiveSprint={onUnarchiveSprint}
            />
          )}
        </>
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
        const isSelected = projectRef?.kind === 'local' && projectRef.path === p;
        return (
          <React.Fragment key={p}>
            <ListItemButton selected={isSelected}
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
            {isSelected && (
              <SprintSubList
                sprints={sprints} sel={sel} onSelect={onSelect} onCreateSprint={onCreateSprint}
                onEditSprint={onEditSprint} onRemoveSprint={onRemoveSprint} onUnarchiveSprint={onUnarchiveSprint}
              />
            )}
          </React.Fragment>
        );
      })}
    </List>

    <Divider />
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      {statusSlot}
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
