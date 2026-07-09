import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, Paper, IconButton, InputBase, Chip, Select, MenuItem, Button, Popover, Checkbox, FormControlLabel, FormGroup, Snackbar, Alert } from "@mui/material";
import CheckSquare from '@mui/icons-material/CheckBoxOutlineBlank';
import Brush from '@mui/icons-material/Brush';
import ImageIcon from '@mui/icons-material/Image';
import Pin from '@mui/icons-material/PushPin';
import MoreVertical from '@mui/icons-material/MoreVert';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MemoryIcon from '@mui/icons-material/Memory';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';

import { useJournalAiStore } from '../../store/useJournalAiStore';
import { useJournalStore } from '../../store/useJournalStore';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAiProfileStore } from '../../store/useAiProfileStore';
import { ExpandedJournalCard } from './ExpandedJournalCard';
import { JournalRepository } from '../../features/projects/repositories/JournalRepository';
import { motion, AnimatePresence } from 'framer-motion';
import type { JournalEntry } from '../../features/projects/types';

export type ProjectActivityType = 
  | "workfile_updated" 
  | "requirement_updated" 
  | "asset_uploaded" 
  | "ai_generated" 
  | "note";

export interface ProjectActivity {
  id: string;
  type: ProjectActivityType;
  title: string;
  description: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  timestamp: string;
  metadata?: any;
}

export interface ProjectActivityFeedProps {
  loading?: boolean;
}

