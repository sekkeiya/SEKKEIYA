import React, { useRef, useCallback } from 'react';
import { Card, CardActionArea, Box, Typography, Chip, Avatar, Tooltip, IconButton } from '@mui/material';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import { useAppStore } from '../../store/useAppStore';

// ─── Asset thumbnail grid ─────────────────────────────────────────────────────

const CELL_COUNT = 4;

const AssetGrid: React.FC<{ thumbs: (string | null)[] }> = ({ thumbs }) => {
  const cells = Array.from({ length: CELL_COUNT }, (_, i) => thumbs[i] ?? null);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', width: '100%', height: '100%' }}>
      {cells.map((url, i) => (
        <Box key={i} sx={{ overflow: 'hidden', position: 'relative', bgcolor: 'rgba(255,255,255,0.03)' }}>
          {url ? (
            <Box
              component="img"
              src={url}
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShapeLineRoundedIcon sx={{ fontSize: 22, color: 'rgba(255,255,255,0.04)' }} />
            </Box>
          )}
          <Box sx={{ position: 'absolute', inset: 0, border: '0.5px solid rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
        </Box>
      ))}
    </Box>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

export const DssProjectCard: React.FC<{
  project: any;
  isSelected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onOwnerClick?: () => void;
  badgeColor?: string;
}> = ({ project, isSelected, onClick, onDoubleClick, onOwnerClick, badgeColor }) => {
  const title = project?.name || 'Untitled Project';

  // assetThumbs: string[] | null
  //   null  → still loading (show nothing yet)
  //   []    → loaded, no valid thumbs → fall back to coverThumbnailUrl / logoUrl
  //   [...] → show 2×2 grid
  const assetThumbs: string[] | null = project?.assetThumbs ?? null;
  const fallbackUrl: string | null = project?.coverThumbnailUrl || project?.logoUrl || null;
  const assetCount: number | null = project?.assetCount ?? null;
  const assetCountOver: boolean = project?.assetCountOver ?? false;
  const assetCountLabel = assetCount === null ? null
    : assetCount === 0 ? null
    : assetCountOver ? `${assetCount}+ models`
    : `${assetCount} ${assetCount === 1 ? 'model' : 'models'}`;

  const showGrid = assetThumbs !== null && assetThumbs.length >= 1;
  const showBanner = assetThumbs !== null && assetThumbs.length === 0 && !!fallbackUrl;
  const hasOverlay = showGrid || showBanner;

  // オーナー情報（enrich済み: ownerPhotoUrl / ownerDisplayName）
  const ownerId: string | null = project?.ownerId || null;
  const ownerLabel: string = project?.ownerDisplayName || project?.ownerName || 'Creator';
  const ownerPhotoUrl: string | null = project?.ownerPhotoUrl || null;

  const handleOwnerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ownerId) return;
    if (onOwnerClick) {
      // S.Models 内では UserProfileDialog を開く（モデル一覧と同じ UX）
      onOwnerClick();
      return;
    }
    // フォールバック: 直接マイページへ（戻り先を保存してから遷移）
    const prevView = useAppStore.getState().currentMainView;
    if (prevView !== 'creator-profile') {
      useAppStore.getState().setCreatorProfileReturnView(prevView);
    }
    useAppStore.getState().setViewingCreatorId(ownerId);
    useAppStore.getState().setCurrentMainView('creator-profile');
  }, [ownerId, onOwnerClick]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const mouseXSpring = useSpring(mouseX, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(mouseY, { stiffness: 400, damping: 30 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['6deg', '-6deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-6deg', '6deg']);
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ['100%', '0%']);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ['100%', '0%']);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 65%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handlePointerLeave = () => { mouseX.set(0); mouseY.set(0); };

  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
      if (onClick) onClick();
      clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0; }, 400);
    } else if (clickCountRef.current === 2) {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      if (onDoubleClick) onDoubleClick();
    }
  }, [onClick, onDoubleClick]);

  return (
    <Box sx={{ width: '100%', height: '100%', perspective: 1400 }}>
      <motion.div
        style={{ width: '100%', height: '100%', rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <Card
          elevation={0}
          sx={{
            position: 'relative',
            height: '100%',
            aspectRatio: '1 / 1',
            backgroundColor: '#0f172a',
            borderRadius: 3,
            border: '1px solid rgba(51,65,85,0.9)',
            boxShadow: isSelected
              ? `0 18px 30px rgba(15,23,42,0.9), 0 0 18px ${badgeColor ?? '#3b82f6'}33`
              : '0 8px 16px rgba(0,0,0,0.4)',
            borderColor: isSelected ? undefined : 'rgba(148,163,184,0.2)',
            transition: 'box-shadow 0.2s, border-color 0.2s',
            overflow: 'hidden',
            userSelect: 'none',
            '&:hover': {
              boxShadow: isSelected
                ? `0 24px 40px rgba(15,23,42,1), 0 0 24px ${badgeColor ?? '#3b82f6'}33`
                : '0 16px 32px rgba(0,0,0,0.6), 0 0 4px rgba(148,163,184,0.3)',
              borderColor: isSelected ? undefined : 'rgba(148,163,184,0.4)',
            },
            '&::after': isSelected ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              border: `3px solid ${badgeColor ?? 'rgba(59, 130, 246, 0.4)'}`,
              pointerEvents: 'none',
              zIndex: 3,
            } : undefined,
          }}
        >
          <motion.div
            style={{ position: 'absolute', inset: 0, background: glareBackground, zIndex: 4, pointerEvents: 'none', mixBlendMode: 'screen' }}
          />
          <CardActionArea
            component="div"
            onClick={handleClick}
            sx={{ position: 'relative', width: '100%', height: '100%', p: 0, display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}
          >
            {/* ── Thumbnail area ── */}
            <Box sx={{ flex: 1, width: '100%', alignSelf: 'stretch', position: 'relative', overflow: 'hidden' }}>
              {showGrid && <AssetGrid thumbs={assetThumbs!} />}
              {showBanner && (
                <Box
                  component="img"
                  src={fallbackUrl!}
                  sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                />
              )}
              {!showGrid && !showBanner && assetThumbs !== null && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShapeLineRoundedIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.05)' }} />
                </Box>
              )}
            </Box>

            {/* ── Scrim ── */}
            {hasOverlay && (
              <Box sx={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                background: showGrid
                  ? 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 35%, rgba(0,0,0,0.08) 60%, rgba(0,0,0,0.65) 100%)'
                  : 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 40%, transparent 55%, rgba(0,0,0,0.6) 100%)',
              }} />
            )}

            {/* ── Text ── */}
            <Box sx={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 2 }}>
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, fontSize: 16, textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                {title}
              </Typography>
            </Box>

            {/* ── Badges ── */}
            <Box sx={{ position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title={ownerLabel} arrow placement="top">
                <IconButton
                  size="small"
                  onClick={handleOwnerClick}
                  sx={{
                    p: 0,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    '&:hover': { transform: 'scale(1.12)', boxShadow: '0 0 10px rgba(255,255,255,0.25)' },
                  }}
                >
                  <Avatar
                    src={ownerPhotoUrl || undefined}
                    sx={{
                      width: 24,
                      height: 24,
                      fontSize: 11,
                      bgcolor: 'rgba(255,255,255,0.15)',
                      border: '1.5px solid rgba(255,255,255,0.35)',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {ownerLabel.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              {project?.isTeam && (
                <Chip
                  size="small"
                  icon={<GroupRoundedIcon sx={{ fontSize: '14px !important', color: 'rgba(255,255,255,0.7)' }} />}
                  label="Team"
                  sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#fff', fontSize: 10, height: 20, border: '1px solid rgba(59, 130, 246, 0.3)' }}
                />
              )}
              <Chip size="small" label="Project" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#ccc', fontSize: 10, height: 20 }} />
              {assetCountLabel && (
                <Chip
                  size="small"
                  label={assetCountLabel}
                  sx={{ ml: 'auto', bgcolor: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.75)', fontSize: 10, height: 20, backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              )}
            </Box>
          </CardActionArea>
        </Card>
      </motion.div>
    </Box>
  );
};
