import React, { useMemo, useState } from 'react';
import {
  Box, Typography, TextField, InputAdornment, CircularProgress,
  Avatar, Stack, Chip, IconButton, Divider, ToggleButtonGroup, ToggleButton, useMediaQuery,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import ViewComfyRoundedIcon from '@mui/icons-material/ViewComfyRounded';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import { BRAND } from '../styles/theme';
import { useAppStore } from '../store/useAppStore';
import { useGalleryFeed } from '../features/gallery/useGalleryFeed';
import { useGalleryStore } from '../features/gallery/useGalleryStore';
import { openGalleryItem } from '../features/gallery/openGalleryItem';
import { KIND_META, type GalleryItem, type GalleryKind } from '../features/gallery/galleryTypes';
import type { GalleryDensity } from '../features/gallery/useGalleryStore';

const KIND_APP: Record<GalleryKind, string> = {
  model:        'S.Model',
  layout:       'S.Layout',
  presentation: 'S.Present',
  furniture:    'S.Create',
  diagram:      'S.Diagram',
  image:        'S.Image',
  portfolio:    'S.Portfolio',
};

// density → grid の minmax 幅
const DENSITY_GRID: Record<GalleryDensity, string> = {
  compact: 'repeat(auto-fill, minmax(180px, 1fr))',
  default: 'repeat(auto-fill, minmax(240px, 1fr))',
  large:   'repeat(auto-fill, minmax(340px, 1fr))',
};

const GalleryPage: React.FC = () => {
  const { kind, scope, search, setSearch, selectedItem, setSelectedItem, density, setDensity } = useGalleryStore();
  const { items, loading, error } = useGalleryFeed({ kind, scope });

  const setViewingCreatorId = useAppStore(s => s.setViewingCreatorId);
  const setCurrentMainView  = useAppStore(s => s.setCurrentMainView);
  const isMobile = useMediaQuery('(max-width:768px)');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it =>
      it.title.toLowerCase().includes(q) ||
      it.tags.some(t => t.toLowerCase().includes(q)) ||
      (it.author.displayName || '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const openProfile = (authorId: string) => {
    if (!authorId || authorId === 'unknown') return;
    setViewingCreatorId(authorId);
    setCurrentMainView('creator-profile');
  };

  const handleOpen = (item: GalleryItem) => {
    setSelectedItem(null);
    openGalleryItem(item);
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.bg, color: BRAND.text }}>
      {/* ヘッダー — モバイルは Instagram 風に検索バーだけ（見出し・密度切替なし） */}
      <Box sx={{
        px: isMobile ? 1.5 : { xs: 3, md: 5 },
        pt: isMobile ? 1.5 : 4, pb: isMobile ? 1.5 : 2.5,
        borderBottom: `1px solid ${BRAND.line}`,
      }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
          {!isMobile && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: 'var(--brand-fg)', letterSpacing: 0.5, mb: 0.25 }}>
                {kind === 'all' ? 'すべての公開作品' : KIND_META[kind].label}
              </Typography>
              <Typography sx={{ color: BRAND.sub2, fontSize: '0.82rem' }}>
                すべての子アプリの公開成果物を横断して探す
              </Typography>
            </Box>
          )}

          {/* 検索 + 密度 */}
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ flex: isMobile ? 1 : 'none', width: isMobile ? '100%' : 'auto' }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isMobile ? '検索' : 'タイトル・タグ・作者で検索…'}
              size="small"
              fullWidth={isMobile}
              sx={{ width: isMobile ? '100%' : 280 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" sx={{ color: BRAND.sub2 }} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: isMobile ? 999 : 2,
                  bgcolor: isMobile ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'rgb(var(--brand-fg-rgb) / 0.04)',
                  border: `1px solid ${BRAND.line}`,
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiInputBase-input': { color: BRAND.text, ...(isMobile && { py: 0.75, fontSize: '0.85rem' }) },
                  '& .MuiInputBase-input::placeholder': { color: BRAND.sub2, opacity: 1 },
                },
              }}
            />

            {/* 密度切替（デスクトップのみ） */}
            {!isMobile && (
            <Box>
              <Typography sx={{ color: BRAND.sub2, fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.2, mb: 0.5, textAlign: 'center' }}>
                Density
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={density}
                onChange={(_e, v) => { if (v) setDensity(v); }}
                sx={{
                  '& .MuiToggleButton-root': {
                    color: BRAND.sub2, borderColor: BRAND.line, py: 0.5, px: 1.25,
                    '&.Mui-selected': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
                  },
                }}
              >
                <ToggleButton value="compact" title="Compact"><ViewComfyRoundedIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="default" title="Default"><ViewModuleRoundedIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="large"   title="Large"><SpaceDashboardRoundedIcon fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            </Box>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* グリッド + 詳細パネル */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* グリッド */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: isMobile ? 0.5 : { xs: 3, md: 4 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <CircularProgress sx={{ color: 'light-dark(#1a6393, #5dade2)' }} />
            </Box>
          ) : error ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ color: 'light-dark(#9b2013, #f1948a)', mb: 2 }}>読み込みに失敗しました。</Typography>
              <Typography
                onClick={() => window.location.reload()}
                sx={{ color: 'light-dark(#1a6393, #5dade2)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                再読み込み
              </Typography>
            </Box>
          ) : filtered.length === 0 ? (
            <Typography sx={{ color: BRAND.sub2, py: 10, textAlign: 'center' }}>
              {scope === 'following' ? 'フォロー中のユーザーの公開成果物がありません。' : '公開成果物が見つかりませんでした。'}
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : DENSITY_GRID[density], gap: isMobile ? '3px' : 2 }}>
              {filtered.map(item => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  density={density}
                  compact={isMobile}
                  onSelect={isMobile ? handleOpen : setSelectedItem}
                  onOpen={handleOpen}
                  onAuthor={openProfile}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* 詳細パネル（デスクトップのみ。モバイルはタップで直接開く） */}
        {selectedItem && !isMobile && (
          <GalleryDetailPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onOpen={handleOpen}
            onAuthor={openProfile}
          />
        )}
      </Box>
    </Box>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// GalleryCard  S.Model スタイル：ホバーで下からオーバーレイ
// ────────────────────────────────────────────────────────────────────────────
const GalleryCard: React.FC<{
  item: GalleryItem;
  selected: boolean;
  density: GalleryDensity;
  compact?: boolean;
  onSelect: (item: GalleryItem) => void;
  onOpen: (item: GalleryItem) => void;
  onAuthor: (authorId: string) => void;
}> = ({ item, selected, compact = false, onSelect, onOpen, onAuthor }) => {
  const [hovered, setHovered] = useState(false);
  const meta = KIND_META[item.kind];

  // モバイル: Instagram 風の正方形タイル（タップで直接開く・メタ/チップなし）
  if (compact) {
    return (
      <Box
        onClick={() => onSelect(item)}
        sx={{
          position: 'relative', width: '100%', aspectRatio: '1 / 1',
          bgcolor: 'var(--brand-bg)', overflow: 'hidden', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', '&:active': { opacity: 0.8 },
        }}
      >
        {/* グリッドでは静止サムネのみ（多数の WebGL コンテキスト生成によるクラッシュ回避）。
            3D の自動回転はフィード/個別表示でのみ行う。 */}
        {item.thumbnailUrl ? (
          <Box component="img" src={item.thumbnailUrl} alt={item.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CollectionsRoundedIcon sx={{ fontSize: 32, color: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      onClick={() => onSelect(item)}
      onDoubleClick={() => onOpen(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        position: 'relative',
        borderRadius: 2.5,
        overflow: 'hidden',
        cursor: 'pointer',
        border: `1px solid ${selected ? meta.color : BRAND.line}`,
        boxShadow: selected ? `0 0 0 2px color-mix(in srgb, ${meta.color} 27%, transparent)` : 'none',
        transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
        bgcolor: 'var(--brand-surface)',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: selected
            ? `0 10px 28px rgba(0,0,0,0.5), 0 0 0 2px color-mix(in srgb, ${meta.color} 27%, transparent)`
            : '0 10px 28px rgba(0,0,0,0.5)',
          borderColor: selected ? meta.color : 'rgb(var(--brand-fg-rgb) / 0.18)',
        },
      }}
    >
      {/* サムネイル */}
      <Box sx={{ width: '100%', aspectRatio: '1 / 1', bgcolor: 'var(--brand-bg)', overflow: 'hidden' }}>
        {item.thumbnailUrl ? (
          <Box
            component="img"
            src={item.thumbnailUrl}
            alt={item.title}
            sx={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.3s ease',
            }}
          />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CollectionsRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
          </Box>
        )}
      </Box>

      {/* 種別バッジ（常時・左上） */}
      <Chip
        label={meta.label}
        size="small"
        sx={{
          position: 'absolute', top: 8, left: 8, height: 20,
          bgcolor: 'rgba(11,15,22,0.78)', color: meta.color, fontWeight: 700, fontSize: 10,
          border: `1px solid color-mix(in srgb, ${meta.color} 33%, transparent)`, backdropFilter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      />

      {/* ホバーオーバーレイ（下からスライドアップ） */}
      <Box
        sx={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(6,9,14,0.97) 0%, rgba(6,9,14,0.82) 60%, transparent 100%)',
          px: 1.5, pt: 4, pb: 1.5,
          transform: hovered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Typography noWrap sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: '0.88rem', mb: 0.75 }}>
          {item.title}
        </Typography>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack
            direction="row" spacing={0.75} alignItems="center"
            onClick={(e) => { e.stopPropagation(); onAuthor(item.author.id); }}
            sx={{ cursor: 'pointer', minWidth: 0, '&:hover .author-name': { color: 'var(--brand-fg)' } }}
          >
            <Avatar src={item.author.photoURL || undefined} sx={{ width: 18, height: 18, fontSize: 9, bgcolor: 'primary.main', flexShrink: 0 }}>
              {(item.author.displayName || 'U')[0]?.toUpperCase()}
            </Avatar>
            <Typography className="author-name" noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: '0.72rem', transition: 'color 0.15s' }}>
              {item.author.displayName || '不明'}
            </Typography>
          </Stack>

          {/* アプリで開くアイコン */}
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onOpen(item); }}
            sx={{
              color: 'rgb(var(--brand-fg-rgb) / 0.5)', p: 0.5,
              '&:hover': { color: meta.color, bgcolor: `color-mix(in srgb, ${meta.color} 13%, transparent)` },
            }}
            title={`${KIND_APP[item.kind]} で開く`}
          >
            <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// GalleryDetailPanel  右スライドイン詳細パネル
// ────────────────────────────────────────────────────────────────────────────
const GalleryDetailPanel: React.FC<{
  item: GalleryItem;
  onClose: () => void;
  onOpen: (item: GalleryItem) => void;
  onAuthor: (authorId: string) => void;
}> = ({ item, onClose, onOpen, onAuthor }) => {
  const meta    = KIND_META[item.kind];
  const appName = KIND_APP[item.kind];
  const date    = new Date(item.updatedAtMs).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <Box
      sx={{
        width: 300, flexShrink: 0, height: '100%',
        bgcolor: BRAND.panel, borderLeft: `1px solid ${BRAND.line}`,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}
    >
      {/* ヘッダー行 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 2, pb: 1 }}>
        <Chip
          label={meta.label}
          size="small"
          sx={{ height: 22, bgcolor: `color-mix(in srgb, ${meta.color} 10%, transparent)`, color: meta.color, fontWeight: 700, fontSize: 11, border: `1px solid color-mix(in srgb, ${meta.color} 27%, transparent)` }}
        />
        <IconButton size="small" onClick={onClose} sx={{ color: BRAND.sub2, '&:hover': { color: 'var(--brand-fg)' } }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* サムネイル（大） */}
      <Box
        sx={{
          mx: 2, borderRadius: 2, overflow: 'hidden',
          aspectRatio: '1/1', bgcolor: 'var(--brand-bg)', mb: 2.5,
          border: `1px solid ${BRAND.line}`,
        }}
      >
        {item.thumbnailUrl ? (
          <Box component="img" src={item.thumbnailUrl} alt={item.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CollectionsRoundedIcon sx={{ fontSize: 56, color: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
          </Box>
        )}
      </Box>

      {/* タイトル */}
      <Typography sx={{ px: 2, fontWeight: 800, color: 'var(--brand-fg)', fontSize: '1.05rem', lineHeight: 1.35, mb: 2 }}>
        {item.title}
      </Typography>

      {/* 作者 */}
      <Stack
        direction="row" spacing={1.25} alignItems="center"
        onClick={() => onAuthor(item.author.id)}
        sx={{ px: 2, mb: 2.5, cursor: 'pointer', '&:hover .author-name': { color: 'var(--brand-fg)' } }}
      >
        <Avatar src={item.author.photoURL || undefined} sx={{ width: 30, height: 30, fontSize: 13, bgcolor: 'primary.main' }}>
          {(item.author.displayName || 'U')[0]?.toUpperCase()}
        </Avatar>
        <Typography className="author-name" sx={{ color: BRAND.sub2, fontSize: '0.85rem', transition: 'color 0.15s' }}>
          {item.author.displayName || '不明なユーザー'}
        </Typography>
      </Stack>

      <Divider sx={{ borderColor: BRAND.line, mx: 2, mb: 2 }} />

      {/* タグ */}
      {item.tags.length > 0 && (
        <Box sx={{ px: 2, mb: 2 }}>
          <Typography sx={{ color: BRAND.sub2, fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.3, mb: 0.75 }}>タグ</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {item.tags.map(tag => (
              <Chip key={tag} label={tag} size="small"
                sx={{ height: 20, fontSize: 11, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', color: BRAND.sub, border: `1px solid ${BRAND.line}` }} />
            ))}
          </Stack>
        </Box>
      )}

      {/* 更新日 */}
      <Box sx={{ px: 2, mb: 3 }}>
        <Typography sx={{ color: BRAND.sub2, fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.3, mb: 0.5 }}>更新日</Typography>
        <Typography sx={{ color: BRAND.sub, fontSize: '0.85rem' }}>{date}</Typography>
      </Box>

      {/* CTA */}
      <Box sx={{ px: 2, mt: 'auto', pb: 3 }}>
        <Box
          onClick={() => onOpen(item)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            py: 1.5, borderRadius: 2,
            bgcolor: meta.color,
            color: '#000',
            fontWeight: 800, fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
            '&:hover': { opacity: 0.85 },
          }}
        >
          <OpenInNewRoundedIcon fontSize="small" />
          {appName} で開く
        </Box>
      </Box>
    </Box>
  );
};

export default GalleryPage;
