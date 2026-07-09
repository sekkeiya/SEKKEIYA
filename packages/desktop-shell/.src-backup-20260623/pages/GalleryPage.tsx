import React, { useMemo } from 'react';
import { Box, Typography, TextField, InputAdornment, CircularProgress, Avatar, Stack, Chip } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import { BRAND } from '../styles/theme';
import { useAppStore } from '../store/useAppStore';
import { useGalleryFeed } from '../features/gallery/useGalleryFeed';
import { useGalleryStore } from '../features/gallery/useGalleryStore';
import { openGalleryItem } from '../features/gallery/openGalleryItem';
import { KIND_META, type GalleryItem } from '../features/gallery/galleryTypes';

const GalleryPage: React.FC = () => {
  const { kind, scope, search, setSearch } = useGalleryStore();
  const { items, loading, error } = useGalleryFeed({ kind, scope });

  const setViewingCreatorId = useAppStore(s => s.setViewingCreatorId);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);

  // テキスト検索はクライアント側フィルター（タイトル / タグ / 著者名）
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it =>
      it.title.toLowerCase().includes(q) ||
      it.tags.some(t => t.toLowerCase().includes(q)) ||
      (it.author.displayName || '').toLowerCase().includes(q));
  }, [items, search]);

  const openProfile = (authorId: string) => {
    if (!authorId || authorId === 'unknown') return;
    setViewingCreatorId(authorId);
    setCurrentMainView('creator-profile');
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.bg, color: BRAND.text }}>
      {/* ヘッダー */}
      <Box sx={{ px: { xs: 3, md: 6 }, pt: 5, pb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', letterSpacing: 1, mb: 0.5 }}>
          {kind === 'all' ? 'すべての公開作品' : KIND_META[kind].label}
        </Typography>
        <Typography sx={{ color: BRAND.sub2, fontSize: '0.9rem', mb: 3 }}>
          すべての子アプリの公開成果物を横断して探す
        </Typography>

        {/* 検索バー */}
        <TextField
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="タイトル・タグ・作者で検索…"
          sx={{ maxWidth: 560 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" sx={{ color: BRAND.sub2 }} />
              </InputAdornment>
            ),
            sx: {
              borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.04)',
              border: `1px solid ${BRAND.line}`,
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '& .MuiInputBase-input': { color: BRAND.text },
              '& .MuiInputBase-input::placeholder': { color: BRAND.sub2, opacity: 1 },
            },
          }}
        />
      </Box>

      {/* 本体 */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 3, md: 6 }, pb: 6 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress sx={{ color: '#5dade2' }} />
          </Box>
        ) : error ? (
          <Typography sx={{ color: '#f1948a', py: 6, textAlign: 'center' }}>
            読み込みに失敗しました。
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography sx={{ color: BRAND.sub2, py: 10, textAlign: 'center' }}>
            {scope === 'following'
              ? 'フォロー中のユーザーの公開成果物がありません。'
              : '公開成果物が見つかりませんでした。'}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2.5 }}>
            {filtered.map(item => (
              <GalleryCard key={item.id} item={item} onOpen={openGalleryItem} onAuthor={openProfile} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

const GalleryCard: React.FC<{
  item: GalleryItem;
  onOpen: (item: GalleryItem) => void;
  onAuthor: (authorId: string) => void;
}> = ({ item, onOpen, onAuthor }) => {
  const meta = KIND_META[item.kind];
  return (
    <Box
      onClick={() => onOpen(item)}
      sx={{
        bgcolor: BRAND.panel,
        borderRadius: 3,
        border: `1px solid ${BRAND.line}`,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
        '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(255,255,255,0.22)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
      }}
    >
      {/* サムネイル */}
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', bgcolor: '#0e131c' }}>
        {item.thumbnailUrl ? (
          <Box component="img" src={item.thumbnailUrl} alt={item.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CollectionsRoundedIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.12)' }} />
          </Box>
        )}
        <Chip
          label={meta.label}
          size="small"
          sx={{
            position: 'absolute', top: 8, left: 8, height: 22,
            bgcolor: 'rgba(11,15,22,0.72)', color: meta.color, fontWeight: 700, fontSize: 11,
            border: `1px solid ${meta.color}55`, backdropFilter: 'blur(6px)',
          }}
        />
      </Box>

      {/* メタ */}
      <Box sx={{ p: 1.5 }}>
        <Typography noWrap sx={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem', mb: 1 }}>
          {item.title}
        </Typography>
        <Stack
          direction="row" spacing={1} alignItems="center"
          onClick={(e) => { e.stopPropagation(); onAuthor(item.author.id); }}
          sx={{ cursor: 'pointer', '&:hover .author-name': { color: '#fff' } }}
        >
          <Avatar src={item.author.photoURL || undefined} sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'primary.main' }}>
            {(item.author.displayName || 'U')[0]?.toUpperCase()}
          </Avatar>
          <Typography className="author-name" noWrap sx={{ color: BRAND.sub2, fontSize: '0.78rem' }}>
            {item.author.displayName || '不明なユーザー'}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};

export default GalleryPage;
