import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, CircularProgress, InputBase, IconButton, Tooltip } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';

import { WorkFileRepository } from '../../features/projects/workFileRepository';
import type { WorkFile, DesktopProject } from '../../features/projects/types';

const isCADFile = (file: WorkFile) => !file.appScope && !!file.toolType && file.toolType !== 'other';

interface AllCadFilesViewProps {
  projects: DesktopProject[];
  filterMode: 'cad' | 'other';
  accent: string;
  /** ファイルを選ぶと、そのファイルが属するプロジェクトのビューへ移動して選択する */
  onOpenFile: (projectId: string, fileId: string) => void;
}

type Row = WorkFile & { projectName: string };

/**
 * 全プロジェクト横断のファイル一覧（読み取り専用のブラウズ用）。
 * 編集・アップロード等は各プロジェクトの WorkFilesList 側で行うため、
 * ここではカードをクリックすると該当プロジェクトへ遷移する。
 */
export const AllCadFilesView: React.FC<AllCadFilesViewProps> = ({ projects, filterMode, accent, onOpenFile }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toolTypeFilter, setToolTypeFilter] = useState<'all' | 'rhino' | 'blender'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const projectKey = useMemo(() => projects.map(p => p.id).join(','), [projects]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      projects.map(p =>
        WorkFileRepository.getWorkFiles(p.id)
          .then(files => files.map(f => ({ ...f, projectName: p.name })))
          .catch(() => [] as Row[])
      )
    ).then(results => {
      if (cancelled) return;
      const all = results.flat()
        .filter(f => !f.isDeleted)
        .filter(f => (filterMode === 'cad' ? isCADFile(f) : !isCADFile(f)))
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      setRows(all);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectKey, filterMode]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rows
      .filter(f => toolTypeFilter === 'all' || f.toolType === toolTypeFilter)
      .filter(f => !q || f.name?.toLowerCase().includes(q) || f.projectName?.toLowerCase().includes(q));
  }, [rows, searchQuery, toolTypeFilter]);

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ja-JP');
  };

  const projectChip = (name: string) => (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 0.75, py: 0.125, borderRadius: 1,
      bgcolor: `${accent}1f`, color: accent,
      fontSize: '0.62rem', fontWeight: 700,
      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      <FolderOpenRoundedIcon sx={{ fontSize: 11 }} />
      {name}
    </Box>
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 1.5 }}>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-fg)' }}>
          ALL
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
          {filtered.length} ファイル / {projects.length} プロジェクト
        </Typography>
      </Box>

      {/* ツールバー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pb: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderRadius: 2, p: 0.4 }}>
          {(['all', 'rhino', 'blender'] as const).map(t => (
            <Box
              key={t}
              onClick={() => setToolTypeFilter(t)}
              sx={{
                px: 1.5, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: toolTypeFilter === t ? 700 : 500,
                color: toolTypeFilter === t ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.55)',
                bgcolor: toolTypeFilter === t ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                '&:hover': { color: 'var(--brand-fg)' },
              }}
            >
              {t === 'all' ? 'すべて' : t === 'rhino' ? 'Rhino' : 'Blender'}
            </Box>
          ))}
        </Box>

        <Box sx={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
          <InputBase
            placeholder="ファイル / プロジェクト名で検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            sx={{ color: 'var(--brand-fg)', fontSize: '0.8rem', flex: 1 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="グリッド表示">
            <IconButton size="small" onClick={() => setViewMode('grid')}
              sx={{ color: viewMode === 'grid' ? accent : 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              <ViewModuleRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="リスト表示">
            <IconButton size="small" onClick={() => setViewMode('list')}
              sx={{ color: viewMode === 'list' ? accent : 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              <ViewListRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 本体 */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, pb: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={22} sx={{ color: accent }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <InsertDriveFileRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.15)', mb: 1 }} />
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.85rem' }}>
              ファイルがありません
            </Typography>
          </Box>
        ) : viewMode === 'grid' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.5 }}>
            {filtered.map(f => (
              <Box
                key={`${f.projectId}/${f.id}`}
                onClick={() => onOpenFile(f.projectId, f.id)}
                sx={{
                  borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                  transition: 'border-color 0.15s, transform 0.15s',
                  '&:hover': { borderColor: accent, transform: 'translateY(-2px)' },
                }}
              >
                <Box sx={{
                  height: 104, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
                  backgroundImage: f.thumbnailUrl ? `url(${f.thumbnailUrl})` : 'none',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }}>
                  {!f.thumbnailUrl && (
                    <InsertDriveFileRoundedIcon sx={{ fontSize: 30, color: 'rgb(var(--brand-fg-rgb) / 0.2)' }} />
                  )}
                </Box>
                <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography sx={{
                    fontSize: '0.78rem', fontWeight: 600, color: 'var(--brand-fg)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.name}
                  </Typography>
                  {projectChip(f.projectName)}
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                    {f.toolType?.toUpperCase()}{f.latestVersionNumber ? ` · v${f.latestVersionNumber}` : ''} · {formatDate(f.updatedAt)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(f => (
              <Box
                key={`${f.projectId}/${f.id}`}
                onClick={() => onOpenFile(f.projectId, f.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
                  borderRadius: 1.5, cursor: 'pointer',
                  borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
                }}
              >
                <InsertDriveFileRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />
                <Typography sx={{
                  flex: 1, minWidth: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--brand-fg)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {f.name}
                </Typography>
                {projectChip(f.projectName)}
                <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', width: 70, textAlign: 'right' }}>
                  {f.toolType?.toUpperCase()}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', width: 90, textAlign: 'right' }}>
                  {formatDate(f.updatedAt)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
