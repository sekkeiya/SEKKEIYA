// チームプロジェクトの共同チャット用「メンバー追加」ダイアログ（チャット統合 Phase1 #2）。
// 既存の teams 招待フロー（sendInvitation → 承諾で team / team projects の memberIds に連動）を流用。
// プロジェクトの teamId 経由でチームに招待する。個人(MY)プロジェクトには teamId が無いので追加不可。

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, Avatar, Button, IconButton, CircularProgress, Chip, Divider,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchMutualFollows, sendInvitation, fetchPendingInvitations, fetchTeam,
  type MutualFollowUser,
} from '../teams/api/teamsApi';
import { fetchMemberProfiles, type MemberProfile } from './api/teamChatApi';

const ProjectMembersDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; projectName: string }> = ({ open, onClose, projectId, projectName }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const uid = currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [candidates, setCandidates] = useState<MutualFollowUser[]>([]);
  const [pendingUids, setPendingUids] = useState<Set<string>>(new Set());
  const [justInvited, setJustInvited] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !uid) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const snap = await getDoc(doc(db, 'projects', projectId)).catch(() => null);
      const data: any = snap && snap.exists() ? snap.data() : {};
      const tId: string | null = data.teamId ?? null;
      const owner: string | null = data.ownerId ?? null;
      const memberIds: string[] = Array.from(new Set([owner, ...(data.memberIds ?? [])].filter(Boolean))) as string[];

      const [profiles, muts, team] = await Promise.all([
        fetchMemberProfiles(memberIds).catch(() => [] as MemberProfile[]),
        fetchMutualFollows(uid).catch(() => [] as MutualFollowUser[]),
        tId ? fetchTeam(tId).catch(() => null) : Promise.resolve(null),
      ]);
      const pendings = tId ? await fetchPendingInvitations(tId).catch(() => []) : [];
      if (!alive) return;

      setTeamId(tId);
      setOwnerId(owner);
      setTeamName(team?.name ?? projectName);
      setMembers(profiles);
      const memberSet = new Set(memberIds);
      setPendingUids(new Set(pendings.map(p => p.inviteeUid).filter(Boolean) as string[]));
      setCandidates(muts.filter(m => !memberSet.has(m.uid)));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open, uid, projectId, projectName]);

  const invite = async (c: MutualFollowUser) => {
    if (!uid || !teamId) return;
    setInviting(c.uid);
    try {
      await sendInvitation({
        teamId,
        teamName,
        invitedBy: uid,
        invitedByName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'ユーザー',
        inviteeUid: c.uid,
        inviteeEmail: null,
      });
      setJustInvited(prev => new Set(prev).add(c.uid));
    } catch (e) {
      console.error('[ProjectMembersDialog] invite failed:', e);
    } finally {
      setInviting(null);
    }
  };

  const isOwner = uid && ownerId && uid === ownerId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: '#1a1f2b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.95rem', fontWeight: 600, pb: 1 }}>
        <PersonAddAltRoundedIcon sx={{ fontSize: '1.2rem', color: '#8ab4f8' }} />
        メンバー
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', mb: 1.5 }}>
          「{projectName}」の共同チャットに参加するメンバー。AI（SEKKEIYA）は常駐します。
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.4)' }} /></Box>
        ) : (
          <>
            {/* 現在のメンバー */}
            <Typography sx={{ fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600, mb: 0.5 }}>
              現在のメンバー（{members.length}）
            </Typography>
            {members.map(m => (
              <Box key={m.uid} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <Avatar src={m.photoURL || undefined} sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#3498db' }}>{m.displayName.slice(0, 1)}</Avatar>
                <Typography sx={{ fontSize: '0.78rem', flex: 1 }} noWrap>{m.displayName}</Typography>
                {ownerId === m.uid && <Chip size="small" icon={<StarRoundedIcon sx={{ fontSize: '0.8rem !important' }} />} label="オーナー" sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(255,215,64,0.12)', color: '#ffd740', border: '1px solid rgba(255,215,64,0.3)' }} />}
              </Box>
            ))}

            <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />

            {!teamId ? (
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, py: 1 }}>
                これは個人（MY）プロジェクトのため、メンバーを追加できません。<br />
                複数人で進めるにはチームプロジェクトに昇格してください。
              </Typography>
            ) : !isOwner ? (
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, py: 1 }}>
                メンバーの招待はオーナーのみ可能です。
              </Typography>
            ) : (
              <>
                <Typography sx={{ fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600, mb: 0.5 }}>
                  招待できる人（相互フォロー）
                </Typography>
                {candidates.length === 0 ? (
                  <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', py: 1 }}>
                    招待できる相互フォローのユーザーがいません。
                  </Typography>
                ) : candidates.map(c => {
                  const pending = pendingUids.has(c.uid) || justInvited.has(c.uid);
                  return (
                    <Box key={c.uid} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                      <Avatar src={c.photoURL || undefined} sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'rgba(255,255,255,0.12)' }}>{c.displayName.slice(0, 1)}</Avatar>
                      <Typography sx={{ fontSize: '0.78rem', flex: 1 }} noWrap>{c.displayName}</Typography>
                      {pending ? (
                        <Chip size="small" icon={<CheckRoundedIcon sx={{ fontSize: '0.8rem !important' }} />} label="招待済み" sx={{ height: 22, fontSize: '0.62rem', bgcolor: 'rgba(102,187,106,0.12)', color: '#66bb6a', border: '1px solid rgba(102,187,106,0.3)' }} />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={inviting === c.uid}
                          onClick={() => invite(c)}
                          startIcon={inviting === c.uid ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <PersonAddAltRoundedIcon sx={{ fontSize: '0.9rem' }} />}
                          sx={{ fontSize: '0.65rem', py: 0.25, borderColor: 'rgba(138,180,248,0.4)', color: '#8ab4f8', '&:hover': { borderColor: '#8ab4f8', bgcolor: 'rgba(138,180,248,0.08)' } }}
                        >
                          招待
                        </Button>
                      )}
                    </Box>
                  );
                })}
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', mt: 1.5, lineHeight: 1.5 }}>
                  招待された相手が承諾すると、チーム（{teamName}）とそのプロジェクトのメンバーに加わります。
                </Typography>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectMembersDialog;
