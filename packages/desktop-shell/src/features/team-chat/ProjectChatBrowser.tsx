// プロジェクトでグループ化したチャット・ブラウザ（Claude Code のセッション一覧風）。
// 全プロジェクトを「チーム / マイ」で並べ、アクティブなプロジェクトを展開して中のチャットを表示する。
//   - チームP: Firestore の共同チャット（メインチャット＋chatTopics）
//   - MY P:   ローカルのオーケストレーター・セッション（useAIChatStore）
// チャットを選ぶと、そのプロジェクトをアクティブにしてチャットを開く。

import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton, TextField, CircularProgress, Tooltip, Menu, MenuItem, Checkbox, Divider } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useAIChatStore } from '../../store/useAIChatStore';
import { useCoreOrchestrator } from '../../store/useCoreOrchestrator';
import { subscribeToProjectTopics, createProjectTopic, deleteProjectTopic, type ProjectChatTopic } from './api/teamChatApi';

// チャット名の左の状況インジケータ：
//   running  = 三点ローディング（AI実行中）
//   awaiting = 🟠橙（ユーザーへの質問あり・タスク未完了）
//   ready    = 🔵青（実行完了／開いていて待機）
//   idle     = ⚪グレー枠（その他）
export type ChatStatus = 'running' | 'awaiting' | 'ready' | 'idle';

const StatusIndicator: React.FC<{ status: ChatStatus }> = ({ status }) => {
  if (status === 'running') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {[0, 1, 2].map(i => (
          <Box key={i} sx={{
            width: 4, height: 4, borderRadius: '50%', bgcolor: '#8ab4f8',
            '@keyframes scDot': { '0%,80%,100%': { opacity: 0.25, transform: 'scale(0.7)' }, '40%': { opacity: 1, transform: 'scale(1)' } },
            animation: `scDot 1.2s ease-in-out ${i * 0.16}s infinite`,
          }} />
        ))}
      </Box>
    );
  }
  const dotSx = status === 'awaiting'
    ? { bgcolor: '#ffb74d' }
    : status === 'ready'
      ? { bgcolor: '#8ab4f8' }
      : { bgcolor: 'transparent', border: '1.5px solid rgba(255,255,255,0.28)' };
  return <Box sx={{ width: 8, height: 8, borderRadius: '50%', ...dotSx }} />;
};

const ChatRow: React.FC<{ label: string; active: boolean; onClick: () => void; indent?: number; status?: ChatStatus; onDelete?: () => void }> = ({ label, active, onClick, indent = 3.25, status = 'idle', onDelete }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: 0.75, pl: indent, pr: 0.5, py: 0.45, mx: 0.5, borderRadius: 1, cursor: 'pointer',
      color: active ? '#fff' : 'rgba(255,255,255,0.7)',
      bgcolor: active ? 'rgba(138,180,248,0.16)' : 'transparent',
      '&:hover': { bgcolor: active ? 'rgba(138,180,248,0.2)' : 'rgba(255,255,255,0.06)' },
      '&:hover .chat-del': { opacity: 1 },
    }}
  >
    <Box sx={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <StatusIndicator status={status} />
    </Box>
    <Typography noWrap sx={{ fontSize: 12, fontWeight: active ? 600 : 400, flex: 1, minWidth: 0 }}>{label}</Typography>
    {onDelete && (
      <Tooltip title="チャットを削除">
        <IconButton
          className="chat-del"
          size="small"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          sx={{ p: 0.25, opacity: 0, flexShrink: 0, color: 'rgba(255,255,255,0.4)', transition: 'opacity 0.12s', '&:hover': { color: '#e57373', bgcolor: 'rgba(229,115,115,0.1)' } }}
        >
          <DeleteOutlineRoundedIcon sx={{ fontSize: '0.95rem' }} />
        </IconButton>
      </Tooltip>
    )}
  </Box>
);

