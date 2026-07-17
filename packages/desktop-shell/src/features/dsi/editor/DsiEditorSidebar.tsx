/**
 * DsiEditorSidebar — S.Image エディター左サイドバー（プロジェクト → チャット ツリー）。
 *
 *   プロジェクトA
 *     - チャット1   ← 選ぶと履歴がエディタに載る（hydrate）
 *     - チャット2
 *   プロジェクトB
 *     - チャット1
 *   ＋新規チャット
 *
 * Firestore users/{uid}/imageSessions と同期。生成履歴は右パネル「生成履歴」タブに表示。
 * （旧: 系統ツリー v1/v2 …。系統分岐UIは廃止し内部は1系統で保持。）
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Button, CircularProgress } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAiSettingsStore } from '../../../store/useAiSettingsStore';
import { useDsiEditorStore } from '../store/useDsiEditorStore';
import { subscribeSessions, deleteSession, saveCurrentSession, type DsiSessionRow } from '../dsiSessions';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#ec407a';
const NONE_KEY = '_none';

export const DsiEditorSidebar: React.FC = () => {
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);
  const setDsiShellMode = useAppStore(s => s.setDsiShellMode);
  const setActiveProjectId = useAppStore(s => s.setActiveProjectId);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const projects = useAppStore(s => s.projects);
  const uid = useAuthStore(s => s.currentUser?.uid);
  const activeSessionId = useDsiEditorStore(s => s.sessionId);

  const [rows, setRows] = useState<DsiSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeSessions(uid, (r) => { setRows(r); setLoading(false); });
    return unsub;
  }, [uid]);

  // プロジェクト → チャット群。書ける（チーム以外）プロジェクトを先に、チャットが無くても表示。
  const groups = useMemo(() => {
    const byPid = new Map<string, DsiSessionRow[]>();
    for (const r of rows) {
      const k = r.projectId || NONE_KEY;
      if (!byPid.has(k)) byPid.set(k, []);
      byPid.get(k)!.push(r);
    }
    const ordered: { pid: string; name: string; chats: DsiSessionRow[] }[] = [];
    for (const p of (projects || []).filter((p: any) => !p.isTeam)) {
      ordered.push({ pid: p.id, name: p.name || 'プロジェクト', chats: byPid.get(p.id) || [] });
      byPid.delete(p.id);
    }
    for (const [k, chats] of byPid) {
      const name = k === NONE_KEY ? '（プロジェクト未設定）' : (projects.find((p: any) => p.id === k)?.name || 'その他');
      ordered.push({ pid: k, name, chats });
    }
    return ordered;
  }, [rows, projects]);

  const openSession = (r: DsiSessionRow) => {
    useDsiEditorStore.getState().hydrate({
      id: r.id, projectId: r.projectId, title: r.title, provider: r.provider,
      mode: r.mode as any, originImageUrl: r.originImageUrl, originTitle: r.originTitle,
      branches: r.branches, createdAtMs: r.createdAtMs,
    });
    if (r.projectId) setActiveProjectId(r.projectId);
  };

  const newChat = (projectId: string) => {
    const pid = projectId === NONE_KEY ? (activeProjectId || null) : projectId;
    if (!pid) { window.alert('保存先プロジェクトがありません。ダッシュボードで作成してください。'); return; }
    const provider = useAiSettingsStore.getState().imageProvider || 'nanobanana';
    useDsiEditorStore.getState().initSession({ originImageUrl: null, originTitle: '', targetProjectId: pid, provider });
    setActiveProjectId(pid);
    // 作成した瞬間にツリーへ出す（空でも即保存。SEKKEIYA Chat と別物であることが一目で分かるように）。
    if (uid) saveCurrentSession(uid, { allowEmpty: true }).catch((e) => console.warn('[DsiEditorSidebar] new chat save failed', e));
  };

  const del = async (e: React.MouseEvent, r: DsiSessionRow) => {
    e.stopPropagation();
    if (!uid) return;
    if (!window.confirm(`チャット「${r.title || '無題'}」を削除しますか？`)) return;
    try { await deleteSession(uid, r.id); } catch (err) { console.error('[DsiEditorSidebar] delete failed', err); }
  };

  const toggle = (pid: string) => setCollapsed((prev) => {
    const next = new Set(prev); next.has(pid) ? next.delete(pid) : next.add(pid); return next;
  });

  // 「＋新規チャット」（下部）: 選択中プロジェクト、無ければ最初の書けるプロジェクト。
  const defaultNewProject = activeProjectId || (projects || []).find((p: any) => !p.isTeam)?.id || '';

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0, height: '100%', bgcolor: BRAND.bg,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: 'flex', flexDirection: 'column', overflowY: 'hidden', overflowX: 'hidden', flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: `1px solid ${BRAND.line}` }}>
        <Button size="small" startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 14 }} />} onClick={() => setDsiShellMode('dashboard')}
          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 11, textTransform: 'none', mb: 1, '&:hover': { color: 'var(--brand-fg)' } }}>
          ダッシュボードへ戻る
        </Button>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase' }}>
          プロジェクト / チャット
        </Typography>
      </Box>

      {/* ツリー */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={18} sx={{ color: ACCENT }} /></Box>
        ) : groups.length === 0 ? (
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', px: 1, py: 2, textAlign: 'center' }}>
            プロジェクトがありません。<br />ダッシュボードで作成してください。
          </Typography>
        ) : groups.map((g) => {
          const isCollapsed = collapsed.has(g.pid);
          return (
            <Box key={g.pid} sx={{ mb: 0.25 }}>
              {/* プロジェクト行 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.25, py: 0.5, borderRadius: 1.5, '&:hover .newchat': { opacity: 1 } }}>
                <Box onClick={() => toggle(g.pid)} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  {isCollapsed ? <ChevronRightRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />}
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)' }}>{g.name}</Typography>
                  <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{g.chats.length}</Typography>
                </Box>
                <Tooltip title="このプロジェクトで新規チャット" placement="left">
                  <IconButton className="newchat" size="small" onClick={() => newChat(g.pid)} sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, color: ACCENT }}>
                    <AddRoundedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* チャット群 */}
              {!isCollapsed && (
                <Box sx={{ ml: 1.25 }}>
                  {g.chats.length === 0 ? (
                    <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)', pl: 1, py: 0.3 }}>チャットなし</Typography>
                  ) : g.chats.map((r) => {
                    const active = r.id === activeSessionId;
                    return (
                      <Box key={r.id} onClick={() => openSession(r)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.35, borderRadius: 1.5, cursor: 'pointer',
                          bgcolor: active ? `${ACCENT}1f` : 'transparent', border: active ? `1px solid ${ACCENT}55` : '1px solid transparent',
                          '&:hover': { bgcolor: active ? `${ACCENT}26` : 'rgb(var(--brand-fg-rgb) / 0.05)', '& .delchat': { opacity: 1 } },
                        }}>
                        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13, color: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.4)', flexShrink: 0 }} />
                        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 11.5, color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
                          {r.title || '無題のチャット'}
                        </Typography>
                        <IconButton className="delchat" size="small" onClick={(e) => del(e, r)} sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.2, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: '#ef9a9a' } }}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* 下部: 新規チャット */}
      <Box sx={{ p: 1.25, borderTop: `1px solid ${BRAND.line}` }}>
        <Button fullWidth size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />} disabled={!defaultNewProject}
          onClick={() => newChat(defaultNewProject)}
          sx={{
            color: 'var(--brand-fg)', fontSize: 11.5, textTransform: 'none', justifyContent: 'center',
            border: `1px dashed ${ACCENT}66`, borderRadius: 2,
            '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}11` },
            '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
          }}>
          新規チャット
        </Button>
      </Box>
    </Box>
  );
};

export default DsiEditorSidebar;
