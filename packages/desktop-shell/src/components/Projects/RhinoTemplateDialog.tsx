import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import ArchitectureRoundedIcon from '@mui/icons-material/ArchitectureRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import type { RhinoTemplate, TemplateSourceType, UploadStatus } from '../../features/projects/types';
import { RhinoTemplateRegistrationDialog } from './RhinoTemplateRegistrationDialog';
import { PreviewDialog } from './PreviewDialog';
import { TemplateThumbnail } from './TemplateThumbnail';
import { TemplateRepository } from '../../features/projects/templateRepository';
import { useAuthStore } from '../../store/useAuthStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (template: RhinoTemplate) => void;
}

const ACCENT = '#00BFFF';
const ACCENT_DIM = 'rgba(0,191,255,0.15)';
const ACCENT_GLOW = 'rgba(0,191,255,0.25)';

const CATEGORY_LABELS: Record<string, string> = {
  Architecture: '建築',
  Interior: 'インテリア',
  Furniture: '家具',
  Product: 'プロダクト',
  Urban: '都市計画',
  Detail: 'ディテール',
  Drawing: '図面',
  Residential: '住宅',
  Mesh: 'メッシュ',
  Default: '汎用',
};

const RhinoTemplateDialog: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const { currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TemplateSourceType>('official');
  const [searchQuery, setSearchQuery] = useState('');
  const [toolFilter, setToolFilter] = useState<'all' | 'rhino' | 'blender'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RhinoTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegDialogOpen, setRegDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<RhinoTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<RhinoTemplate | null>(null);

  const isAdmin = currentUser?.email === 'sekkeiyanosagyoubeya@gmail.com' || currentUser?.email === '3dshapeshare@gmail.com' || currentUser?.email === 's.sekkeiya@gmail.com';

  const handlePreview = (tmpl: RhinoTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewTemplate(tmpl);
  };

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      TemplateRepository.getTemplates(currentUser?.uid).then(data => {
        setTemplates(data);
        setIsLoading(false);
      });
    }
  }, [open, currentUser]);

  const handleRegister = async (newTmpl: RhinoTemplate, file: File | null, onProgress: (s: UploadStatus) => void, thumbnailFile?: File | null, glbFile?: File | null) => {
    if (!currentUser) return;
    try {
      if (editTemplate) {
        await TemplateRepository.updateTemplate(
          newTmpl.id,
          currentUser.uid,
          editTemplate.sourceType === 'official' || newTmpl.sourceType === 'official' ? 'official' : newTmpl.sourceType,
          newTmpl.isPublic,
          newTmpl,
          file,
          onProgress,
          thumbnailFile,
          glbFile
        );
      } else {
        await TemplateRepository.saveTemplate(newTmpl, file, currentUser.uid, onProgress, thumbnailFile, glbFile);
      }
      setTimeout(() => {
        setRegDialogOpen(false);
        setEditTemplate(null);
        if (!editTemplate) setActiveTab('user');
        setIsLoading(true);
        TemplateRepository.getTemplates(currentUser.uid).then(data => {
          setTemplates(data);
          const matched = data.find(t => t.id === newTmpl.id) || data.find(t => t.templatePath === newTmpl.templatePath);
          if (matched) setSelectedId(matched.id);
          setIsLoading(false);
        });
      }, 1500);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleDelete = async (tmpl: RhinoTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`テンプレート「${tmpl.name}」を削除しますか？`)) {
      if (!currentUser) return;
      try {
        await TemplateRepository.deleteTemplate(tmpl.id, tmpl.sourceType, currentUser.uid, tmpl.storagePath);
        setTemplates(prev => prev.filter(t => t.id !== tmpl.id));
        if (selectedId === tmpl.id) setSelectedId(null);
      } catch {
        alert('削除に失敗しました。');
      }
    }
  };

  const openEdit = (tmpl: RhinoTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTemplate(tmpl);
    setRegDialogOpen(true);
  };

  const filteredTemplates = useMemo(() => {
    const list = templates.filter(tmpl => {
      if (tmpl.sourceType !== activeTab) return false;
      if (toolFilter !== 'all' && tmpl.toolType !== toolFilter) return false;
      if (categoryFilter !== 'all' && (tmpl.category ?? '') !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        tmpl.name.toLowerCase().includes(q) ||
        (tmpl.description?.toLowerCase().includes(q) ?? false) ||
        (tmpl.tags?.some(t => t.toLowerCase().includes(q)) ?? false) ||
        (tmpl.ownerName?.toLowerCase().includes(q) ?? false)
      );
    });
    // 人気順（usageCount 降順）
    return list.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
  }, [templates, activeTab, searchQuery, toolFilter, categoryFilter]);

  // タブ切り替え時はカテゴリフィルターをリセット
  const handleTabChange = (_: React.SyntheticEvent, v: TemplateSourceType) => {
    setActiveTab(v);
    setSelectedId(null);
    setCategoryFilter('all');
  };

  /** 現在のタブ内に存在するカテゴリ一覧（ツールフィルター適用後） */
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    templates.forEach(t => {
      if (t.sourceType !== activeTab) return;
      if (toolFilter !== 'all' && t.toolType !== toolFilter) return;
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [templates, activeTab, toolFilter]);

  const handleConfirm = () => {
    const tmpl = templates.find(t => t.id === selectedId);
    if (tmpl) onSelect(tmpl);
  };

  const selectedTemplate = templates.find(t => t.id === selectedId);
  const selectedIsDraft = selectedTemplate ? (!selectedTemplate.templatePath || (selectedTemplate as any).isDraft === true) : false;
  const canOpen = selectedTemplate && !selectedTemplate.isMock && !selectedIsDraft;

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { official: 0, user: 0, public: 0 };
    templates.forEach(t => { if (counts[t.sourceType] !== undefined) counts[t.sourceType]++; });
    return counts;
  }, [templates]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(10, 13, 20, 0.98)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
            borderRadius: '16px',
            color: 'var(--brand-fg)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.7), 0 0 0 1px rgb(var(--brand-fg-rgb) / 0.04) inset',
            minHeight: '600px',
            maxHeight: '88vh',
            width: 'min(1400px, 95vw)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }
        }}
      >
        {/* ── Header ── */}
        <DialogTitle sx={{ m: 0, px: 3, pt: 2.5, pb: 0, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: `linear-gradient(135deg, ${ACCENT_DIM}, rgba(0,191,255,0.05))`,
                border: `1px solid ${ACCENT_DIM}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'rgb(var(--brand-fg-rgb) / 0.95)' }}>
                  Template Library
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.38)', fontWeight: 500 }}>
                  プロジェクトのベーステンプレートを選択
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddRoundedIcon sx={{ fontSize: '15px !important' }} />}
                onClick={() => setRegDialogOpen(true)}
                sx={{
                  color: ACCENT,
                  borderColor: 'rgba(0,191,255,0.35)',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  py: 0.6,
                  px: 1.5,
                  '&:hover': { borderColor: ACCENT, bgcolor: ACCENT_DIM }
                }}
              >
                登録
              </Button>
              <IconButton onClick={onClose} size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)' }, borderRadius: '8px' }}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ mt: 2.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                minHeight: 36,
                '& .MuiTabs-root': { minHeight: 36 },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  minWidth: 'unset',
                  px: 2,
                  py: 0.8,
                  minHeight: 36,
                  color: 'rgb(var(--brand-fg-rgb) / 0.4)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  letterSpacing: '0.01em',
                  transition: 'color 0.15s',
                },
                '& .Mui-selected': { color: 'rgb(var(--brand-fg-rgb) / 0.92) !important' },
                '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 2, borderRadius: '2px 2px 0 0' }
              }}
            >
              {[
                { value: 'official', label: '公式' },
                { value: 'user', label: 'マイテンプレート' },
                { value: 'public', label: '公開' },
              ].map(({ value, label }) => (
                <Tab
                  key={value}
                  value={value}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      {label}
                      {tabCounts[value] > 0 && (
                        <Box sx={{
                          px: 0.7, py: 0.1,
                          bgcolor: activeTab === value ? ACCENT_DIM : 'rgb(var(--brand-fg-rgb) / 0.07)',
                          color: activeTab === value ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.35)',
                          borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.6,
                          border: `1px solid ${activeTab === value ? 'rgba(0,191,255,0.3)' : 'transparent'}`,
                        }}>
                          {tabCounts[value]}
                        </Box>
                      )}
                    </Box>
                  }
                />
              ))}
            </Tabs>
          </Box>
        </DialogTitle>

        {/* ── Filters ── */}
        <Box sx={{ px: 3, pt: 2, pb: 0, display: 'flex', flexDirection: 'column', gap: 1.25, flexShrink: 0 }}>
          {/* Row 1: Search + tool filter */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              placeholder="テンプレート名、タグ、作者名で検索..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.28)', fontSize: 18 }} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '9px',
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
                  color: 'rgb(var(--brand-fg-rgb) / 0.85)',
                  fontSize: '0.83rem',
                  '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
                  '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
                  '&.Mui-focused fieldset': { borderColor: 'rgba(0,191,255,0.45)' },
                }
              }}
            />
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {(['all', 'rhino', 'blender'] as const).map(type => (
                <Box
                  key={type}
                  onClick={() => { setToolFilter(type); setCategoryFilter('all'); }}
                  sx={{
                    px: 1.5, py: 0.5, borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    bgcolor: toolFilter === type ? ACCENT_DIM : 'rgb(var(--brand-fg-rgb) / 0.04)',
                    color: toolFilter === type ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.5)',
                    border: `1px solid ${toolFilter === type ? 'rgba(0,191,255,0.4)' : 'rgb(var(--brand-fg-rgb) / 0.07)'}`,
                    '&:hover': {
                      bgcolor: toolFilter === type ? ACCENT_DIM : 'rgb(var(--brand-fg-rgb) / 0.07)',
                      borderColor: toolFilter === type ? 'rgba(0,191,255,0.6)' : 'rgb(var(--brand-fg-rgb) / 0.12)',
                    },
                    userSelect: 'none',
                  }}
                >
                  {type === 'all' ? 'すべて' : type === 'rhino' ? 'Rhino' : 'Blender'}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Row 2: Category filter (2つ以上あるときだけ表示) */}
          {availableCategories.length > 1 && (
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', pb: 1.25, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
              {[{ id: 'all', label: 'すべて' }, ...availableCategories.map(c => ({ id: c, label: CATEGORY_LABELS[c] ?? c }))].map(({ id, label }) => {
                const active = categoryFilter === id;
                return (
                  <Box
                    key={id}
                    onClick={() => setCategoryFilter(id)}
                    sx={{
                      px: 1.25, py: 0.3, borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
                      bgcolor: active ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                      color: active ? 'rgb(var(--brand-fg-rgb) / 0.9)' : 'rgb(var(--brand-fg-rgb) / 0.38)',
                      border: `1px solid ${active ? 'rgb(var(--brand-fg-rgb) / 0.2)' : 'transparent'}`,
                      '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.7)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
                    }}
                  >
                    {label}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* ── Body: Grid + Detail sidebar ── */}
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <DialogContent sx={{ px: 3, pt: 0, pb: 1.5, flex: 1, overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2 },
        }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <CircularProgress size={32} sx={{ color: ACCENT }} />
            </Box>
          ) : filteredTemplates.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 2 }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '14px',
                bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <StraightenRoundedIcon sx={{ fontSize: 26, color: 'rgb(var(--brand-fg-rgb) / 0.2)' }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontWeight: 600, fontSize: '0.88rem' }}>
                  {searchQuery ? '検索条件に一致するテンプレートがありません' : (
                    activeTab === 'user' ? 'マイテンプレートはまだありません' : 'テンプレートがありません'
                  )}
                </Typography>
                {activeTab === 'user' && !searchQuery && (
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.25)', fontSize: '0.76rem', mt: 0.5 }}>
                    「登録」ボタンから追加できます
                  </Typography>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 1.5 }}>
              {filteredTemplates.map(tmpl => {
                const isSelected = selectedId === tmpl.id;
                const isDraft = !tmpl.templatePath || (tmpl as any).isDraft === true;
                return (
                  <Box
                    key={tmpl.id}
                    onClick={() => setSelectedId(tmpl.id)}
                    sx={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      bgcolor: isSelected ? 'rgba(0,191,255,0.06)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
                      border: `1px solid ${isSelected ? 'rgba(0,191,255,0.5)' : 'rgb(var(--brand-fg-rgb) / 0.07)'}`,
                      boxShadow: isSelected ? `0 0 0 1px rgba(0,191,255,0.2), 0 4px 20px rgba(0,191,255,0.08)` : 'none',
                      position: 'relative',
                      '&:hover': {
                        bgcolor: isSelected ? 'rgba(0,191,255,0.08)' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                        borderColor: isSelected ? 'rgba(0,191,255,0.65)' : 'rgb(var(--brand-fg-rgb) / 0.14)',
                        transform: 'translateY(-2px)',
                        boxShadow: isSelected
                          ? `0 0 0 1px rgba(0,191,255,0.3), 0 8px 24px rgba(0,191,255,0.12)`
                          : '0 4px 16px rgba(0,0,0,0.3)',
                      },
                    }}
                  >
                    {/* Thumbnail */}
                    <Box sx={{ width: '100%', aspectRatio: '16/9', bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', position: 'relative', overflow: 'hidden' }}>
                      <TemplateThumbnail tmpl={tmpl} />

                      {/* Overlay badges */}
                      <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {tmpl.sourceType === 'official' && (
                          <Box sx={{ px: 0.8, py: 0.25, bgcolor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', borderRadius: '5px', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)' }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.75)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              Official
                            </Typography>
                          </Box>
                        )}
                        {tmpl.sourceType === 'public' && (
                          <Box sx={{ px: 0.8, py: 0.25, bgcolor: 'rgba(0,191,255,0.25)', backdropFilter: 'blur(8px)', borderRadius: '5px', border: '1px solid rgba(0,191,255,0.4)' }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              Public
                            </Typography>
                          </Box>
                        )}
                        {tmpl.isMock && (
                          <Box sx={{ px: 0.8, py: 0.25, bgcolor: 'rgba(255,152,0,0.25)', backdropFilter: 'blur(8px)', borderRadius: '5px', border: '1px solid rgba(255,152,0,0.4)' }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#ff9800', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              未接続
                            </Typography>
                          </Box>
                        )}
                        {isDraft && !tmpl.isMock && (
                          <Box sx={{ px: 0.8, py: 0.25, bgcolor: 'rgba(180,100,255,0.25)', backdropFilter: 'blur(8px)', borderRadius: '5px', border: '1px solid rgba(180,100,255,0.45)' }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'light-dark(#742e7f, #ce93d8)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              Draft
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {/* Selected checkmark */}
                      {isSelected && (
                        <Box sx={{
                          position: 'absolute', top: 8, right: 8,
                          width: 22, height: 22, borderRadius: '6px',
                          bgcolor: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: `0 0 8px ${ACCENT_GLOW}`,
                        }}>
                          <CheckRoundedIcon sx={{ fontSize: 13, color: '#000' }} />
                        </Box>
                      )}

                    </Box>

                    {/* Card body */}
                    <Box sx={{ p: 1.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.84rem', color: 'rgb(var(--brand-fg-rgb) / 0.9)', mb: 0.4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tmpl.name}
                      </Typography>
                      <Typography sx={{
                        fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 1,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', lineHeight: 1.5,
                      }}>
                        {tmpl.description || '説明なし'}
                      </Typography>

                      {/* Tags */}
                      {tmpl.tags && tmpl.tags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mb: 1 }}>
                          {tmpl.tags.slice(0, 3).map(tag => (
                            <Box key={tag} sx={{
                              px: 0.75, py: 0.2, borderRadius: '4px',
                              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                              fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontWeight: 500,
                            }}>
                              {tag}
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* Footer meta */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.75, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                        <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 500 }}>
                          {tmpl.toolType === 'blender' ? 'Blender' : `Rhino ${tmpl.rhinoVersion ?? 8}`}
                          {tmpl.unitSystem ? ` · ${tmpl.unitSystem}` : ''}
                        </Typography>
                        {tmpl.usageCount !== undefined && tmpl.usageCount > 0 && (
                          <Typography sx={{ fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.22)', fontWeight: 500 }}>
                            {tmpl.usageCount.toLocaleString()} uses
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>

        {/* ── Detail sidebar ── */}
        {selectedTemplate && (() => {
          const tmpl = selectedTemplate;
          const canEdit = (tmpl.sourceType === 'official' && isAdmin) || (tmpl.ownerId === currentUser?.uid);
          return (
            <Box sx={{
              width: 300, flexShrink: 0,
              borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
              bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2 },
            }}>
              {/* Sidebar header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5, pb: 1 }}>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
                  テンプレート詳細
                </Typography>
                <IconButton size="small" onClick={() => setSelectedId(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', p: 0.4, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)' } }}>
                  <CloseRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>

              {/* Thumbnail */}
              <Box sx={{ mx: 2, aspectRatio: '16/9', borderRadius: '10px', overflow: 'hidden', position: 'relative', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', flexShrink: 0 }}>
                <TemplateThumbnail tmpl={tmpl} />
              </Box>

              <Box sx={{ px: 2, pt: 1.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                {/* Name + badges */}
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'rgb(var(--brand-fg-rgb) / 0.95)', lineHeight: 1.3, mb: 0.6 }}>
                    {tmpl.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {tmpl.sourceType === 'official' && (
                      <Chip label="Official" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} />
                    )}
                    {tmpl.sourceType === 'public' && (
                      <Chip label="Public" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: ACCENT_DIM, color: ACCENT }} />
                    )}
                    {tmpl.sourceType === 'user' && (
                      <Chip label="My Template" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(76,175,80,0.15)', color: 'light-dark(#357838, #81c784)' }} />
                    )}
                    {tmpl.category && (
                      <Chip label={CATEGORY_LABELS[tmpl.category] ?? tmpl.category} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: 'transparent', color: 'rgb(var(--brand-fg-rgb) / 0.5)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)' }} />
                    )}
                  </Box>
                </Box>

                {/* Description */}
                <Typography sx={{ fontSize: '0.76rem', color: 'rgb(var(--brand-fg-rgb) / 0.6)', lineHeight: 1.65 }}>
                  {tmpl.description || '説明なし'}
                </Typography>

                {/* Recommended for */}
                {tmpl.recommendedFor && (
                  <Box sx={{ p: 1.25, borderRadius: '8px', bgcolor: ACCENT_DIM, border: '1px solid rgba(0,191,255,0.25)' }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.04em', mb: 0.3, textTransform: 'uppercase' }}>
                      こんな用途に
                    </Typography>
                    <Typography sx={{ fontSize: '0.74rem', color: 'rgb(var(--brand-fg-rgb) / 0.78)', lineHeight: 1.55 }}>
                      {tmpl.recommendedFor}
                    </Typography>
                  </Box>
                )}

                {/* Tags */}
                {tmpl.tags && tmpl.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {tmpl.tags.map(tag => (
                      <Box key={tag} sx={{
                        px: 0.8, py: 0.25, borderRadius: '4px',
                        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                        fontSize: '0.64rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 500,
                      }}>
                        {tag}
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Meta table */}
                <Box sx={{ borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', pt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                  {[
                    { label: 'ツール', value: tmpl.toolType === 'blender' ? 'Blender' : `Rhino ${tmpl.rhinoVersion ?? 8}` },
                    { label: '単位', value: tmpl.unitSystem ?? '—' },
                    { label: '作者', value: tmpl.sourceType === 'official' ? 'SEKKEIYA' : (tmpl.ownerName || '—') },
                    { label: '使用回数', value: tmpl.usageCount !== undefined ? `${tmpl.usageCount.toLocaleString()} 回` : '—' },
                    { label: 'ファイル', value: tmpl.isMock ? '未接続' : (tmpl.templatePath ? '接続済み' : '未添付') },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.32)', fontWeight: 600 }}>{label}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: label === 'ファイル' && (tmpl.isMock || !tmpl.templatePath) ? '#ff9800' : 'rgb(var(--brand-fg-rgb) / 0.72)', fontWeight: 600 }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Actions */}
                <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75, pt: 1 }}>
                  <Button
                    fullWidth
                    onClick={(e) => handlePreview(tmpl, e)}
                    startIcon={<VisibilityRoundedIcon sx={{ fontSize: '15px !important' }} />}
                    sx={{
                      color: 'rgb(var(--brand-fg-rgb) / 0.85)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)',
                      border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: '8px',
                      textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', py: 0.7,
                      '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)' },
                    }}
                  >
                    3D プレビュー
                  </Button>
                  {canEdit && (
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Button
                        fullWidth
                        onClick={(e) => openEdit(tmpl, e)}
                        startIcon={<EditRoundedIcon sx={{ fontSize: '14px !important' }} />}
                        sx={{
                          color: 'light-dark(#095fa5, #90caf9)', bgcolor: 'rgba(144,202,249,0.08)', border: '1px solid rgba(144,202,249,0.25)',
                          borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.74rem', py: 0.5,
                          '&:hover': { bgcolor: 'rgba(144,202,249,0.18)' },
                        }}
                      >
                        編集
                      </Button>
                      <Button
                        fullWidth
                        onClick={(e) => handleDelete(tmpl, e)}
                        startIcon={<DeleteRoundedIcon sx={{ fontSize: '14px !important' }} />}
                        sx={{
                          color: 'light-dark(#961818, #ef9a9a)', bgcolor: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.25)',
                          borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.74rem', py: 0.5,
                          '&:hover': { bgcolor: 'rgba(244,67,54,0.15)' },
                        }}
                      >
                        削除
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })()}
        </Box>

        {/* ── Footer ── */}
        <DialogActions sx={{
          px: 3, py: 2,
          borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
          bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <Box sx={{ minWidth: 0, flex: 1, mr: 2 }}>
            {selectedTemplate ? (
              selectedTemplate.isMock ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoRoundedIcon sx={{ fontSize: 15, color: '#ff9800', flexShrink: 0 }} />
                  <Typography sx={{ color: '#ff9800', fontSize: '0.75rem', fontWeight: 600 }}>
                    このテンプレートはまだローカル実体に接続されていません
                  </Typography>
                </Box>
              ) : selectedIsDraft ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ce93d8', flexShrink: 0 }} />
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: '0.75rem' }}>
                    <Box component="span" sx={{ color: 'light-dark(#742e7f, #ce93d8)', fontWeight: 600 }}>{selectedTemplate.name}</Box>
                    {' '}— ファイル未添付（編集で追加できます）
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckRoundedIcon sx={{ fontSize: 14, color: ACCENT, flexShrink: 0 }} />
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Box component="span" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.85)', fontWeight: 600 }}>{selectedTemplate.name}</Box>
                    {' '}を選択中
                  </Typography>
                </Box>
              )
            ) : (
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.22)', fontSize: '0.75rem' }}>
                テンプレートを選択してください
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
            <Button
              onClick={onClose}
              sx={{
                color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                borderRadius: '8px', px: 2,
                '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.8)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
              }}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedId || !canOpen}
              variant="contained"
              sx={{
                background: canOpen ? `linear-gradient(135deg, ${ACCENT}, #0099cc)` : undefined,
                bgcolor: !canOpen ? 'rgb(var(--brand-fg-rgb) / 0.07) !important' : undefined,
                color: canOpen ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.25) !important',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '9px',
                px: 2.5,
                py: 0.85,
                fontSize: '0.84rem',
                boxShadow: canOpen ? `0 4px 16px rgba(0,191,255,0.3)` : 'none',
                '&:hover': { background: canOpen ? `linear-gradient(135deg, #33d6ff, #0099cc)` : undefined, boxShadow: canOpen ? `0 6px 20px rgba(0,191,255,0.4)` : 'none' },
                '&.Mui-disabled': {},
              }}
            >
              テンプレートで開く
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <RhinoTemplateRegistrationDialog
        open={isRegDialogOpen}
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
    </>
  );
};

export default RhinoTemplateDialog;
