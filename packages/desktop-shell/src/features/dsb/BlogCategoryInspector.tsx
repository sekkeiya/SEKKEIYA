/**
 * BlogCategoryInspector — カテゴリ管理ビューの右ペイン（選択カテゴリの編集）。
 * 名前の変更（配下記事の category も一括更新）・件数表示・配下記事の一覧（クリックで編集）・
 * 削除（配下記事は未分類化）を行う。
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Tooltip, Button,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BRAND } from '../../styles/theme';

const ACCENT = '#e57373';
const hueOf = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
};

interface Props {
  name: string;
  uid?: string;
  onClose: () => void;
  onRenamed: (newName: string) => void;
  onOpenArticle: (id: string) => void;
}

export const BlogCategoryInspector: React.FC<Props> = ({ name, uid, onClose, onRenamed, onOpenArticle }) => {
  const { articles, setCategoryFilter, renameCategory, removeCategory } = useDsbStore();

  const [value, setValue] = useState(name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setValue(name); }, [name]);

  const items = useMemo(
    () => articles
      .filter((a) => (a.category || '') === name)
      .sort((a, b) => (a.status !== b.status ? (a.status === 'published' ? -1 : 1) : (b.updatedAt || '').localeCompare(a.updatedAt || ''))),
    [articles, name],
  );
  const published = items.filter((a) => a.status === 'published').length;
  const drafts = items.length - published;

  const commitRename = () => {
    const n = value.trim();
    if (!uid || !n || n === name) { setValue(name); return; }
    renameCategory(uid, name, n);
    onRenamed(n);
  };

  return (
    <Box sx={{
      width: 340, flexShrink: 0, height: '100%',
      borderLeft: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(10,15,25,0.6)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5, px: 2.5, py: 2.5,
    }}>
      {/* ヘッダ */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, bgcolor: `hsl(${hueOf(name)},65%,62%)` }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            カテゴリ
          </Typography>
        </Box>
        <Tooltip title="閉じる"><IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      </Box>

      {/* 名前 */}
      <TextField
        label="カテゴリ名" value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        fullWidth size="small" sx={fieldSx}
      />

      {/* 件数 */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {[
          { v: items.length, l: '記事', c: '#607d8b' },
          { v: published, l: '公開', c: '#43a047' },
          { v: drafts, l: '下書き', c: '#9e9e9e' },
        ].map((s) => (
          <Box key={s.l} sx={{ flex: 1, p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.v}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.c }} />
              <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>{s.l}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Button
        onClick={() => setCategoryFilter(name)}
        startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
        variant="outlined" size="small" fullWidth
        sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}14` } }}
      >
        このカテゴリの記事一覧を開く
      </Button>

      {/* 配下の記事 */}
      <Box>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, mb: 1 }}>記事（{items.length}）</Typography>
        {items.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', py: 1 }}>このカテゴリの記事はまだありません。</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {items.map((a) => {
              const pub = a.status === 'published';
              const color = pub ? '#81c784' : '#ffb74d';
              return (
                <Box key={a.id} onClick={() => onOpenArticle(a.id)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.75, borderRadius: 1.5, cursor: 'pointer', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
                  {pub ? <PublicRoundedIcon sx={{ fontSize: 14, color, flexShrink: 0 }} /> : <EditNoteRoundedIcon sx={{ fontSize: 14, color, flexShrink: 0 }} />}
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 12.5, color: pub ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)' }}>{a.title || '(無題)'}</Typography>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 700, color, flexShrink: 0 }}>{pub ? '公開' : '下書き'}</Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Button
        onClick={() => setConfirmDelete(true)}
        startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
        variant="text" size="small"
        sx={{ mt: 'auto', alignSelf: 'flex-start', color: '#fa9bb4', textTransform: 'none', '&:hover': { bgcolor: 'rgba(250,155,180,0.08)' } }}
      >
        このカテゴリを削除
      </Button>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}
        PaperProps={{ sx: { bgcolor: '#0e121c', color: '#fff', border: `1px solid ${BRAND.line}`, minWidth: 380, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>カテゴリを削除</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            「{name}」を削除します。
            {items.length > 0
              ? `配下の ${items.length} 件の記事は未分類（カテゴリなし）になります（記事自体は削除されません）。`
              : 'このカテゴリには記事がありません。'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmDelete(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
          <Button onClick={() => { if (uid) removeCategory(uid, name); setConfirmDelete(false); onClose(); }}
            variant="contained" sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>削除する</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
