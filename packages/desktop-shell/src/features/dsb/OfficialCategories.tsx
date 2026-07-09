import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, Chip, IconButton, CircularProgress,
  Drawer, Stack, Switch, FormControlLabel, MenuItem, Snackbar, Alert,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded';
import {
  fetchCategories, createCategory, updateCategory, deleteCategory, seedDefaultCategories,
  type BlogCategory,
} from './api/officialCategoriesApi';
import { BRAND } from '../../styles/theme';

const ACCENT = '#38bdf8';

interface CatForm { name: string; slug: string; description: string; order: number | string; parent: string; active: boolean; }
const emptyForm = (order = 999): CatForm => ({ name: '', slug: '', description: '', order, parent: '', active: true });

export const OfficialCategories: React.FC = () => {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<BlogCategory | null>(null);
  const [form, setForm] = useState<CatForm>(emptyForm());
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const [confirm, setConfirm] = useState<BlogCategory | null>(null);

  const topLevels = categories.filter((c) => !c.parent);
  const childrenOf = (slug: string) => categories.filter((c) => c.parent === slug);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCategories(await fetchCategories()); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openAdd = (parent = '') => {
    setEditCat(null);
    setForm({ ...emptyForm(categories.length + 1), parent });
    setDialogOpen(true);
  };
  const openEdit = (c: BlogCategory) => {
    setEditCat(c);
    setForm({ name: c.name || '', slug: c.slug || '', description: c.description || '', order: c.order ?? 999, parent: c.parent || '', active: c.active !== false });
    setDialogOpen(true);
  };
  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editCat) await updateCategory(editCat.id, form);
      else await createCategory(form);
      setDialogOpen(false);
      await load();
      setToast({ msg: editCat ? 'カテゴリを更新しました' : 'カテゴリを追加しました', sev: 'success' });
    } catch (e: any) { setToast({ msg: `保存に失敗: ${e.message}`, sev: 'error' }); }
  };
  const doDelete = async (c: BlogCategory) => {
    try {
      await deleteCategory(c.id);
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
      setConfirm(null);
      setToast({ msg: '削除しました', sev: 'info' });
    } catch (e: any) { setToast({ msg: `削除に失敗: ${e.message}`, sev: 'error' }); }
  };
  const toggleActive = async (c: BlogCategory) => {
    await updateCategory(c.id, { active: !(c.active !== false) });
    await load();
  };
  const seed = async () => {
    setSeeding(true);
    try { await seedDefaultCategories(); await load(); setToast({ msg: '既定カテゴリを作成しました', sev: 'success' }); }
    catch (e: any) { setToast({ msg: `作成に失敗: ${e.message}`, sev: 'error' }); }
    setSeeding(false);
  };

  const renderRow = (c: BlogCategory, isChild: boolean) => (
    <Box key={c.id} onClick={() => openEdit(c)} sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, pl: isChild ? 5 : 1.5,
      borderBottom: `1px solid ${BRAND.line}`, opacity: c.active === false ? 0.5 : 1, cursor: 'pointer',
      bgcolor: editCat?.id === c.id && dialogOpen ? `${ACCENT}14` : (isChild ? 'rgb(var(--brand-fg-rgb) / 0.015)' : 'transparent'),
      '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' },
    }}>
      {isChild
        ? <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.25)' }} />
        : <Typography sx={{ width: 22, color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{c.order ?? '-'}</Typography>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: isChild ? 600 : 800, fontSize: isChild ? '0.9rem' : '1rem' }}>{c.name}</Typography>
          <Chip label={c.slug} size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: `${ACCENT}1f`, color: ACCENT }} />
          {!isChild && <Chip label="ハブ" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(74,222,128,0.14)', color: '#4ade80' }} />}
          {c.active === false && <Chip label="無効" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(107,114,128,0.2)', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />}
        </Stack>
        {c.description && <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.75rem', mt: 0.25 }}>{c.description}</Typography>}
      </Box>
      {!isChild && (
        <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />} onClick={(e) => { e.stopPropagation(); openAdd(c.slug); }}
          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontSize: '0.72rem', minWidth: 0 }}>サブ追加</Button>
      )}
      <FormControlLabel onClick={(e) => e.stopPropagation()}
        control={<Switch size="small" checked={c.active !== false} onChange={() => void toggleActive(c)} />}
        label={<Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>有効</Typography>} sx={{ mr: 0 }} />
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setConfirm(c); }} sx={{ color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' }}>
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  return (
    <Box sx={{ flex: 1, height: '100%', overflowY: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%', p: { xs: 2.5, md: 4 } }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: `${ACCENT}1f`, border: `1px solid ${ACCENT}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CategoryRoundedIcon sx={{ color: ACCENT }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--brand-fg)' }}>カテゴリ管理</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openAdd()}
            sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#0ea5e9' } }}>
            カテゴリを追加
          </Button>
        </Box>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.82rem', mb: 2.5, mt: 1 }}>
          記事のカテゴリを管理。トピック追加・AIネタ提案・公開一覧のフィルタに反映されます。
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : categories.length === 0 ? (
          <Box sx={{ p: 5, borderRadius: 2, border: `1px dashed ${ACCENT}4d`, textAlign: 'center' }}>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1 }}>カテゴリがまだありません</Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.82rem', mb: 3 }}>
              まずは既定のカテゴリ（お知らせ / AI×空間設計 / 3Dモデル …）を一括作成すると便利です
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button variant="contained" startIcon={seeding ? <CircularProgress size={16} sx={{ color: '#000' }} /> : <AutoAwesomeRoundedIcon />}
                onClick={() => void seed()} disabled={seeding}
                sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', borderRadius: 2 }}>既定カテゴリを一括作成</Button>
              <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => openAdd()}
                sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', borderRadius: 2 }}>自分で追加</Button>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ borderRadius: 2, border: `1px solid ${BRAND.line}`, overflow: 'hidden' }}>
            {topLevels.map((top) => (
              <Box key={top.id}>
                {renderRow(top, false)}
                {childrenOf(top.slug).map((k) => renderRow(k, true))}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* 追加/編集 右サイドバー */}
      <Drawer anchor="right" open={dialogOpen} onClose={() => setDialogOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, bgcolor: 'var(--brand-surface)', borderLeft: `1px solid ${BRAND.line}`, color: 'var(--brand-fg)' } }}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}` }}>
          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 800, fontSize: '1.05rem' }}>{editCat ? 'カテゴリを編集' : 'カテゴリを追加'}</Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
          <Stack spacing={2.5}>
            <TextField label="カテゴリ名 *" fullWidth size="small" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例: AI × 空間設計" InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
              sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }} />
            <TextField label="スラッグ（空欄なら自動生成）" fullWidth size="small" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="例: ai-design" InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
              sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }} />
            <TextField label="説明（任意・AIネタ提案の参考にもなります）" fullWidth size="small" multiline rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
              sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }} />
            <TextField select label="親カテゴリ（サブにする場合）" fullWidth size="small" value={form.parent} onChange={(e) => setForm((f) => ({ ...f, parent: e.target.value }))}
              helperText="なし＝トップレベル（公開一覧のフィルタに出る）" InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
              FormHelperTextProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}
              sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }}>
              <MenuItem value=""><em>なし（トップレベル）</em></MenuItem>
              {topLevels.filter((t) => !editCat || t.slug !== editCat.slug).map((t) => (
                <MenuItem key={t.slug} value={t.slug}>{t.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="並び順" type="number" size="small" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
              sx={{ width: 120, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }}
              InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }} />
            <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />}
              label={<Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>有効（トピック・ネタ提案・公開フィルタに表示）</Typography>} />
            {editCat && (
              <Button onClick={() => { setDialogOpen(false); setConfirm(editCat); }} startIcon={<DeleteOutlineRoundedIcon />}
                sx={{ color: '#ef4444', textTransform: 'none', justifyContent: 'flex-start', mt: 1 }}>このカテゴリを削除</Button>
            )}
          </Stack>
        </Box>
        <Box sx={{ p: 2.5, borderTop: `1px solid ${BRAND.line}`, display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={() => void handleSave()} variant="contained" disabled={!form.name.trim()}
            sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', borderRadius: 2 }}>{editCat ? '更新' : '追加'}</Button>
        </Box>
      </Drawer>

      {/* 削除確認（簡易） */}
      <Drawer anchor="bottom" open={!!confirm} onClose={() => setConfirm(null)}
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}>
        {confirm && (
          <Box sx={{ maxWidth: 460, mx: 'auto', mb: 3, p: 2.5, bgcolor: 'var(--brand-surface)', border: `1px solid ${BRAND.line}`, borderRadius: 3 }}>
            <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 800, mb: 1 }}>カテゴリを削除</Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.88rem', mb: 2 }}>
              「{confirm.name}」を削除します。既存記事のカテゴリ表示は残ります。
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
              <Button onClick={() => setConfirm(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
              <Button onClick={() => void doDelete(confirm)} variant="contained" sx={{ bgcolor: '#ef4444', color: 'var(--brand-fg)', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>削除する</Button>
            </Box>
          </Box>
        )}
      </Drawer>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
