// Project Chat のトーク選択（LINE のトーク一覧に相当）。
// サイドバー（MainLayout）と、未選択時のパネル初期画面の両方で使う。
// タブ: すべて / プロジェクト / チーム / ダイレクト

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Avatar, AvatarGroup, CircularProgress } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { UserSearchDialog } from '../social/UserSearchDialog';

import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchMyTeams, fetchMutualFollows, type Team, type MutualFollowUser } from '../teams/api/teamsApi';
import { useTeamChatStore, type ChatTarget } from './store/useTeamChatStore';
import {
  ensureDmChat,
  ensureTeamChat,
  teamChatId,
  listMyDmChats,
  fetchMemberProfiles,
  type DmChatSummary,
  type MemberProfile,
} from './api/teamChatApi';

type FilterTab = 'all' | 'project' | 'team' | 'dm';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',     label: 'すべて' },
  { id: 'project', label: 'プロジェクト' },
  { id: 'team',    label: 'チーム' },
  { id: 'dm',      label: 'ダイレクト' },
];

// ── 行アイテム共通 ───────────────────────────────────────────────────────
const Row: React.FC<{
  avatar: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}> = ({ avatar, title, subtitle, active, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: 1.25,
      px: 1.5, py: 1, cursor: 'pointer', borderRadius: 1.5, mx: 0.75,
      bgcolor: active ? 'rgba(138,180,248,0.12)' : 'transparent',
      transition: 'background 0.15s',
      '&:hover': { bgcolor: active ? 'rgba(138,180,248,0.16)' : 'rgba(255,255,255,0.05)' },
    }}
  >
    {avatar}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: '0.72rem', fontWeight: active ? 600 : 400, color: active ? '#fff' : 'rgba(255,255,255,0.85)' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography noWrap sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  </Box>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ px: 2, pt: 1.5, pb: 0.5, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
    {children}
  </Typography>
);

