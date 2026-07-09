import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, Typography, Box, DialogActions, Button, Avatar, CircularProgress, IconButton, Tooltip, Chip } from '@mui/material';
import TwitterIcon from '@mui/icons-material/Twitter';
import InstagramIcon from '@mui/icons-material/Instagram';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { FollowListDialog } from './FollowListDialog';
import { doc, getDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

export const UserProfileDialog: React.FC<{
  authorId?: string;
  authorName?: string;
  open: boolean;
  onClose: () => void;
}> = ({ authorId, authorName = "SEKKEIYA Creator", open, onClose }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = useAuthStore((state: any) => state.currentUser);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const setViewingCreatorId = useAppStore(s => s.setViewingCreatorId);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const isOwnerProfile = Boolean(currentUser && authorId && currentUser.uid === authorId);

  const openFullProfile = () => {
    if (!authorId) return;
    // ←ボタンで元の画面に戻れるよう、遷移前のビューを保存
    const prevView = useAppStore.getState().currentMainView;
    if (prevView !== 'creator-profile') {
      useAppStore.getState().setCreatorProfileReturnView(prevView);
    }
    setViewingCreatorId(authorId);
    setCurrentMainView('creator-profile');
    onClose();
  };

  const [isFollowing, setIsFollowing] = useState(false);
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  // Extended Profile State
  const [extendedProfile, setExtendedProfile] = useState<any>(null);

  // 公開モデル一覧（ダイアログ内スクロール表示用）
  const [publicModels, setPublicModels] = useState<any[] | null>(null);

  // Resolution of display names and photo
  let displayAuthorName = authorName;
  let displayPhotoUrl = undefined;
  
  if (isOwnerProfile && currentUser) {
    displayAuthorName = currentUser.displayName || authorName;
    displayPhotoUrl = currentUser.photoURL || undefined;
  }
  
  // Override with extended profile data if available
  if (extendedProfile) {
    if (extendedProfile.displayName) displayAuthorName = extendedProfile.displayName;
    if (extendedProfile.photoURL) displayPhotoUrl = extendedProfile.photoURL;
  }

  useEffect(() => {
    if (authorId && open) {
      let isMounted = true;
      
      const fetchExtendedProfile = async () => {
        try {
          const docRef = doc(db, 'users', authorId);
          const snap = await getDoc(docRef);
          if (snap.exists() && isMounted) {
            setExtendedProfile(snap.data());
          } else if (isMounted) {
            setExtendedProfile(null);
          }
        } catch (e) {
          console.error("Failed to fetch extended user profile:", e);
        }
      };

      const fetchCount = async () => {
        try {
          const { collection, query, where, getCountFromServer, and, or } = await import('firebase/firestore');
          
          let q1;
          if (isOwnerProfile) {
            q1 = query(collection(db, 'assets'), where('ownerId', '==', authorId));
          } else {
            q1 = query(
              collection(db, 'assets'), 
              and(
                where('ownerId', '==', authorId),
                or(where('visibility', '==', 'public'), where('isPublic', '==', true))
              )
            );
          }
          const snap1 = await getCountFromServer(q1);
          let total = snap1.data().count;

          if (total === 0) {
            let q2;
            if (isOwnerProfile) {
               q2 = query(collection(db, 'assets'), where('authorId', '==', authorId));
            } else {
               q2 = query(
                 collection(db, 'assets'), 
                 and(
                   where('authorId', '==', authorId),
                   or(where('visibility', '==', 'public'), where('isPublic', '==', true))
                 )
               );
            }
            const snap2 = await getCountFromServer(q2);
            total = snap2.data().count;
          }

          if (isMounted) setModelCount(total);
        } catch (e) {
          console.error("Failed to fetch author's model count:", e);
          if (isMounted) setModelCount(0);
        }
      };

      const fetchFollowData = async () => {
        try {
          if (currentUser && currentUser.uid !== authorId) {
            const followDoc = await getDoc(
              doc(db, 'users', currentUser.uid, 'following', authorId)
            );
            if (isMounted) setIsFollowing(followDoc.exists());
          }

          const followersSnap = await getDocs(
            collection(db, 'users', authorId, 'followers')
          );
          if (isMounted) setFollowerCount(followersSnap.size);

          const followingSnap = await getDocs(
            collection(db, 'users', authorId, 'following')
          );
          if (isMounted) setFollowingCount(followingSnap.size);
        } catch (e) {
          console.error("Failed to fetch follow data:", e);
          if (isMounted) {
            setFollowerCount(0);
            setFollowingCount(0);
          }
        }
      };

      // 公開モデル一覧を取得（my_public_models と同じクエリ形）
      const fetchPublicModels = async () => {
        try {
          const { collection, query, where, getDocs, limit, and, or } = await import('firebase/firestore');
          const buildQuery = (ownerField: string) => query(
            collection(db, 'assets'),
            and(
              where('type', '==', '3d-model'),
              or(where('visibility', '==', 'public'), where('isPublic', '==', true)),
              where(ownerField, '==', authorId)
            ),
            limit(30)
          );
          let snap = await getDocs(buildQuery('ownerId'));
          if (snap.empty) snap = await getDocs(buildQuery('authorId'));
          if (isMounted) {
            setPublicModels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        } catch (e) {
          console.error("Failed to fetch author's public models:", e);
          if (isMounted) setPublicModels([]);
        }
      };

      fetchExtendedProfile();
      fetchCount();
      fetchFollowData();
      fetchPublicModels();

      return () => { isMounted = false; };
    } else {
      setModelCount(null);
      setExtendedProfile(null);
      setPublicModels(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId, open]);

  const goToLink = (url: string) => {
    if (!url) return;
    window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
  };

  const handleToggleFollow = async () => {
    if (!currentUser || !authorId) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', currentUser.uid, 'following', authorId));
        batch.delete(doc(db, 'users', authorId, 'followers', currentUser.uid));
        await batch.commit();
        setIsFollowing(false);
        setFollowerCount(prev => prev !== null ? Math.max(0, prev - 1) : 0);
      } else {
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', currentUser.uid, 'following', authorId), {
          followedAt: serverTimestamp()
        });
        batch.set(doc(db, 'users', authorId, 'followers', currentUser.uid), {
          followedAt: serverTimestamp()
        });
        await batch.commit();
        setIsFollowing(true);
        setFollowerCount(prev => prev !== null ? prev + 1 : 1);
        // 相手にフォロー通知（失敗してもフォロー自体には影響させない）
        import('../../teams/api/teamsApi').then(({ notifyFollowed }) =>
          notifyFollowed({
            targetUid: authorId,
            fromUid: currentUser.uid,
            fromName: currentUser.displayName || currentUser.email?.split('@')[0] || 'ユーザー',
          })
        ).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to toggle follow:", e);
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1e293b',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden'
        }
      }}
    >
      {/* Banner Area */}
      <Box 
        sx={{ 
          height: '160px', 
          width: '100%', 
          bgcolor: 'rgba(255,255,255,0.05)',
          backgroundImage: extendedProfile?.bannerURL ? `url(${extendedProfile.bannerURL})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative'
        }}
      >
        {/* Avatar positioned overlapping the banner and content */}
        <Avatar 
          src={displayPhotoUrl} 
          sx={{ 
            width: 100, 
            height: 100, 
            fontSize: '3rem',
            bgcolor: 'primary.main',
            position: 'absolute',
            bottom: -50,
            left: 24,
            border: '4px solid #1e293b',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}
        >
          {displayAuthorName?.charAt(0).toUpperCase()}
        </Avatar>
      </Box>
      
      <DialogContent sx={{ mt: 5, px: 4, pb: 3, pt: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{displayAuthorName}</Typography>
            {extendedProfile?.title && (
              <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600, mt: 0.5 }}>
                {extendedProfile.title}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isOwnerProfile && (
              <Button 
                variant={isFollowing ? "outlined" : "contained"} 
                color="primary"
                onClick={handleToggleFollow}
                disabled={isFollowLoading}
                sx={{ fontWeight: 600, px: 3, borderRadius: '24px' }}
                size="small"
              >
                {isFollowLoading ? <CircularProgress size={20} color="inherit" /> : isFollowing ? "フォロー解除" : "フォロー"}
              </Button>
            )}
            <Button
              variant="outlined"
              color={isOwnerProfile ? "inherit" : "primary"}
              onClick={openFullProfile}
              sx={{ fontWeight: 600, borderRadius: '24px', opacity: isOwnerProfile ? 0.8 : 1 }}
              size="small"
            >
              {isOwnerProfile ? 'マイページを開く' : 'クリエイターページ'}
            </Button>
          </Box>
        </Box>

        {extendedProfile?.bio && (
          <Typography variant="body1" sx={{ mt: 3, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {extendedProfile.bio}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 4, mt: 4, mb: 1, p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {modelCount === null ? <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.5)' }} /> : modelCount}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>投稿モデル</Typography>
          </Box>
          <Box 
            onClick={() => setFollowListType('followers')}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 }, minWidth: 64 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {followerCount === null ? <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.5)' }} /> : followerCount}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>フォロワー</Typography>
          </Box>
          <Box 
            onClick={() => setFollowListType('following')}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 }, minWidth: 64 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {followingCount === null ? <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.5)' }} /> : followingCount}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>フォロー中</Typography>
          </Box>
        </Box>

        {/* Social Links */}
        {extendedProfile?.socials && Object.values(extendedProfile.socials).some(v => v) && (
          <Box sx={{ display: 'flex', gap: 1, mt: 3, flexWrap: 'wrap' }}>
            {extendedProfile.socials.twitter && (
              <Tooltip title="X (Twitter)">
                 <IconButton size="small" onClick={() => goToLink(extendedProfile.socials.twitter)} sx={{ color: '#1DA1F2', bgcolor: 'rgba(29, 161, 242, 0.1)' }}>
                   <TwitterIcon fontSize="small" />
                 </IconButton>
              </Tooltip>
            )}
            {extendedProfile.socials.instagram && (
              <Tooltip title="Instagram">
                 <IconButton size="small" onClick={() => goToLink(extendedProfile.socials.instagram)} sx={{ color: '#E1306C', bgcolor: 'rgba(225, 48, 108, 0.1)' }}>
                   <InstagramIcon fontSize="small" />
                 </IconButton>
              </Tooltip>
            )}
            {extendedProfile.socials.artstation && (
              <Tooltip title="ArtStation">
                 <IconButton size="small" onClick={() => goToLink(extendedProfile.socials.artstation)} sx={{ color: '#13AFF0', bgcolor: 'rgba(19, 175, 240, 0.1)' }}>
                   <BrushRoundedIcon fontSize="small" />
                 </IconButton>
              </Tooltip>
            )}
            {extendedProfile.socials.github && (
              <Tooltip title="GitHub">
                 <IconButton size="small" onClick={() => goToLink(extendedProfile.socials.github)} sx={{ color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.1)' }}>
                   <GitHubIcon fontSize="small" />
                 </IconButton>
              </Tooltip>
            )}
            {extendedProfile.socials.website && (
              <Tooltip title="Website / Portfolio">
                 <IconButton size="small" onClick={() => goToLink(extendedProfile.socials.website)} sx={{ color: 'primary.main', bgcolor: 'rgba(0, 191, 255, 0.1)' }}>
                   <LanguageRoundedIcon fontSize="small" />
                 </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

        {/* 公開モデル一覧 */}
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
              公開モデル
            </Typography>
            {publicModels !== null && (
              <Chip label={publicModels.length} size="small" sx={{ height: 18, fontSize: 11, bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }} />
            )}
          </Box>
          {publicModels === null ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.4)' }} />
            </Box>
          ) : publicModels.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', py: 2, textAlign: 'center' }}>
              まだ公開モデルがありません
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              {publicModels.map((m: any) => {
                const thumb =
                  m?.metadata?.thumbnailFilePath?.url ||
                  m?.metadata?.thumbnailUrl ||
                  m?.metadata?.thumbnail?.url ||
                  m?.thumbnailFilePath?.url ||
                  m?.thumbnailUrl ||
                  m?.thumbnail?.url ||
                  m?.imageUrl ||
                  m?.previewUrl ||
                  m?.thumbUrl ||
                  m?.coverUrl ||
                  '';
                return (
                  <Tooltip key={m.id} title={m.name || m.title || ''} arrow>
                    <Box
                      sx={{
                        aspectRatio: '1 / 1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        bgcolor: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {thumb ? (
                        <Box component="img" src={thumb} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', px: 0.5, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.name || m.title || '3D'}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          )}
        </Box>

      </DialogContent>

      {/* Follow List Dialog */}
      {followListType && authorId && (
        <FollowListDialog
          open={true}
          onClose={() => setFollowListType(null)}
          targetUid={authorId}
          type={followListType}
        />
      )}

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};
