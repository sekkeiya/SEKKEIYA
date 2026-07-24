import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, TextField, InputAdornment, CircularProgress, Button,
  Snackbar, Alert, IconButton, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import type { RhinoTemplate, TemplateSourceType, UploadStatus } from '../../features/projects/types';
import { TemplateRepository } from '../../features/projects/templateRepository';
import { TemplateThumbnail } from './TemplateThumbnail';
import { InlineTemplatePreview } from './InlineTemplatePreview';
import { RhinoTemplateRegistrationDialog } from './RhinoTemplateRegistrationDialog';
import { PreviewDialog } from './PreviewDialog';
import { useAuthStore } from '../../store/useAuthStore';
import { createCadFromTemplateAndLaunch } from '../../features/projects/cadLaunch';
import { useWorkFileStore } from '../../store/useWorkFileStore';

const ACCENT = '#00BFFF';
const ACCENT_DIM = 'rgba(0,191,255,0.15)';

interface TemplatesPanelProps {
  /** 起動先の候補プロジェクト。複数なら上部で選択、単一なら固定。 */
  projects: { id: string; name: string }[];
  /** 外部（左サイドバーのツリー）から選択テンプレートを指定する */
  externalSelectedId?: string | null;
  /** パネル内で選択が変わったとき外部（ツリー）へ通知する */
  onSelectedIdChange?: (templateId: string | null) => void;
}

/**
 * CAD Files エクスプローラー左サイドバーの「テンプレート」項目から開く、
 * インラインのテンプレート一覧パネル。RhinoTemplateDialog の一覧表示をパネル化したもの。
 * テンプレートを選んで「このテンプレートで開く」で Rhino を起動し、CAD File を新規作成する。
 */
