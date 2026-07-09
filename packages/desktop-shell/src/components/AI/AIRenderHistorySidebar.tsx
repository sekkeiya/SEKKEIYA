import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useAIRenderStore } from '../../store/useAIRenderStore';

interface RenderItem {
  id: string;
  name: string;
  url: string;
  thumb: string;
  createdAt: any;
}

// AI Render タブの左サイドバー（過去のレンダー履歴）。
// assets コレクションから ai_render 由来の画像を取得（AI3DHistorySidebar と同じクエリ形＝既存インデックスで動く）。
const AIRenderHistorySidebar: React.FC = () => {
  const uid = useAuthStore(s => s.currentUser?.uid);
  const setImageUrl = useAIRenderStore(s => s.setImageUrl);
  const currentImageUrl = useAIRenderStore(s => s.imageUrl);
  const [items, setItems] = useState<RenderItem[]>([]);
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
      const fetched: RenderItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data.type === 'image' && data.metadata?.source === 'ai_render') {
          const url = data.imageUrl || data.storageUrl || data.thumbnailUrl || '';
          fetched.push({ id: d.id, name: data.name || 'AI Render', url, thumb: data.thumbnailUrl || url, createdAt: data.createdAt });
        }
      });
      setItems(fetched);
      setLoading(false);
    }, (err) => {
      console.error('[AIRenderHistorySidebar] assets query error:', err);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600, flexShrink: 0 }}>
        レンダー履歴
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, pb: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}><CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.4)' }} /></Box>
        ) : items.length === 0 ? (
          <Typography sx={{ px: 1, pt: 2, fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
            まだレンダー結果がありません。生成して「AI Drive に保存」すると、ここに表示されます。
          </Typography>
        ) : (
          items.map((it) => {
            const active = currentImageUrl === it.url;
            return (
              <Box
                key={it.id}
                onClick={() => it.url && setImageUrl(it.url)}
                title={it.name}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, p: 0.75, mb: 0.5, borderRadius: 1, cursor: 'pointer',
                  border: `1px solid ${active ? 'rgba(52,152,219,0.6)' : 'transparent'}`,
                  bgcolor: active ? 'rgba(52,152,219,0.12)' : 'transparent',
                  '&:hover': { bgcolor: active ? 'rgba(52,152,219,0.16)' : 'rgba(255,255,255,0.06)' },
                }}
              >
                <Box component="img" src={it.thumb} alt={it.name} sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', flexShrink: 0, bgcolor: '#0d1018' }} />
                <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</Typography>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default AIRenderHistorySidebar;
