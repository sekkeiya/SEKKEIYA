// @ts-nocheck
import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Divider,
} from '@mui/material';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useDscStore } from '../store/useDscStore';
import { WorkFileRepository } from '../../projects/workFileRepository';

// ─── Empty state ─────────────────────────────────────────────────────────────

function DscEmptyState() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.35)', mb: 2, fontSize: 12, lineHeight: 1.6 }}>
        アイテムをクリックすると<br />プロパティが表示されます。
      </Typography>
      <Box sx={{
        p: 2, bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 1.5,
        border: '1px dashed rgba(255,167,38,0.15)',
      }}>
        <Typography variant="caption" sx={{ color: '#ffa726', fontWeight: 600, display: 'block', mb: 0.5 }}>
          3DSC Workspace
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.5 }}>
          Generative parameters, style prompts, and mesh exports.
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Item info panel ──────────────────────────────────────────────────────────

function DscItemInfo({
  item,
  projectName,
  partsCount,
  onOpen,
  onDelete,
  onVisibilityChange,
  isDeleting,
  isUpdatingVisibility,
}) {
  const visibility = item.visibility || 'private';
  const isPublic = visibility === 'public';

  const updatedStr = item.updatedAt
    ? new Date(item.updatedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  const createdStr = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>

      {/* Thumbnail */}
      <Box sx={{
        height: 160, bgcolor: '#0d1117', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {item.thumbnailUrl ? (
          <Box
            component="img"
            src={item.thumbnailUrl}
            alt={item.name}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ViewInArIcon sx={{ fontSize: 52, color: 'rgba(255,167,38,0.12)' }} />
        )}
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Name */}
        <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>
          {item.name || '名称未設定'}
        </Typography>

        {/* Meta */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {projectName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderRoundedIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{projectName}</Typography>
            </Box>
          )}
          {partsCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ViewInArIcon sx={{ fontSize: 11, color: 'rgba(255,167,38,0.5)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{partsCount} パーツ</Typography>
            </Box>
          )}
          {(updatedStr || createdStr) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarTodayRoundedIcon sx={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {updatedStr ? `更新: ${updatedStr}` : `作成: ${createdStr}`}
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* ── 公開設定 ── */}
        <Box>
          <Typography sx={{
            fontSize: 10, fontWeight: 600, letterSpacing: 0.8,
            color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', mb: 1,
          }}>
            公開設定
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* 公開ボタン */}
            <Button
              size="small"
              fullWidth
              startIcon={<PublicRoundedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => !isPublic && onVisibilityChange('public')}
              disabled={isUpdatingVisibility}
              sx={isPublic ? {
                bgcolor: 'rgba(46,204,113,0.12)',
                color: '#2ecc71',
                border: '1px solid rgba(46,204,113,0.35)',
                fontWeight: 700, fontSize: 11,
                '&:hover': { bgcolor: 'rgba(46,204,113,0.2)' },
                cursor: 'default',
              } : {
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.35)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 11,
                '&:hover': { borderColor: 'rgba(46,204,113,0.35)', color: '#2ecc71', bgcolor: 'rgba(46,204,113,0.06)' },
              }}
            >
              公開
            </Button>
            {/* 非公開ボタン */}
            <Button
              size="small"
              fullWidth
              startIcon={<LockRoundedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => isPublic && onVisibilityChange('private')}
              disabled={isUpdatingVisibility}
              sx={!isPublic ? {
                bgcolor: 'rgba(255,167,38,0.12)',
                color: '#ffa726',
                border: '1px solid rgba(255,167,38,0.35)',
                fontWeight: 700, fontSize: 11,
                '&:hover': { bgcolor: 'rgba(255,167,38,0.2)' },
                cursor: 'default',
              } : {
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.35)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 11,
                '&:hover': { borderColor: 'rgba(255,167,38,0.35)', color: '#ffa726', bgcolor: 'rgba(255,167,38,0.06)' },
              }}
            >
              非公開
            </Button>
          </Box>
          {/* 現在の状態ラベル */}
          <Typography sx={{
            fontSize: 10, color: isPublic ? 'rgba(46,204,113,0.6)' : 'rgba(255,167,38,0.5)',
            mt: 0.75, textAlign: 'center',
          }}>
            {isUpdatingVisibility ? '更新中...' : isPublic ? '公開中 — Furniture で表示されます' : '非公開 — Private Furniture のみ'}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            size="small"
            startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            onClick={onOpen}
            sx={{
              bgcolor: '#ffa726', color: '#000', fontWeight: 700, fontSize: 12,
              '&:hover': { bgcolor: '#fb8c00' },
            }}
          >
            スタジオで開く
          </Button>
          <Button
            variant="outlined"
            fullWidth
            size="small"
            startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={onDelete}
            disabled={isDeleting}
            sx={{
              fontSize: 11,
              borderColor: 'rgba(255,77,79,0.3)',
              color: 'rgba(255,77,79,0.7)',
              '&:hover': { borderColor: '#ff4d4f', color: '#ff4d4f', bgcolor: 'rgba(255,77,79,0.05)' },
            }}
          >
            {isDeleting ? '削除中...' : '削除'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

// ─── DscRightPanel export ─────────────────────────────────────────────────────

export const DscRightPanel: React.FC = () => {
  const { panelSelections, setPanelSelection, projects, setActiveProjectId, setDscShellMode } = useAppStore();
  const item: any = panelSelections?.['create'] ?? null;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const projectName = useMemo(() => {
    if (!item?.projectId) return '';
    return projects.find(p => p.id === item.projectId)?.name || '';
  }, [projects, item?.projectId]);

  const partsCount = useMemo(() => {
    try { if (item?.componentsJson) return JSON.parse(item.componentsJson).length; } catch {}
    return 0;
  }, [item?.componentsJson]);

  const handleOpen = () => {
    if (!item) return;
    if (item.projectId) setActiveProjectId(item.projectId);
    useDscStore.getState().loadWorkFile(item);
    setDscShellMode('studio');
  };

  const handleDelete = async () => {
    if (!item || isDeleting) return;
    if (!item.projectId) return;
    try {
      setIsDeleting(true);
      await WorkFileRepository.deleteWorkFile(item.projectId, item.id);
      setPanelSelection('create', null);
      useDscStore.getState().incrementSavedCount();
    } catch (err) {
      console.error('[DSC] Delete from right panel failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVisibilityChange = async (newVisibility: 'public' | 'private') => {
    if (!item || !item.projectId || isUpdatingVisibility) return;
    // 楽観的更新: UI を即時反映
    const updated = { ...item, visibility: newVisibility };
    setPanelSelection('create', updated);
    setIsUpdatingVisibility(true);
    try {
      await WorkFileRepository.updateWorkFile(item.projectId, item.id, { visibility: newVisibility } as any);
      // ダッシュボード一覧も再フェッチ（Public Furniture / Private Furniture の切り替えに反映）
      useDscStore.getState().incrementSavedCount();
    } catch (err) {
      console.error('[DSC] Visibility update failed:', err);
      // エラー時はロールバック
      setPanelSelection('create', item);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  if (!item) return <DscEmptyState />;

  return (
    <DscItemInfo
      item={item}
      projectName={projectName}
      partsCount={partsCount}
      onOpen={handleOpen}
      onDelete={handleDelete}
      onVisibilityChange={handleVisibilityChange}
      isDeleting={isDeleting}
      isUpdatingVisibility={isUpdatingVisibility}
    />
  );
};
