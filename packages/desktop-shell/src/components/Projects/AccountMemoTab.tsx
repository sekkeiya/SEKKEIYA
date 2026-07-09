import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, InputBase, Button, Chip, CircularProgress,
  IconButton, Select, MenuItem, FormControl, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField,
} from '@mui/material';
import AddRoundedIcon       from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon    from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon      from '@mui/icons-material/EditRounded';
import CloseRoundedIcon     from '@mui/icons-material/CloseRounded';
import MenuBookRoundedIcon  from '@mui/icons-material/MenuBookRounded';
import FolderRoundedIcon    from '@mui/icons-material/FolderRounded';
import { motion, AnimatePresence } from 'framer-motion';
import { JournalRepository } from '../../features/projects/repositories/JournalRepository';
import { useAuthStore }  from '../../store/useAuthStore';
import { useAppStore }   from '../../store/useAppStore';
import type { JournalEntry } from '../../features/projects/types';

interface EnrichedEntry extends JournalEntry {
  projectName?: string;
}

// ─── Date helper ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditDialogProps {
  entry: EnrichedEntry | null;
  onClose: () => void;
  onSave: (entry: EnrichedEntry, title: string, content: string) => Promise<void>;
}

const EditDialog: React.FC<EditDialogProps> = ({ entry, onClose, onSave }) => {
  const [title,   setTitle]   = useState('');
  const [content, setContent] = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (entry) { setTitle(entry.title ?? ''); setContent(entry.content ?? ''); }
  }, [entry]);

  const handleSave = async () => {
    if (!entry || !content.trim()) return;
    setSaving(true);
    try { await onSave(entry, title, content); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!entry} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#131920', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#fff' } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '0.95rem', pb: 1 }}>メモを編集</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField label="タイトル" value={title} onChange={e => setTitle(e.target.value)} fullWidth size="small"
          InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)', '&.Mui-focused': { color: '#00BFFF' } } }}
          InputProps={{ sx: { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } } }}
          sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } }}/>
        <TextField label="内容 *" value={content} onChange={e => setContent(e.target.value)} fullWidth multiline minRows={5} size="small"
          InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)', '&.Mui-focused': { color: '#00BFFF' } } }}
          InputProps={{ sx: { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } } }}
          sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } }}/>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
        <Button onClick={handleSave} disabled={!content.trim() || saving} variant="contained"
          sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2,
            '&:hover': { bgcolor: '#4facfe' }, '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' } }}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AccountMemoTab: React.FC = () => {
  const currentUser = useAuthStore(s => s.currentUser);
  const projects    = useAppStore(s => s.projects);

  // Filter / composer state
  const [filterProjectId,   setFilterProjectId]   = useState<string>('all');
  const [composerProjectId, setComposerProjectId] = useState<string>('');
  const [composerTitle,     setComposerTitle]     = useState('');
  const [composerText,      setComposerText]      = useState('');
  const [isFocused,         setIsFocused]         = useState(false);
  const [isSubmitting,      setIsSubmitting]      = useState(false);

  // Entries state
  const [entries,  setEntries]  = useState<EnrichedEntry[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<EnrichedEntry | null>(null);

  // Auto-select first project for composer
  useEffect(() => {
    if (projects.length > 0 && !composerProjectId) {
      setComposerProjectId(projects[0].id);
    }
  }, [projects, composerProjectId]);

  // Subscribe to journals (all projects or filtered)
  useEffect(() => {
    if (!projects.length) { setLoading(false); return; }
    const targets = filterProjectId === 'all'
      ? projects
      : projects.filter(p => p.id === filterProjectId);
    if (!targets.length) { setEntries([]); setLoading(false); return; }

    const map: Record<string, EnrichedEntry[]> = {};
    setLoading(true);

    const unsubs = targets.map(p =>
      JournalRepository.subscribeToRecentJournals(p.id, 50,
        (es) => {
          map[p.id] = es.map(e => ({ ...e, projectName: p.name }));
          setEntries(
            Object.values(map).flat().sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
          setLoading(false);
        },
        err => { console.error('[AccountMemoTab]', err); setLoading(false); }
      )
    );
    return () => unsubs.forEach(u => u());
  }, [projects, filterProjectId]);

  // Submit new memo
  const handleSubmit = useCallback(async () => {
    if (!composerText.trim() || !composerProjectId || isSubmitting || !currentUser) return;
    setIsSubmitting(true);
    try {
      const content = composerText.trim();
      const finalTitle = composerTitle.trim() || (content.length > 30 ? content.substring(0, 30) + '...' : content);
      const excerpt    = content.length > 80 ? content.substring(0, 80).replace(/\n/g, ' ') + '...' : content;
      await JournalRepository.addJournalEntry(composerProjectId, {
        authorId: currentUser.uid,
        title: finalTitle,
        excerpt,
        content,
        aiContextSnapshot: { contextLevel: 'off', watchedScopes: [] },
      });
      setComposerText(''); setComposerTitle(''); setIsFocused(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [composerText, composerTitle, composerProjectId, isSubmitting, currentUser]);

  // Save edit
  const handleSaveEdit = useCallback(async (entry: EnrichedEntry, title: string, content: string) => {
    const finalTitle   = title.trim() || (content.length > 30 ? content.substring(0, 30) + '...' : content);
    const finalExcerpt = content.length > 80 ? content.substring(0, 80).replace(/\n/g, ' ') + '...' : content;
    await JournalRepository.updateJournalEntry(entry.projectId, entry.id, {
      content: content.trim(), title: finalTitle, excerpt: finalExcerpt,
    });
  }, []);

  // Delete memo
  const handleDelete = useCallback(async (entry: EnrichedEntry) => {
    if (!currentUser || !window.confirm('このメモを削除しますか？')) return;
    await JournalRepository.deleteJournalEntry(entry.projectId, entry.id, currentUser.uid);
  }, [currentUser]);

  if (!projects.length) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <FolderRoundedIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.12)', mb: 1.5 }}/>
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>
          プロジェクトがありません
        </Typography>
      </Box>
    );
  }

  const composerProject = projects.find(p => p.id === composerProjectId);

  return (
    <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, py: 3, boxSizing: 'border-box' }}>

      {/* ── プロジェクトフィルター ─────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3, alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, mr: 0.5, letterSpacing: 0.5 }}>
          表示
        </Typography>
        {[{ id: 'all', name: 'すべて' }, ...projects.map(p => ({ id: p.id, name: p.name }))].map(p => (
          <Chip key={p.id} label={p.name} size="small" onClick={() => setFilterProjectId(p.id)}
            sx={{ height: 24, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
              bgcolor: filterProjectId === p.id ? 'rgba(0,191,255,0.14)' : 'rgba(255,255,255,0.06)',
              color:   filterProjectId === p.id ? '#00BFFF' : 'rgba(255,255,255,0.55)',
              border:  `1px solid ${filterProjectId === p.id ? 'rgba(0,191,255,0.4)' : 'transparent'}`,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' } }}/>
        ))}
      </Box>

      {/* ── メモ作成コンポーザー ──────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <Box sx={{ width: '100%', maxWidth: 640 }}>
          <Paper elevation={isFocused ? 4 : 1}
            sx={{ display: 'flex', flexDirection: 'column', p: '8px 16px',
              bgcolor: '#202124', border: '1px solid', borderRadius: 3,
              borderColor: isFocused ? '#8ab4f8' : '#5f6368',
              boxShadow: isFocused ? '0 1px 2px 0 rgba(0,0,0,0.6), 0 2px 6px 2px rgba(0,0,0,0.3)' : '0 1px 2px 0 rgba(0,0,0,0.6)',
              transition: 'all 0.2s' }}>
            {(isFocused || composerText.length > 0) && (
              <InputBase
                sx={{ width: '100%', color: '#e8eaed', py: 0.5, fontSize: 15, fontWeight: 600, mb: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="タイトル（任意）"
                value={composerTitle}
                onChange={e => setComposerTitle(e.target.value)}
              />
            )}
            <InputBase
              multiline
              minRows={isFocused || composerText.length > 0 ? 3 : 1}
              maxRows={10}
              sx={{ flex: 1, color: '#e8eaed', py: 1, fontSize: 15 }}
              placeholder="メモを書く... (Shift+Enter で保存)"
              onFocus={() => setIsFocused(true)}
              value={composerText}
              onChange={e => setComposerText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            />
            {(isFocused || composerText.length > 0) && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1,
                borderTop: '1px solid rgba(255,255,255,0.08)', pt: 1 }}>
                {/* Project selector */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <FolderRoundedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}/>
                  <Select
                    value={composerProjectId}
                    onChange={e => setComposerProjectId(e.target.value)}
                    size="small" variant="standard" disableUnderline
                    sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
                      '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.35)', fontSize: 16 } }}
                    MenuProps={{ PaperProps: { sx: { bgcolor: '#1a2030', color: '#fff' } } }}>
                    {projects.map(p => (
                      <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8rem', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button size="small" onClick={() => { setIsFocused(false); setComposerText(''); setComposerTitle(''); }}
                    sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                    キャンセル
                  </Button>
                  <Button size="small" variant="contained" disabled={!composerText.trim() || isSubmitting}
                    onClick={handleSubmit}
                    sx={{ textTransform: 'none', borderRadius: 2, height: 28, fontSize: '0.75rem',
                      bgcolor: '#00BFFF', color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#4facfe' },
                      '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' } }}>
                    {isSubmitting ? '保存中...' : '保存'}
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* ── エントリーリスト ──────────────────────────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress size={24} sx={{ color: '#00BFFF' }}/>
        </Box>
      ) : entries.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <MenuBookRoundedIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.1)', mb: 1.5 }}/>
          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.875rem' }}>
            {filterProjectId === 'all' ? 'まだメモがありません' : 'このプロジェクトにメモがありません'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{
          columnCount: { xs: 1, sm: 2, md: 3, lg: 4 },
          columnGap: '16px',
          '& > div': { breakInside: 'avoid', mb: '16px' },
        }}>
          <AnimatePresence>
            {entries.map(entry => (
              <Box key={entry.id} component={motion.div}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                sx={{ bgcolor: '#202124', borderRadius: 2, border: '1px solid #5f6368', p: 2,
                  cursor: 'pointer', position: 'relative', transition: 'border-color 0.2s, box-shadow 0.2s',
                  '&:hover': { borderColor: '#8ab4f8', boxShadow: '0 1px 6px rgba(0,0,0,0.4)', '& .memo-act': { opacity: 1 } } }}>

                {/* Actions (hover) */}
                <Box className="memo-act" sx={{ position: 'absolute', top: 6, right: 6, opacity: 0,
                  transition: 'opacity 0.15s', display: 'flex', gap: 0.25,
                  bgcolor: 'rgba(32,33,36,0.9)', borderRadius: 1 }}>
                  <IconButton size="small" onClick={e => { e.stopPropagation(); setEditTarget(entry); }}
                    sx={{ p: '3px', color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#00BFFF' } }}>
                    <EditRoundedIcon sx={{ fontSize: 13 }}/>
                  </IconButton>
                  <IconButton size="small" onClick={e => { e.stopPropagation(); handleDelete(entry); }}
                    sx={{ p: '3px', color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fa709a' } }}>
                    <DeleteRoundedIcon sx={{ fontSize: 13 }}/>
                  </IconButton>
                </Box>

                {/* Project badge */}
                {filterProjectId === 'all' && entry.projectName && (
                  <Chip label={entry.projectName} size="small"
                    sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, mb: 1,
                      color: 'rgba(255,255,255,0.55)', bgcolor: 'rgba(255,255,255,0.06)' }}/>
                )}

                {entry.title && (
                  <Typography sx={{ color: '#e8eaed', fontWeight: 600, fontSize: '0.9rem', mb: 0.75, pr: 3, wordBreak: 'break-word' }}>
                    {entry.title}
                  </Typography>
                )}

                <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', lineHeight: 1.55,
                  display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {entry.content}
                </Typography>

                <Typography sx={{ mt: 1.25, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
                  {formatDate(entry.createdAt)}
                </Typography>
              </Box>
            ))}
          </AnimatePresence>
        </Box>
      )}

      {/* Edit Dialog */}
      <EditDialog entry={editTarget} onClose={() => setEditTarget(null)} onSave={handleSaveEdit}/>
    </Box>
  );
};
