import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, CircularProgress, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Plus, Rotate3d } from 'lucide-react';
import { BRAND } from '../styles/theme';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { getFieldPhotos, toggleLike, type FieldPhoto } from '../features/projects/fieldPhotosApi';
import { useGalleryFeed } from '../features/gallery/useGalleryFeed';
import type { GalleryItem } from '../features/gallery/galleryTypes';
import StoryViewer from '../components/StoryViewer';
import Model3DViewer from '../components/Model3DViewer';

interface Props {
  onCameraOpen: () => void;
  onRetry?: () => void;
}

// ────────────────────────────────────────────
// Feed card: field photo
// ────────────────────────────────────────────
const PhotoCard: React.FC<{
  photo: FieldPhoto;
  projectName: string;
  currentUserId?: string;
  onLikeToggle: (photo: FieldPhoto) => void;
}> = ({ photo, projectName, currentUserId, onLikeToggle }) => {
  const liked = currentUserId ? photo.likes.includes(currentUserId) : false;
  const elapsed = Math.floor((Date.now() - photo.createdAt) / 60000);
  const timeLabel = elapsed < 60
    ? `${elapsed}分前`
    : elapsed < 1440
    ? `${Math.floor(elapsed / 60)}時間前`
    : `${Math.floor(elapsed / 1440)}日前`;

  return (
    <Box sx={{ borderBottom: `1px solid ${BRAND.line}`, pb: 0 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: '#3498db', fontSize: 14 }}>
          {projectName[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)' }} noWrap>
            {projectName}
          </Typography>
          <Typography sx={{ fontSize: 11, color: BRAND.sub2 }}>{timeLabel}</Typography>
        </Box>
      </Box>

      {/* Photo */}
      <Box sx={{ bgcolor: 'var(--brand-bg)', width: '100%' }}>
        <img
          src={photo.storageUrl}
          alt={photo.caption}
          style={{ width: '100%', maxHeight: '75vw', objectFit: 'cover', display: 'block' }}
        />
      </Box>

      {/* Actions */}
      <Box sx={{ px: 2, pt: 1, pb: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onLikeToggle(photo)}
            sx={{ color: liked ? '#ef4444' : BRAND.sub, p: 0.5, transition: 'color 0.15s' }}
          >
            <Heart size={22} fill={liked ? '#ef4444' : 'none'} />
          </IconButton>
          <IconButton size="small" sx={{ color: BRAND.sub, p: 0.5 }}>
            <MessageCircle size={22} />
          </IconButton>
        </Box>
        {photo.likes.length > 0 && (
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)', mb: 0.25 }}>
            {photo.likes.length}件のいいね
          </Typography>
        )}
        {photo.caption && (
          <Typography sx={{ fontSize: 13, color: BRAND.text, lineHeight: 1.5 }}>
            {photo.caption}
          </Typography>
        )}
        {photo.comments.length > 0 && (
          <Typography sx={{ fontSize: 12, color: BRAND.sub2, mt: 0.5 }}>
            コメント {photo.comments.length}件
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ────────────────────────────────────────────
// Feed card: gallery item (render / model)
// ────────────────────────────────────────────
const GalleryCard: React.FC<{ item: GalleryItem; onPreview3D?: (url: string) => void }> = ({ item, onPreview3D }) => {

  const kindLabel: Record<string, string> = {
    model: '3Dモデル', layout: 'レイアウト', presentation: 'プレゼン',
    render: 'レンダリング', canvas: 'キャンバス', diagram: '図面', drawing: '図面',
    furniture: '家具',
  };

  return (
    <Box sx={{ borderBottom: `1px solid ${BRAND.line}` }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: BRAND.panel2, fontSize: 11, fontWeight: 700, color: 'light-dark(#095fa5, #90caf9)' }}>
          {item.author.id.slice(0, 2).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)' }} noWrap>
            {item.title}
          </Typography>
          <Typography sx={{ fontSize: 11, color: BRAND.sub2 }}>
            {kindLabel[item.kind] ?? item.kind}
          </Typography>
        </Box>
      </Box>

      {/* Content — 静止画。モデルは「3D」ボタンでフルスクリーンの操作可能ビューアを開く */}
      {item.thumbnailUrl ? (
        <Box sx={{ bgcolor: 'var(--brand-bg)', position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
          <img src={item.thumbnailUrl} alt={item.title}
            style={{
              // モデルのサムネは余白が多いので中央を拡大して大きく見せる。
              // transform: scale だと描画済みラスタを再拡大して画質が落ちるため、
              // 画像要素自体を拡大サイズにして元画像から直接サンプリングする（translate は中央寄せのみ）。
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: item.kind === 'model' ? '170%' : '100%',
              height: item.kind === 'model' ? '170%' : '100%',
              objectFit: 'cover', display: 'block',
            }} />
          {item.kind === 'model' && item.modelUrl && onPreview3D && (
            <Box
              component="button"
              onClick={() => onPreview3D(item.modelUrl!)}
              sx={{
                position: 'absolute', bottom: 8, right: 8,
                display: 'flex', alignItems: 'center', gap: 0.5,
                bgcolor: 'rgba(0,0,0,0.62)', color: 'var(--brand-fg)',
                borderRadius: 999, px: 1.1, py: 0.5,
                border: '1px solid rgb(var(--brand-fg-rgb) / 0.25)', cursor: 'pointer',
                backdropFilter: 'blur(4px)', WebkitTapHighlightColor: 'transparent',
                '&:active': { opacity: 0.8 },
              }}
            >
              <Rotate3d size={14} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'inherit' }}>3D</Typography>
            </Box>
          )}
        </Box>
      ) : item.kind === 'model' && item.modelUrl && onPreview3D ? (
        // サムネ無しのモデル → 3Dで開くボタンだけのプレースホルダ
        <Box
          component="button"
          onClick={() => onPreview3D(item.modelUrl!)}
          sx={{
            width: '100%', height: 120, border: 'none', cursor: 'pointer',
            bgcolor: 'var(--brand-bg)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 0.75,
            color: 'rgb(var(--brand-fg-rgb) / 0.7)', WebkitTapHighlightColor: 'transparent',
            '&:active': { opacity: 0.8 },
          }}
        >
          <Rotate3d size={26} />
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'inherit' }}>3D で見る</Typography>
        </Box>
      ) : (
        <Box sx={{ height: 56, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', display: 'flex', alignItems: 'center', px: 2 }}>
          <Typography sx={{ fontSize: 11, color: BRAND.sub2 }}>（プレビューなし）</Typography>
        </Box>
      )}

      <Box sx={{ px: 2, pt: 1, pb: 1.5 }}>
        {item.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {item.tags.slice(0, 3).map(tag => (
              <Typography key={tag} sx={{
                fontSize: 11, color: 'light-dark(#095fa5, #90caf9)',
                bgcolor: 'rgba(144,202,249,0.1)', borderRadius: 1, px: 0.75, py: 0.25,
              }}>
                #{tag}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ────────────────────────────────────────────
// Empty state
// ────────────────────────────────────────────
const EmptyFeed: React.FC<{ onCameraOpen: () => void }> = ({ onCameraOpen }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 8, gap: 2, px: 4, textAlign: 'center' }}>
    <Typography sx={{ fontSize: 40 }}>📐</Typography>
    <Typography sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: 16 }}>フィードが空です</Typography>
    <Typography sx={{ color: BRAND.sub, fontSize: 13, lineHeight: 1.7 }}>
      現場フォトを撮影したり、プロジェクトを進めると<br />ここに活動が流れてきます。
    </Typography>
    <Box
      component="button"
      onClick={onCameraOpen}
      sx={{
        mt: 1, px: 3, py: 1.5, bgcolor: '#3498db', color: 'var(--brand-fg)', border: 'none',
        borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      最初の現場フォトを撮る
    </Box>
  </Box>
);

// ────────────────────────────────────────────
// Main feed
// ────────────────────────────────────────────
const MobileFeed: React.FC<Props> = ({ onCameraOpen, onRetry }) => {
  const { projects, setActiveProjectId, setCurrentMainView } = useAppStore();
  const { currentUser } = useAuthStore();

  const [photos, setPhotos] = useState<FieldPhoto[]>([]);
  const [projectMap, setProjectMap] = useState<Record<string, string>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  // Story viewer state
  const [storyProjectId, setStoryProjectId] = useState<string | null>(null);
  const [storyProjectName, setStoryProjectName] = useState('');

  // 3D プレビュー（フルスクリーン・操作可能）。同時に開くのは 1 つだけ。
  const [preview3dUrl, setPreview3dUrl] = useState<string | null>(null);

  const { items: galleryItems, loading: galleryLoading, error: galleryError } = useGalleryFeed({ kind: 'all', scope: 'all' });

  useEffect(() => {
    if (!projects.length) { setLoadingPhotos(false); return; }
    const map: Record<string, string> = {};
    projects.forEach(p => { map[p.id] = p.name; });
    setProjectMap(map);

    Promise.all(projects.map(p => getFieldPhotos(p.id).catch(() => [] as FieldPhoto[])))
      .then(results => {
        const all = results.flat().sort((a, b) => b.createdAt - a.createdAt);
        setPhotos(all);
      })
      .finally(() => setLoadingPhotos(false));
  }, [projects]);

  const handleLikeToggle = async (photo: FieldPhoto) => {
    if (!currentUser) return;
    const liked = photo.likes.includes(currentUser.uid);
    setPhotos(prev => prev.map(p =>
      p.id !== photo.id ? p : {
        ...p,
        likes: liked
          ? p.likes.filter(id => id !== currentUser.uid)
          : [...p.likes, currentUser.uid],
      }
    ));
    await toggleLike(photo.projectId, photo.id, currentUser.uid, liked);
  };

  const isLoading = loadingPhotos || galleryLoading;
  const hasContent = photos.length > 0 || galleryItems.length > 0;

  // Merge & sort feed: photos first (most recent), then gallery items
  const feedItems: Array<{ type: 'photo'; data: FieldPhoto } | { type: 'gallery'; data: GalleryItem }> = [
    ...photos.map(p => ({ type: 'photo' as const, data: p })),
    ...galleryItems.filter(i => i.thumbnailUrl).map(i => ({ type: 'gallery' as const, data: i })),
  ].sort((a, b) => {
    const aMs = a.type === 'photo' ? a.data.createdAt : a.data.updatedAtMs;
    const bMs = b.type === 'photo' ? b.data.createdAt : b.data.updatedAtMs;
    return bMs - aMs;
  });

  return (
    <>
    {/* Right swipe → camera (like Instagram swipe-right) */}
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.35 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 80 || info.velocity.x > 300) onCameraOpen();
      }}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', touchAction: 'pan-y', overflowX: 'hidden' }}
    >
      {/* ── Stories strip ── */}
      <Box sx={{
        display: 'flex',
        gap: 2,
        px: 2,
        py: 1.5,
        overflowX: 'auto',
        flexShrink: 0,
        borderBottom: `1px solid ${BRAND.line}`,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {/* カメラ追加ボタン */}
        <Box
          onClick={onCameraOpen}
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
        >
          <Box sx={{
            width: 58, height: 58, borderRadius: '50%',
            border: '2px dashed rgb(var(--brand-fg-rgb) / 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plus size={22} style={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
          </Box>
          <Typography sx={{ fontSize: 10, color: BRAND.sub2 }}>追加</Typography>
        </Box>

        {/* プロジェクト別 Story 円 */}
        {projects.slice(0, 10).map(project => {
          const latestPhoto = photos.find(p => p.projectId === project.id);
          const hue = [...(project.name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
          const hasNew = !!latestPhoto;
          return (
            <Box
              key={project.id}
              onClick={() => {
                // Open story viewer (shows empty state if no photos)
                setStoryProjectId(project.id);
                setStoryProjectName(project.name || 'プロジェクト');
              }}
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flexShrink: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            >
              <Box sx={{
                width: 58, height: 58, borderRadius: '50%',
                padding: '2px',
                background: hasNew
                  ? 'linear-gradient(135deg, #3498db, #9b59b6)'
                  : 'rgb(var(--brand-fg-rgb) / 0.1)',
              }}>
                <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${BRAND.bg}` }}>
                  {latestPhoto ? (
                    <img src={latestPhoto.thumbnailUrl || latestPhoto.storageUrl}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <Box sx={{
                      width: '100%', height: '100%',
                      bgcolor: `hsl(${hue},45%,22%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ fontSize: 20, fontWeight: 800, color: `hsl(${hue},70%,65%)` }}>
                        {project.name?.[0]?.toUpperCase()}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
              <Typography sx={{ fontSize: 10, color: BRAND.sub2, maxWidth: 62, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.name}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* ── Feed ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pb: '80px' }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={26} sx={{ color: '#3498db' }} />
          </Box>
        )}

        {!isLoading && !hasContent && (
          galleryError ? (
            /* Error state with retry */
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 8, gap: 2, px: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 32 }}>⚠️</Typography>
              <Typography sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: 15 }}>読み込みエラー</Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: 12 }}>{galleryError}</Typography>
              <Box component="button" onClick={onRetry}
                sx={{ mt: 1, px: 3, py: 1.5, bgcolor: '#3498db', color: 'var(--brand-fg)', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                再読み込み
              </Box>
            </Box>
          ) : (
            <EmptyFeed onCameraOpen={onCameraOpen} />
          )
        )}

        {!isLoading && feedItems.map(item =>
          item.type === 'photo' ? (
            <PhotoCard
              key={`photo-${item.data.id}`}
              photo={item.data}
              projectName={projectMap[item.data.projectId] || 'プロジェクト'}
              currentUserId={currentUser?.uid}
              onLikeToggle={handleLikeToggle}
            />
          ) : (
            <GalleryCard key={`gallery-${item.data.id}`} item={item.data} onPreview3D={setPreview3dUrl} />
          )
        )}

        {/* 右スワイプのヒント（初回のみ） */}
        {!isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3, gap: 0.5, opacity: 0.4 }}>
            <Typography sx={{ fontSize: 11, color: BRAND.sub2 }}>← スワイプしてカメラを開く →</Typography>
          </Box>
        )}
      </Box>
    </motion.div>

    {/* Story Viewer — fixed overlay, renders outside the motion.div */}
    <StoryViewer
      projectId={storyProjectId}
      projectName={storyProjectName}
      open={storyProjectId !== null}
      onClose={() => setStoryProjectId(null)}
    />

    {/* 3D プレビュー（フルスクリーン・操作可能）。開いている間だけ 1 つの WebGL コンテキスト */}
    <Model3DViewer
      modelUrl={preview3dUrl}
      open={preview3dUrl !== null}
      onClose={() => setPreview3dUrl(null)}
    />
    </>
  );
};

export default MobileFeed;
