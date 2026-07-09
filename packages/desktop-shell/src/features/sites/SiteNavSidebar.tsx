import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip, TextField } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';

import type { ProjectSite, SitePage, SiteSection } from '../projects/types';
import { SECTION_META } from './siteTemplates';
import type { EditorialTheme } from './editorialThemes';
import { useScrollSpyStore } from '../../store/useScrollSpyStore';

interface Props {
  site: ProjectSite;
  activePageId: string | null;
  activeSections: SiteSection[];
  mode: 'edit' | 'preview';
  theme: EditorialTheme;
  projectName: string;
  selectedSectionId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onRemovePage: (id: string) => void;
  onRenamePage: (id: string, title: string) => void;
  onTocClick: (sectionId: string) => void;
  /** true のとき現在ページのセクション目次を左サイドバーに表示しない（右サイドバーが担うとき）。 */
  hideSectionToc?: boolean;
  // プロジェクトサイトからアカウントサイト（ダッシュボード）へ戻る導線
  accountName?: string;
  onGoToAccount?: () => void;
  // アカウントサイト専用：My / Team プロジェクトのナビゲーション群
  accountGroups?: { my: { id: string; name: string }[]; team: { id: string; name: string }[] } | null;
  activeProjectsList?: 'my' | 'team' | null;
  onShowProjectsList?: (scope: 'my' | 'team') => void;
  onOpenProject?: (id: string) => void;
  onCreateProject?: (scope: 'my' | 'team') => void;
}

const sectionLabel = (s: SiteSection): string =>
  s.type === 'hero' ? 'トップ' : (s.title && s.title.trim()) || SECTION_META[s.type].label;

