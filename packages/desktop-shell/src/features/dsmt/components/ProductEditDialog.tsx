import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Slider, MenuItem, ListSubheader, Select, InputAdornment,
} from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import type { DsmtProduct } from '../types';
import { MANUFACTURER_GROUPS, FIRE_RATINGS, fireScoreFromRating } from '../data/manufacturers';
import { SLibraryCatalogPicker, type CatalogPick } from './SLibraryCatalogPicker';

const ACCENT = '#ec407a';

const fieldSx = {
  '& .MuiInputBase-input': { color: '#fff' },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
} as const;

interface Props {
  open: boolean;
  /** 編集対象（新規は null）。 */
  product: DsmtProduct | null;
  onClose: () => void;
  onSave: (product: DsmtProduct) => void;
}

const emptyDraft = (): DsmtProduct => ({
  id: crypto.randomUUID(),
  manufacturer: '',
  name: '',
  priceUnit: '㎡',
  durability: 60,
  fireSafety: 60,
  source: 'manual',
});

export const ProductEditDialog: React.FC<Props> = ({ open, product, onClose, onSave }) => {
  const [draft, setDraft] = useState<DsmtProduct>(emptyDraft());
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) setDraft(product ? { ...product } : emptyDraft());
  }, [open, product]);

  const set = <K extends keyof DsmtProduct>(k: K, v: DsmtProduct[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // S.Library のカタログから商品名・URL・メーカーを取り込む（空欄のみ補完）。
  const applyCatalog = (pick: CatalogPick) => {
    setDraft((d) => ({
      ...d,
      url: pick.url || d.url,
      name: d.name?.trim() ? d.name : pick.title,
      manufacturer: d.manufacturer?.trim() ? d.manufacturer : pick.manufacturer,
      source: 's-library',
    }));
    setPickerOpen(false);
  };

  const handleFireRating = (rating: string) => {
    const score = fireScoreFromRating(rating);
    setDraft((d) => ({ ...d, fireRating: rating, fireSafety: score ?? d.fireSafety }));
  };

  const canSave = draft.manufacturer.trim() && draft.name.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#0f172a', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }}>
      <DialogTitle sx={{ pb: 1 }}>{product ? '商品を編集' : '商品を追加'}</DialogTitle>
      <DialogContent>
        <Button
          fullWidth variant="outlined" size="small" startIcon={<MenuBookRoundedIcon />}
          onClick={() => setPickerOpen(true)}
          sx={{ mt: 0.5, mb: 0.5, color: '#26a69a', borderColor: 'rgba(38,166,154,0.5)', textTransform: 'none', '&:hover': { borderColor: '#26a69a', bgcolor: 'rgba(38,166,154,0.08)' } }}
        >
          S.Library のカタログから取り込む
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>メーカー *</Typography>
            <Select
              fullWidth size="small" displayEmpty
              value={draft.manufacturer}
              onChange={(e) => set('manufacturer', e.target.value)}
              sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' } }}
            >
              <MenuItem value=""><em>選択 / 自由入力</em></MenuItem>
              {MANUFACTURER_GROUPS.flatMap((g) => [
                <ListSubheader key={g.group} sx={{ bgcolor: '#0f172a', color: ACCENT, fontSize: 11 }}>{g.group}</ListSubheader>,
                ...g.items.map((m) => <MenuItem key={m.name} value={m.name} sx={{ fontSize: 13 }}>{m.name}</MenuItem>),
              ])}
            </Select>
            <TextField
              fullWidth size="small" placeholder="一覧に無いメーカーは直接入力"
              value={draft.manufacturer}
              onChange={(e) => set('manufacturer', e.target.value)}
              sx={{ mt: 0.75, ...fieldSx }}
            />
          </Box>
        </Box>

        <TextField label="商品名 *" fullWidth size="small" value={draft.name} onChange={(e) => set('name', e.target.value)} sx={{ mt: 2, ...fieldSx }} />

        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
          <TextField label="品番" size="small" value={draft.code ?? ''} onChange={(e) => set('code', e.target.value)} sx={{ flex: 1, ...fieldSx }} />
          <TextField
            label="参考単価" size="small" type="number" value={draft.price ?? ''}
            onChange={(e) => set('price', e.target.value === '' ? undefined : Number(e.target.value))}
            InputProps={{ startAdornment: <InputAdornment position="start"><span style={{ color: 'rgba(255,255,255,0.5)' }}>¥</span></InputAdornment> }}
            sx={{ flex: 1, ...fieldSx }}
          />
          <TextField label="単位" size="small" value={draft.priceUnit ?? ''} onChange={(e) => set('priceUnit', e.target.value)} sx={{ width: 90, ...fieldSx }} />
        </Box>

        <TextField label="商品 / カタログ URL" fullWidth size="small" value={draft.url ?? ''} onChange={(e) => set('url', e.target.value)} sx={{ mt: 2, ...fieldSx }} />
        <TextField label="画像 URL" fullWidth size="small" value={draft.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value)} sx={{ mt: 2, ...fieldSx }} />

        {/* 耐久性スコア */}
        <Box sx={{ mt: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>耐久性・メンテ性</Typography>
            <Typography sx={{ fontSize: 12, color: '#fff' }}>{draft.durability ?? 0}</Typography>
          </Box>
          <Slider size="small" min={0} max={100} step={5} value={draft.durability ?? 0} onChange={(_, v) => set('durability', v as number)} sx={{ color: '#4dd0e1' }} />
        </Box>

        {/* 防火・安全 */}
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>防火・安全性能</Typography>
            <Typography sx={{ fontSize: 12, color: '#fff' }}>{draft.fireSafety ?? 0}</Typography>
          </Box>
          <Slider size="small" min={0} max={100} step={5} value={draft.fireSafety ?? 0} onChange={(_, v) => set('fireSafety', v as number)} sx={{ color: '#ff8a80' }} />
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {FIRE_RATINGS.map((r) => (
              <Box
                key={r.value}
                onClick={() => handleFireRating(r.value)}
                sx={{
                  px: 1, py: 0.25, borderRadius: 1, cursor: 'pointer', fontSize: 11,
                  bgcolor: draft.fireRating === r.value ? 'rgba(255,138,128,0.3)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${draft.fireRating === r.value ? '#ff8a80' : 'rgba(255,255,255,0.12)'}`,
                  color: '#fff',
                }}
              >
                {r.value}
              </Box>
            ))}
          </Box>
        </Box>

        <TextField label="メモ" fullWidth size="small" multiline minRows={2} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} sx={{ mt: 2, ...fieldSx }} />
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => onSave(draft)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#f06292' }, textTransform: 'none' }}>
          {product ? '更新' : '追加'}
        </Button>
      </DialogActions>

      <SLibraryCatalogPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={applyCatalog} />
    </Dialog>
  );
};
