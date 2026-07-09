import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Box, Typography, IconButton, TextField, Dialog, DialogContent, Button } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAIChatStore } from '../../store/useAIChatStore';

// 子アプリ appScope → 表示名（docs/12 §3）。
const APP_LABEL: Record<string, string> = {
  '3dss': 'S.Models', '3dsl': 'S.Layout', '3dsp': 'S.Presentations',
  '3dsc': 'S.Create', '3dsd': 'S.Diagram', '3dsr': 'S.Drawing',
  '3dsi': 'S.Image', '3dsf': 'S.Portfolio', '3dsq': 'S.Quest', '3dsk': 'S.Library',
};

const ACCENT = '#ffd740';

// ─── 通常行（ヘッダー / 新規作成 / 子アプリ等）──────────────────────────────

interface RowProps {
  depth: number;
  icon: React.ReactNode;
  label: string;
  tag?: string;
  count?: number;
  active?: boolean;
  caret?: 'down' | 'right' | 'none';
  muted?: boolean;
  onClick?: () => void;
}

const Row: React.FC<RowProps> = ({ depth, icon, label, tag, count, active, caret = 'none', muted, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: 0.75,
      pl: 0.5 + depth * 1.4, pr: 1, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
      ...(active
        ? { background: 'linear-gradient(90deg, rgba(255,215,64,0.14), rgba(255,215,64,0.03))', outline: '1px solid rgba(255,215,64,0.35)' }
        : {}),
      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
    }}
  >
    <Box sx={{ width: 12, flexShrink: 0, display: 'flex', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
      {caret === 'down' ? <KeyboardArrowDownIcon sx={{ fontSize: 13 }} />
        : caret === 'right' ? <KeyboardArrowRightIcon sx={{ fontSize: 13 }} />
        : null}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', color: active ? ACCENT : 'rgba(255,255,255,0.7)', flexShrink: 0 }}>
      {icon}
    </Box>
    <Typography noWrap sx={{
      flex: 1, fontSize: '0.72rem',
      color: active ? ACCENT : muted ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
      fontWeight: active ? 600 : 400,
    }}>
      {label}
    </Typography>
    {tag && (
      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 0.75, px: 0.5 }}>
        {tag}
      </Typography>
    )}
    {count != null && (
      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 5, px: 0.75 }}>
        {count}
      </Typography>
    )}
  </Box>
);

// ─── チャットセッション行（hover で編集・削除ボタン表示）────────────────────

interface ChatSessionRowProps {
  sessionId: string;
  depth: number;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  onRename: (sessionId: string, newTitle: string) => void;
  onDelete: (sessionId: string, title: string) => void;
}

