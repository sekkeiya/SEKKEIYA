import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
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
import type { RhinoTemplate, TemplateSourceType, UploadStatus } from '../../features/projects/types';
import { RhinoTemplateRegistrationDialog } from './RhinoTemplateRegistrationDialog';
import { PreviewDialog } from './PreviewDialog';
import { TemplateRepository } from '../../features/projects/templateRepository';
import { useAuthStore } from '../../store/useAuthStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (template: RhinoTemplate) => void;
}

const RhinoTemplateDialog: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const { currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TemplateSourceType>('official');
  const [searchQuery, setSearchQuery] = useState('');
  const [toolFilter, setToolFilter] = useState<'all' | 'rhino' | 'blender'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RhinoTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegDialogOpen, setRegDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<RhinoTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<RhinoTemplate | null>(null);

  const isAdmin = currentUser?.email === 'sekkeiyanosagyoubeya@gmail.com' || currentUser?.email === '3dshapeshare@gmail.com';

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
        if (!file) throw new Error("File required for new template");
        await TemplateRepository.saveTemplate(newTmpl, file, currentUser.uid, onProgress, thumbnailFile, glbFile);
      }
      
      // Refresh templates
      setTimeout(() => {
        setRegDialogOpen(false);
        setEditTemplate(null);
        if (!editTemplate) setActiveTab('user'); // Go to user tab only if new create
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
        // Remove locally
        setTemplates(prev => prev.filter(t => t.id !== tmpl.id));
        if (selectedId === tmpl.id) setSelectedId(null);
      } catch (err) {
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
    return templates.filter(tmpl => {
      if (tmpl.sourceType !== activeTab) return false;
      if (toolFilter !== 'all' && tmpl.toolType !== toolFilter) return false;
      
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inName = tmpl.name.toLowerCase().includes(q);
      const inDesc = tmpl.description?.toLowerCase().includes(q) || false;
      const inTags = tmpl.tags?.some(t => t.toLowerCase().includes(q)) || false;
      const inAuthor = tmpl.ownerName?.toLowerCase().includes(q) || false;

      return inName || inDesc || inTags || inAuthor;
    });
  }, [templates, activeTab, searchQuery, toolFilter]);

  const handleConfirm = () => {
    const tmpl = templates.find(t => t.id === selectedId);
    if (tmpl) {
      onSelect(tmpl);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedId);
  const canOpen = selectedTemplate && !selectedTemplate.isMock;

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
          bgcolor: 'rgba(15, 20, 30, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4,
          color: '#fff',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          minHeight: '550px',
        }
      }}
    >
      <DialogTitle sx={{ m: 0, px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div" fontWeight={800}>
          Template Library
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button 
            variant="outlined" 
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => setRegDialogOpen(true)}
            sx={{ 
              color: '#90caf9', 
              borderColor: 'rgba(144, 202, 249, 0.5)', 
              borderRadius: 8,
              textTransform: 'none',
              '&:hover': { borderColor: '#90caf9', bgcolor: 'rgba(144,202,249,0.1)' }
            }}
          >
            テンプレートを登録
          </Button>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', px: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, v) => { setActiveTab(v); setSelectedId(null); }}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', minWidth: 100, color: 'rgba(255,255,255,0.5)', fontWeight: 600 },
            '& .Mui-selected': { color: '#90caf9 !important' },
            '& .MuiTabs-indicator': { backgroundColor: '#90caf9' }
          }}
        >
          <Tab value="official" label="公式" />
          <Tab value="user" label="マイテンプレート" />
          <Tab value="public" label="公開" />
        </Tabs>
      </Box>

      <Box sx={{ px: 3, pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          fullWidth
          placeholder="テンプレート名、タグ、作者名で検索..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
            sx: { 
              borderRadius: 8, 
              bgcolor: 'rgba(255,255,255,0.03)',
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&.Mui-focused fieldset': { borderColor: '#90caf9' }
            }
          }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          {['all', 'rhino', 'blender'].map(type => (
            <Chip 
              key={type}
              label={type === 'all' ? 'All' : type === 'rhino' ? 'Rhino' : 'Blender'}
              onClick={() => setToolFilter(type as any)}
              sx={{ 
                bgcolor: toolFilter === type ? 'rgba(144, 202, 249, 0.2)' : 'rgba(255,255,255,0.05)',
                color: toolFilter === type ? '#90caf9' : 'rgba(255,255,255,0.7)',
                border: '1px solid',
                borderColor: toolFilter === type ? '#90caf9' : 'transparent',
                fontWeight: 600,
                '&:hover': { bgcolor: toolFilter === type ? 'rgba(144, 202, 249, 0.3)' : 'rgba(255,255,255,0.1)' }
              }}
            />
          ))}
        </Box>
      </Box>

      <DialogContent sx={{ px: 3, pb: 2, pt: 2 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
            <CircularProgress sx={{ color: '#90caf9' }} />
          </Box>
        ) : filteredTemplates.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6, mt: 8 }}>
            <StraightenRoundedIcon sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="body1">
              {searchQuery ? '検索条件に一致するテンプレートが見つかりません。' : (
                activeTab === 'user' ? '登録されたマイテンプレートはありません。' : '現在利用可能なテンプレートはありません。'
              )}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
            {filteredTemplates.map(tmpl => {
              const isSelected = selectedId === tmpl.id;
              const canEdit = (tmpl.sourceType === 'official' && isAdmin) || (tmpl.ownerId === currentUser?.uid);
              return (
                <Paper
                  key={tmpl.id}
                  onClick={() => setSelectedId(tmpl.id)}
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: isSelected ? 'rgba(0, 191, 255, 0.1)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid',
                    borderColor: isSelected ? '#90caf9' : 'rgba(255,255,255,0.08)',
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      bgcolor: isSelected ? 'rgba(0, 191, 255, 0.15)' : 'rgba(255,255,255,0.06)'
                    },
                    '&:hover .template-actions': {
                      opacity: 1
                    }
                  }}
                >
                    <Box 
                      className="template-actions"
                      sx={{ 
                        position: 'absolute', 
                        top: 16, 
                        right: 16, 
                        display: 'flex', 
                        gap: 0.5, 
                        opacity: 0, 
                        transition: 'opacity 0.2s',
                        zIndex: 10,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        borderRadius: 2,
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      <Button 
                        size="small" 
                        onClick={(e) => handlePreview(tmpl, e)} 
                        startIcon={<VisibilityRoundedIcon sx={{ fontSize: '14px !important' }} />}
                        sx={{ 
                          color: '#fff', 
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          p: '2px 8px',
                          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' } 
                        }}
                      >
                        プレビュー
                      </Button>
                      {canEdit && (
                        <>
                          <IconButton size="small" onClick={(e) => openEdit(tmpl, e)} sx={{ color: '#90caf9', '&:hover': { bgcolor: 'rgba(144, 202, 249, 0.2)' } }}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={(e) => handleDelete(tmpl, e)} sx={{ color: '#f44336', '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.2)' } }}>
                            <DeleteRoundedIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  {tmpl.isMock && (
                    <Box sx={{ position: 'absolute', top: 12, right: -24, bgcolor: '#ff9800', transform: 'rotate(45deg)', width: 100, textAlign: 'center', py: 0.5, zIndex: 11 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#000', fontSize: '0.6rem' }}>未接続</Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ width: '100%', aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden', mb: 1.5, borderRadius: 2 }}>
                    {tmpl.thumbnailUrl ? (
                      <img src={tmpl.thumbnailUrl} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                        {tmpl.category === 'Architecture' ? <ArchitectureRoundedIcon sx={{ fontSize: 48 }} /> : <StraightenRoundedIcon sx={{ fontSize: 48 }} />}
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1, gap: 1.5, position: 'relative', zIndex: 2 }}>
                    <Box sx={{ flex: 1, minWidth: 0, pr: tmpl.isMock ? 3 : 0 }}>
                      <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tmpl.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {tmpl.sourceType === 'official' && (
                          <Chip label="Official" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }} />
                        )}
                        {tmpl.sourceType === 'public' && (
                          <Chip label="Public" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(0,191,255,0.2)', color: '#00bfff' }} />
                        )}
                        {tmpl.sourceType === 'user' && (
                          <Chip label="User" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(76,175,80,0.2)', color: '#81c784' }} />
                        )}
                        <Typography variant="body2" sx={{ color: tmpl.sourceType === 'public' ? '#90caf9' : 'rgba(255,255,255,0.6)', fontWeight: 600, ml: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                          {tmpl.sourceType === 'official' ? 'SEKKEIYA' : tmpl.ownerName}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', mb: 2, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 1 }}>
                    {tmpl.description}
                  </Typography>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    {tmpl.tags && tmpl.tags.slice(0, 3).map(tag => (
                      <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }} />
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', pt: 1.5 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', display: 'block' }}>
                        {tmpl.toolType === 'blender' ? 'Blender' : `Rhino ${tmpl.rhinoVersion || 8}`} {tmpl.unitSystem ? `• ${tmpl.unitSystem}` : ''}
                      </Typography>
                    </Box>
                    {tmpl.usageCount !== undefined && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}>
                        {tmpl.usageCount.toLocaleString()} uses
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
        <Box>
          {selectedId && selectedTemplate?.isMock && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#ff9800' }}>
               <InfoRoundedIcon fontSize="small" />
               <Typography variant="caption" fontWeight={600}>
                 このテンプレートはまだローカル実体に接続されていません
               </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            onClick={onClose} 
            sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontWeight: 600 }}
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedId || !canOpen}
            variant="contained"
            sx={{ 
              bgcolor: '#90caf9', 
              color: '#000', 
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
              px: 4,
              '&:hover': { bgcolor: '#64b5f6' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }
            }}
          >
            テンプレートで開く
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
    
    <RhinoTemplateRegistrationDialog 
      open={isRegDialogOpen}
      onClose={() => {
        setRegDialogOpen(false);
        setEditTemplate(null);
      }}
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
