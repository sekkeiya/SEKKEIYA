/**
 * FurnitureDefaultPickerDialog.tsx
 * 指定カテゴリのデフォルト家具を S.Models から選ぶピッカー。
 * LayoutRulesPanel の「デフォルト家具」タブから呼ばれる。
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, CircularProgress, Typography, TextField,
  InputAdornment, Grid,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

import { getDocs, query, collection, where, limit, or, and } from 'firebase/firestore';
import { db, auth } from '../../../../lib/firebase/client';
import type { FurnitureCategoryMeta } from '../constants/furnitureCategoryDefaults';

interface Props {
  open: boolean;
  onClose: () => void;
  category: FurnitureCategoryMeta | null;
  onSelect: (asset: { entityId: string; title: string; thumbnailUrl?: string; widthMm?: number; depthMm?: number }) => void;
}

const line = 'rgba(255,255,255,0.1)';

export function FurnitureDefaultPickerDialog({ open, onClose, category, onSelect }: Props) {
  const [assets, setAssets] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !category) return;
    setSearch('');
    setSelected(null);
    setAssets([]);
    setFiltered([]);

    const fetchAssets = async () => {
      setLoading(true);
      try {
        const uid = auth.currentUser?.uid;
        const results: any[] = [];
        const seen = new Set<string>();

        // 1. ユーザー自身の全モデルを取得（最大 200 件）
        if (uid) {
          const privateQ = query(
            collection(db, 'assets'),
            where('ownerId', '==', uid),
            where('type', '==', '3d-model'),
            limit(200)
          );
          const snap = await getDocs(privateQ);
          snap.docs.forEach(d => {
            if (!seen.has(d.id)) { results.push({ id: d.id, ...d.data() }); seen.add(d.id); }
          });
        }

        // 2. 公開モデルも補完（50件）
        const pubQ = query(
          collection(db, 'assets'),
          and(
            where('type', '==', '3d-model'),
            or(where('visibility', '==', 'public'), where('isPublic', '==', true))
          ),
          limit(50)
        );
        const pubSnap = await getDocs(pubQ);
        pubSnap.docs.forEach(d => {
          if (!seen.has(d.id)) { results.push({ id: d.id, ...d.data() }); seen.add(d.id); }
        });

        setAssets(results);
        applyFilter(results, '');
      } catch (e) {
        console.error('[FurnitureDefaultPickerDialog] fetch failed', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [open, category]);

  const applyFilter = (list: any[], q: string) => {
    if (!q.trim()) {
      setFiltered(list);
      return;
    }
    const lower = q.toLowerCase();
    setFiltered(list.filter(a =>
      (a.title || a.name || '').toLowerCase().includes(lower) ||
      (a.category || '').toLowerCase().includes(lower) ||
      (a.tags || []).some((t: string) => t.toLowerCase().includes(lower))
    ));
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    applyFilter(assets, q);
  };

  const handleConfirm = () => {
    const asset = assets.find(a => a.id === selected);
    if (!asset) return;
    const thumb = asset.thumbnailUrl || asset.metadata?.thumbnailUrl || asset.thumbUrl || asset.coverUrl || '';
    const w = asset.metadata?.dimensions?.width || asset.extendedMetadata?.dimensions?.width;
    const d = asset.metadata?.dimensions?.depth || asset.extendedMetadata?.dimensions?.depth;
    onSelect({
      entityId: asset.id,
      title: asset.title || asset.name || 'Untitled',
      thumbnailUrl: thumb || undefined,
      widthMm: w,
      depthMm: d,
    });
    onClose();
  };

  const thumb = (a: any) =>
    a.thumbnailUrl || a.metadata?.thumbnailUrl || a.thumbUrl || a.coverUrl || '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: '#16161e',
          border: `1px solid ${line}`,
          color: '#fff',
          height: '70vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${line}`, py: 1.5, px: 2.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
          デフォルト家具を選択：{category?.label}
        </Typography>
        <Typography sx={{ fontSize: 12, color: alpha('#fff', 0.4), mt: 0.25 }}>
          自動レイアウト時にこのカテゴリのプレースホルダーとして使用されます
        </Typography>
      </DialogTitle>

      <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${line}`, flexShrink: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="名前・カテゴリ・タグで検索..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 18, color: alpha('#fff', 0.4) }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#fff', fontSize: 13,
              '& fieldset': { borderColor: line },
              '&:hover fieldset': { borderColor: alpha('#fff', 0.3) },
              '&.Mui-focused fieldset': { borderColor: '#a78bfa' },
            },
          }}
        />
      </Box>

      <DialogContent sx={{ p: 2, flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={28} sx={{ color: '#a78bfa' }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography sx={{ fontSize: 13, color: alpha('#fff', 0.4) }}>
              {search ? '検索結果がありません' : 'モデルが見つかりません'}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={1.5}>
            {filtered.slice(0, 80).map(asset => {
              const isSelected = selected === asset.id;
              const t = thumb(asset);
              return (
                <Grid item xs={3} sm={2} key={asset.id}>
                  <Box
                    onClick={() => setSelected(isSelected ? null : asset.id)}
                    sx={{
                      position: 'relative',
                      borderRadius: 1.5,
                      border: `2px solid ${isSelected ? '#a78bfa' : alpha('#fff', 0.1)}`,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: alpha('#fff', 0.04),
                      transition: 'all 0.12s',
                      '&:hover': { borderColor: alpha('#a78bfa', 0.6), background: alpha('#7c3aed', 0.1) },
                      aspectRatio: '1',
                    }}
                  >
                    {t ? (
                      <Box
                        component="img"
                        src={t}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha('#fff', 0.05) }}>
                        <Typography sx={{ fontSize: 10, color: alpha('#fff', 0.3) }}>No Image</Typography>
                      </Box>
                    )}
                    {isSelected && (
                      <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
                        <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#a78bfa', filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }} />
                      </Box>
                    )}
                    <Box sx={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      px: 0.75, py: 0.5,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                    }}>
                      <Typography sx={{ fontSize: 9.5, color: '#fff', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {asset.title || asset.name || 'Untitled'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1, borderTop: `1px solid ${line}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: alpha('#fff', 0.7), '&:hover': { background: alpha('#fff', 0.06) } }}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          disabled={!selected}
          onClick={handleConfirm}
          sx={{ borderRadius: 1, fontWeight: 800, background: '#7c3aed', '&:hover': { background: '#6d28d9' }, '&.Mui-disabled': { background: alpha('#7c3aed', 0.3), color: alpha('#fff', 0.3) } }}
        >
          このモデルをデフォルトに設定
        </Button>
      </DialogActions>
    </Dialog>
  );
}