export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ projects, externalSelectedId, onSelectedIdChange }) => {
  const { currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TemplateSourceType>('official');
  const [searchQuery, setSearchQuery] = useState('');
  const [toolFilter, setToolFilter] = useState<'all' | 'rhino' | 'blender'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RhinoTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [regDialogOpen, setRegDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<RhinoTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<RhinoTemplate | null>(null);

  const isAdmin = currentUser?.email === 'sekkeiyanosagyoubeya@gmail.com' || currentUser?.email === '3dshapeshare@gmail.com' || currentUser?.email === 's.sekkeiya@gmail.com';

  const loadTemplates = () => {
    setIsLoading(true);
    TemplateRepository.getTemplates(currentUser?.uid).then(data => {
      setTemplates(data);
      setIsLoading(false);
    });
  };
  useEffect(() => { loadTemplates(); /* eslint-disable-next-line */ }, [currentUser]);

  // 外部（ツリー）からの選択指定。null なら選択解除（＝一覧に戻る）まで追従する。
  // prop 自体が未指定（undefined）のときは非制御として何もしない。
  useEffect(() => {
    if (externalSelectedId === undefined) return;
    setSelectedId(externalSelectedId);
    if (externalSelectedId) {
      const tmpl = templates.find(t => t.id === externalSelectedId);
      if (tmpl) setActiveTab(tmpl.sourceType); // 選択カードが見えるようタブも合わせる
    }
  }, [externalSelectedId, templates]);

  // パネル内の選択変更をツリーへ通知（初回マウント時は外部指定を潰さないよう通知しない）
  const selectionNotifyReadyRef = React.useRef(false);
  useEffect(() => {
    if (!selectionNotifyReadyRef.current) { selectionNotifyReadyRef.current = true; return; }
    onSelectedIdChange?.(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const filteredTemplates = useMemo(() => {
    return templates
      .filter(t => {
        if (t.sourceType !== activeTab) return false;
        if (toolFilter !== 'all' && t.toolType !== toolFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false) ||
          (t.tags?.some(tag => tag.toLowerCase().includes(q)) ?? false)
        );
      })
      .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
  }, [templates, activeTab, searchQuery, toolFilter]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { official: 0, user: 0, public: 0 };
    templates.forEach(t => { if (c[t.sourceType] !== undefined) c[t.sourceType]++; });
    return c;
  }, [templates]);

  const selectedTemplate = templates.find(t => t.id === selectedId) ?? null;
  const selectedIsDraft = selectedTemplate ? (!selectedTemplate.templatePath || (selectedTemplate as any).isDraft === true) : false;
  const canOpen = !!selectedTemplate && !selectedTemplate.isMock && !selectedIsDraft && projects.length > 0;
  /** ローカル保存テンプレート（templatePath が Windows 絶対パス） */
  const selectedIsLocal = !!selectedTemplate?.templatePath?.match(/^[a-zA-Z]:\\/);
  const selectedCanEdit = !!selectedTemplate &&
    ((selectedTemplate.sourceType === 'official' && isAdmin) || selectedTemplate.ownerId === currentUser?.uid);

  /** 起動先プロジェクトが確定した後の実際の起動処理 */
  const handleLaunchWith = async (project: { id: string; name: string }) => {
    if (!selectedTemplate || !currentUser?.uid) return;
    setProjectPickerOpen(false);
    setLaunching(true);
    setToast('Rhino を起動中...');
    try {
      await createCadFromTemplateAndLaunch(project, currentUser.uid, selectedTemplate);
      useWorkFileStore.getState().notifyUpdate();
      setToast(`${project.name} に新しい CAD File を作成しました`);
    } catch (e: any) {
      setToast(`起動エラー: ${e?.message || e}`);
    } finally {
      setLaunching(false);
    }
  };

  /** 「このテンプレートで開く」: 単一プロジェクトなら即起動、複数ならダイアログで選択 */
  const handleOpenClick = () => {
    if (!canOpen || launching) return;
    if (projects.length === 1) {
      handleLaunchWith(projects[0]);
    } else {
      setProjectPickerOpen(true);
    }
  };

  const handleRegister = async (newTmpl: RhinoTemplate, file: File | null, onProgress: (s: UploadStatus) => void, thumbnailFile?: File | null, glbFile?: File | null) => {
    if (!currentUser) return;
    if (editTemplate) {
      await TemplateRepository.updateTemplate(
        newTmpl.id, currentUser.uid,
        editTemplate.sourceType === 'official' || newTmpl.sourceType === 'official' ? 'official' : newTmpl.sourceType,
        newTmpl.isPublic, newTmpl, file, onProgress, thumbnailFile, glbFile,
      );
    } else {
      await TemplateRepository.saveTemplate(newTmpl, file, currentUser.uid, onProgress, thumbnailFile, glbFile);
    }
    // CAD 新規作成の場合はダイアログ内に完了表示を出さないため、トーストで結果を伝える
    setToast(editTemplate ? `「${newTmpl.name}」を更新しました` : `「${newTmpl.name}」を登録しました`);
    setTimeout(() => {
      setRegDialogOpen(false);
      setEditTemplate(null);
      if (!editTemplate) setActiveTab('user');
      loadTemplates();
    }, 1500);
  };

  const handleDelete = async (tmpl: RhinoTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    if (!window.confirm(`テンプレート「${tmpl.name}」を削除しますか？`)) return;
    try {
      await TemplateRepository.deleteTemplate(tmpl.id, tmpl.sourceType, currentUser.uid, tmpl.storagePath);
      setTemplates(prev => prev.filter(t => t.id !== tmpl.id));
      if (selectedId === tmpl.id) setSelectedId(null);
    } catch { setToast('削除に失敗しました'); }
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Header / filters ── */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.75, pb: 1.25, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <StraightenRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--brand-fg)' }}>Template Library</Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small" startIcon={<AddRoundedIcon sx={{ fontSize: '15px !important' }} />}
            onClick={() => { setEditTemplate(null); setRegDialogOpen(true); }}
            sx={{ color: ACCENT, border: '1px solid rgba(0,191,255,0.35)', borderRadius: 1.5, textTransform: 'none', fontWeight: 600, fontSize: '0.76rem', py: 0.4, px: 1.25, '&:hover': { bgcolor: ACCENT_DIM } }}
          >
            テンプレートを登録
          </Button>
        </Box>

        {/* Tabs + search + tool filter */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.09)' }}>
            {([['official', '公式'], ['user', 'マイ'], ['public', '公開']] as [TemplateSourceType, string][]).map(([val, label]) => (
              <Button key={val} size="small" onClick={() => { setActiveTab(val); setSelectedId(null); }}
                sx={{ textTransform: 'none', fontWeight: activeTab === val ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color: activeTab === val ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: activeTab === val ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'var(--brand-fg)' } }}>
                {label}{tabCounts[val] > 0 ? ` (${tabCounts[val]})` : ''}
              </Button>
            ))}
          </Box>
          <TextField
            placeholder="テンプレート検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 160 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.28)', fontSize: 18 }} /></InputAdornment>,
              sx: { borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', color: 'rgb(var(--brand-fg-rgb) / 0.85)', fontSize: '0.8rem',
                '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' } },
            }}
          />
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.09)' }}>
            {(['all', 'rhino', 'blender'] as const).map(t => (
              <Button key={t} size="small" onClick={() => setToolFilter(t)}
                sx={{ textTransform: 'none', fontWeight: toolFilter === t ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color: toolFilter === t ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: toolFilter === t ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'var(--brand-fg)' } }}>
                {t === 'all' ? 'すべて' : t === 'rhino' ? 'Rhino' : 'Blender'}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── 選択中はメインエリアを3Dビューワーに切り替える（CAD Files と同じ挙動） ── */}
      {selectedTemplate ? (
        <Box sx={{
          flex: 1, minHeight: 0, mx: { xs: 2, md: 3 }, my: 2,
          borderRadius: 2, overflow: 'hidden', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        }}>
          <InlineTemplatePreview
            key={selectedTemplate.id}
            templatePath={selectedTemplate.templatePath}
            templateId={selectedTemplate.id}
            fileName={selectedTemplate.name}
            toolType={selectedTemplate.toolType}
          />
        </Box>
      ) : (
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 240 }}>
            <CircularProgress size={30} sx={{ color: ACCENT }} />
          </Box>
        ) : filteredTemplates.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 1.5 }}>
            <StraightenRoundedIcon sx={{ fontSize: 32, color: 'rgb(var(--brand-fg-rgb) / 0.2)' }} />
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: '0.85rem' }}>
              {searchQuery ? '一致するテンプレートがありません' : 'テンプレートがありません'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
            {filteredTemplates.map(tmpl => {
              const isSelected = selectedId === tmpl.id;
              const isDraft = !tmpl.templatePath || (tmpl as any).isDraft === true;
              const canEdit = (tmpl.sourceType === 'official' && isAdmin) || (tmpl.ownerId === currentUser?.uid);
              return (
                <Box key={tmpl.id} onClick={() => setSelectedId(tmpl.id)} onDoubleClick={handleOpenClick}
                  sx={{
                    borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.18s ease', position: 'relative',
                    bgcolor: isSelected ? 'rgba(0,191,255,0.06)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
                    border: `1px solid ${isSelected ? 'rgba(0,191,255,0.5)' : 'rgb(var(--brand-fg-rgb) / 0.07)'}`,
                    '&:hover': { borderColor: isSelected ? 'rgba(0,191,255,0.65)' : 'rgb(var(--brand-fg-rgb) / 0.14)', transform: 'translateY(-2px)' },
                  }}>
                  <Box sx={{ width: '100%', aspectRatio: '16/9', bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', position: 'relative', overflow: 'hidden' }}>
                    <TemplateThumbnail tmpl={tmpl} />
                    {isSelected && (
                      <Box sx={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '6px', bgcolor: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckRoundedIcon sx={{ fontSize: 13, color: '#000' }} />
                      </Box>
                    )}
                    {(tmpl.isMock || isDraft) && (
                      <Box sx={{ position: 'absolute', top: 8, left: 8, px: 0.8, py: 0.25, bgcolor: 'rgba(255,152,0,0.25)', backdropFilter: 'blur(8px)', borderRadius: '5px', border: '1px solid rgba(255,152,0,0.4)' }}>
                        <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#ff9800', textTransform: 'uppercase' }}>{tmpl.isMock ? '未接続' : 'Draft'}</Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ p: 1.25 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'rgb(var(--brand-fg-rgb) / 0.9)', mb: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.name}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.42)', mb: 0.75, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45, minHeight: '2em' }}>
                      {tmpl.description || '説明なし'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.63rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
                        {tmpl.toolType === 'blender' ? 'Blender' : `Rhino ${tmpl.rhinoVersion ?? 8}`}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.25 }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setPreviewTemplate(tmpl); }} sx={{ p: 0.3, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
                          <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        {canEdit && (
                          <>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditTemplate(tmpl); setRegDialogOpen(true); }} sx={{ p: 0.3, color: 'light-dark(rgba(9,95,165,0.7), rgba(144,202,249,0.7))', '&:hover': { color: 'light-dark(#095fa5, #90caf9)' } }}>
                              <EditRoundedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <IconButton size="small" onClick={(e) => handleDelete(tmpl, e)} sx={{ p: 0.3, color: 'light-dark(rgba(150,24,24,0.7), rgba(239,154,154,0.7))', '&:hover': { color: 'light-dark(#961818, #ef9a9a)' } }}>
                              <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      )}

      {/* ── Footer action bar（未選択時のみ。選択中は右の詳細パネルに操作を集約） ── */}
      {!selectedTemplate && (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 1.25, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'rgb(var(--brand-fg-rgb) / 0.25)' }}>テンプレートを選択してください</Typography>
        </Box>
      )}
      </Box>

      {/* ── 右: テンプレート詳細パネル（CAD Files のファイル詳細と同じ構成） ── */}
      {selectedTemplate && (
        <Box sx={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'var(--brand-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ACCENT, flexShrink: 0 }} />
            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-fg)', flex: 1 }}>テンプレート詳細</Typography>
            {selectedCanEdit && (
              <>
                <Tooltip title="編集">
                  <IconButton onClick={() => { setEditTemplate(selectedTemplate); setRegDialogOpen(true); }} size="small" sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: 'var(--brand-fg)' } }}>
                    <EditRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="このテンプレートを削除">
                  <IconButton onClick={(e) => handleDelete(selectedTemplate, e)} size="small" sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: 'light-dark(#961818, #ef9a9a)' } }}>
                    <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <IconButton onClick={() => setSelectedId(null)} size="small" sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Scrollable content */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.3 }}>テンプレート名</Typography>
              <Box sx={{ px: 1.25, py: 0.875, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-fg)', wordBreak: 'break-all', lineHeight: 1.4 }}>{selectedTemplate.name}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.3 }}>ソフトウェア</Typography>
                <Box sx={{ px: 1.25, py: 0.75, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 1.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
                    {selectedTemplate.toolType === 'blender' ? 'Blender' : `Rhino ${selectedTemplate.rhinoVersion ?? 8}`}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.3 }}>単位</Typography>
                <Box sx={{ px: 1.25, py: 0.75, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 1.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>{selectedTemplate.unitSystem ?? '—'}</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.3 }}>区分</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                <Chip size="small" label={selectedTemplate.sourceType === 'official' ? '公式' : selectedTemplate.sourceType === 'public' ? '公開' : 'マイ'}
                  sx={{ bgcolor: ACCENT_DIM, color: ACCENT, fontWeight: 700 }} />
                <Chip size="small" label={selectedTemplate.category || 'Default'}
                  sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
                {selectedIsLocal && (
                  <Chip size="small" label="ローカル（このPCのみ）" sx={{ bgcolor: 'rgba(255,152,0,0.15)', color: '#ff9800', fontWeight: 700 }} />
                )}
                {selectedIsDraft && (
                  <Chip size="small" label="Draft（ファイル未設定）" sx={{ bgcolor: 'rgba(255,152,0,0.15)', color: '#ff9800', fontWeight: 700 }} />
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.3 }}>説明</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)', lineHeight: 1.7 }}>
                {selectedTemplate.description || '説明なし'}
              </Typography>
            </Box>

            {(selectedTemplate.tags?.length ?? 0) > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.3 }}>タグ</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selectedTemplate.tags!.map(tag => (
                    <Chip key={tag} size="small" label={tag} sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
                  ))}
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.3 }}>保存場所</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                {selectedTemplate.templatePath || '未設定'}
              </Typography>
            </Box>
          </Box>

          {/* Footer */}
          <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            {!canOpen && (
              <Typography sx={{ fontSize: '0.68rem', color: '#ff9800' }}>
                このテンプレートは開けません（ファイル未設定）
              </Typography>
            )}
            <Button
              onClick={handleOpenClick}
              disabled={!canOpen || launching}
              variant="contained"
              fullWidth
              startIcon={launching ? <CircularProgress size={14} sx={{ color: '#000' }} /> : undefined}
              sx={{
                background: canOpen ? `linear-gradient(135deg, ${ACCENT}, #0099cc)` : undefined,
                bgcolor: !canOpen ? 'rgb(var(--brand-fg-rgb) / 0.07) !important' : undefined,
                color: canOpen ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.25) !important',
                fontWeight: 700, textTransform: 'none', borderRadius: 1.5, py: 0.8, fontSize: '0.82rem',
              }}
            >
              このテンプレートで開く
            </Button>
          </Box>
        </Box>
      )}

      <RhinoTemplateRegistrationDialog
        open={regDialogOpen}
        onClose={() => { setRegDialogOpen(false); setEditTemplate(null); }}
        onRegister={handleRegister}
        initialData={editTemplate}
      />
      <PreviewDialog
        open={previewTemplate !== null}
        onClose={() => setPreviewTemplate(null)}
        fileName={previewTemplate?.name || ''}
        toolType={previewTemplate?.toolType === 'blender' ? 'Blender' : `Rhino ${previewTemplate?.rhinoVersion || 8}`}
        templatePath={previewTemplate?.templatePath}
        templateId={previewTemplate?.id || 'temp-preview'}
      />
      {/* ── 起動先プロジェクト選択ダイアログ ── */}
      <Dialog open={projectPickerOpen} onClose={() => setProjectPickerOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', borderRadius: 3, minWidth: 380, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>どのプロジェクトで開きますか？</DialogTitle>
        <DialogContent sx={{ pt: '4px !important' }}>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)', mb: 1.5 }}>
            テンプレート「{selectedTemplate?.name}」から新しい CAD File を作成します。
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 320, overflowY: 'auto' }}>
            {projects.map(p => (
              <Box key={p.id} onClick={() => handleLaunchWith(p)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.1, borderRadius: 2, cursor: 'pointer',
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                  '&:hover': { bgcolor: ACCENT_DIM, borderColor: 'rgba(0,191,255,0.45)' },
                }}>
                <FolderRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setProjectPickerOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontWeight: 600 }}>キャンセル</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setToast(null)} sx={{ width: '100%' }}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
};
