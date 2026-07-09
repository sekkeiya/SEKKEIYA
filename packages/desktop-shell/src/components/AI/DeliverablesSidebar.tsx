import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography, IconButton, Chip, CircularProgress } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import { listProjectAssets, type ProjectAssetItem } from '../../features/sites/projectAssetsApi';
import { useLightboxStore } from '../../store/useLightboxStore';

// 右サイドバー成果物ギャラリー（docs/19 成果物面）。
// プロジェクト範囲の成果物（レンダー/画像/図解/図面/スライド/作品集/動画）を横断表示。
// 供給源は listProjectAssets（既存の横断集約）。画像系クリックでライトボックス拡大。

interface Props {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
}

// sectionType → フィルタ表示名
const GROUPS: { key: string; label: string }[] = [
  { key: 'layout', label: 'レンダー' },
  { key: 'gallery', label: '画像' },
  { key: 'walkthrough', label: '動画' },
  { key: 'presentation', label: 'スライド' },
  { key: 'diagram', label: '図解' },
  { key: 'drawing', label: '図面' },
  { key: 'portfolio', label: '作品集' },
];

export const DeliverablesSidebar: React.FC<Props> = ({ open, onClose, projectId }) => {
  const [items, setItems] = useState<ProjectAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const refresh = useCallback(async () => {
    if (!projectId) { setItems([]); return; }
    setLoading(true);
    try {
      const list = await listProjectAssets(projectId);
      setItems(list.filter(i => i.ref.thumbnailUrl)); // サムネがあるものだけ表示
    } catch (e) {
      console.warn('[DeliverablesSidebar] load failed', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const presentGroups = useMemo(
    () => GROUPS.filter(g => items.some(i => i.sectionType === g.key)),
    [items],
  );
  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter(i => i.sectionType === filter)),
    [items, filter],
  );

  const openLightbox = (startIndex: number) => {
    const imgs = filtered.map(i => ({ url: i.ref.thumbnailUrl as string, caption: i.ref.title }));
    useLightboxStore.getState().show(imgs, startIndex);
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, maxWidth: '85%',
        bgcolor: '#141821', borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', zIndex: 30,
        boxShadow: '-8px 0 24px rgba(0,0,0,0.35)',
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 0.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Typography sx={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>成果物</Typography>
        <IconButton size="small" onClick={refresh} title="更新" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
          <RefreshRoundedIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
        <IconButton size="small" onClick={onClose} title="閉じる" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
          <CloseRoundedIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Box>

      {/* フィルタ */}
      {presentGroups.length > 0 && (
        <Box sx={{ px: 1.25, py: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Chip
            size="small" label="すべて" onClick={() => setFilter('all')}
            sx={{ height: 22, fontSize: 11, fontWeight: 700,
              color: filter === 'all' ? '#1a1f2b' : 'rgba(255,255,255,0.7)',
              bgcolor: filter === 'all' ? '#ffd740' : 'rgba(255,255,255,0.06)' }}
          />
          {presentGroups.map(g => (
            <Chip
              key={g.key} size="small" label={g.label} onClick={() => setFilter(g.key)}
              sx={{ height: 22, fontSize: 11, fontWeight: 700,
                color: filter === g.key ? '#1a1f2b' : 'rgba(255,255,255,0.7)',
                bgcolor: filter === g.key ? '#ffd740' : 'rgba(255,255,255,0.06)' }}
            />
          ))}
        </Box>
      )}

      {/* グリッド */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={22} sx={{ color: 'rgba(255,255,255,0.5)' }} /></Box>
        ) : filtered.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', pt: 4, px: 2 }}>
            {projectId ? 'まだ成果物がありません。チャットでレンダーやスライドを作ると、ここに集まります。' : 'プロジェクトを選択してください。'}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.75 }}>
            {filtered.map((it, i) => (
              <Box key={it.ref.id} sx={{ position: 'relative' }}>
                <Box
                  component="img"
                  src={it.ref.thumbnailUrl as string}
                  loading="lazy"
                  onClick={() => openLightbox(i)}
                  sx={{
                    width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 1.5,
                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', bgcolor: 'rgba(255,255,255,0.04)',
                    transition: 'transform 0.12s, border-color 0.12s',
                    '&:hover': { transform: 'scale(1.03)', borderColor: 'rgba(125,211,252,0.6)' },
                  }}
                />
                {it.ref.kind === 'video' && (
                  <PlayCircleRoundedIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,0.9)', fontSize: 28, pointerEvents: 'none' }} />
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
