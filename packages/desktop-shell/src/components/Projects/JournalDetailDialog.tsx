import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Button, 
  Box, 
  Typography, 
  IconButton,
  InputBase,
  Chip,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReactMarkdown from 'react-markdown';
import { JournalRepository } from '../../features/projects/repositories/JournalRepository';
import type { JournalEntry } from '../../features/projects/types';

interface JournalDetailDialogProps {
  open: boolean;
  onClose: () => void;
  entry: JournalEntry | null;
  onEdit: (id: string, content: string, title?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currentUserId?: string;
}

export const JournalDetailDialog: React.FC<JournalDetailDialogProps> = ({ 
  open, 
  onClose, 
  entry, 
  onEdit, 
  onDelete,
  currentUserId 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entry) {
      setEditTitle(entry.title || '');
      setEditContent(entry.content || '');
    }
  }, [entry]);

  // Auto-enable edit mode when dialog opens for the author, or reset when closed
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    } else if (open && currentUserId && entry && currentUserId === entry.authorId) {
      setIsEditing(true);
    }
  }, [open, currentUserId, entry]);

  if (!entry) return null;

  const isAuthor = currentUserId === entry.authorId;

  const handleSave = async () => {
    if (!editContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onEdit(entry.id, editContent.trim(), editTitle.trim() || undefined);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save entry", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("このジャーナルを削除しますか？(Soft Delete)")) {
      await onDelete(entry.id);
      onClose();
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!entry?.projectId || !file.type.startsWith('image/')) return;
    
    setIsUploading(true);
    try {
      const downloadUrl = await JournalRepository.uploadAttachment(entry.projectId, file);
      const markdownImage = `![${file.name}](${downloadUrl})`;
      setEditContent(prev => prev ? `${prev}\n${markdownImage}\n` : `${markdownImage}\n`);
    } catch (err) {
      console.error("画像のアップロードに失敗しました", err);
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
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.65)', fontSize: '0.65rem' }}>
          このジャーナルが記録された際に、AIが参照していたコンテキスト情報です。
        </Typography>
      </Box>
    );

    return (
      <Tooltip 
        title={tooltipContent} 
        placement="bottom-start" 
        arrow 
        componentsProps={{ 
          tooltip: { sx: { bgcolor: '#303134', border: '1px solid #5f6368', p: 1 } },
          arrow: { sx: { color: '#303134', '&::before': { border: '1px solid #5f6368' } } }
        }}
      >
        <IconButton size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', p: 0.5, ml: 1 }}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
        {isEditing ? (
          <InputBase
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title (Optional)"
            sx={{ color: 'var(--brand-fg)', fontSize: 20, fontWeight: 'bold', flex: 1, mr: 2 }}
          />
        ) : (
          <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>{entry.title || "No Title"}</Typography>
        )}
        <Box>
          {!isEditing && isAuthor && (
            <>
              <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ color: 'light-dark(#0a45a4, #8ab4f8)', mr: 1 }}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={handleDelete} sx={{ color: 'light-dark(#9d1c10, #f28b82)', mr: 1 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>
              {new Date(entry.createdAt).toLocaleString()}
            </Typography>
            {renderContextChips()}
          </Box>
        </Box>

        {isEditing ? (
          <InputBase
            multiline
            minRows={10}
            fullWidth
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            sx={{ 
              color: 'var(--brand-fg)', 
              bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', 
              p: 2, 
              borderRadius: 1,
              fontFamily: 'monospace'
            }}
          />
        ) : (
          <Box sx={{ 
            color: 'var(--brand-fg)',
            '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 2, mb: 1 },
            '& p': { mt: 0, mb: 2 },
            '& code': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', p: 0.5, borderRadius: 1, fontFamily: 'monospace' },
            '& pre': { bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', p: 2, borderRadius: 1, overflowX: 'auto' },
            '& a': { color: 'light-dark(#0a45a4, #8ab4f8)' },
            '& blockquote': { borderLeft: '4px solid #5f6368', pl: 2, ml: 0, color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
            '& img': { maxWidth: '100%', borderRadius: '8px', mt: 2, mb: 2 }
          }}>
            <ReactMarkdown>{entry.content}</ReactMarkdown>
          </Box>
        )}
      </DialogContent>
      
      {isEditing && (
        <DialogActions sx={{ borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <input 
              type="file" 
              accept="image/*" 
              hidden 
              ref={fileInputRef} 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
              }} 
            />
            <IconButton sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }} size="small" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              <ImageIcon />
            </IconButton>
          </Box>
          <Box>
            <Button onClick={() => setIsEditing(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', mr: 1 }}>キャンセル</Button>
            <Button onClick={handleSave} disabled={isSubmitting || isUploading} variant="contained" sx={{ bgcolor: '#8ab4f8', color: '#202124', '&:hover': { bgcolor: '#aecbfa' } }}>
              {isSubmitting || isUploading ? '保存中...' : '保存'}
            </Button>
          </Box>
        </DialogActions>
      )}
    </Dialog>
  );
};
