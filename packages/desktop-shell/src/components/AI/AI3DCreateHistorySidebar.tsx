import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useAI3DCreateStore } from '../../store/useAI3DCreateStore';

interface Gen3DItem {
  id: string;
  name: string;
  thumb: string;
  glbUrl: string;
  createdAt: any;
}

// AI 3D Generate タブの左サイドバー（生成履歴）。コックピットの細い左スロット用にコンパクト化。
// 完成アセット（assets: type 3d_model / source ai_generated）を AI3DHistorySidebar と同じクエリ形で取得。
const AI3DCreateHistorySidebar: React.FC = () => {
  const uid = useAuthStore(s => s.currentUser?.uid);
  const setImageUrl = useAI3DCreateStore(s => s.setImageUrl);
  const setGlbUrl = useAI3DCreateStore(s => s.setGlbUrl);
  const currentGlb = useAI3DCreateStore(s => s.glbUrl);
  const [items, setItems] = useState<Gen3DItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const assetsQ = query(
      collection(db, 'assets'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
    const unsub = onSnapshot(assetsQ, (snap) => {
      const fetched: Gen3DItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data.type === '3d_model' && data.metadata?.source === 'ai_generated') {
          fetched.push({
            id: d.id,
            name: data.name || 'AI 3D',
            thumb: data.generation?.inputImageUrl || data.metadata?.originalImageUrl || data.thumbnailUrl || '',
            glbUrl: data.storageUrl || '',
            createdAt: data.createdAt,
          });
        }
      });
      setItems(fetched);
      setLoading(false);
    }, (err) => {
      console.error('[AI3DCreateHistorySidebar] assets query error:', err);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600, flexShrink: 0 }}>
        生成履歴
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, pb: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}><CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.4)' }} /></Box>
        ) : items.length === 0 ? (
          <Typography sx={{ px: 1, pt: 2, fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
            まだ生成済みの3Dがありません。画像から生成すると、ここに表示されます。
          </Typography>
        ) : (
          items.map((it) => {
            const active = currentGlb === it.glbUrl && !!it.glbUrl;
            return (
              <Box
                key={it.id}
                onClick={() => { if (it.thumb) setImageUrl(it.thumb); if (it.glbUrl) setGlbUrl(it.glbUrl); }}
                title={it.name}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, p: 0.75, mb: 0.5, borderRadius: 1, cursor: 'pointer',
                  border: `1px solid ${active ? 'rgba(52,152,219,0.6)' : 'transparent'}`,
                  bgcolor: active ? 'rgba(52,152,219,0.12)' : 'transparent',
                  '&:hover': { bgcolor: active ? 'rgba(52,152,219,0.16)' : 'rgba(255,255,255,0.06)' },
                }}
              >
                {it.thumb ? (
                  <Box component="img" src={it.thumb} alt={it.name} sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', flexShrink: 0, bgcolor: '#0d1018' }} />
                ) : (
                  <Box sx={{ width: 40, height: 40, borderRadius: 1, flexShrink: 0, bgcolor: '#0d1018', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}><ViewInArRoundedIcon sx={{ fontSize: 18 }} /></Box>
                )}
                <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</Typography>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default AI3DCreateHistorySidebar;