// 展開中のプロジェクト配下のチャット一覧（複数プロジェクトを同時展開できる）。
const ProjectChats: React.FC<{
  projectId: string; isTeam: boolean; isActiveProject: boolean; activeTopicId?: string; sortMode: 'recent' | 'name';
  onSelectTeamChat: (topicId?: string) => void;
  onSelectMyChat: (sessionId: string) => void;
}> = ({ projectId, isTeam, isActiveProject, activeTopicId, sortMode, onSelectTeamChat, onSelectMyChat }) => {
  const uid = useAuthStore(s => s.currentUser?.uid);
  const sessions = useAIChatStore(s => s.sessions);
  const activeSessionId = useAIChatStore(s => s.activeSessionId);
  const createSession = useAIChatStore(s => s.createSession);
  const isProcessing = useCoreOrchestrator(s => s.isProcessing);
  const pending = useCoreOrchestrator(s => s.pending);
  // 開いているチャットのみ実状態を反映（実行中=三点 / 質問待ち=橙 / 完了=青）。他は idle。
  const statusFor = (isActive: boolean): ChatStatus => isActive ? (isProcessing ? 'running' : (pending ? 'awaiting' : 'ready')) : 'idle';
  const [topics, setTopics] = useState<ProjectChatTopic[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isTeam) return;
    const unsub = subscribeToProjectTopics(projectId, setTopics, () => {});
    return unsub;
  }, [isTeam, projectId]);

  const mySessions = isTeam ? [] : sessions.filter(s => s.projectId === projectId).sort((a, b) =>
    sortMode === 'name' ? (a.title || '').localeCompare(b.title || '', 'ja') : b.updatedAt - a.updatedAt);
  const sortedTopics = sortMode === 'name'
    ? [...topics].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    : [...topics].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  // チームP：トピックはメンバー共有なので従来どおり名前を付けて作成。
  const createChat = async () => {
    if (creating) return;
    const name = newName.trim();
    if (!name || !uid) return;
    setCreating(true);
    try { const id = await createProjectTopic(projectId, name, uid); setNewName(''); setAdding(false); onSelectTeamChat(id); }
    catch (e) { console.error('[ProjectChatBrowser] createTopic failed:', e); }
    finally { setCreating(false); }
  };

  // マイP：＋で仮名のチャットを即作成。内容から自動命名される（useCoreOrchestrator）。
  const createMyChatInstant = () => {
    const id = createSession(projectId, '新しいチャット');
    onSelectMyChat(id);
  };

  return (
    <Box sx={{ pb: 0.5 }}>
      {isTeam ? (
        <>
          {(() => { const a = isActiveProject && !activeTopicId; return <ChatRow label="メインチャット" active={a} status={statusFor(a)} onClick={() => onSelectTeamChat(undefined)} />; })()}
          {sortedTopics.map(t => { const a = isActiveProject && activeTopicId === t.id; return (
            <ChatRow
              key={t.id} label={t.name} active={a} status={statusFor(a)}
              onClick={() => onSelectTeamChat(t.id)}
              onDelete={async () => {
                if (a) onSelectTeamChat(undefined); // 削除前にメインチャットへ退避
                try { await deleteProjectTopic(projectId, t.id); } catch (e) { console.error('[ProjectChatBrowser] deleteTopic failed:', e); }
              }}
            />
          ); })}
        </>
      ) : (
        mySessions.length === 0
          ? <ChatRow label="メインチャット" active={isActiveProject} status={statusFor(isActiveProject)} onClick={() => onSelectMyChat('')} />
          : mySessions.map(s => { const a = isActiveProject && activeSessionId === s.id; return (
            <ChatRow
              key={s.id} label={s.title || '無題のチャット'} active={a} status={statusFor(a)}
              onClick={() => onSelectMyChat(s.id)}
              onDelete={() => useAIChatStore.getState().deleteSession(s.id)}
            />
          ); })
      )}

      {isTeam && adding ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 3, pr: 1, py: 0.4 }}>
          <TextField
            size="small" autoFocus value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) createChat(); }}
            onBlur={() => { if (!newName.trim()) setAdding(false); }}
            placeholder="チャット名"
            sx={{ flex: 1, '& .MuiInputBase-root': { color: '#fff', fontSize: 11.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }}
          />
          <IconButton size="small" onClick={createChat} disabled={creating} sx={{ color: '#8ab4f8' }}>
            {creating ? <CircularProgress size={13} sx={{ color: 'inherit' }} /> : <AddRoundedIcon sx={{ fontSize: '1rem' }} />}
          </IconButton>
        </Box>
      ) : (
        // マイP＝即作成（仮名→内容で自動命名）。チームP＝名前入力を開く。
        <Box onClick={() => { if (isTeam) setAdding(true); else createMyChatInstant(); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 3.25, pr: 1, py: 0.4, mx: 0.5, borderRadius: 1, cursor: 'pointer', color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#8ab4f8', bgcolor: 'rgba(255,255,255,0.05)' } }}>
          <AddRoundedIcon sx={{ fontSize: '0.85rem' }} />
          <Typography sx={{ fontSize: 11.5 }}>新規チャット</Typography>
        </Box>
      )}
    </Box>
  );
};

