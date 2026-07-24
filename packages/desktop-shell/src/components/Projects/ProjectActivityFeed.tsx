import React, { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Paper, IconButton, InputBase, Button,
  Popover, Checkbox, FormControlLabel, FormGroup, Snackbar, Alert, Select, MenuItem,
} from "@mui/material";
import CheckSquare from '@mui/icons-material/CheckBoxOutlineBlank';
import Brush from '@mui/icons-material/Brush';
import ImageIcon from '@mui/icons-material/Image';
import Pin from '@mui/icons-material/PushPin';
import MemoryIcon from '@mui/icons-material/Memory';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { useJournalAiStore } from '../../store/useJournalAiStore';
import { useJournalStore } from '../../store/useJournalStore';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAiProfileStore } from '../../store/useAiProfileStore';
import { ExpandedJournalCard } from './ExpandedJournalCard';
import { JournalRepository } from '../../features/projects/repositories/JournalRepository';
import { motion, AnimatePresence } from 'framer-motion';

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
  /** 狭いサイドバー埋め込み用（Research & Memo タブ右ペイン）。1カラム固定・余白圧縮 */
  compact?: boolean;
}

export const ProjectActivityFeed: React.FC<ProjectActivityFeedProps> = ({ loading = false, compact = false }) => {
  const [isFocused, setIsFocused] = useState(false);
  const { contextLevel, setContextLevel, watchedScopes, toggleWatchedScope } = useJournalAiStore();
  const {
    entries, submitEntry, updateEntry, deleteEntry,
    subscribeToProjectJournals, unsubscribeFromProjectJournals,
    isSubmitting, selectedEntryId, setSelectedEntryId,
  } = useJournalStore();
  const activeProfile = useAiProfileStore(s => s.aiProfiles.find(p => p.status === 'Active'));
  const activeWorkspace = useAppStore(s => s.getActiveWorkspace());
  const activeProject = useAppStore(s => s.getActiveProject());
  const { currentUser } = useAuthStore();

  const [customAnchorEl, setCustomAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [inputText, setInputText] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [errorToast, setErrorToast] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEntry = entries.find(e => e.id === selectedEntryId) || null;

  useEffect(() => {
    if (!activeProject?.id) return;
    subscribeToProjectJournals(activeProject.id);
    return () => { unsubscribeFromProjectJournals(); };
  }, [activeProject?.id, subscribeToProjectJournals, unsubscribeFromProjectJournals]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); await handleSubmit(); }
  };

  const handleSubmit = async () => {
    if (!inputText.trim() || isSubmitting) return;
    try {
      await submitEntry(inputText.trim(), inputTitle.trim() || undefined, {
        contextLevel, watchedScopes,
        activeProfileId: activeProfile?.id,
        activeProfileName: activeProfile?.name,
        workspaceId: activeWorkspace?.workspaceId || null,
        workspaceName: activeWorkspace?.name || null,
      });
      setInputText(""); setInputTitle("");
    } catch { setErrorToast("保存に失敗しました。再試行してください。"); }
  };

  const handleImageUpload = async (file: File) => {
    if (!activeProject?.id || !file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
      const url = await JournalRepository.uploadAttachment(activeProject.id, file);
      const md = `![${file.name}](${url})`;
      setInputText(prev => prev ? `${prev}\n${md}\n` : `${md}\n`);
    } catch { setErrorToast("画像のアップロードに失敗しました。"); }
    finally { setIsUploading(false); }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const f = items[i].getAsFile();
        if (f) handleImageUpload(f);
      }
    }
  };

  const handleEditEntry = async (id: string, content: string, title?: string) => {
    try { await updateEntry(id, content, title); }
    catch { setErrorToast("更新に失敗しました。"); }
  };

  const handleDeleteEntry = async (id: string) => {
    try { await deleteEntry(id); }
    catch { setErrorToast("削除に失敗しました。"); }
  };

  if (!activeProject) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <MenuBookIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.12)', mb: 1.5 }} />
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.875rem' }}>
          左のサイドバーからプロジェクトを選択すると<br />そのプロジェクトのメモが表示されます
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>Loading notes...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: compact ? 2 : { xs: 2, md: 3, lg: 4 }, py: 2, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, boxSizing: 'border-box' }}>

      {/* ── Compact top bar (Schedules & Tasks スタイル) ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1.5, flexShrink: 0, minHeight: 36 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#a18cd1', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, letterSpacing: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
            プロジェクト
          </Typography>
          <Box sx={{ px: 1.25, py: 0.25, bgcolor: 'rgba(161,140,209,0.1)', border: '1px solid rgba(161,140,209,0.25)', borderRadius: 1.5 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'light-dark(#48327c, #a18cd1)', whiteSpace: 'nowrap' }}>
              {activeProject.name}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
            {entries.length} 件のメモ
          </Typography>
        </Box>
      </Box>

      {/* ── Composer ── */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, flexShrink: 0 }}>
        <Box sx={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Paper elevation={0} sx={{
            display: 'flex', flexDirection: 'column', p: '10px 16px',
            bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)',
            border: '1px solid',
            borderColor: isFocused ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.12)',
            borderRadius: 3,
            transition: 'border-color 0.2s',
            boxShadow: isFocused ? '0 0 0 1px rgba(0,191,255,0.2)' : 'none',
          }}>
            {(isFocused || inputText.length > 0) && (
              <InputBase
                sx={{ width: '100%', color: 'var(--brand-fg)', py: 0.5, fontSize: 14, fontWeight: 600, mb: 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}
                placeholder="Title (optional)"
                value={inputTitle}
                onChange={e => setInputTitle(e.target.value)}
              />
            )}
            <InputBase
              multiline
              minRows={isFocused || inputText.length > 0 ? 3 : 1}
              maxRows={10}
              sx={{ flex: 1, color: 'rgb(var(--brand-fg-rgb) / 0.85)', py: 1, fontSize: 14 }}
              placeholder="今日の検討内容や議事録を書く...　(Shift+Enter で保存)"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleImageUpload(e.dataTransfer.files[0]); }}
              onDragOver={e => e.preventDefault()}
            />

            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              mt: 1, borderTop: isFocused ? '1px solid rgb(var(--brand-fg-rgb) / 0.07)' : 'none',
              pt: isFocused ? 1 : 0, opacity: isFocused ? 1 : 0.6, transition: 'all 0.2s',
            }}>
              {/* AI Context */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(161,140,209,0.1)', color: 'light-dark(#48327c, #a18cd1)', px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer', gap: 0.5, '&:hover': { bgcolor: 'rgba(161,140,209,0.18)' } }}
                onMouseDown={e => { e.preventDefault(); setCustomAnchorEl(e.currentTarget as any); }}
              >
                <MemoryIcon sx={{ fontSize: 13 }} />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  AI Context: {contextLevel === 'off' ? 'OFF' : contextLevel === 'workspace' ? 'Workspace' : contextLevel === 'project' ? 'Project' : 'Custom'}
                </Typography>
                <KeyboardArrowDownIcon sx={{ fontSize: 13 }} />
              </Box>

              {/* Actions */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <IconButton size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.5, '&:hover': { color: 'var(--brand-fg)' } }}>
                  <CheckSquare sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.5, '&:hover': { color: 'var(--brand-fg)' } }}>
                  <Brush sx={{ fontSize: 18 }} />
                </IconButton>
                <input type="file" accept="image/*" hidden ref={fileInputRef}
                  onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
                <IconButton size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.5, '&:hover': { color: 'var(--brand-fg)' } }}
                  onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <ImageIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Button size="small" variant="contained" disabled={!inputText.trim() || isSubmitting || isUploading}
                  onClick={handleSubmit}
                  sx={{ ml: 1, textTransform: 'none', borderRadius: 2, height: 28, fontWeight: 700, fontSize: '0.72rem', bgcolor: '#a18cd1', '&:hover': { bgcolor: '#b89fe0' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
                  {isSubmitting || isUploading ? '保存中...' : '保存'}
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Inline AI assist (shown on focus) */}
          <Box sx={{
            display: 'flex', gap: 1, pl: 1,
            opacity: isFocused ? 1 : 0,
            transform: isFocused ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: isFocused ? 'auto' : 'none',
          }}>
            <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: 13 }} />}
              sx={{ fontSize: '0.65rem', color: 'light-dark(#48327c, #a18cd1)', bgcolor: 'rgba(161,140,209,0.1)', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgba(161,140,209,0.18)' } }}>
              AIに相談
            </Button>
            <Button size="small" startIcon={<FlashOnIcon sx={{ fontSize: 13 }} />}
              sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.6)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.09)' } }}>
              不足項目を確認
            </Button>
            <Button size="small" startIcon={<MenuBookIcon sx={{ fontSize: 13 }} />}
              sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.6)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.09)' } }}>
              要約
            </Button>
          </Box>
        </Box>

        {/* AI Context Popover */}
        <Popover
          open={Boolean(customAnchorEl)}
          anchorEl={customAnchorEl}
          onClose={() => setCustomAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)', p: 1, minWidth: 220, mt: 1, backgroundImage: 'none', borderRadius: 2 } }}
        >
          <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 1, px: 1 }}>AI Context Level</Typography>
          <Select value={contextLevel} onChange={e => setContextLevel(e.target.value as any)}
            size="small" fullWidth
            MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', backgroundImage: 'none' } } }}
            sx={{ color: 'var(--brand-fg)', fontSize: '0.8rem', mb: 1, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#a18cd1' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#a18cd1' }, '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}>
            <MenuItem value="off" sx={{ fontSize: '0.8rem', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>OFF（通常メモ）</MenuItem>
            <MenuItem value="workspace" sx={{ fontSize: '0.8rem', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>Workspace（現在画面のみ）</MenuItem>
            <MenuItem value="project" sx={{ fontSize: '0.8rem', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>Project（案件全体推奨）</MenuItem>
            <MenuItem value="custom" sx={{ fontSize: '0.8rem', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>Custom（個別選択）</MenuItem>
          </Select>
          {contextLevel === 'custom' && (
            <Box sx={{ mt: 1, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', pt: 1 }}>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', px: 1, mb: 0.5 }}>Watching Scopes</Typography>
              <FormGroup sx={{ px: 1 }}>
                {['requirements', 'workfiles', 'models', 'layout', 'presents', 'journal'].map(scope => (
                  <FormControlLabel key={scope}
                    control={<Checkbox size="small" checked={watchedScopes.includes(scope as any)} onChange={() => toggleWatchedScope(scope as any)}
                      sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&.Mui-checked': { color: 'light-dark(#48327c, #a18cd1)' }, py: 0.25 }} />}
                    label={<Typography sx={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>{scope}</Typography>}
                    sx={{ m: 0 }} />
                ))}
              </FormGroup>
            </Box>
          )}
        </Popover>
      </Box>

      {/* ── Note grid (masonry) ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5,
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3 } }}>
        {entries.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <MenuBookIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.1)', mb: 1.5 }} />
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontSize: '0.875rem', lineHeight: 2 }}>
              まだメモがありません<br />
              <Box component="span" sx={{ fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.22)' }}>
                プロジェクトの検討内容や議事録を記録しましょう
              </Box>
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            // compact はコンテナ幅が狭い（≒400pxサイドバー）ため、ビューポート基準のブレークポイントを使わない
            columnCount: compact ? 1 : { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 },
            columnGap: '12px',
            '& > div': { breakInside: 'avoid', mb: '12px' },
          }}>
            {entries.map(entry => (
              <Box
                component={motion.div}
                layoutId={`journal-card-${entry.id}`}
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
                sx={{
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)',
                  borderRadius: 2.5,
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                  p: 2,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                  '&:hover': {
                    borderColor: 'rgba(161,140,209,0.45)',
                    bgcolor: 'rgba(161,140,209,0.04)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    '& .note-actions': { opacity: 1 },
                  },
                }}
              >
                <Box className="note-actions" sx={{
                  position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.15s',
                  display: 'flex', gap: 0.5, bgcolor: 'rgba(15,20,30,0.85)', borderRadius: 1,
                }}>
                  <IconButton size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', p: 0.4, '&:hover': { color: 'var(--brand-fg)' } }}>
                    <Pin sx={{ fontSize: 15 }} />
                  </IconButton>
                </Box>

                {entry.title && (
                  <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: '0.88rem', mb: 1, pr: 3, wordBreak: 'break-word' }}>
                    {entry.title}
                  </Typography>
                )}
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.82rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', mb: 1.5 }}>
                  {entry.excerpt}
                </Typography>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: '0.65rem' }}>
                  {new Date(entry.createdAt).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Expanded view */}
      <AnimatePresence>
        {selectedEntry && (
          <ExpandedJournalCard key="expanded-card" entry={selectedEntry}
            onClose={() => setSelectedEntryId(null)}
            onEdit={handleEditEntry}
            onDelete={handleDeleteEntry}
            currentUserId={currentUser?.uid} />
        )}
      </AnimatePresence>

      <Snackbar open={!!errorToast} autoHideDuration={6000} onClose={() => setErrorToast("")}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setErrorToast("")} severity="error" sx={{ width: '100%' }}>
          {errorToast}
        </Alert>
      </Snackbar>
    </Box>
  );
};
