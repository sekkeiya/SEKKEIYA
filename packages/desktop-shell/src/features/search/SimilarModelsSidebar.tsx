// 索引商品の詳細モーダル右サイドバー。
// (A) この商品に視覚的に似た S.Model 3Dモデルを一覧（findSimilarModels=CLIP類似）。
// (B) 近しいモデルが無い場合に、この商品画像から3Dモデルを生成（Tripo / useBatchGenStore）。
import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import type { CatalogVisionItem } from '../dsk/catalog/catalogVisionStore';
import { findSimilarModelsBroad, type RankedModel } from '../dsl/layout/services/replaceSearch';
import { useBatchGenStore } from '../../store/useBatchGenStore';
import { useAppStore } from '../../store/useAppStore';

// 商品ID別の結果キャッシュ（←→で都度再計算/再検索しないため。セッション内）。
const resultCache = new Map<string, RankedModel[]>();

export const SimilarModelsSidebar: React.FC<{ item: CatalogVisionItem }> = ({ item }) => {
  const [models, setModels] = useState<RankedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [genBusy, setGenBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  useEffect(() => {
    let alive = true;
    const cached = resultCache.get(item.id);
    if (cached) { setModels(cached); setLoading(false); return; } // 既出商品は即表示（再検索しない）
    setLoading(true);
    setModels([]);
    findSimilarModelsBroad(item, { topN: 8 })
      .then((r) => { if (alive) { setModels(r); resultCache.set(item.id, r); } })
      .catch((e) => { console.warn('[SimilarModels] failed', e); if (alive) setModels([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [item.id, item.cropDataUrl, item.category]);

  const openModels = () => {
    const s = useAppStore.getState() as any;
    try {
      if (s.pinnedTabIds && !s.pinnedTabIds.includes('3dss')) s.togglePinnedTab?.('3dss');
      s.setActiveWorkspaceId?.('models');
      s.setLastActiveAppScope?.('3dss');
      s.setCurrentMainView?.('workspace');
    } catch (e) { console.error(e); }
  };

  const generate = async () => {
    if (genBusy) return;
    setGenBusy(true);
    try {
      const s = useAppStore.getState() as any;
      const projectId = s.activeProjectId || s.getActiveProject?.()?.id || null;
      const { batchId } = await useBatchGenStore.getState().startBatch(
        [{ id: item.id, downloadUrl: item.cropDataUrl }],
        { provider: 'tripo3d', projectId },
      );
      setToast({ msg: batchId ? '3Dモデルの生成を開始しました（進捗は生成パネルに表示）' : '生成を開始しました', sev: 'success' });
    } catch (e: any) {
      console.error('[SimilarModels] generate failed', e);
      setToast({ msg: e?.message || '生成の開始に失敗しました', sev: 'error' });
    } finally {
      setGenBusy(false);
    }
  };

  return (
    <Box sx={{ width: 300, flexShrink: 0, height: '100%', borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ViewInArRoundedIcon sx={{ fontSize: 18, color: 'light-dark(#2705a9, #c4b5fd)' }} />
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-fg)' }}>似た3Dモデル</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 4 }}>
            <CircularProgress size={18} sx={{ color: 'light-dark(#2705a9, #c4b5fd)' }} />
            <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>類似モデルを照合中…</Typography>
          </Box>
        ) : models.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {models.map((m) => (
              <Box key={m.id} onClick={openModels}
                sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', cursor: 'pointer', transition: 'border-color 0.15s', '&:hover': { borderColor: 'rgba(196,181,253,0.6)' } }}>
                <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))' }}>
                  {m.thumbUrl && <img src={m.thumbUrl} alt={m.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                  <Box sx={{ position: 'absolute', top: 4, right: 4, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(124,58,237,0.9)', fontSize: 11, fontWeight: 700, color: 'var(--brand-fg)' }}>
                    {Math.round(m.similarity * 100)}%
                  </Box>
                  {m.isLocal && (
                    <Box sx={{ position: 'absolute', top: 4, left: 4, px: 0.6, py: 0.2, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.55)', fontSize: 9.5, fontWeight: 700, color: 'light-dark(#ab8303, #fcd34d)' }}>
                      ローカル
                    </Box>
                  )}
                </Box>
                <Typography noWrap sx={{ fontSize: 11.5, px: 1, py: 0.75, color: 'rgb(var(--brand-fg-rgb) / 0.88)' }}>{m.title}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 3, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
            <Typography sx={{ fontSize: 11.5 }}>近い3Dモデルが見つかりませんでした</Typography>
            <Typography sx={{ fontSize: 10, mt: 0.5 }}>この商品画像から生成できます ↓</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ p: 2, pt: 1, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
        <Button
          fullWidth variant="contained" size="small" disabled={genBusy}
          startIcon={genBusy ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={generate}
          sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
        >
          この商品から3Dモデルを生成
        </Button>
        <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', mt: 0.75, textAlign: 'center' }}>
          画像→3D（Tripo）。月の生成上限内で実行されます。
        </Typography>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