const ProjectChatBrowser: React.FC<{
  activeTopicId?: string;
  onSelectTeamChat: (projectId: string, topicId?: string) => void;
  onSelectMyChat: (projectId: string, sessionId?: string) => void;
  onNewGlobalChat: () => void;
  onSelectGlobalChat: (sessionId: string) => void;
}> = ({ activeTopicId, onSelectTeamChat, onSelectMyChat, onNewGlobalChat, onSelectGlobalChat }) => {
  const projects = useAppStore(s => s.projects);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const sessions = useAIChatStore(s => s.sessions);
  const activeSessionId = useAIChatStore(s => s.activeSessionId);
  const isProcessing = useCoreOrchestrator(s => s.isProcessing);
  const pending = useCoreOrchestrator(s => s.pending);
  const globalStatusFor = (isActive: boolean): ChatStatus => isActive ? (isProcessing ? 'running' : (pending ? 'awaiting' : 'ready')) : 'idle';

  // 複数プロジェクトを同時に開いたままにできる（独立した開閉）。
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(activeProjectId ? [activeProjectId] : []));
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [myExpanded, setMyExpanded] = useState(true);
  const [teamExpanded, setTeamExpanded] = useState(true);
  // アカウントサイト（マイページ）の新規チャット。
  // ＋を押したら仮名で即作成し、最初のメッセージ内容から自動命名される（useCoreOrchestrator）。
  const createAccountChat = () => {
    const id = useAIChatStore.getState().createScopedSession('account', { title: '新しいチャット' });
    onSelectGlobalChat(id);
  };
  // 絞り込み・並び替え。
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [visibleGroups, setVisibleGroups] = useState({ my: true, team: true, global: true });
  const [sortMode, setSortMode] = useState<'recent' | 'name'>('recent');
  const toggleGroup = (k: 'my' | 'team' | 'global') => setVisibleGroups(g => ({ ...g, [k]: !g[k] }));
  const clearFilters = () => { setVisibleGroups({ my: true, team: true, global: true }); setSortMode('recent'); };
  // フィルタ／並び替えが既定（全グループ表示・新着順）から変化しているか＝絞り込みボタンの強調表示用。
  const filtersActive = !visibleGroups.my || !visibleGroups.team || !visibleGroups.global || sortMode !== 'recent';
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ja');
  const toggleExpand = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  // アクティブになったプロジェクトは自動で開く（閉じているチャットを選んだ時など）。
  useEffect(() => {
    if (activeProjectId) setExpandedIds(prev => prev.has(activeProjectId) ? prev : new Set(prev).add(activeProjectId));
  }, [activeProjectId]);

  const sortP = (arr: typeof projects) => sortMode === 'name' ? [...arr].sort(byName) : arr;
  const teamProjects = sortP(projects.filter(p => p.isTeam));
  const myProjects = sortP(projects.filter(p => !p.isTeam));
  // アカウントサイト（マイページ＝最上位）のチャット＝projectId '__global__'（scope: account/global）。
  const globalSessions = (() => {
    const g = sessions.filter(s => s.projectId === '__global__');
    return sortMode === 'name'
      ? [...g].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'))
      : [...g].sort((a, b) => b.updatedAt - a.updatedAt);
  })();

  const renderProject = (p: typeof projects[number]) => {
    const active = p.id === activeProjectId;
    const expanded = expandedIds.has(p.id);
    return (
      <Box key={p.id}>
        <Box
          onClick={() => toggleExpand(p.id)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.6, mx: 0.5, borderRadius: 1, cursor: 'pointer',
            color: active ? '#fff' : 'rgba(255,255,255,0.8)',
            bgcolor: active ? 'rgba(255,255,255,0.05)' : 'transparent',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
          }}
        >
          {expanded
            ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
            : <KeyboardArrowRightRoundedIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />}
          {p.isTeam
            ? <GroupsRoundedIcon sx={{ fontSize: '0.9rem', color: active ? '#8ab4f8' : 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            : <FolderRoundedIcon sx={{ fontSize: '0.9rem', color: active ? '#8ab4f8' : 'rgba(255,255,255,0.4)', flexShrink: 0 }} />}
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: active ? 600 : 400, flex: 1 }}>{p.name}</Typography>
        </Box>
        {expanded && (
          <ProjectChats
            projectId={p.id} isTeam={!!p.isTeam} isActiveProject={active} activeTopicId={activeTopicId} sortMode={sortMode}
            onSelectTeamChat={(tid) => onSelectTeamChat(p.id, tid)}
            onSelectMyChat={(sid) => onSelectMyChat(p.id, sid)}
          />
        )}
      </Box>
    );
  };

  // 折りたたみ可能なグループ見出し（マイ／チーム／プロジェクト外で共通）。
  const groupHeader = (label: string, expanded: boolean, onToggle: () => void) => (
    <Box
      onClick={onToggle}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, mx: 0.5, mt: 0.5, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
    >
      {expanded
        ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
        : <KeyboardArrowRightRoundedIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />}
      <Typography sx={{ fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{label}</Typography>
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 最上部：プロジェクト外の新規チャット（Claude Code の「新規セッション」相当） */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, pt: 1, pb: 0.5, flexShrink: 0 }}>
        <Box
          onClick={onNewGlobalChat}
          sx={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.6, borderRadius: 1, cursor: 'pointer',
            color: '#fff', bgcolor: 'rgba(138,180,248,0.12)', border: '1px solid rgba(138,180,248,0.3)',
            '&:hover': { bgcolor: 'rgba(138,180,248,0.2)' },
          }}
        >
          <AddRoundedIcon sx={{ fontSize: '1rem', color: '#8ab4f8' }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>新規チャット</Typography>
        </Box>
        <Tooltip title="絞り込み・並び替え">
          <IconButton
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            sx={{
              flexShrink: 0, borderRadius: 1, border: '1px solid rgba(255,255,255,0.12)',
              color: filtersActive ? '#8ab4f8' : 'rgba(255,255,255,0.5)',
              bgcolor: filtersActive ? 'rgba(138,180,248,0.12)' : 'transparent',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            <TuneRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 絞り込み・並び替えメニュー */}
      <Menu
        anchorEl={filterAnchor}
        open={Boolean(filterAnchor)}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ dense: true }}
        PaperProps={{ sx: { bgcolor: '#222a36', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 220 } }}
      >
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>表示するグループ</Typography>
        {([['global', 'アカウントサイト'], ['my', 'マイプロジェクト'], ['team', 'チームプロジェクト']] as const).map(([k, label]) => (
          <MenuItem key={k} onClick={() => toggleGroup(k)} sx={{ fontSize: 13 }}>
            <Checkbox checked={visibleGroups[k]} size="small" sx={{ p: 0.5, mr: 0.5, color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: '#8ab4f8' } }} />
            {label}
          </MenuItem>
        ))}
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 0.5 }} />
        <Typography sx={{ px: 2, pt: 0.5, pb: 0.5, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>並び順</Typography>
        {([['recent', '更新が新しい順'], ['name', '名前順']] as const).map(([k, label]) => (
          <MenuItem key={k} onClick={() => setSortMode(k)} sx={{ fontSize: 13 }}>
            <Box sx={{ width: 22, display: 'flex', justifyContent: 'center', mr: 0.5 }}>
              {sortMode === k && <CheckRoundedIcon sx={{ fontSize: '1rem', color: '#8ab4f8' }} />}
            </Box>
            {label}
          </MenuItem>
        ))}
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 0.5 }} />
        <MenuItem onClick={() => { clearFilters(); setFilterAnchor(null); }} sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          <Box sx={{ width: 22, mr: 0.5 }} />絞り込みをクリア
        </MenuItem>
      </Menu>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pb: 1 }}>
        {/* アカウントサイト（マイページ）＝最上位のチャット。プロジェクトに属さない。
            常に表示し、ここから新規チャットも作成できる。 */}
        {visibleGroups.global && (
          <Box>
            <Box
              onClick={() => setGlobalExpanded(v => !v)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.6, mx: 0.5, mt: 0.5, borderRadius: 1, cursor: 'pointer',
                color: 'rgba(255,255,255,0.85)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              {globalExpanded
                ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
                : <KeyboardArrowRightRoundedIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />}
              <LanguageRoundedIcon sx={{ fontSize: '0.95rem', color: '#8ab4f8', flexShrink: 0 }} />
              <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>アカウントサイト</Typography>
            </Box>
            {globalExpanded && (
              <Box sx={{ pb: 0.5 }}>
                {globalSessions.map(s => {
                  const a = activeProjectId == null && activeSessionId === s.id;
                  return (
                    <ChatRow
                      key={s.id}
                      label={s.title || '無題のチャット'}
                      indent={3.25}
                      active={a}
                      status={globalStatusFor(a)}
                      onClick={() => onSelectGlobalChat(s.id)}
                      onDelete={() => useAIChatStore.getState().deleteSession(s.id)}
                    />
                  );
                })}
                <Box onClick={createAccountChat} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 3.25, pr: 1, py: 0.4, mx: 0.5, borderRadius: 1, cursor: 'pointer', color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#8ab4f8', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                  <AddRoundedIcon sx={{ fontSize: '0.85rem' }} />
                  <Typography sx={{ fontSize: 11.5 }}>新規チャット</Typography>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {visibleGroups.my && myProjects.length > 0 && groupHeader('マイプロジェクト', myExpanded, () => setMyExpanded(v => !v))}
        {visibleGroups.my && myExpanded && myProjects.map(renderProject)}
        {visibleGroups.team && teamProjects.length > 0 && groupHeader('チームプロジェクト', teamExpanded, () => setTeamExpanded(v => !v))}
        {visibleGroups.team && teamExpanded && teamProjects.map(renderProject)}
        {projects.length === 0 && globalSessions.length === 0 && (
          <Typography sx={{ px: 1.5, pt: 2, fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
            まだチャットがありません。「新規チャット」から始められます。
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ProjectChatBrowser;
