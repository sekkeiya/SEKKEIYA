import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { RightPanelModelViewer } from './RightPanelModelViewer';
import { getDownloadUrlForModel, getCanonicalModelId } from '../utils/modelUtils';
import { WorkspaceItemRepository } from '../../workspace/WorkspaceItemRepository';
import { useAuthStore } from '../../../store/useAuthStore';

const ACCENT = '#7c4dff';

export interface SwapModelRef {
  id: string;
  title?: string;
  thumbUrl?: string | null;
  glbUrl?: string | null;
  /** 差し替え先モデル自身の寸法（mm）。配置時にこの寸法でスケールする。 */
  dimensions?: { width?: number; depth?: number; height?: number } | null;
}

function readSwapModels(model: any): SwapModelRef[] {
  const raw = model?.extendedMetadata?.swapModels;
  if (!Array.isArray(raw)) return [];
  return raw.filter((m: any) => m && m.id).map((m: any) => ({ id: m.id, title: m.title ?? '', thumbUrl: m.thumbUrl ?? null, glbUrl: m.glbUrl ?? null, dimensions: m.dimensions ?? null }));
}

const Thumb: React.FC<{ url?: string | null; selected?: boolean; onClick?: () => void; title?: string }> = ({ url, selected, onClick, title }) => (
  <Tooltip title={title || ''}>
    <Box onClick={onClick} sx={{
      width: 84, height: 84, borderRadius: 1.5, flexShrink: 0, overflow: 'hidden', cursor: 'pointer',
      bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', border: selected ? `2px solid ${ACCENT}` : '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
      boxShadow: selected ? `0 0 0 2px ${ACCENT}55` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url ? <img src={url} alt={title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <ImageRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.25)' }} />}
    </Box>
  </Tooltip>
);

interface Props {
  model: any;
  isAuthor: boolean;
  mode?: 'edit' | 'preview';
}

/**
 * 家具置き換え：同カテゴリの他モデルを「差し替え候補」として登録（作成者）。
 * 閲覧/プレビューでは候補サムネをクリックして3Dプレビューのモデルを差し替える。
 * 保存先: asset.extendedMetadata.swapModels = SwapModelRef[]。
 */
export const DssFurnitureSwap: React.FC<Props> = ({ model, isAuthor, mode = 'edit' }) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const canonicalId = useMemo(() => getCanonicalModelId(model) || model?.id, [model]);
  const selfRef: SwapModelRef = useMemo(() => ({
    id: model?.id, title: model?.title || model?.name || 'この家具', thumbUrl: model?.thumbnailUrl || model?.thumbUrl || null,
    glbUrl: getDownloadUrlForModel(model, 'glb') as string,
  }), [model]);

  const [swaps, setSwaps] = useState<SwapModelRef[]>(() => readSwapModels(model));
  const [selectedId, setSelectedId] = useState<string>(model?.id);
  const [saving, setSaving] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCands, setLoadingCands] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { setSwaps(readSwapModels(model)); setSelectedId(model?.id); }, [model?.id]);

  const options: SwapModelRef[] = useMemo(() => [selfRef, ...swaps], [selfRef, swaps]);
  const selected = options.find((o) => o.id === selectedId) || selfRef;

  const isEditing = isAuthor && mode === 'edit';

  const persist = async (next: SwapModelRef[]) => {
    if (!isAuthor || !canonicalId) return;
    setSaving(true);
    try {
      await WorkspaceItemRepository.updateGlobalAsset(canonicalId, {
        extendedMetadata: { ...(model.extendedMetadata || {}), swapModels: next.map((m) => ({ id: m.id, title: m.title || '', thumbUrl: m.thumbUrl || null, glbUrl: m.glbUrl || null, dimensions: m.dimensions || null })) },
      });
    } catch (e) { console.error('[DssFurnitureSwap] persist failed', e); }
    finally { setSaving(false); }
  };

  const addModel = (asset: any) => {
    const ref: SwapModelRef = {
      id: asset.id, title: asset.title || asset.name || '', thumbUrl: asset.thumbnailUrl || asset.thumbUrl || null,
      glbUrl: (asset.glbUrl || asset.downloadUrl || null),
      dimensions: asset.dimensions || asset.dimensionsMm || null,
    };
    if (swaps.some((s) => s.id === ref.id) || ref.id === model?.id) return;
    const next = [...swaps, ref];
    setSwaps(next); persist(next);
  };
  const removeModel = (id: string) => { const next = swaps.filter((s) => s.id !== id); setSwaps(next); persist(next); if (selectedId === id) setSelectedId(model?.id); };

  // 同カテゴリ候補を取得（公開モデル＋自分の非公開）
  const openPicker = async () => {
    setPickerOpen(true); setLoadingCands(true);
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      const assetsRef = collection(db, 'assets');
      const snaps = await getDocs(query(assetsRef, where('type', '==', '3d-model'), where('visibility', '==', 'public')));
      let items = snaps.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      if (currentUser?.uid) {
        const own = await getDocs(query(assetsRef, where('type', '==', '3d-model'), where('ownerId', '==', currentUser.uid)));
        const map = new Map<string, any>();
        [...items, ...own.docs.map((d) => ({ id: d.id, ...d.data() } as any))].forEach((it) => map.set(it.id, it));
        items = Array.from(map.values());
      }
      // 同カテゴリ（mainCategory 優先、無ければ macroCategory）でフィルタ。自分自身・登録済みは除外。
      const cat = model?.mainCategory || model?.macroCategory;
      const filtered = items.filter((it) => it.id !== model?.id && !swaps.some((s) => s.id === it.id)
        && (!cat || it.mainCategory === cat || it.macroCategory === cat || it.subCategory === model?.subCategory));
      setCandidates(filtered);
    } catch (e) { console.error('[DssFurnitureSwap] fetch candidates failed', e); setCandidates([]); }
    finally { setLoadingCands(false); }
  };

  const shownCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => (c.title || c.name || '').toLowerCase().includes(q));
  }, [candidates, search]);

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 2 }}>
      {/* プレビュー */}
      <Box sx={{ flex: '1 1 320px', minWidth: 280, height: 340, bgcolor: 'var(--brand-bg)', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', overflow: 'hidden' }}>
        {selected.glbUrl ? (
          <RightPanelModelViewer modelUrl={selected.glbUrl} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.4)', gap: 1 }}>
            <ImageRoundedIcon /><Typography sx={{ fontSize: 12 }}>3Dプレビューを表示できません</Typography>
          </Box>
        )}
      </Box>

      {/* 右ペイン */}
      <Box sx={{ flex: '1 1 320px', minWidth: 300 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-fg)', flex: 1 }}>
            {isEditing ? '家具置き換え（候補を登録）' : '家具を切り替え'}
          </Typography>
          {saving && <CircularProgress size={14} sx={{ color: ACCENT }} />}
        </Box>

        <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1 }}>
          {isEditing ? '同カテゴリの他モデルを登録すると、閲覧者がサムネをクリックして家具を差し替えられます。' : 'サムネをクリックすると家具が差し替わります。'}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {options.map((o) => (
            <Box key={o.id} sx={{ position: 'relative', width: 84 }}>
              <Thumb url={o.thumbUrl} selected={selectedId === o.id} onClick={() => setSelectedId(o.id)} title={o.title} />
              {o.id === model?.id && (
                <Typography sx={{ position: 'absolute', bottom: 2, left: 4, fontSize: 9, color: 'var(--brand-fg)', fontWeight: 700, textShadow: '0 1px 2px #000' }}>元</Typography>
              )}
              {isEditing && o.id !== model?.id && (
                <IconButton size="small" onClick={() => removeModel(o.id)}
                  sx={{ position: 'absolute', top: -6, right: -6, p: 0.2, bgcolor: 'rgba(0,0,0,0.7)', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#ef5350' } }}>
                  <CloseRoundedIcon sx={{ fontSize: 13 }} />
                </IconButton>
              )}
            </Box>
          ))}
          {isEditing && (
            <Box onClick={openPicker} sx={{ width: 84, height: 84, borderRadius: 1.5, border: `1px dashed ${ACCENT}88`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: ACCENT, '&:hover': { bgcolor: `${ACCENT}14` } }}>
              <AddRoundedIcon sx={{ fontSize: 20 }} />
              <Typography sx={{ fontSize: 10 }}>追加</Typography>
            </Box>
          )}
        </Box>
        {!isEditing && options.length <= 1 && (
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontStyle: 'italic', mt: 1 }}>置き換え候補は未設定です。</Typography>
        )}
      </Box>

      {/* 候補ピッカー */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)' } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 900 }}>置き換え候補を選ぶ（同カテゴリ）</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" placeholder="モデル名で検索" value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 1.5, '& .MuiInputBase-root': { color: 'var(--brand-fg)', bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }} />
          {loadingCands ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
          ) : shownCandidates.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', py: 2 }}>同カテゴリの候補が見つかりません。</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {shownCandidates.map((c) => {
                const added = swaps.some((s) => s.id === c.id);
                return (
                  <Box key={c.id} sx={{ width: 96, textAlign: 'center' }}>
                    <Box sx={{ position: 'relative' }}>
                      <Thumb url={c.thumbnailUrl || c.thumbUrl} title={c.title || c.name} onClick={() => !added && addModel(c)} />
                      {added && (
                        <Box sx={{ position: 'absolute', inset: 0, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckRoundedIcon sx={{ color: '#66bb6a' }} />
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.7)', mt: 0.5 }} noWrap>{c.title || c.name || '—'}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPickerOpen(false)} sx={{ textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
