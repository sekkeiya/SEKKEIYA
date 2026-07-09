// SEKKEIYA ユーザー検索ダイアログ。
// MiniSidebar の虫眼鏡ボタンから開く。displayName の前方一致で検索し、
// フォロー / DM開始 / プロフィール表示 ができる。

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogContent, Box, Typography, TextField, IconButton, Avatar,
  Button, CircularProgress, InputAdornment, Tooltip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';

import {
  collection, doc, getDoc, getDocs, query, orderBy, startAt, endAt, limit,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useTeamChatStore } from '../team-chat/store/useTeamChatStore';
import { ensureDmChat } from '../team-chat/api/teamChatApi';
import { notifyFollowed } from '../teams/api/teamsApi';
import { BRAND } from '../../styles/theme';

interface UserSearchResult {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
}

export const UserSearchDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [candidates, setCandidates] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myUid = currentUser?.uid ?? null;
  const myName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'ユーザー';

  // ── 初期候補：フォロー中ユーザーを表示 ──
  useEffect(() => {
    if (!open || !myUid) return;
    let alive = true;
    setCandidatesLoading(true);
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', myUid, 'following'));
        const uids = snap.docs.map(d => d.id).slice(0, 20);
        if (!uids.length || !alive) { setCandidates([]); return; }
        const profiles = await Promise.all(uids.map(uid =>
          getDoc(doc(db, 'users', uid)).then(s => {
            if (!s.exists()) return null;
            const d = s.data() as any;
            return { uid, displayName: d.displayName ?? '', photoURL: d.photoURL ?? '', bio: d.bio ?? '' } as UserSearchResult;
          }).catch(() => null)
        ));
        if (!alive) return;
        const valid = profiles.filter((p): p is UserSearchResult => p !== null && !!p.displayName);
        setCandidates(valid);
        // フォロー状態を初期化（全員フォロー中）
        setFollowingMap(prev => ({ ...prev, ...Object.fromEntries(valid.map(u => [u.uid, true])) }));
      } catch {
        if (alive) setCandidates([]);
      } finally {
        if (alive) setCandidatesLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, myUid]);

  // ── 検索（displayName 前方一致・デバウンス 350ms） ──
  const runSearch = useCallback(async (q: string) => {
    const keyword = q.trim();
    if (!keyword) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'users'),
        orderBy('displayName'),
        startAt(keyword),
        endAt(keyword + '\uf8ff'),
        limit(20),
      ));
      const users: UserSearchResult[] = snap.docs
        .map(d => {
          const data = d.data() as any;
          return {
            uid: d.id,
            displayName: data.displayName ?? '',
            photoURL: data.photoURL ?? '',
            bio: data.bio ?? '',
          };
        })
        .filter(u => u.displayName && u.uid !== myUid);
      setResults(users);
      setSearched(true);

      // 各結果のフォロー状態を取得
      if (myUid && users.length) {
        const states = await Promise.all(users.map(u =>
          getDoc(doc(db, 'users', myUid, 'following', u.uid))
            .then(s => [u.uid, s.exists()] as const)
            .catch(() => [u.uid, false] as const)
        ));
        setFollowingMap(prev => ({ ...prev, ...Object.fromEntries(states) }));
      }
    } catch (e) {
      console.error('[user-search]', e);
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [myUid]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(queryText), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [queryText, open, runSearch]);

  // ダイアログを閉じたら状態リセット
  useEffect(() => {
    if (!open) { setQueryText(''); setResults([]); setSearched(false); }
  }, [open]);

  // ── フォロー / 解除 ──
  const toggleFollow = async (target: UserSearchResult) => {
    if (!myUid || followBusy) return;
    setFollowBusy(target.uid);
    const isFollowing = !!followingMap[target.uid];
    try {
      const batch = writeBatch(db);
      if (isFollowing) {
        batch.delete(doc(db, 'users', myUid, 'following', target.uid));
        batch.delete(doc(db, 'users', target.uid, 'followers', myUid));
        await batch.commit();
        setFollowingMap(prev => ({ ...prev, [target.uid]: false }));
      } else {
        batch.set(doc(db, 'users', myUid, 'following', target.uid), { followedAt: serverTimestamp() });
        batch.set(doc(db, 'users', target.uid, 'followers', myUid), { followedAt: serverTimestamp() });
        await batch.commit();
        setFollowingMap(prev => ({ ...prev, [target.uid]: true }));
        // 相手にフォロー通知
        notifyFollowed({ targetUid: target.uid, fromUid: myUid, fromName: myName }).catch(() => {});
      }
    } catch (e) {
      console.error('[user-search] follow toggle failed:', e);
    } finally {
      setFollowBusy(null);
    }
  };

  // ── DM 開始 ──
  const startDm = async (target: UserSearchResult) => {
    if (!myUid) return;
    try {
      const chatId = await ensureDmChat(myUid, target.uid);
      useTeamChatStore.getState().setTarget({
        kind: 'dm', id: chatId, name: target.displayName, photoURL: target.photoURL, otherUid: target.uid,
      });
      useAppStore.getState().setTeamChatOpen(true);
      onClose();
    } catch (e) {
      console.error('[user-search] start dm failed:', e);
    }
  };

  // ── プロフィールを開く ──
  const openProfile = (uid: string) => {
    const appStore = useAppStore.getState();
    const prevView = appStore.currentMainView;
    if (prevView !== 'creator-profile') appStore.setCreatorProfileReturnView(prevView);
    appStore.setViewingCreatorId(uid);
    appStore.setCurrentMainView('creator-profile');
    onClose();
  };

  // ── 1行レンダリング（候補・検索結果共用） ──
  const renderUserRow = (u: UserSearchResult) => {
    const isFollowing = !!followingMap[u.uid];
    return (
      <Box
        key={u.uid}
        sx={{
          px: 2.5, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: `1px solid ${BRAND.line}`,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
        }}
      >
        <Avatar
          src={u.photoURL || undefined}
          onClick={() => openProfile(u.uid)}
          sx={{ width: 38, height: 38, fontSize: 15, bgcolor: '#3498db', cursor: 'pointer' }}
        >
          {u.displayName.slice(0, 1)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openProfile(u.uid)}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text }}>
            {u.displayName}
          </Typography>
          {u.bio && (
            <Typography noWrap sx={{ fontSize: 11, color: BRAND.sub2 }}>
              {u.bio}
            </Typography>
          )}
        </Box>
        <Tooltip title="ダイレクトチャット">
          <IconButton
            size="small"
            onClick={() => void startDm(u)}
            sx={{
              color: '#8ab4f8', border: '1px solid rgba(138,180,248,0.3)', borderRadius: 2, p: 0.6,
              '&:hover': { bgcolor: 'rgba(138,180,248,0.1)' },
            }}
          >
            <ForumRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          disabled={followBusy === u.uid}
          onClick={() => void toggleFollow(u)}
          startIcon={followBusy === u.uid
            ? <CircularProgress size={11} color="inherit" />
            : isFollowing ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : <PersonAddAltRoundedIcon sx={{ fontSize: 13 }} />}
          sx={{
            textTransform: 'none', fontSize: 11.5, fontWeight: 700, borderRadius: 5, px: 1.5, py: 0.4,
            flexShrink: 0, minWidth: 96,
            ...(isFollowing
              ? { color: BRAND.sub, border: '1px solid rgba(255,255,255,0.15)', '&:hover': { color: '#f87171', borderColor: 'rgba(248,113,113,0.4)', bgcolor: 'rgba(248,113,113,0.06)' } }
              : { color: '#fff', bgcolor: '#3498db', '&:hover': { bgcolor: '#2980b9' } }),
          }}
        >
          {isFollowing ? 'フォロー中' : 'フォロー'}
        </Button>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'rgba(16,20,30,0.97)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BRAND.line}`,
            borderRadius: 3,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            height: 520,
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* ヘッダー + 検索ボックス */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SearchRoundedIcon sx={{ fontSize: 18, color: BRAND.sub }} />
              ユーザーを検索
            </Typography>
            <IconButton onClick={onClose} size="small" sx={{ color: BRAND.sub2 }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            placeholder="ユーザー名で検索…"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.35)' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2.5, fontSize: 13, color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused fieldset': { borderColor: 'rgba(138,180,248,0.5)' },
              },
            }}
          />
        </Box>

        {/* 結果リスト */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {(loading || candidatesLoading) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.3)' }} />
            </Box>
          )}

          {/* 初期候補（フォロー中） */}
          {!loading && !candidatesLoading && !searched && candidates.length > 0 && (
            <>
              <Typography sx={{ px: 2.5, pt: 1.5, pb: 0.5, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                フォロー中
              </Typography>
              {candidates.map(u => renderUserRow(u))}
            </>
          )}

          {/* 候補もなく未検索の空状態 */}
          {!loading && !candidatesLoading && !searched && candidates.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6, opacity: 0.45 }}>
              <SearchRoundedIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.3)', mb: 1 }} />
              <Typography sx={{ fontSize: 12.5, color: BRAND.sub }}>
                SEKKEIYA のユーザーを名前で検索できます
              </Typography>
              <Typography sx={{ fontSize: 11, color: BRAND.sub2, mt: 0.5 }}>
                フォローしあうとダイレクトチャットができます
              </Typography>
            </Box>
          )}

          {!loading && searched && results.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6, opacity: 0.5 }}>
              <Typography sx={{ fontSize: 12.5, color: BRAND.sub }}>
                「{queryText.trim()}」に一致するユーザーが見つかりませんでした
              </Typography>
            </Box>
          )}

          {!loading && searched && results.map(u => renderUserRow(u))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