const ChatSessionRow: React.FC<ChatSessionRowProps> = ({
  sessionId, depth, icon, label, active, onClick, onRename, onDelete,
}) => {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditValue(label); }, [label]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) onRename(sessionId, trimmed);
    setEditing(false);
  };

  const cancelEdit = () => { setEditValue(label); setEditing(false); };

  if (editing) {
    return (
      <Box sx={{ pl: 0.5 + depth * 1.4, pr: 1, py: '3px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.5)', flexShrink: 0, ml: '12px', mr: 0.5 }}>
          {icon}
        </Box>
        <TextField
          inputRef={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
          onBlur={commitEdit}
          size="small"
          variant="standard"
          fullWidth
          autoFocus
          InputProps={{
            sx: {
              fontSize: '0.72rem', color: '#fff',
              '&:before': { borderBottomColor: 'rgba(255,215,64,0.5)' },
              '&:after': { borderBottomColor: ACCENT },
            },
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        pl: 0.5 + depth * 1.4, pr: 0.5, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
        ...(active
          ? { background: 'linear-gradient(90deg, rgba(255,215,64,0.14), rgba(255,215,64,0.03))', outline: '1px solid rgba(255,215,64,0.35)' }
          : {}),
        '&:hover': { bgcolor: active ? undefined : 'rgba(255,255,255,0.05)' },
      }}
    >
      {/* カレット領域（幅揃え） */}
      <Box sx={{ width: 12, flexShrink: 0 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', color: active ? ACCENT : 'rgba(255,255,255,0.7)', flexShrink: 0 }}>
        {icon}
      </Box>
      <Typography noWrap sx={{
        flex: 1, fontSize: '0.72rem',
        color: active ? ACCENT : 'rgba(255,255,255,0.85)',
        fontWeight: active ? 600 : 400,
        minWidth: 0,
      }}>
        {label}
      </Typography>
      {/* hover アクション */}
      {hovered && (
        <Box sx={{ display: 'flex', gap: '1px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <IconButton
            size="small"
            onClick={() => setEditing(true)}
            sx={{ p: '3px', color: 'rgba(255,255,255,0.4)', borderRadius: 1, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <EditRoundedIcon sx={{ fontSize: 12 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDelete(sessionId, label)}
            sx={{ p: '3px', color: 'rgba(255,255,255,0.4)', borderRadius: 1, '&:hover': { color: '#fa709a', bgcolor: 'rgba(250,112,154,0.12)' } }}
          >
            <DeleteRoundedIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

// ─── メインコンポーネント ────────────────────────────────────────────────────

interface Props {
  onSelect?: () => void;
}

const ChatScopeNavigator: React.FC<Props> = ({ onSelect }) => {
  const projects = useAppStore(s => s.projects);
  const activeProject = useAppStore(s => s.getActiveProject());
  const currentUser = useAuthStore(s => s.currentUser);
  const sessions = useAIChatStore(s => s.sessions);
  const activeSessionId = useAIChatStore(s => s.activeSessionId);
  const setActiveSession = useAIChatStore(s => s.setActiveSession);
  const createScopedSession = useAIChatStore(s => s.createScopedSession);
  const updateSessionTitle = useAIChatStore(s => s.updateSessionTitle);
  const deleteSession = useAIChatStore(s => s.deleteSession);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const isOpen = (key: string, defaultOpen: boolean) => collapsed[key] === undefined ? defaultOpen : !collapsed[key];

  const pick = (id: string) => { setActiveSession(id); onSelect?.(); };

  // 削除確認ダイアログ
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const handleRename = (sessionId: string, newTitle: string) => {
    updateSessionTitle(sessionId, newTitle);
  };

  const handleDeleteRequest = (sessionId: string, title: string) => {
    setDeleteTarget({ id: sessionId, title });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (activeSessionId === deleteTarget.id) setActiveSession(null);
    deleteSession(deleteTarget.id);
    setDeleteTarget(null);
  };

  const accountId = currentUser?.uid ?? '__account__';
  const accountName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'マイページ';
  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? 'プロジェクト';

  const projectIds = useMemo(() => {
    const ids = new Set<string>(projects.map(p => p.id));
    sessions.forEach(s => {
      if (s.projectId && s.projectId !== '__global__' && s.projectId !== accountId) ids.add(s.projectId);
    });
    return Array.from(ids);
  }, [projects, sessions, accountId]);

  const renderContainer = (
    cid: string,
    name: string,
    tag: string,
    depth: number,
    scope: 'account' | 'project',
    defaultOpen: boolean,
  ) => {
    const isAccount = scope === 'account';
    const direct = sessions.filter(s =>
      !s.appScope && (s.projectId === cid || (isAccount && (s.projectId === '__global__' || s.scope === 'global')))
    );
    const scoped = sessions.filter(s => s.appScope && s.projectId === cid);
    const subappScopes = Array.from(new Set(scoped.map(s => s.appScope!)));
    const open = isOpen(`c:${cid}`, defaultOpen);
    const totalCount = sessions.filter(s => s.projectId === cid).length;

    return (
      <Box key={cid}>
        <Row
          depth={depth} caret={open ? 'down' : 'right'}
          icon={isAccount ? <PersonRoundedIcon sx={{ fontSize: 15 }} /> : <FolderRoundedIcon sx={{ fontSize: 14 }} />}
          label={name} tag={tag}
          count={!open ? totalCount : undefined}
          onClick={() => toggle(`c:${cid}`)}
        />
        {open && (
          <>
            {/* 直下スレッド */}
            {direct.map(s => (
              <ChatSessionRow
                key={s.id}
                sessionId={s.id}
                depth={depth + 1}
                icon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />}
                label={s.title}
                active={s.id === activeSessionId}
                onClick={() => pick(s.id)}
                onRename={handleRename}
                onDelete={handleDeleteRequest}
              />
            ))}

            {/* 子アプリ群 */}
            {subappScopes.length > 0 && (() => {
              const saOpen = isOpen(`sub:${cid}`, true);
              return (
                <>
                  <Row depth={depth + 1} caret={saOpen ? 'down' : 'right'}
                    icon={<ExtensionRoundedIcon sx={{ fontSize: 13 }} />}
                    label="子アプリ" onClick={() => toggle(`sub:${cid}`)} />
                  {saOpen && subappScopes.map(sc => {
                    const tasks = scoped.filter(s => s.appScope === sc && s.taskId);
                    const appOpen = isOpen(`app:${cid}:${sc}`, sc === '3dsd');
                    return (
                      <Box key={sc}>
                        <Row depth={depth + 2} caret={appOpen ? 'down' : 'right'}
                          icon={<Box sx={{ width: 13, textAlign: 'center', color: ACCENT, fontSize: 11 }}>◆</Box>}
                          label={APP_LABEL[sc] ?? sc} tag={sc}
                          count={!appOpen ? tasks.length : undefined}
                          onClick={() => toggle(`app:${cid}:${sc}`)} />
                        {appOpen && (
                          <>
                            {tasks.map(t => (
                              <ChatSessionRow
                                key={t.id}
                                sessionId={t.id}
                                depth={depth + 3}
                                icon={<DescriptionRoundedIcon sx={{ fontSize: 13, color: '#4fc3f7' }} />}
                                label={t.taskTitle ?? t.title}
                                active={t.id === activeSessionId}
                                onClick={() => pick(t.id)}
                                onRename={handleRename}
                                onDelete={handleDeleteRequest}
                              />
                            ))}
                            <Row depth={depth + 3} muted
                              icon={<AddRoundedIcon sx={{ fontSize: 13 }} />}
                              label="新規タスク"
                              onClick={() => {
                                const id = createScopedSession('task', { projectId: cid, appScope: sc, taskTitle: '新規タスク' });
                                pick(id);
                              }} />
                          </>
                        )}
                      </Box>
                    );
                  })}
                </>
              );
            })()}

            {/* 直下に新規チャット作成 */}
            <Row depth={depth + 1} muted
              icon={<AddRoundedIcon sx={{ fontSize: 13 }} />}
              label="新規チャット"
              onClick={() => {
                const id = isAccount
                  ? createScopedSession('account', { projectId: accountId })
                  : createScopedSession('project', { projectId: cid });
                pick(id);
              }} />

            {/* アカウント配下にプロジェクト群（2層モデル） */}
            {isAccount && projectIds.map(pid =>
              renderContainer(pid, projectName(pid), 'project', depth + 1, 'project', activeProject?.id === pid)
            )}
          </>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 1, overflowY: 'auto', height: '100%' }}>
      {renderContainer(accountId, accountName, 'account', 0, 'account', true)}

      {/* 削除確認ダイアログ */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: '#131920', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#fff', minWidth: 300 } }}
      >
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'rgba(250,112,154,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
              <DeleteRoundedIcon sx={{ fontSize: 17, color: '#fa709a' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', mb: 0.75 }}>
                チャットを削除しますか？
              </Typography>
              <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
                「{deleteTarget?.title}」を削除します。<br />この操作は取り消せません。
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDeleteTarget(null)}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', px: 2, borderRadius: 2,
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              キャンセル
            </Button>
            <Button variant="contained" onClick={handleDeleteConfirm}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', px: 2.5, borderRadius: 2,
                bgcolor: '#fa709a', color: '#fff', boxShadow: 'none', '&:hover': { bgcolor: '#f04e7a', boxShadow: 'none' } }}>
              削除する
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ChatScopeNavigator;