export const ProjectActivityFeed: React.FC<ProjectActivityFeedProps> = ({ 
  loading = false, 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { contextLevel, setContextLevel, watchedScopes, toggleWatchedScope } = useJournalAiStore();
  const { entries, submitEntry, updateEntry, deleteEntry, subscribeToProjectJournals, unsubscribeFromProjectJournals, isSubmitting, selectedEntryId, setSelectedEntryId } = useJournalStore();
  const activeProfile = useAiProfileStore(s => s.aiProfiles.find(p => p.status === 'Active'));
  const activeWorkspace = useAppStore(s => s.getActiveWorkspace());
  const activeProject = useAppStore(s => s.getActiveProject());
  const { currentUser } = useAuthStore();
  
  const [customAnchorEl, setCustomAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [inputText, setInputText] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [errorToast, setErrorToast] = useState("");
  
  const selectedEntry = entries.find(e => e.id === selectedEntryId) || null;
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeProject?.id) {
      subscribeToProjectJournals(activeProject.id);
    }
    return () => {
      unsubscribeFromProjectJournals();
    };
  }, [activeProject?.id, subscribeToProjectJournals, unsubscribeFromProjectJournals]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!inputText.trim() || isSubmitting) return;

    try {
      await submitEntry(inputText.trim(), inputTitle.trim() || undefined, {
        contextLevel,
        watchedScopes,
        activeProfileId: activeProfile?.id,
        activeProfileName: activeProfile?.name,
        workspaceId: activeWorkspace?.workspaceId || null,
        workspaceName: activeWorkspace?.name || null
      });
      setInputText("");
      setInputTitle("");
    } catch (err) {
      setErrorToast("保存に失敗しました。再試行してください。");
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!activeProject?.id || !file.type.startsWith('image/')) return;
    
    setIsUploading(true);
    try {
      const downloadUrl = await JournalRepository.uploadAttachment(activeProject.id, file);
      const markdownImage = `![${file.name}](${downloadUrl})`;
      setInputText(prev => prev ? `${prev}\n${markdownImage}\n` : `${markdownImage}\n`);
    } catch (err) {
      setErrorToast("画像のアップロードに失敗しました。");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) handleImageUpload(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>Loading notes...</Typography>
      </Box>
    );
  }

  const handleEditEntry = async (id: string, content: string, title?: string) => {
    try {
      await updateEntry(id, content, title);
    } catch (e) {
      setErrorToast("更新に失敗しました。");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteEntry(id);
    } catch (e) {
      setErrorToast("削除に失敗しました。");
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 } }}>
      
      {/* Journal Composer Area */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6, mt: 2 }}>
        <Box sx={{ width: '100%', maxWidth: 650, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Paper 
            elevation={isFocused ? 4 : 1}
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              p: '8px 16px',
              bgcolor: '#202124', 
              border: '1px solid',
              borderColor: isFocused ? '#8ab4f8' : '#5f6368',
              borderRadius: 3,
              boxShadow: isFocused ? '0 1px 2px 0 rgba(0,0,0,0.6), 0 2px 6px 2px rgba(0,0,0,0.3)' : '0 1px 2px 0 rgba(0,0,0,0.6)'
            }}
          >
            {(isFocused || inputText.length > 0) && (
              <InputBase
                sx={{ width: '100%', color: '#e8eaed', py: 0.5, fontSize: 16, fontWeight: 600, mb: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="Title (Optional)"
                value={inputTitle}
                onChange={e => setInputTitle(e.target.value)}
              />
            )}
            <InputBase
              multiline
              minRows={isFocused || inputText.length > 0 ? 3 : 1}
              maxRows={10}
              sx={{ flex: 1, color: '#e8eaed', py: 1, fontSize: 15 }}
              placeholder="今日の検討内容や議事録を書く... (Shift+Enterで保存)"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            />
            
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              mt: 1, 
              borderTop: isFocused ? '1px solid rgba(255,255,255,0.1)' : 'none', 
              pt: isFocused ? 1 : 0, 
              opacity: isFocused ? 1 : 0.7,
              transition: 'all 0.2s' 
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box 
                  sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(138, 180, 248, 0.1)', color: '#8ab4f8', px: 1, py: 0.5, borderRadius: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(138, 180, 248, 0.15)' } }} 
                  onMouseDown={(e) => { e.preventDefault(); setCustomAnchorEl(e.currentTarget); }}
                >
                  <MemoryIcon sx={{ fontSize: 14, mr: 0.5 }} />
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                    AI Context: {contextLevel === 'off' ? 'OFF' : contextLevel === 'workspace' ? 'Workspace' : contextLevel === 'project' ? 'Project' : 'Custom'}
                  </Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 14, ml: 0.5 }} />
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton sx={{ color: '#9aa0a6', p: 0.5 }} size="small">
                  <CheckSquare size={18} />
                </IconButton>
                <IconButton sx={{ color: '#9aa0a6', p: 0.5 }} size="small">
                  <Brush size={18} />
                </IconButton>
                <input 
                  type="file" 
                  accept="image/*" 
                  hidden 
                  ref={fileInputRef} 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
                  }} 
                />
                <IconButton sx={{ color: '#9aa0a6', p: 0.5 }} size="small" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <ImageIcon size={18} />
                </IconButton>
                <Button 
                  size="small" 
                  variant="contained" 
                  disabled={!inputText.trim() || isSubmitting || isUploading}
                  onClick={handleSubmit}
                  sx={{ ml: 1, textTransform: 'none', borderRadius: 2, height: 28 }}
                >
                  {isSubmitting || isUploading ? '保存中...' : '保存'}
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Manual AI Assist Buttons */}
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            pl: 1, 
            opacity: isFocused ? 1 : 0, 
            transform: isFocused ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
            pointerEvents: isFocused ? 'auto' : 'none' 
          }}>
            <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }}/>} sx={{ fontSize: '0.65rem', color: '#e2a6ff', bgcolor: 'rgba(226, 166, 255, 0.1)', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgba(226, 166, 255, 0.15)' } }}>AIに相談</Button>
            <Button size="small" startIcon={<FlashOnIcon sx={{ fontSize: 14 }}/>} sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.05)', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>不足項目を確認</Button>
            <Button size="small" startIcon={<MenuBookIcon sx={{ fontSize: 14 }}/>} sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.05)', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>要約</Button>
            <Button size="small" startIcon={<CheckSquare size={14} />} sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.05)', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>設計メモ化</Button>
          </Box>
        </Box>

        <Popover
          open={Boolean(customAnchorEl)}
          anchorEl={customAnchorEl}
          onClose={() => setCustomAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          PaperProps={{ sx: { bgcolor: '#2d3136', border: '1px solid #5f6368', color: '#fff', p: 1, minWidth: 220, mt: 1, backgroundImage: 'none' } }}
        >
          <Typography sx={{ fontSize: '0.7rem', color: '#9aa0a6', mb: 1, px: 1 }}>Select AI Context Level</Typography>
          <Select
            value={contextLevel}
            onChange={(e) => setContextLevel(e.target.value as any)}
            size="small"
            fullWidth
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: '#2d3136',
                  border: '1px solid #5f6368',
                  backgroundImage: 'none'
                }
              }
            }}
            sx={{ color: '#fff', fontSize: '0.8rem', mb: 1, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5f6368' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8ab4f8' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8ab4f8' } }}
          >
            <MenuItem value="off" sx={{ fontSize: '0.8rem' }}>OFF (通常メモ)</MenuItem>
            <MenuItem value="workspace" sx={{ fontSize: '0.8rem' }}>Workspace (現在画面のみ)</MenuItem>
            <MenuItem value="project" sx={{ fontSize: '0.8rem' }}>Project (案件全体推奨)</MenuItem>
            <MenuItem value="custom" sx={{ fontSize: '0.8rem' }}>Custom (個別選択)</MenuItem>
          </Select>
          
          {contextLevel === 'custom' && (
            <Box sx={{ mt: 1, borderTop: '1px solid #5f6368', pt: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#9aa0a6', px: 1, mb: 0.5 }}>Watching Scopes</Typography>
              <FormGroup sx={{ px: 1 }}>
                {['requirements', 'workfiles', 'models', 'layout', 'presents', 'journal'].map(scope => (
                  <FormControlLabel
                    key={scope}
                    control={<Checkbox size="small" checked={watchedScopes.includes(scope as any)} onChange={() => toggleWatchedScope(scope as any)} sx={{ color: '#5f6368', '&.Mui-checked': { color: '#8ab4f8' }, py: 0.25 }} />}
                    label={<Typography sx={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{scope}</Typography>}
                    sx={{ m: 0 }}
                  />
                ))}
              </FormGroup>
            </Box>
          )}
        </Popover>
      </Box>

      {/* Masonry Layout for Notes */}
      <Box sx={{ 
        columnCount: { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }, 
        columnGap: '16px',
        '& > div': { 
          breakInside: 'avoid', 
          mb: '16px' 
        }
      }}>
        {entries.map((entry) => (
          <Box
            component={motion.div}
            layoutId={`journal-card-${entry.id}`}
            key={entry.id}
            onClick={() => setSelectedEntryId(entry.id)}
            sx={{ 
              bgcolor: '#202124', 
              borderRadius: 2, 
              border: '1px solid #5f6368',
              p: 2,
              cursor: "pointer",
              transition: "box-shadow 0.2s, border-color 0.2s",
              position: 'relative',
              '&:hover': {
                borderColor: '#e8eaed',
                boxShadow: '0 1px 2px 0 rgba(0,0,0,0.6), 0 1px 3px 1px rgba(0,0,0,0.3)',
                '& .note-actions': { opacity: 1 }
              }
            }}
          >
            {/* Note Actions (Visible on hover) */}
            <Box 
              className="note-actions"
              sx={{ 
                position: 'absolute', 
                top: 8, 
                right: 8, 
                opacity: 0, 
                transition: 'opacity 0.2s',
                display: 'flex',
                gap: 0.5,
                bgcolor: 'rgba(32,33,36,0.9)',
                borderRadius: 1
              }}
            >
              <IconButton size="small" sx={{ color: '#e8eaed', p: 0.5 }}>
                <Pin size={16} />
              </IconButton>
            </Box>

            {entry.title && (
              <Typography sx={{ color: '#e8eaed', fontWeight: 600, fontSize: 15, mb: 1.5, pr: 3, wordBreak: 'break-word' }}>
                {entry.title}
              </Typography>
            )}
            
            <Typography sx={{ 
              color: '#e8eaed', 
              fontSize: 14, 
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              mb: 2
            }}>
              {entry.excerpt}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, alignItems: 'center' }}>
              <Typography sx={{ color: '#9aa0a6', fontSize: '11px', flex: 1 }}>
                {new Date(entry.createdAt).toLocaleString()}
              </Typography>
            </Box>
          </Box>
        ))}
        {entries.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 8, color: '#9aa0a6' }}>
            <Typography variant="body1">まだジャーナルがありません。</Typography>
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
              プロジェクトの検討内容や議事録を記録しましょう。
            </Typography>
          </Box>
        )}
      </Box>

      {/* Journal Detail / Edit Expanded View */}
      <AnimatePresence>
        {selectedEntry && (
          <ExpandedJournalCard
            key="expanded-card"
            entry={selectedEntry}
            onClose={() => setSelectedEntryId(null)}
            onEdit={handleEditEntry}
            onDelete={handleDeleteEntry}
            currentUserId={currentUser?.uid}
          />
        )}
      </AnimatePresence>

      <Snackbar 
        open={!!errorToast} 
        autoHideDuration={6000} 
        onClose={() => setErrorToast("")}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setErrorToast("")} severity="error" sx={{ width: '100%' }}>
          {errorToast}
        </Alert>
      </Snackbar>
    </Box>
  );
};
