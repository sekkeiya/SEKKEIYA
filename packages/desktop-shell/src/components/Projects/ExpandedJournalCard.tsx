import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton, InputBase, Chip, Button, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { motion } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TitleIcon from '@mui/icons-material/Title';
import { JournalBlockEditor } from './JournalBlockEditor';
import { JournalRepository } from '../../features/projects/repositories/JournalRepository';
import type { JournalEntry } from '../../features/projects/types';

interface ExpandedJournalCardProps {
  entry: JournalEntry;
  onClose: () => void;
  onEdit: (id: string, content: string, title?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currentUserId?: string;
}

export const ExpandedJournalCard: React.FC<ExpandedJournalCardProps> = ({
  entry,
  onClose,
  onEdit,
  onDelete,
  currentUserId
}) => {
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (entry) {
      setEditTitle(entry.title || '');
      setEditContent(entry.content || '');
    }
  }, [entry]);



  const isAuthor = currentUserId === entry.authorId;

  // Auto-save debounce effect
  useEffect(() => {
    if (isSubmitting) return;
    const timeoutId = setTimeout(() => {
      if (editContent.trim() !== entry.content?.trim() || editTitle.trim() !== entry.title?.trim()) {
        setIsSubmitting(true);
        onEdit(entry.id, editContent.trim(), editTitle.trim() || undefined)
          .catch(err => console.error("Auto-save failed", err))
          .finally(() => setIsSubmitting(false));
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [editContent, editTitle, entry, onEdit]);

  const handleCloseWithSave = async () => {
    if (editContent.trim() !== entry.content?.trim() || editTitle.trim() !== entry.title?.trim()) {
      try {
        await onEdit(entry.id, editContent.trim(), editTitle.trim() || undefined);
      } catch (err) {
        console.error("Failed to save on close", err);
      }
    }
    onClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    await onDelete(entry.id);
    setDeleteDialogOpen(false);
    onClose();
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    if (!entry?.projectId) throw new Error("No project ID");
    return await JournalRepository.uploadAttachment(entry.projectId, file);
  };

  const renderContextChips = () => {
    if (!entry.aiContextSnapshot) return null;
    const { contextLevel, watchedScopes } = entry.aiContextSnapshot;
    
    const tooltipContent = (
      <Box sx={{ p: 0.5, maxWidth: 300 }}>
        <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'var(--brand-fg)', fontWeight: 'bold' }}>
          AI Context Snapshot
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip size="small" label={`Level: ${contextLevel}`} sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'var(--brand-fg)', fontSize: '0.7rem', height: 20 }} />
          {watchedScopes && watchedScopes.map(scope => (
            <Chip key={scope} size="small" label={scope} sx={{ bgcolor: 'rgba(138, 180, 248, 0.2)', color: 'light-dark(#0a45a4, #8ab4f8)', fontSize: '0.7rem', height: 20 }} />
          ))}
        </Box>
      </Box>
    );

    return (
      <Tooltip title={tooltipContent} placement="bottom-start" arrow componentsProps={{ tooltip: { sx: { bgcolor: '#303134', border: '1px solid #5f6368', p: 1 } }, arrow: { sx: { color: '#303134', '&::before': { border: '1px solid #5f6368' } } } }}>
        <IconButton size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', p: 0.5, ml: 1 }}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleCloseWithSave}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 1200,
          backdropFilter: 'blur(2px)'
        }}
      />
      
      {/* Expanded Card */}
      <Box sx={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1201,
        pointerEvents: 'none'
      }}>
        <motion.div
          layoutId={`journal-card-${entry.id}`}
          style={{
            width: '100%',
            maxWidth: 900,
            maxHeight: '90vh',
            backgroundColor: 'var(--brand-surface)',
            borderRadius: 12,
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
            overflow: 'hidden'
          }}
        >
          {/* Top Actions Bar (Notion style) */}
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {isAuthor && (
                <IconButton size="small" onClick={handleDeleteClick} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', '&:hover': { color: 'light-dark(#9d1c10, #f28b82)', bgcolor: 'rgba(242, 139, 130, 0.1)' } }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton size="small" onClick={handleCloseWithSave} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Main Scrollable Content */}
          <Box sx={{ px: { xs: 4, md: 8 }, pb: 8, pt: 2, overflowY: 'auto', flex: 1 }}>
            {/* Title */}
            <Box sx={{ mb: 4 }}>
              {isAuthor ? (
                <InputBase
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="無題"
                  multiline
                  sx={{ 
                    color: 'var(--brand-fg)', 
                    fontSize: 40, 
                    fontWeight: 800, 
                    lineHeight: 1.2,
                    width: '100%',
                    '& input': { padding: 0 }
                  }}
                />
              ) : (
                <Typography variant="h1" sx={{ fontSize: 40, fontWeight: 800, color: 'var(--brand-fg)', lineHeight: 1.2 }}>
                  {entry.title || "無題"}
                </Typography>
              )}
            </Box>

            {/* Properties */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', pb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', width: 120, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoOutlinedIcon fontSize="small" /> 作成日時
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--brand-fg)' }}>
                  {new Date(entry.createdAt).toLocaleString()}
                </Typography>
              </Box>
              
              {entry.aiContextSnapshot && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', width: 120, display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <TitleIcon fontSize="small" /> コンテキスト
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip size="small" label={`Level: ${entry.aiContextSnapshot.contextLevel}`} sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)', height: 24 }} />
                    {entry.aiContextSnapshot.watchedScopes?.map(scope => (
                      <Chip key={scope} size="small" label={scope} sx={{ bgcolor: 'rgba(138, 180, 248, 0.15)', color: 'light-dark(#0a45a4, #8ab4f8)', height: 24 }} />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
            {/* BlockNote Editor */}
            <Box sx={{ 
              mx: -4, // Counteract the horizontal padding of the parent slightly to align the editor perfectly 
              '& .bn-container': {
                fontFamily: 'inherit',
              }
            }}>
              <JournalBlockEditor 
                key={entry.id}
                initialMarkdown={entry.content || ''}
                onChange={(markdown) => setEditContent(markdown)}
                editable={isAuthor}
                onImageUpload={handleImageUpload}
              />
            </Box>
          </Box>
        </motion.div>
      </Box>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid #5f6368' }
        }}
      >
        <DialogTitle sx={{ color: 'var(--brand-fg)' }}>ジャーナルの削除</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>
            本当にこのジャーナルを削除してもよろしいですか？この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>キャンセル</Button>
          <Button onClick={confirmDelete} sx={{ color: 'light-dark(#9d1c10, #f28b82)', fontWeight: 'bold' }}>削除する</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
