import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, Typography, Box, CircularProgress, Avatar, Button, IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { collection, getDocs, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { UserProfileDialog } from './UserProfileDialog';
import { UserSearchDialog } from '../../social/UserSearchDialog';
import { notifyFollowed } from '../../teams/api/teamsApi';

export interface FollowUserItem {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  isFollowingByMe: boolean; // For current user
}

export const FollowListDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  targetUid: string;
  type: 'followers' | 'following';
  onUserClick?: (uid: string, name: string) => void;
}> = ({ open, onClose, targetUid, type, onUserClick }) => {
  const currentUser = useAuthStore((state: any) => state.currentUser);
  const [users, setUsers] = useState<FollowUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingActionUid, setLoadingActionUid] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{uid: string, name: string} | null>(null);
  const [userSearchOpen, setUserSearchOpen] = useState(false);

  useEffect(() => {
    if (open && targetUid) {
      let isMounted = true;
      const fetchUsers = async () => {
        setIsLoading(true);
        try {
          // 1. Get UIDs
          const snap = await getDocs(collection(db, 'users', targetUid, type));
          const uids = snap.docs.map(d => d.id);

          if (uids.length === 0) {
            if (isMounted) setUsers([]);
            return;
          }

          // 2. Fetch User profiles
          const userPromises = uids.map(uid => getDoc(doc(db, 'users', uid)));
          const userSnaps = await Promise.all(userPromises);

          // 3. Check follow status (only if logged in)
          // To scale, we can map what we already follow, but for MVP we will fetch individually.
          // In a real app we might cache this or batch it.
          const followPromises = currentUser 
             ? uids.map(uid => getDoc(doc(db, 'users', currentUser.uid, 'following', uid)))
             : [];
          
          const followSnaps = currentUser ? await Promise.all(followPromises) : [];
          
          const items: FollowUserItem[] = [];
          for (let i = 0; i < uids.length; i++) {
             const uSnap = userSnaps[i];
             const uid = uids[i];
             if (uSnap.exists()) {
               const data = uSnap.data();
               const isFollowing = currentUser ? followSnaps[i].exists() : false;
               
               items.push({
                 uid,
                 displayName: data.displayName || '名無しユーザー',
                 photoURL: data.photoURL || '',
                 bio: data.bio || '',
                 isFollowingByMe: isFollowing
               });
             }
          }
          if (isMounted) setUsers(items);

        } catch (e) {
          console.error("Failed to fetch follow list:", e);
          if (isMounted) setUsers([]);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      };

      fetchUsers();
      return () => { isMounted = false; };
    } else {
      setUsers([]);
    }
  }, [open, targetUid, type, currentUser]);

  const handleToggleFollow = async (item: FollowUserItem) => {
    if (!currentUser) return;
    setLoadingActionUid(item.uid);
    try {
      const batch = writeBatch(db);
      if (item.isFollowingByMe) {
        batch.delete(doc(db, 'users', currentUser.uid, 'following', item.uid));
        batch.delete(doc(db, 'users', item.uid, 'followers', currentUser.uid));
        await batch.commit();
        setUsers(prev => prev.map(u => u.uid === item.uid ? { ...u, isFollowingByMe: false } : u));
      } else {
        batch.set(doc(db, 'users', currentUser.uid, 'following', item.uid), { followedAt: serverTimestamp() });
        batch.set(doc(db, 'users', item.uid, 'followers', currentUser.uid), { followedAt: serverTimestamp() });
        await batch.commit();
        setUsers(prev => prev.map(u => u.uid === item.uid ? { ...u, isFollowingByMe: true } : u));
        // 相手にフォロー通知（失敗してもフォロー自体には影響させない）
        notifyFollowed({
          targetUid: item.uid,
          fromUid: currentUser.uid,
          fromName: currentUser.displayName || currentUser.email?.split('@')[0] || 'ユーザー',
        }).catch(() => {});
      }
    } catch (e) {
      console.error("Toggle follow failed:", e);
    } finally {
      setLoadingActionUid(null);
    }
  };

  const title = type === 'followers' ? `フォロワー` : `フォロー中`;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--brand-surface2)',
          backgroundImage: 'none',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
          borderRadius: '16px',
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
          {title} {users.length > 0 && `(${users.length})`}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button
            size="small"
            startIcon={<SearchRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setUserSearchOpen(true)}
            sx={{
              textTransform: 'none', fontSize: '0.78rem', fontWeight: 600, borderRadius: '20px', px: 1.5,
              color: 'rgb(var(--brand-fg-rgb) / 0.7)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
              '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
            }}
          >
            ユーザーを検索
          </Button>
          <IconButton onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0, minHeight: 120 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 4 }}>
            <CircularProgress sx={{ color: 'primary.main' }} />
          </Box>
        ) : users.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>ユーザーがいません</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {users.map(u => (
              <Box 
                key={u.uid} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  p: 2, 
                  borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)' }
                }}
              >
                <Box 
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 1, minWidth: 0 }}
                  onClick={() => {
                    setSelectedUser({ uid: u.uid, name: u.displayName });
                    if (onUserClick) onUserClick(u.uid, u.displayName);
                  }}
                >
                  <Avatar src={u.photoURL} sx={{ width: 44, height: 44, bgcolor: 'primary.main' }}>
                    {u.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, pr: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', alignItems: 'center', display: 'flex', gap: 1 }}>
                      {u.displayName}
                    </Typography>
                    {u.bio && (
                      <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.bio}
                      </Typography>
                    )}
                  </Box>
                </Box>
                
                {currentUser && currentUser.uid !== u.uid && (
                   <Button
                     variant={u.isFollowingByMe ? "outlined" : "contained"}
                     color="primary"
                     size="small"
                     disabled={loadingActionUid === u.uid}
                     onClick={() => handleToggleFollow(u)}
                     sx={{ borderRadius: '20px', fontWeight: 600, minWidth: 100, flexShrink: 0 }}
                   >
                     {loadingActionUid === u.uid ? <CircularProgress size={16} color="inherit" /> : u.isFollowingByMe ? "フォロー解除" : "フォロー"}
                   </Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      {selectedUser && (
        <UserProfileDialog
          authorId={selectedUser.uid}
          authorName={selectedUser.name}
          open={true}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* ユーザー検索（フォロー画面からの自然な導線） */}
      <UserSearchDialog open={userSearchOpen} onClose={() => setUserSearchOpen(false)} />
    </Dialog>
  );
};
