import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Avatar, IconButton, Tooltip, Button,
  CircularProgress, Chip, Divider, LinearProgress, useMediaQuery,
  Menu, MenuItem, ListItemIcon, Badge,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { NotificationPanel } from '../features/teams/components/NotificationPanel';
import { useNotificationsStore } from '../store/useNotificationsStore';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import TwitterIcon from '@mui/icons-material/Twitter';
import InstagramIcon from '@mui/icons-material/Instagram';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import {
  collection, doc, getDoc, query, where, getDocs, limit, updateDoc, and, or,
  writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { BRAND } from '../styles/theme';
import { FollowListDialog } from '../features/dss/components/FollowListDialog';
import { publicUrl } from '../features/sites/publishService';
import { UserSettingsDialog } from '../components/Sidebar/UserSettingsDialog';

type ProfileTab = 'models' | 'likes' | 'saved';

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
      ? <CircularProgress size={14} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 0.5 }} />
      : <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>{value}</Typography>}
    <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{label}</Typography>
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
      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
      border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
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
        <ViewInArRoundedIcon sx={{ fontSize: 48, color: 'rgb(var(--brand-fg-rgb) / 0.15)' }} />
      </Box>
    )}

    {/* Featured star badge */}
    <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
      <Chip
        icon={<StarRoundedIcon sx={{ fontSize: '14px !important', color: 'light-dark(#aa7c03, #fbbf24) !important' }} />}
        label="Featured"
        size="small"
        sx={{ bgcolor: 'rgba(0,0,0,0.65)', color: 'light-dark(#aa7c03, #fbbf24)', fontWeight: 700, fontSize: 11, backdropFilter: 'blur(6px)' }}
      />
    </Box>

    {/* Unpin button (own profile only) */}
    {isOwn && (
      <Tooltip title="Featuredを解除">
        <IconButton
          size="small"
          onClick={() => onToggleFeatured(asset.id, false)}
          sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.55)', color: 'light-dark(#aa7c03, #fbbf24)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
        >
          <StarRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}

    <Box sx={{
      position: 'absolute', bottom: 0, left: 0, right: 0, p: 1.5, pt: 3,
      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
    }}>
      <Typography variant="body2" sx={{ color: 'var(--brand-fg)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
      border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
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
        <ViewInArRoundedIcon sx={{ fontSize: 36, color: 'rgb(var(--brand-fg-rgb) / 0.2)' }} />
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
            bgcolor: 'rgba(0,0,0,0.55)', color: 'rgb(var(--brand-fg-rgb) / 0.7)',
            opacity: 0, transition: 'opacity 0.15s',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', color: 'light-dark(#aa7c03, #fbbf24)' },
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
      <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

const CreatorProfilePage: React.FC = () => {
  const isMobile = useMediaQuery('(max-width:768px)');
  const BANNER_HEIGHT = isMobile ? 160 : 280;
  const AVATAR_SIZE = isMobile ? 76 : 96;
  const SIDE_PAD = isMobile ? 2 : 5;
  const AVATAR_LEFT = isMobile ? 16 : 40;

  const viewingCreatorId = useAppStore(s => s.viewingCreatorId);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const logout = useAuthStore((s: any) => s.logout);
  const isOwn = Boolean(viewingCreatorId && currentUser?.uid === viewingCreatorId);

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  // 通知（旧トップバーのベルをマイページへ移動）。自分のページのみ表示。
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const unreadCount = useNotificationsStore(s => s.unreadCount);
  const [activeTab, setActiveTab] = useState<ProfileTab>('models');

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [allAssets, setAllAssets] = useState<AssetItem[]>([]);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  // 公開済みアカウントサイト（users/{uid}/site/main の publish 状態）
  const [publishedSiteSlug, setPublishedSiteSlug] = useState<string | null>(null);
  // フォロー状態
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const displayName = profile?.displayName || currentUser?.displayName || 'SEKKEIYA Creator';
  const photoURL = profile?.photoURL || (isOwn ? currentUser?.photoURL : undefined);

  const featuredAssets = allAssets.filter(a => featuredIds.has(a.id));
  const regularAssets = allAssets.filter(a => !featuredIds.has(a.id));
  const skillTags = aggregateSkillTags(allAssets);
  const workStatusCfg = profile?.workStatus && profile.workStatus !== 'none'
    ? WORK_STATUS_CONFIG[profile.workStatus as Exclude<WorkStatus, 'none'>]
    : null;

  const handleBack = useCallback(() => {
    // マイページを開く前にいた画面へ戻る（不明な場合は従来どおり my-site へ）
    const returnView = useAppStore.getState().creatorProfileReturnView;
    useAppStore.getState().setCreatorProfileReturnView(null);
    setCurrentMainView((returnView as any) || 'my-site');
  }, [setCurrentMainView]);
  const handleEdit = useCallback(() => setAccountSettingsOpen(true), []);
  const handleShare = useCallback(async () => {
    setMenuAnchor(null);
    const url = `https://sekkeiya.com/creator/${viewingCreatorId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${displayName} | SEKKEIYA`, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('プロフィールのリンクをコピーしました');
      }
    } catch { /* user cancelled */ }
  }, [viewingCreatorId]);
  const handleOpenSettings = useCallback(() => {
    setMenuAnchor(null);
    setCurrentMainView('global-settings');
  }, [setCurrentMainView]);
  const handleLogout = useCallback(async () => {
    setMenuAnchor(null);
    await logout();
  }, [logout]);

  // フォロー / フォロー解除（UserProfileDialog と同じ仕組み）
  const handleToggleFollow = useCallback(async () => {
    if (!currentUser?.uid || !viewingCreatorId || currentUser.uid === viewingCreatorId) return;
    setIsFollowLoading(true);
    try {
      const batch = writeBatch(db);
      if (isFollowing) {
        batch.delete(doc(db, 'users', currentUser.uid, 'following', viewingCreatorId));
        batch.delete(doc(db, 'users', viewingCreatorId, 'followers', currentUser.uid));
        await batch.commit();
        setIsFollowing(false);
        setFollowerCount(prev => (prev !== null ? Math.max(0, prev - 1) : 0));
      } else {
        batch.set(doc(db, 'users', currentUser.uid, 'following', viewingCreatorId), { followedAt: serverTimestamp() });
        batch.set(doc(db, 'users', viewingCreatorId, 'followers', currentUser.uid), { followedAt: serverTimestamp() });
        await batch.commit();
        setIsFollowing(true);
        setFollowerCount(prev => (prev !== null ? prev + 1 : 1));
        // 相手にフォロー通知（失敗してもフォロー自体には影響させない）
        import('../features/teams/api/teamsApi').then(({ notifyFollowed }) =>
          notifyFollowed({
            targetUid: viewingCreatorId,
            fromUid: currentUser.uid,
            fromName: currentUser.displayName || currentUser.email?.split('@')[0] || 'ユーザー',
          })
        ).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to toggle follow:', e);
    } finally {
      setIsFollowLoading(false);
    }
  }, [currentUser?.uid, viewingCreatorId, isFollowing]);

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
        // my_public_models と同じクエリ形（where と or の混在は and() で包む必要がある）
        const buildQuery = (ownerField: string) => {
          if (!isOwn) {
            return query(
              collection(db, 'assets'),
              and(
                where('type', '==', '3d-model'),
                or(where('visibility', '==', 'public'), where('isPublic', '==', true)),
                where(ownerField, '==', viewingCreatorId)
              ),
              limit(100)
            );
          }
          return query(
            collection(db, 'assets'),
            where('type', '==', '3d-model'),
            where(ownerField, '==', viewingCreatorId),
            limit(100)
          );
        };

        let snap = await getDocs(buildQuery('ownerId'));
        if (snap.empty) {
          snap = await getDocs(buildQuery('authorId'));
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
        // 自分がこのユーザーをフォローしているか
        if (currentUser?.uid && currentUser.uid !== viewingCreatorId) {
          const followDoc = await getDoc(doc(db, 'users', currentUser.uid, 'following', viewingCreatorId));
          if (mounted) setIsFollowing(followDoc.exists());
        }

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

    // 公開済みアカウントサイトがあれば遷移ボタンを表示する
    const fetchPublishedSite = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', viewingCreatorId, 'site', 'main'));
        if (mounted) {
          const publish = snap.exists() ? (snap.data() as any).publish : null;
          setPublishedSiteSlug(
            publish?.status === 'published' && publish?.slug ? publish.slug : null
          );
        }
      } catch {
        // 未公開 or 読み取り不可 → ボタン非表示
        if (mounted) setPublishedSiteSlug(null);
      }
    };

    fetchProfile();
    fetchAssets();
    fetchFollowData();
    fetchPublishedSite();
    return () => { mounted = false; };
  }, [viewingCreatorId]);

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto', bgcolor: BRAND.bg, color: BRAND.text }}>

      {/* ── HERO ── */}
      <Box sx={{ position: 'relative', width: '100%' }}>
        <Box sx={{
          width: '100%', height: BANNER_HEIGHT,
          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
          backgroundImage: profile?.bannerURL ? `url(${profile.bannerURL})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative',
        }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, light-dark(rgba(15,23,42,0.02), rgba(0,0,0,0.05)) 0%, rgba(0,0,0,0.6) 100%)' }} />
          {!isOwn && (
            <IconButton onClick={handleBack} sx={{
              position: 'absolute', top: 16, left: 16,
              bgcolor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'var(--brand-fg)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
            }}>
              <ArrowBackRoundedIcon />
            </IconButton>
          )}
          {isOwn && (
            <Tooltip title="通知">
              <IconButton onClick={(e) => setNotifAnchor(e.currentTarget)} sx={{
                position: 'absolute', top: 16, right: 64,
                bgcolor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'var(--brand-fg)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
              }}>
                <Badge
                  badgeContent={unreadCount}
                  max={99}
                  sx={{ '& .MuiBadge-badge': { bgcolor: '#3498db', color: 'var(--brand-fg)', fontSize: 10, fontWeight: 700, minWidth: 16, height: 16 } }}
                >
                  <NotificationsRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          {isOwn && (
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{
              position: 'absolute', top: 16, right: 16,
              bgcolor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'var(--brand-fg)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
            }}>
              <MoreVertRoundedIcon />
            </IconButton>
          )}
        </Box>
        <Avatar src={photoURL || undefined} sx={{
          width: AVATAR_SIZE, height: AVATAR_SIZE, fontSize: '2.5rem', bgcolor: 'primary.main',
          position: 'absolute', bottom: -(AVATAR_SIZE / 2), left: AVATAR_LEFT,
          border: `4px solid ${BRAND.bg}`, boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          {displayName.charAt(0).toUpperCase()}
        </Avatar>
      </Box>

      {/* ── PROFILE INFO ── */}
      <Box sx={{ px: SIDE_PAD, pt: `${AVATAR_SIZE / 2 + 16}px`, pb: 2 }}>

        {/* Name + follow row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            {isLoadingProfile
              ? <CircularProgress size={20} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
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
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
            {/* 公開済みアカウントサイトへの遷移 */}
            {publishedSiteSlug && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<LanguageRoundedIcon />}
                onClick={() => window.open(publicUrl(publishedSiteSlug), '_blank')}
                sx={{ borderRadius: '24px', fontWeight: 700, px: 2.5, color: '#00BFFF', borderColor: 'rgba(0,191,255,0.4)', '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.08)' } }}
              >
                アカウントサイト
              </Button>
            )}
            {isOwn ? (
              <Tooltip title="アカウント設定">
                <IconButton
                  onClick={() => setAccountSettingsOpen(true)}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', borderRadius: 2, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'var(--brand-fg)' } }}
                >
                  <ManageAccountsRoundedIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                variant={isFollowing ? 'outlined' : 'contained'}
                size="small"
                onClick={handleToggleFollow}
                disabled={isFollowLoading || !currentUser?.uid}
                sx={{ borderRadius: '24px', fontWeight: 700, px: 3 }}
              >
                {isFollowLoading
                  ? <CircularProgress size={18} color="inherit" />
                  : isFollowing ? 'フォロー解除' : 'フォロー'}
              </Button>
            )}
          </Box>
        </Box>

        {/* Work Status badge */}
        {workStatusCfg && (
          <Box sx={{ mt: 2 }}>
            <Chip
              icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: workStatusCfg.dot, ml: '10px !important' }} />}
              label={workStatusCfg.label}
              size="small"
              sx={{ bgcolor: workStatusCfg.bg, color: workStatusCfg.color, fontWeight: 700, fontSize: 12, border: `1px solid color-mix(in srgb, ${workStatusCfg.color} 25%, transparent)`, px: 0.5 }}
            />
          </Box>
        )}

        {/* Bio */}
        {profile?.bio && (
          <Typography variant="body2" sx={{ mt: 2, color: 'rgb(var(--brand-fg-rgb) / 0.8)', whiteSpace: 'pre-wrap', lineHeight: 1.7, maxWidth: 640 }}>
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
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
              <Tooltip title={`メールを送る: ${profile.contactEmail}`}>
                <IconButton
                  size="small"
                  onClick={() => window.open(`mailto:${profile?.contactEmail}`, '_blank')}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', '&:hover': { color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)' } }}
                >
                  <EmailRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {profile?.socials && Object.values(profile.socials).some(Boolean) && (
            <>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <SocialButton show={profile.socials.twitter} href={profile.socials.twitter!} icon={<TwitterIcon />} color="#1DA1F2" bg="rgba(29,161,242,0.12)" label="X (Twitter)" />
                <SocialButton show={profile.socials.instagram} href={profile.socials.instagram!} icon={<InstagramIcon />} color="#E1306C" bg="rgba(225,48,108,0.12)" label="Instagram" />
                <SocialButton show={profile.socials.artstation} href={profile.socials.artstation!} icon={<BrushRoundedIcon />} color="#13AFF0" bg="rgba(19,175,240,0.12)" label="ArtStation" />
                <SocialButton show={profile.socials.github} href={profile.socials.github!} icon={<GitHubIcon />} color="var(--brand-fg)" bg="rgb(var(--brand-fg-rgb) / 0.1)" label="GitHub" />
                <SocialButton show={profile.socials.website} href={profile.socials.website!} icon={<LanguageRoundedIcon />} color="#00BFFF" bg="rgba(0,191,255,0.12)" label="Website" />
              </Box>
            </>
          )}
        </Box>

        {/* Skill tags (auto-aggregated) */}
        {!isLoadingAssets && skillTags.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 1.5 }}>
              得意ジャンル
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 360 }}>
              {skillTags.map(({ label, count }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.75)', minWidth: 100, fontWeight: 600 }}>
                    {label}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(count / skillTags[0].count) * 100}
                    sx={{
                      flex: 1, height: 6, borderRadius: 3,
                      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)',
                      '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 3 },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', minWidth: 28, textAlign: 'right' }}>
                    {count}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', mx: SIDE_PAD, my: 2 }} />

      {/* ── FEATURED SECTION (highlight strip) ── */}
      {!isLoadingAssets && featuredAssets.length > 0 && (
        <Box sx={{ px: SIDE_PAD, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <StarRoundedIcon sx={{ color: 'light-dark(#aa7c03, #fbbf24)', fontSize: 18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.9)' }}>
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

      {/* ── CONTENT TABS ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        position: 'sticky', top: 0, bgcolor: BRAND.bg, zIndex: 5,
      }}>
        {([
          { id: 'models' as ProfileTab, icon: <ViewInArRoundedIcon fontSize="small" />, label: '投稿モデル' },
          { id: 'likes' as ProfileTab, icon: <FavoriteBorderRoundedIcon fontSize="small" />, label: 'いいね' },
          { id: 'saved' as ProfileTab, icon: <BookmarkBorderRoundedIcon fontSize="small" />, label: '保存' },
        ]).filter(t => isOwn || t.id === 'models').map(tab => {
          const active = activeTab === tab.id;
          return (
            <Box
              key={tab.id}
              component="button"
              onClick={() => setActiveTab(tab.id)}
              sx={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                py: 1.5, border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                color: active ? BRAND.text : 'rgb(var(--brand-fg-rgb) / 0.45)',
                borderTop: active ? '2px solid #fff' : '2px solid transparent', mt: '-1px',
              }}
            >
              {tab.icon}
              {!isMobile && <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>{tab.label}</Typography>}
            </Box>
          );
        })}
      </Box>

      {/* ── TAB CONTENT ── */}
      <Box sx={{ px: SIDE_PAD, py: 3, pb: 8 }}>
        {activeTab === 'models' && (
          <>
            {isOwn && regularAssets.length > 0 && (
              <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
                ★ アイコンにカーソルを当てると代表作に設定できます
              </Typography>
            )}
            {isLoadingAssets ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
                <CircularProgress sx={{ color: 'primary.main' }} />
              </Box>
            ) : regularAssets.length === 0 && featuredAssets.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
                <ViewInArRoundedIcon sx={{ fontSize: 56, mb: 2, display: 'block', mx: 'auto' }} />
                <Typography variant="body1">まだモデルが投稿されていません</Typography>
              </Box>
            ) : (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: isMobile ? 0.5 : 2,
              }}>
                {regularAssets.map(asset => (
                  <ModelCard key={asset.id} asset={asset} isOwn={isOwn} onToggleFeatured={handleToggleFeatured} />
                ))}
              </Box>
            )}
          </>
        )}

        {(activeTab === 'likes' || activeTab === 'saved') && (
          <Box sx={{ textAlign: 'center', py: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
            {activeTab === 'likes'
              ? <FavoriteBorderRoundedIcon sx={{ fontSize: 56, mb: 2, display: 'block', mx: 'auto' }} />
              : <BookmarkBorderRoundedIcon sx={{ fontSize: 56, mb: 2, display: 'block', mx: 'auto' }} />}
            <Typography variant="body1">近日公開</Typography>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.25)' }}>
              {activeTab === 'likes' ? 'いいねしたモデルがここに表示されます' : '保存したモデルがここに表示されます'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Settings menu (own profile) */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface2)', color: BRAND.text, border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', minWidth: 200 } } }}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); handleEdit(); }}>
          <ListItemIcon><EditRoundedIcon fontSize="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} /></ListItemIcon>
          プロフィールを編集
        </MenuItem>
        <MenuItem onClick={handleShare}>
          <ListItemIcon><IosShareRoundedIcon fontSize="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} /></ListItemIcon>
          プロフィールを共有
        </MenuItem>
        <MenuItem onClick={handleOpenSettings}>
          <ListItemIcon><SettingsRoundedIcon fontSize="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} /></ListItemIcon>
          設定
        </MenuItem>
        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
        <MenuItem onClick={handleLogout} sx={{ color: '#ef4444' }}>
          <ListItemIcon><LogoutRoundedIcon fontSize="small" sx={{ color: '#ef4444' }} /></ListItemIcon>
          ログアウト
        </MenuItem>
      </Menu>

      {/* 通知パネル（マイページのベルにアンカー） */}
      {isOwn && (
        <NotificationPanel anchorEl={notifAnchor} onClose={() => setNotifAnchor(null)} />
      )}

      {/* Follow List Dialog */}
      {followListType && viewingCreatorId && (
        <FollowListDialog
          open={true}
          onClose={() => setFollowListType(null)}
          targetUid={viewingCreatorId}
          type={followListType}
        />
      )}

      {/* Account Settings Dialog */}
      <UserSettingsDialog open={accountSettingsOpen} onClose={() => setAccountSettingsOpen(false)} />
    </Box>
  );
};

export default CreatorProfilePage;
