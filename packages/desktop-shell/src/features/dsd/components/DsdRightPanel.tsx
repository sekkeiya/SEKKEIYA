import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, Button, Divider,
  Switch, TextField,
  CircularProgress,
} from '@mui/material';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useDsdStore } from '../store/useDsdStore';

const TEMPLATE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sun:    { label: '日照・日影',   icon: <WbSunnyRoundedIcon sx={{ fontSize: 14 }} />, color: 'light-dark(#5a822b, #aed581)' },
  site:   { label: '敷地・周辺',   icon: <PlaceRoundedIcon   sx={{ fontSize: 14 }} />, color: 'light-dark(#198694, #4dd0e1)' },
  layout: { label: 'ゾーニング',   icon: <RouteRoundedIcon   sx={{ fontSize: 14 }} />, color: 'light-dark(#ad6700, #ffb74d)' },
  env:    { label: '環境・風・音', icon: <AirRoundedIcon     sx={{ fontSize: 14 }} />, color: 'light-dark(#327b74, #80cbc4)' },
};

const FORMAT_META: Record<string, { label: string; icon: React.ReactNode }> = {
  image: { label: 'PNG画像', icon: <ImageRoundedIcon       sx={{ fontSize: 14 }} /> },
  video: { label: '動画',    icon: <VideocamRoundedIcon    sx={{ fontSize: 14 }} /> },
  pdf:   { label: 'PDF',    icon: <PictureAsPdfRoundedIcon sx={{ fontSize: 14 }} /> },
};

function formatDate(ts: any): string {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Label helper ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="caption" sx={{
    fontWeight: 600, fontSize: 10, color: 'text.secondary',
    display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5,
  }}>
    {children}
  </Typography>
);