export const SiteNavSidebar: React.FC<Props> = ({
  site, activePageId, activeSections, mode, theme, projectName,
  selectedSectionId, onSelectPage, onAddPage, onRemovePage, onRenamePage, onTocClick,
  hideSectionToc,
  accountName, onGoToAccount,
  accountGroups, activeProjectsList, onShowProjectsList, onOpenProject, onCreateProject,
}) => {
  const isEdit = mode === 'edit';
  const activeSectionId = useScrollSpyStore(s => s.activeSectionId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const startRename = (id: string, current: string) => { setEditingId(id); setEditText(current); };
  const commitRename = () => {
    if (editingId && editText.trim()) onRenamePage(editingId, editText.trim());
    setEditingId(null);
  };

  const renderPage = (p: SitePage) => {
    const active = p.id === activePageId;
    return (
      <Box key={p.id}>
        <Box
          onClick={() => onSelectPage(p.id)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.7,
            cursor: 'pointer', borderRadius: 0,
            borderLeft: `2px solid ${active ? theme.accent : 'transparent'}`,
            transition: 'border-color 0.2s',
            '&:hover': { bgcolor: `${theme.text}06`, '& .page-actions': { opacity: 1 }, '& .page-title': { color: theme.text } },
          }}
        >
          {editingId === p.id ? (
            <TextField
              value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); }} onClick={(e) => e.stopPropagation()}
              autoFocus variant="standard" fullWidth
              InputProps={{ disableUnderline: true, sx: { fontSize: '0.83rem', fontWeight: 700, color: theme.text } }}
            />
          ) : (
            <Typography className="page-title" noWrap sx={{
              flex: 1, fontFamily: theme.headingFamily, fontSize: '0.83rem',
              fontWeight: active ? 800 : 500, color: active ? theme.text : theme.subtext,
              transition: 'color 0.2s', letterSpacing: active ? '0.01em' : 0,
            }}>
              {p.title}
            </Typography>
          )}
          {isEdit && editingId !== p.id && (
            <Box className="page-actions" sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.15s' }} onClick={(e) => e.stopPropagation()}>
              <Tooltip title="名前を変更">
                <IconButton size="small" onClick={() => startRename(p.id, p.title)} sx={{ color: theme.subtext, p: 0.25 }}><EditRoundedIcon sx={{ fontSize: '0.85rem' }} /></IconButton>
              </Tooltip>
              {site.pages.length > 1 && (
                <Tooltip title="ページを削除">
                  <IconButton size="small" onClick={() => onRemovePage(p.id)} sx={{ color: theme.subtext, p: 0.25, '&:hover': { color: '#e05a5a' } }}><CloseRoundedIcon sx={{ fontSize: '0.85rem' }} /></IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        {/* Section TOC — numbered items with thin indent bar */}
        {active && !hideSectionToc && activeSections.length > 0 && (
          <Box sx={{ borderLeft: `0.5px solid ${theme.border}`, ml: 3, mt: 0.5, mb: 1 }}>
            {activeSections.map((s, idx) => {
              const current = activeSectionId === s.id;
              const highlight = current || selectedSectionId === s.id;
              const num = String(idx + 1).padStart(2, '0');
              return (
                <Box
                  key={s.id}
                  onClick={(e) => { e.stopPropagation(); onTocClick(s.id); }}
                  sx={{
                    display: 'flex', alignItems: 'baseline', gap: 0.75, py: 0.35, px: 0.75,
                    cursor: 'pointer', borderLeft: `1.5px solid ${current ? theme.accent : 'transparent'}`, ml: '-0.5px',
                    '&:hover': { bgcolor: `${theme.text}06` },
                    transition: 'border-color 0.2s',
                  }}
                >
                  <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.52rem', fontWeight: 700, color: current ? theme.accent : `${theme.subtext}66`, flexShrink: 0 }}>{num}</Typography>
                  <Typography noWrap sx={{ fontFamily: theme.bodyFamily, fontSize: '0.72rem', color: highlight ? theme.accent : theme.subtext, fontWeight: highlight ? 700 : 400, transition: 'color 0.2s' }}>
                    {sectionLabel(s)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{
      width: 232, flexShrink: 0, height: '100%', overflowY: 'auto',
      bgcolor: theme.surface, borderRight: `0.5px solid ${theme.border}`,
      display: 'flex', flexDirection: 'column', py: 2.5,
      scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }}>
      {/* Brand area */}
      <Box sx={{ px: 2.5, mb: 2.5, pt: 0.5 }}>
        {onGoToAccount ? (
          // プロジェクトサイト：上部はアカウントサイト名＝ダッシュボードへ戻るブランドリンク
          <Box onClick={onGoToAccount} sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1.5, cursor: 'pointer',
            '&:hover': { '& .acct-label': { color: theme.accent } },
          }}>
            <ChevronLeftRoundedIcon sx={{ fontSize: '0.8rem', color: theme.subtext }} />
            <Typography className="acct-label" sx={{ fontFamily: theme.kickerFamily, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.subtext, transition: 'color 0.2s' }}>
              {accountName || 'マイサイト'}
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.subtext, mb: 0.5, opacity: 0.6 }}>
            {theme.label}
          </Typography>
        )}
        {/* Site name */}
        <Typography noWrap sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, fontSize: '1.1rem', color: theme.text, letterSpacing: theme.headingLetterSpacing }}>
          {projectName}
        </Typography>
        {/* Thin divider */}
        <Box sx={{ height: '0.5px', bgcolor: theme.border, mt: 1.5 }} />
      </Box>

      {/* ページ一覧 */}
      <Box sx={{ px: 1.25 }}>
        {site.pages.map(renderPage)}
      </Box>

      {/* アカウントサイト：My / Team プロジェクトのナビ群（見出しクリックで一覧表示） */}
      {accountGroups && (['my', 'team'] as const).map(scope => {
        const list = scope === 'my' ? accountGroups.my : accountGroups.team;
        const label = scope === 'my' ? 'MY PROJECTS' : 'TEAM PROJECTS';
        const hdrActive = activeProjectsList === scope;
        return (
          <Box key={scope} sx={{ px: 1.25, mt: 1.5 }}>
            <Box
              onClick={() => onShowProjectsList?.(scope)}
              sx={{ display: 'flex', alignItems: 'center', px: 1.25, py: 0.6, borderRadius: 1.5, cursor: 'pointer', bgcolor: hdrActive ? `${theme.accent}1f` : 'transparent', '&:hover': { bgcolor: hdrActive ? `${theme.accent}2a` : `${theme.text}0a`, '& .grp-add': { opacity: 1 } } }}
            >
              <Box sx={{ width: 3, height: 14, borderRadius: 2, bgcolor: hdrActive ? theme.accent : 'transparent', flexShrink: 0, mr: 0.75 }} />
              <Typography sx={{ flex: 1, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: hdrActive ? theme.accent : `${theme.subtext}88` }}>{label}</Typography>
              {onCreateProject && (
                <Tooltip title={scope === 'my' ? 'マイプロジェクトを作成' : 'チームプロジェクトを作成'}>
                  <IconButton size="small" className="grp-add" onClick={(e) => { e.stopPropagation(); onCreateProject(scope); }} sx={{ opacity: 0.5, transition: 'opacity 0.15s', color: theme.subtext, p: 0.25, '&:hover': { color: theme.accent } }}>
                    <AddRoundedIcon sx={{ fontSize: '0.95rem' }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {list.map(p => (
              <Box key={p.id} onClick={() => onOpenProject?.(p.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 2, px: 1.25, py: 0.45, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: `${theme.text}08`, '& .pname': { color: theme.text } } }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: theme.subtext, flexShrink: 0 }} />
                <Typography className="pname" noWrap sx={{ fontFamily: theme.bodyFamily, fontSize: '0.78rem', color: theme.subtext, transition: 'color 0.15s' }}>{p.name}</Typography>
              </Box>
            ))}
            {list.length === 0 && <Typography sx={{ ml: 2.5, fontSize: '0.7rem', color: theme.subtext, opacity: 0.55 }}>（なし）</Typography>}
          </Box>
        );
      })}

      {/* ページ追加（編集モード） */}
      {isEdit && (
        <Box
          onClick={onAddPage}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mx: 1.25, mt: 1, px: 1.25, py: 0.85, borderRadius: 1.5, cursor: 'pointer', color: theme.subtext, '&:hover': { bgcolor: `${theme.text}0a`, color: theme.text } }}
        >
          <AddRoundedIcon sx={{ fontSize: '1rem' }} />
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: theme.headingFamily }}>ページを追加</Typography>
        </Box>
      )}
    </Box>
  );
};
