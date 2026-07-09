import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Avatar, IconButton, Tooltip, Button,
  CircularProgress, Chip, Divider, LinearProgress,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import TwitterIcon from '@mui/icons-material/Twitter';
import InstagramIcon from '@mui/icons-material/Instagram';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import {
  collection, doc, getDoc, query, where, getDocs, orderBy, limit, updateDoc, and, or
} from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { BRAND } from '../styles/theme';
import { FollowListDialog } from '../features/dss/components/FollowListDialog';

// ─── types ──────────────────────────────────────────────────────────────────

type WorkStatus = 'available' | 'open' | 'busy' | 'none';

interface CreatorProfile {
  displayName?: string;
  photoURL?: string;
  bannerURL?: string;
  title?: string;
  bio?: string;
  workStatus?: WorkStatus;
  contactEmail?: string;
  followerCount?: number;
  followingCount?: number;
  socials?: {
    twitter?: string;
    instagram?: string;
    artstation?: string;
    github?: string;
    website?: string;
  };
}

interface AssetItem {
  id: string;
  name?: string;
  thumbnailUrl?: string;
  type?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  isFeatured?: boolean;
  createdAt?: any;
}

interface SkillTag {
  label: string;
  count: number;
}

// ─── Work status config ──────────────────────────────────────────────────────

const WORK_STATUS_CONFIG: Record<
  Exclude<WorkStatus, 'none'>,
  { label: string; color: string; bg: string; dot: string }
> = {
  available: {
    label: 'Available — フリーランス案件 歓迎',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    dot: '#22c55e',
  },
  open: {
    label: 'Open to Work — 就職・案件 探し中',
    color: '#eab308',
    bg: 'rgba(234,179,8,0.12)',
    dot: '#eab308',
  },
  busy: {
    label: 'Busy — 現在は依頼受付なし',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    dot: '#ef4444',
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatBox = ({ value, label, onClick }: { value: number | null; label: string; onClick?: () => void }) => (
  <Box 
    onClick={onClick}
    sx={{ 
      textAlign: 'center', 
      minWidth: 72, 
      cursor: onClick ? 'pointer' : 'default',
      '&:hover': onClick ? { opacity: 0.8 } : {}
    }}
  >
    {value === null
      ? <CircularProgress size={14} sx={{ color: 'rgba(255,255,255,0.4)', mb: 0.5 }} />
      : <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>{value}</Typography>}
    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{label}</Typography>
  </Box>
);

const SocialButton = ({
  show, href, icon, color, bg, label,
}: { show?: string; href: string; icon: React.ReactElement; color: string; bg: string; label: string }) => {
  if (!show) return null;
  const url = href.startsWith('http') ? href : `https://${href}`;
  return (
    <Tooltip title={label}>
      <IconButton size="small" onClick={() => window.open(url, '_blank')}
        sx={{ color, bgcolor: bg, '&:hover': { opacity: 0.85 } }}>
        {React.cloneElement(icon, { fontSize: 'small' } as any)}
      </IconButton>
    </Tooltip>
  );
};

// Featured large card
const FeaturedCard = ({
  asset, isOwn, onToggleFeatured,
}: { asset: AssetItem; isOwn: boolean; onToggleFeatured: (id: string, val: boolean) => void }) => (
  <Box
    sx={{
      position: 'relative',
      borderRadius: '14px',
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      aspectRatio: '4 / 3',
      flexShrink: 0,
      width: 280,
      transition: 'transform 0.18s, box-shadow 0.18s',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' },
    }}
  >
    {asset.thumbnailUrl ? (
      <Box component="img" src={asset.thumbnailUrl} alt={asset.name}
        sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ViewInArRoundedIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.15)' }} />
      </Box>
    )}

    {/* Featured star badge */}
    <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
      <Chip
        icon={<StarRoundedIcon sx={{ fontSize: '14px !important', color: '#fbbf24 !important' }} />}
        label="Featured"
        size="small"
        sx={{ bgcolor: 'rgba(0,0,0,0.65)', color: '#fbbf24', fontWeight: 700, fontSize: 11, backdropFilter: 'blur(6px)' }}
      />
    </Box>

    {/* Unpin button (own profile only) */}
    {isOwn && (
      <Tooltip title="Featuredを解除">
        <IconButton
          size="small"
          onClick={() => onToggleFeatured(asset.id, false)}
          sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.55)', color: '#fbbf24', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
        >
          <StarRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}

    <Box sx={{
      position: 'absolute', bottom: 0, left: 0, right: 0, p: 1.5, pt: 3,
      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
    }}>
      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {asset.name || '無題'}
      </Typography>
    </Box>
  </Box>
);

// Regular thumbnail card
const ModelCard = ({
  asset, isOwn, onToggleFeatured,
}: { asset: AssetItem; isOwn: boolean; onToggleFeatured: (id: string, val: boolean) => void }) => (
  <Box
    sx={{
      position: 'relative',
      borderRadius: '10px',
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      aspectRatio: '1 / 1',
      cursor: 'pointer',
      transition: 'transform 0.18s, box-shadow 0.18s',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
      '&:hover .pin-btn': { opacity: 1 },
    }}
  >
    {asset.thumbnailUrl ? (
      <Box component="img" src={asset.thumbnailUrl} alt={asset.name}
        sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ViewInArRoundedIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.2)' }} />
      </Box>
    )}

    {/* Pin button — own profile, hover only */}
    {isOwn && (
      <Tooltip title="Featuredに設定">
        <IconButton
          className="pin-btn"
          size="small"
          onClick={() => onToggleFeatured(asset.id, true)}
          sx={{
            position: 'absolute', top: 6, right: 6,
            bgcolor: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.7)',
            opacity: 0, transition: 'opacity 0.15s',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', color: '#fbbf24' },
          }}
        >
          <StarBorderRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}

    <Box sx={{
      position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, pt: 2,
      background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
    }}>
      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {asset.name || '無題'}
      </Typography>
    </Box>
  </Box>
);