// ─── Diagram-state right panel ────────────────────────────────────────────────
const DiagramStatePanel: React.FC<{ selectedItem: any }> = ({ selectedItem }) => {
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const activeProjectId   = useAppStore(s => s.activeProjectId);

  const [category, setCategory]     = useState<string>('');
  const [tags, setTags]             = useState<string[]>([]);
  const [tagInput, setTagInput]     = useState('');
  const [isPublic, setIsPublic]     = useState(false);
  const [isSaving, setIsSaving]     = useState(false);

  // Sync local state from selectedItem
  useEffect(() => {
    setCategory(selectedItem.category ?? '');
    setTags(selectedItem.tags ?? []);
    setIsPublic((selectedItem.visibility ?? 'private') === 'public');
    setTagInput('');
  }, [selectedItem.id]);

  const persistFields = useCallback(async (fields: Record<string, any>) => {
    if (!activeProjectId || !selectedItem.id) return;
    setIsSaving(true);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('../../../lib/firebase/client');
      await setDoc(
        doc(firestoreDb, `projects/${activeProjectId}/workFiles`, selectedItem.id),
        fields,
        { merge: true },
      );
      // Keep panelSelection in sync
      const wid = activeWorkspaceId ?? 'diagram';
      useAppStore.getState().setPanelSelection(wid, { ...selectedItem, ...fields });
    } catch (e) {
      console.error('[DsdRightPanel] persist failed', e);
    } finally {
      setIsSaving(false);
    }
  }, [activeProjectId, activeWorkspaceId, selectedItem]);

  const handleCategoryBlur = () => {
    persistFields({ category });
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || tags.includes(trimmed)) { setTagInput(''); return; }
    const next = [...tags, trimmed];
    setTags(next);
    setTagInput('');
    persistFields({ tags: next });
  };

  const handleRemoveTag = (tag: string) => {
    const next = tags.filter(t => t !== tag);
    setTags(next);
    persistFields({ tags: next });
  };

  const handleVisibilityChange = (checked: boolean) => {
    setIsPublic(checked);
    persistFields({ visibility: checked ? 'public' : 'private' });
  };

  const handleOpenInEditor = () => {
    const store = useDsdStore.getState();
    store.loadState({
      currentTemplate: selectedItem.currentTemplate,
      diagramTitle: selectedItem.diagramTitle,
      style: selectedItem.style,
      presetShape: selectedItem.presetShape,
      customPolygon: selectedItem.customPolygon ?? [],
      buildingWidth: selectedItem.buildingWidth,
      buildingDepth: selectedItem.buildingDepth,
      buildingHeight: selectedItem.buildingHeight,
      northAngle: selectedItem.northAngle,
      month: selectedItem.month,
      timeHour: selectedItem.timeHour,
      latitude: selectedItem.latitude,
      layoutMode: selectedItem.layoutMode,
      zones: selectedItem.zones ?? [],
      flows: selectedItem.flows ?? [],
      siteBoundaryW: selectedItem.siteBoundaryW,
      siteBoundaryH: selectedItem.siteBoundaryH,
      siteNorthAngle: selectedItem.siteNorthAngle,
      siteElements: selectedItem.siteElements ?? [],
      siteAccesses: selectedItem.siteAccesses ?? [],
      windDirection: selectedItem.windDirection,
      windSpeed: selectedItem.windSpeed,
      envLayer: selectedItem.envLayer,
      noiseSources: selectedItem.noiseSources ?? [],
      thermalSeason: selectedItem.thermalSeason,
      windViewCx: selectedItem.windViewCx,
      windViewCy: selectedItem.windViewCy,
      windViewW: selectedItem.windViewW,
      windViewH: selectedItem.windViewH,
      annotations: selectedItem.annotations ?? [],
    });
    if (selectedItem.currentTemplate) store.setCurrentTemplate(selectedItem.currentTemplate);
    useAppStore.getState().setActiveDiagramId(selectedItem.id);
    useAppStore.getState().setDsdShellMode('editor');
  };

  const handleDelete = async () => {
    if (!activeProjectId || !selectedItem.id) return;
    if (!window.confirm(`「${selectedItem.diagramTitle || 'このダイアグラム'}」を削除しますか？`)) return;
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('../../../lib/firebase/client');
      await deleteDoc(doc(firestoreDb, `projects/${activeProjectId}/workFiles`, selectedItem.id));
      // Clear activeDiagramId if it was the deleted one
      if (useAppStore.getState().activeDiagramId === selectedItem.id) {
        useAppStore.getState().setActiveDiagramId(null);
      }
      useAppStore.getState().setPanelSelection(activeWorkspaceId ?? 'diagram', null);
    } catch (e) {
      console.error('[DsdRightPanel] delete diagram failed', e);
    }
  };

  const template = selectedItem.currentTemplate ?? 'sun';
  const meta = TEMPLATE_META[template] ?? TEMPLATE_META.sun;
  const updatedAt = selectedItem.updatedAt ?? selectedItem.createdAt;
  const createdAt = selectedItem.createdAt;

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Template icon header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, mb: 2,
        p: 1.5, borderRadius: 1.5,
        bgcolor: `color-mix(in srgb, ${meta.color} 5%, transparent)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 20%, transparent)`,
      }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: `color-mix(in srgb, ${meta.color} 13%, transparent)`, color: meta.color,
        }}>
          {React.cloneElement(meta.icon as React.ReactElement, { sx: { fontSize: 20 } })}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedItem.diagramTitle || 'Untitled Diagram'}
          </Typography>
          <Chip
            label={meta.label}
            size="small"
            sx={{
              height: 18, fontSize: '0.62rem', fontWeight: 600, mt: 0.5,
              bgcolor: `color-mix(in srgb, ${meta.color} 13%, transparent)`, color: meta.color,
              border: `1px solid color-mix(in srgb, ${meta.color} 27%, transparent)`,
            }}
          />
        </Box>
        {isSaving && <CircularProgress size={14} sx={{ color: meta.color, flexShrink: 0 }} />}
      </Box>

      {/* Dates */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            最終更新
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
            {formatDate(updatedAt)}
          </Typography>
        </Box>
        {createdAt && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              作成日
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
              {formatDate(createdAt)}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />

      {/* Category */}
      <Box sx={{ mb: 2 }}>
        <SectionLabel>カテゴリ</SectionLabel>
        <TextField
          value={category}
          onChange={e => setCategory(e.target.value)}
          onBlur={handleCategoryBlur}
          onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
          placeholder="カテゴリを入力"
          size="small"
          fullWidth
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: 12, color: 'var(--brand-fg)',
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
              '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
              '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
              '&.Mui-focused fieldset': { borderColor: meta.color },
            },
            '& input::placeholder': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 12 },
          }}
        />
      </Box>

      {/* Tags */}
      <Box sx={{ mb: 2 }}>
        <SectionLabel>タグ</SectionLabel>
        {tags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
            {tags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={() => handleRemoveTag(tag)}
                deleteIcon={<CloseRoundedIcon sx={{ fontSize: '12px !important' }} />}
                sx={{
                  height: 22, fontSize: '0.7rem',
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)',
                  color: 'rgb(var(--brand-fg-rgb) / 0.75)',
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
                  '& .MuiChip-deleteIcon': { color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: '#ef5350' } },
                }}
              />
            ))}
          </Box>
        )}
        <TextField
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
          placeholder="タグを入力してEnter"
          size="small"
          fullWidth
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: 12, color: 'var(--brand-fg)',
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
              '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
              '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
              '&.Mui-focused fieldset': { borderColor: meta.color },
            },
            '& input::placeholder': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 12 },
          }}
        />
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />

      {/* Visibility */}
      <Box sx={{ mb: 2 }}>
        <SectionLabel>公開設定</SectionLabel>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1.5, py: 1,
          borderRadius: 1.5,
          bgcolor: isPublic ? 'rgba(174,213,129,0.07)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
          border: `1px solid ${isPublic ? 'rgba(174,213,129,0.25)' : 'rgb(var(--brand-fg-rgb) / 0.07)'}`,
          transition: 'all 0.2s',
        }}>
          <Typography sx={{ fontSize: 12, color: isPublic ? 'light-dark(#5a822b, #aed581)' : 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 600 }}>
            {isPublic ? '公開' : '非公開'}
          </Typography>
          <Switch
            checked={isPublic}
            onChange={e => handleVisibilityChange(e.target.checked)}
            size="small"
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: 'light-dark(#5a822b, #aed581)' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#aed58188' },
            }}
          />
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />

      {/* Actions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          fullWidth
          startIcon={<EditRoundedIcon />}
          onClick={handleOpenInEditor}
          sx={{
            bgcolor: `color-mix(in srgb, ${meta.color} 13%, transparent)`, color: meta.color,
            border: `1px solid color-mix(in srgb, ${meta.color} 27%, transparent)`,
            justifyContent: 'flex-start', fontSize: 12, fontWeight: 600,
            '&:hover': { bgcolor: `color-mix(in srgb, ${meta.color} 20%, transparent)` },
            boxShadow: 'none',
          }}
        >
          エディタで開く
        </Button>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={handleDelete}
          sx={{
            color: '#ef5350', borderColor: 'rgba(239,83,80,0.3)',
            justifyContent: 'flex-start', fontSize: 12,
            '&:hover': { bgcolor: 'rgba(239,83,80,0.08)', borderColor: '#ef5350' },
          }}
        >
          削除
        </Button>
      </Box>
    </Box>
  );
};

// ─── Export-item right panel ──────────────────────────────────────────────────
const ExportItemPanel: React.FC<{ selectedItem: any }> = ({ selectedItem }) => {
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const activeProjectId   = useAppStore(s => s.activeProjectId);

  const templateMeta = TEMPLATE_META[selectedItem.template] ?? TEMPLATE_META.sun;
  const formatMeta   = FORMAT_META[selectedItem.exportType]  ?? FORMAT_META.image;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = selectedItem.fileUrl;
    a.download = selectedItem.title || 'diagram';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleDelete = async () => {
    if (!activeProjectId || !selectedItem.id) return;
    if (!window.confirm(`「${selectedItem.title || 'このアイテム'}」を削除しますか？`)) return;
    try {
      const { deleteDsdExport } = await import('../library/dsdExportService');
      await deleteDsdExport(activeProjectId, selectedItem.id);
      useAppStore.getState().setPanelSelection(activeWorkspaceId || 'diagram', null);
    } catch (e) {
      console.error('[DsdRightPanel] Delete failed', e);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Thumbnail */}
      {selectedItem.thumbnailUrl && (
        <Box sx={{
          width: '100%', aspectRatio: '16/9',
          bgcolor: `color-mix(in srgb, ${templateMeta.color} 6%, transparent)`,
          borderRadius: 2, border: `1px solid color-mix(in srgb, ${templateMeta.color} 20%, transparent)`,
          overflow: 'hidden', mb: 2,
        }}>
          <Box component="img"
            src={selectedItem.thumbnailUrl}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
      )}

      {/* Title */}
      <SectionLabel>タイトル</SectionLabel>
      <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-fg)', lineHeight: 1.4, mb: 2 }}>
        {selectedItem.title || 'Untitled'}
      </Typography>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />

      {/* Meta */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            テンプレート
          </Typography>
          <Chip
            icon={templateMeta.icon as React.ReactElement}
            label={templateMeta.label}
            size="small"
            sx={{
              height: 22, fontSize: '0.68rem', fontWeight: 600,
              bgcolor: `color-mix(in srgb, ${templateMeta.color} 9%, transparent)`, color: templateMeta.color,
              border: `1px solid color-mix(in srgb, ${templateMeta.color} 27%, transparent)`,
              '& .MuiChip-icon': { color: templateMeta.color, ml: 0.5 },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            形式
          </Typography>
          <Chip
            icon={formatMeta.icon as React.ReactElement}
            label={formatMeta.label}
            size="small"
            sx={{
              height: 22, fontSize: '0.68rem',
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', color: 'rgb(var(--brand-fg-rgb) / 0.7)',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
              '& .MuiChip-icon': { color: 'rgb(var(--brand-fg-rgb) / 0.5)', ml: 0.5 },
            }}
          />
        </Box>
        {selectedItem.fileSize && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              サイズ
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
              {formatSize(selectedItem.fileSize)}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            作成日
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
            {formatDate(selectedItem.createdAt)}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />

      {/* Actions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          fullWidth
          startIcon={<DownloadRoundedIcon />}
          onClick={handleDownload}
          sx={{
            bgcolor: `color-mix(in srgb, ${templateMeta.color} 13%, transparent)`, color: templateMeta.color,
            border: `1px solid color-mix(in srgb, ${templateMeta.color} 27%, transparent)`,
            justifyContent: 'flex-start', fontSize: 12, fontWeight: 600,
            '&:hover': { bgcolor: `color-mix(in srgb, ${templateMeta.color} 20%, transparent)` },
            boxShadow: 'none',
          }}
        >
          ダウンロード
        </Button>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={handleDelete}
          sx={{
            color: '#ef5350', borderColor: 'rgba(239,83,80,0.3)',
            justifyContent: 'flex-start', fontSize: 12,
            '&:hover': { bgcolor: 'rgba(239,83,80,0.08)', borderColor: '#ef5350' },
          }}
        >
          削除
        </Button>
      </Box>
    </Box>
  );
};

// ─── Public export ────────────────────────────────────────────────────────────
export const DsdRightPanel: React.FC = () => {
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const selectedItem = useAppStore(s => activeWorkspaceId ? s.panelSelections[activeWorkspaceId] : null);

  if (!selectedItem) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          アイテムを選択するとプロパティが表示されます。
        </Typography>
        <Box sx={{ p: 2, bgcolor: 'rgba(174,213,129,0.05)', borderRadius: 1, border: '1px dashed rgba(174,213,129,0.2)' }}>
          <Typography variant="caption" sx={{ color: 'light-dark(#5a822b, #aed581)', display: 'block', mb: 0.5 }}>S.Diagram ライブラリ</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', lineHeight: 1.6 }}>
            カードをクリックするとプロパティが表示されます。ダブルクリックするとエディタが開きます。
          </Typography>
        </Box>
      </Box>
    );
  }

  if (selectedItem.type === 'diagram-state') {
    return <DiagramStatePanel selectedItem={selectedItem} />;
  }

  return <ExportItemPanel selectedItem={selectedItem} />;
};