// ── トーク選択リスト本体 ─────────────────────────────────────────────────
export const ChatTargetList: React.FC<{ onSelected?: () => void; dmOnly?: boolean }> = ({ onSelected, dmOnly = false }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const projects = useAppStore(s => s.projects);
  const target = useTeamChatStore(s => s.target);
  const setTarget = useTeamChatStore(s => s.setTarget);

  const [tab, setTab] = useState<FilterTab>('all');
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dms, setDms] = useState<DmChatSummary[]>([]);
  const [dmProfiles, setDmProfiles] = useState<Record<string, MemberProfile>>({});
  const [mutuals, setMutuals] = useState<MutualFollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  const uid = currentUser?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchMyTeams(uid).catch(() => [] as Team[]),
      listMyDmChats(uid).catch(() => [] as DmChatSummary[]),
      fetchMutualFollows(uid).catch(() => [] as MutualFollowUser[]),
    ]).then(async ([t, d, m]) => {
      if (!alive) return;
      setTeams(t);
      setDms(d);
      setMutuals(m);
      const profiles = await fetchMemberProfiles(d.map(x => x.otherUid)).catch(() => [] as MemberProfile[]);
      if (!alive) return;
      setDmProfiles(Object.fromEntries(profiles.map(p => [p.uid, p])));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [uid]);

  const select = useCallback(async (t: ChatTarget) => {
    setTarget(t);
    onSelected?.();
  }, [setTarget, onSelected]);

  const selectTeam = useCallback(async (team: Team) => {
    await ensureTeamChat(team.id, team.name, team.memberIds).catch(() => {});
    void select({ kind: 'team', id: teamChatId(team.id), name: team.name, memberIds: team.memberIds });
  }, [select]);

  const selectDm = useCallback(async (otherUid: string, name: string, photoURL?: string) => {
    if (!uid) return;
    const chatId = await ensureDmChat(uid, otherUid).catch(() => null);
    if (!chatId) return;
    void select({ kind: 'dm', id: chatId, name, photoURL, otherUid });
  }, [uid, select]);

  // 既存DMに出てくる相手は「新しい相手」から除外
  const existingDmUids = new Set(dms.map(d => d.otherUid));
  const newDmCandidates = mutuals.filter(m => !existingDmUids.has(m.uid));

  // DM専用モード（Project Chat → DM 化）ではプロジェクト/チームを出さず、ダイレクトのみ。
  const showProjects = !dmOnly && (tab === 'all' || tab === 'project');
  const showTeams    = !dmOnly && (tab === 'all' || tab === 'team');
  const showDms      = dmOnly || tab === 'all' || tab === 'dm';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* タブ（DM専用では非表示） */}
      {!dmOnly && (
      <Box sx={{ display: 'flex', gap: 0.5, px: 1.5, pt: 1.25, pb: 0.75, flexWrap: 'wrap', flexShrink: 0 }}>
        {TABS.map(t => (
          <Box
            key={t.id}
            onClick={() => setTab(t.id)}
            sx={{
              fontSize: '0.62rem', fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
              bgcolor: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: '1px solid', borderColor: tab === t.id ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
              borderRadius: 5, px: 1.1, py: 0.35, cursor: 'pointer', transition: 'all 0.15s',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            {t.label}
          </Box>
        ))}
      </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', pb: 1.5 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.3)' }} />
          </Box>
        )}

        {/* プロジェクト */}
        {showProjects && projects.length > 0 && (
          <>
            <SectionLabel>プロジェクト</SectionLabel>
            {projects.map(p => (
              <Row
                key={p.id}
                avatar={
                  p.iconUrl
                    ? <Avatar src={p.iconUrl} sx={{ width: 28, height: 28 }} />
                    : <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(138,180,248,0.15)' }}>
                        {p.iconEmoji
                          ? <span style={{ fontSize: 14 }}>{p.iconEmoji}</span>
                          : <FolderRoundedIcon sx={{ fontSize: 14, color: '#8ab4f8' }} />}
                      </Avatar>
                }
                title={p.name}
                subtitle={p.isTeam ? 'チームプロジェクト' : `メンバー ${(p.memberIds?.length ?? 1)} 人 + AI`}
                active={target?.kind === 'project' && target.id === p.id}
                onClick={() => void select({ kind: 'project', id: p.id, name: p.name })}
              />
            ))}
          </>
        )}

        {/* チーム */}
        {showTeams && teams.length > 0 && (
          <>
            <SectionLabel>チーム</SectionLabel>
            {teams.map(t => (
              <Row
                key={t.id}
                avatar={
                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(52,152,219,0.2)' }}>
                    <GroupsRoundedIcon sx={{ fontSize: 15, color: '#3498db' }} />
                  </Avatar>
                }
                title={t.name}
                subtitle={`メンバー ${t.memberIds.length} 人`}
                active={target?.kind === 'team' && target.id === `team__${t.id}`}
                onClick={() => void selectTeam(t)}
              />
            ))}
          </>
        )}

        {/* ダイレクト */}
        {showDms && (
          <>
            {/* ユーザー検索からDM開始（次の行動への自然な入口） */}
            <SectionLabel>ダイレクト</SectionLabel>
            <Row
              avatar={
                <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(138,180,248,0.12)' }}>
                  <SearchRoundedIcon sx={{ fontSize: 15, color: '#8ab4f8' }} />
                </Avatar>
              }
              title="ユーザーを検索"
              subtitle="名前で探してチャットを開始"
              onClick={() => setUserSearchOpen(true)}
            />
            {dms.length > 0 && (
              <>
                {dms.map(d => {
                  const prof = dmProfiles[d.otherUid];
                  const name = prof?.displayName ?? '名無しユーザー';
                  return (
                    <Row
                      key={d.chatId}
                      avatar={
                        <Avatar src={prof?.photoURL || undefined} sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#3498db' }}>
                          {name.slice(0, 1)}
                        </Avatar>
                      }
                      title={name}
                      subtitle={d.lastMessage}
                      active={target?.kind === 'dm' && target.id === d.chatId}
                      onClick={() => void selectDm(d.otherUid, name, prof?.photoURL)}
                    />
                  );
                })}
              </>
            )}
            {newDmCandidates.length > 0 && (
              <>
                <SectionLabel>新しい相手（相互フォロー）</SectionLabel>
                {newDmCandidates.map(m => (
                  <Row
                    key={m.uid}
                    avatar={
                      <Avatar src={m.photoURL || undefined} sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'rgba(255,255,255,0.12)' }}>
                        {m.displayName.slice(0, 1)}
                      </Avatar>
                    }
                    title={m.displayName}
                    subtitle={<><PersonAddAltRoundedIcon sx={{ fontSize: 9, mr: 0.25, verticalAlign: 'middle' }} />新しいチャットを開始</>}
                    onClick={() => void selectDm(m.uid, m.displayName, m.photoURL)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* 空状態 */}
        {!loading && (dmOnly
          ? (dms.length === 0 && newDmCandidates.length === 0)
          : (projects.length === 0 && teams.length === 0 && dms.length === 0 && newDmCandidates.length === 0)) && (
          <Box sx={{ textAlign: 'center', py: 5, opacity: 0.5 }}>
            <ForumRoundedIcon sx={{ fontSize: 28, color: 'rgba(255,255,255,0.3)', mb: 1 }} />
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>
              {dmOnly
                ? <>DM できる相手がまだいません。<br />相互フォローを増やしましょう。</>
                : <>チャットできる相手がまだいません。<br />チームに参加するか、相互フォローを増やしましょう。</>}
            </Typography>
          </Box>
        )}
      </Box>

      {/* ユーザー検索（DM開始・フォロー） */}
      <UserSearchDialog open={userSearchOpen} onClose={() => { setUserSearchOpen(false); onSelected?.(); }} />
    </Box>
  );
};

// ── サイドバー（MainLayout 用ラッパー。AI Chat の「チャット階層」と同形式） ──
// dmOnly: Project Chat → DM 化。ダイレクトメッセージのみを一覧する。
export const TeamChatNavigator: React.FC<{ dmOnly?: boolean }> = ({ dmOnly = false }) => (
  <>
    <Typography sx={{ px: 1.5, pt: 1.25, pb: 0, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600, flexShrink: 0 }}>
      {dmOnly ? 'ダイレクト' : 'トーク'}
    </Typography>
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <ChatTargetList dmOnly={dmOnly} />
    </Box>
  </>
);