// ─── Skill tags aggregation ──────────────────────────────────────────────────

function aggregateSkillTags(assets: AssetItem[]): SkillTag[] {
  const counts: Record<string, number> = {};
  for (const a of assets) {
    const sources: string[] = [];
    if (a.category) sources.push(a.category);
    if (Array.isArray(a.tags)) sources.push(...a.tags);
    for (const s of sources) {
      const key = s.trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));
}

// ─── Main page ───────────────────────────────────────────────────────────────

const BANNER_HEIGHT = 280;
const AVATAR_SIZE = 96;

const CreatorProfilePage: React.FC = () => {
  const viewingCreatorId = useAppStore(s => s.viewingCreatorId);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const isOwn = Boolean(viewingCreatorId && currentUser?.uid === viewingCreatorId);

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [allAssets, setAllAssets] = useState<AssetItem[]>([]);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

  const displayName = profile?.displayName || currentUser?.displayName || 'SEKKEIYA Creator';
  const photoURL = profile?.photoURL || (isOwn ? currentUser?.photoURL : undefined);

  const featuredAssets = allAssets.filter(a => featuredIds.has(a.id));
  const regularAssets = allAssets.filter(a => !featuredIds.has(a.id));
  const skillTags = aggregateSkillTags(allAssets);
  const workStatusCfg = profile?.workStatus && profile.workStatus !== 'none'
    ? WORK_STATUS_CONFIG[profile.workStatus as Exclude<WorkStatus, 'none'>]
    : null;

  const handleBack = useCallback(() => setCurrentMainView('app-hub'), [setCurrentMainView]);

  // Toggle featured on asset
  const handleToggleFeatured = useCallback(async (assetId: string, value: boolean) => {
    try {
      await updateDoc(doc(db, 'assets', assetId), { isFeatured: value });
      setFeaturedIds(prev => {
        const next = new Set(prev);
        if (value) next.add(assetId); else next.delete(assetId);
        return next;
      });
    } catch (e) {
      console.error('Failed to toggle featured:', e);
    }
  }, []);

  useEffect(() => {
    if (!viewingCreatorId) return;
    let mounted = true;

    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const snap = await getDoc(doc(db, 'users', viewingCreatorId));
        if (mounted) setProfile(snap.exists() ? (snap.data() as CreatorProfile) : null);
      } catch (e) {
        console.error('Failed to fetch creator profile:', e);
      } finally {
        if (mounted) setIsLoadingProfile(false);
      }
    };

    const fetchAssets = async () => {
      setIsLoadingAssets(true);
      try {
        let baseQueryConditions = [];
        if (!isOwn) {
          baseQueryConditions.push(
            or(where('isPublic', '==', true), where('visibility', '==', 'public'))
          );
        }

        let q = query(
          collection(db, 'assets'), 
          where('ownerId', '==', viewingCreatorId), 
          ...baseQueryConditions,
          limit(100)
        );
        let snap = await getDocs(q);
        
        if (snap.empty) {
          q = query(
            collection(db, 'assets'), 
            where('authorId', '==', viewingCreatorId), 
            ...baseQueryConditions,
            limit(100)
          );
          snap = await getDocs(q);
        }
        if (mounted) {
          let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AssetItem));
          // Show only public assets when viewing another creator's profile
          if (!isOwn) list = list.filter(a => a.isPublic !== false);
          // Sort by createdAt descending client-side
          list.sort((a, b) => {
            const ta = a.createdAt?.seconds ?? a.createdAt ?? 0;
            const tb = b.createdAt?.seconds ?? b.createdAt ?? 0;
            return tb - ta;
          });
          setAllAssets(list);
          setModelCount(list.length);
          setFeaturedIds(new Set(list.filter(a => a.isFeatured).map(a => a.id)));
        }
      } catch (e) {
        console.error('Failed to fetch creator assets:', e);
        if (mounted) { setAllAssets([]); setModelCount(0); }
      } finally {
        if (mounted) setIsLoadingAssets(false);
      }
    };

    const fetchFollowData = async () => {
      try {
        const followersSnap = await getDocs(collection(db, 'users', viewingCreatorId, 'followers'));
        if (mounted) setFollowerCount(followersSnap.size);

        const followingSnap = await getDocs(collection(db, 'users', viewingCreatorId, 'following'));
        if (mounted) setFollowingCount(followingSnap.size);
      } catch (e) {
        console.error('Failed to fetch follow data:', e);
        if (mounted) {
          setFollowerCount(0);
          setFollowingCount(0);
        }
      }
    };

    fetchProfile();
    fetchAssets();
    fetchFollowData();
    return () => { mounted = false; };
  }, [viewingCreatorId]);

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto', bgcolor: BRAND.bg, color: BRAND.text }}>

      {/* ── HERO ── */}
      <Box sx={{ position: 'relative', width: '100%' }}>
        <Box sx={{
          width: '100%', height: BANNER_HEIGHT,
          bgcolor: 'rgba(255,255,255,0.04)',
          backgroundImage: profile?.bannerURL ? `url(${profile.bannerURL})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative',
        }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.6) 100%)' }} />
          <IconButton onClick={handleBack} sx={{
            position: 'absolute', top: 16, left: 16,
            bgcolor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: '#fff',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
          }}>
            <ArrowBackRoundedIcon />
          </IconButton>
        </Box>
        <Avatar src={photoURL || undefined} sx={{
          width: AVATAR_SIZE, height: AVATAR_SIZE, fontSize: '2.5rem', bgcolor: 'primary.main',
          position: 'absolute', bottom: -(AVATAR_SIZE / 2), left: 40,
          border: `4px solid ${BRAND.bg}`, boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          {displayName.charAt(0).toUpperCase()}
        </Avatar>
      </Box>

      {/* ── PROFILE INFO ── */}
      <Box sx={{ px: 5, pt: `${AVATAR_SIZE / 2 + 16}px`, pb: 2 }}>

        {/* Name + follow row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            {isLoadingProfile
              ? <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.4)' }} />
              : <>
                  <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{displayName}</Typography>
                  {profile?.title && (
                    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600, mt: 0.5 }}>
                      {profile.title}
                    </Typography>
                  )}
                </>
            }
          </Box>
          {!isOwn && (
            <Button variant="contained" size="small" sx={{ borderRadius: '24px', fontWeight: 700, px: 3, flexShrink: 0 }}>
              フォロー
            </Button>
          )}
        </Box>

        {/* Work Status badge */}
        {workStatusCfg && (
          <Box sx={{ mt: 2 }}>
            <Chip
              icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: workStatusCfg.dot, ml: '10px !important' }} />}
              label={workStatusCfg.label}
              size="small"
              sx={{ bgcolor: workStatusCfg.bg, color: workStatusCfg.color, fontWeight: 700, fontSize: 12, border: `1px solid ${workStatusCfg.color}40`, px: 0.5 }}
            />
          </Box>
        )}

        {/* Bio */}
        {profile?.bio && (
          <Typography variant="body2" sx={{ mt: 2, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', lineHeight: 1.7, maxWidth: 640 }}>
            {profile.bio}
          </Typography>
        )}

        {/* Stats + Socials + Contact */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, mt: 3, flexWrap: 'wrap' }}>
          <StatBox value={modelCount} label="投稿モデル" />
          <StatBox value={followerCount} label="フォロワー" onClick={() => setFollowListType('followers')} />
          <StatBox value={followingCount} label="フォロー中" onClick={() => setFollowListType('following')} />

          {/* Contact email */}
          {profile?.contactEmail && (
            <>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <Tooltip title={`メールを送る: ${profile.contactEmail}`}>
                <IconButton
                  size="small"
                  onClick={() => window.open(`mailto:${profile?.contactEmail}`, '_blank')}
                  sx={{ color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.07)', '&:hover': { color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)' } }}
                >
                  <EmailRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {profile?.socials && Object.values(profile.socials).some(Boolean) && (
            <>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <SocialButton show={profile.socials.twitter} href={profile.socials.twitter!} icon={<TwitterIcon />} color="#1DA1F2" bg="rgba(29,161,242,0.12)" label="X (Twitter)" />
                <SocialButton show={profile.socials.instagram} href={profile.socials.instagram!} icon={<InstagramIcon />} color="#E1306C" bg="rgba(225,48,108,0.12)" label="Instagram" />
                <SocialButton show={profile.socials.artstation} href={profile.socials.artstation!} icon={<BrushRoundedIcon />} color="#13AFF0" bg="rgba(19,175,240,0.12)" label="ArtStation" />
                <SocialButton show={profile.socials.github} href={profile.socials.github!} icon={<GitHubIcon />} color="#fff" bg="rgba(255,255,255,0.1)" label="GitHub" />
                <SocialButton show={profile.socials.website} href={profile.socials.website!} icon={<LanguageRoundedIcon />} color="#00BFFF" bg="rgba(0,191,255,0.12)" label="Website" />
              </Box>
            </>
          )}
        </Box>

        {/* Skill tags (auto-aggregated) */}
        {!isLoadingAssets && skillTags.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 1.5 }}>
              得意ジャンル
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 360 }}>
              {skillTags.map(({ label, count }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', minWidth: 100, fontWeight: 600 }}>
                    {label}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(count / skillTags[0].count) * 100}
                    sx={{
                      flex: 1, height: 6, borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.07)',
                      '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 3 },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', minWidth: 28, textAlign: 'right' }}>
                    {count}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 5, my: 2 }} />

      {/* ── FEATURED SECTION ── */}
      {!isLoadingAssets && featuredAssets.length > 0 && (
        <Box sx={{ px: 5, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <StarRoundedIcon sx={{ color: '#fbbf24', fontSize: 18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              代表作
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
            {featuredAssets.map(asset => (
              <FeaturedCard key={asset.id} asset={asset} isOwn={isOwn} onToggleFeatured={handleToggleFeatured} />
            ))}
          </Box>
        </Box>
      )}

      {/* ── MODELS GRID ── */}
      <Box sx={{ px: 5, pb: 6 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'rgba(255,255,255,0.9)' }}>
          投稿モデル
          {modelCount !== null && (
            <Chip label={modelCount} size="small" sx={{ ml: 1.5, height: 20, fontSize: 11, bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }} />
          )}
          {isOwn && regularAssets.length > 0 && (
            <Typography component="span" variant="caption" sx={{ ml: 2, color: 'rgba(255,255,255,0.35)' }}>
              ★ アイコンにカーソルを当てると代表作に設定できます
            </Typography>
          )}
        </Typography>

        {isLoadingAssets ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress sx={{ color: 'primary.main' }} />
          </Box>
        ) : regularAssets.length === 0 && featuredAssets.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10, color: 'rgba(255,255,255,0.3)' }}>
            <ViewInArRoundedIcon sx={{ fontSize: 56, mb: 2, display: 'block', mx: 'auto' }} />
            <Typography variant="body1">まだモデルが投稿されていません</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
            {regularAssets.map(asset => (
              <ModelCard key={asset.id} asset={asset} isOwn={isOwn} onToggleFeatured={handleToggleFeatured} />
            ))}
          </Box>
        )}
      </Box>

      {/* Follow List Dialog */}
      {followListType && viewingCreatorId && (
        <FollowListDialog
          open={true}
          onClose={() => setFollowListType(null)}
          targetUid={viewingCreatorId}
          type={followListType}
        />
      )}
    </Box>
  );
};

export default CreatorProfilePage;
