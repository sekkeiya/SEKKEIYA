// AIタスク進捗パネル（フローティング）。常時表示、実行中タスク数をバッジで通知。
// MainLayout 直下にマウントされ、画面遷移しても残る。アプリ全体の操作は妨げない
// （画面右下に固定された小さなカードで、pointer-events は自身のみ）。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, IconButton, LinearProgress, Button, Tooltip, CircularProgress, Switch } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SaveAltRoundedIcon from '@mui/icons-material/SaveAltRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, limit, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { useBatchGenStore, type BatchItemStatus } from '../../../store/useBatchGenStore';
import { useAppStore } from '../../../store/useAppStore';
import { saveBatchDoneItemsToSModels } from '../../../store/saveBatchToModels';
import sekkeiyaIconSrc from '../../../../src-tauri/icons/icon.png';
import { getChatSuggestions } from '../../../components/AI/chatSuggestions';
import { AI_3D_LIMITS, OFFICIAL_EMAILS } from '../../ai-studio/constants/ai-model-plans';

// 左上のブランド（白地に筆文字の S）と同じ見た目のアイコン。
// アクティブ時はシアンのリング＋グローでハイライトする。
const SekkeiyaIcon: React.FC<{ size?: number; active?: boolean; radius?: string }> = ({ size = 20, active = false, radius = '6px' }) => (
  <Box
    sx={{
      width: size, height: size, flexShrink: 0,
      borderRadius: radius,
      overflow: 'hidden',
      bgcolor: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: active ? '1px solid rgba(0,191,255,0.9)' : 'none',
      boxShadow: active ? '0 0 8px rgba(0,191,255,0.55)' : 'none',
      transition: 'border 0.2s, box-shadow 0.2s',
    }}
  >
    <Box
      component="img"
      src={sekkeiyaIconSrc}
      alt="SEKKEIYA"
      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  </Box>
);

interface AiTaskMini {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  status: 'todo' | 'in_progress';
  dueDate?: string;
  startTime?: string;
  description?: string;
}

const MARGIN = 16;

const STATUS_LABEL: Record<BatchItemStatus, string> = {
  queued: '待機', submitting: '送信中', generating: '生成中', done: '完了', failed: '失敗', skipped: 'スキップ',
};
const STATUS_COLOR: Record<BatchItemStatus, string> = {
  queued: 'rgb(var(--brand-fg-rgb) / 0.5)', submitting: '#8ab4f8', generating: '#ffb74d',
  done: '#66bb6a', failed: '#ef5350', skipped: 'rgb(var(--brand-fg-rgb) / 0.35)',
};

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}分` : `${m}分${rem}秒`;
}

function isTaskOverdue(dueDate?: string, startTime?: string, nowMs?: number): boolean {
  if (!dueDate) return false;
  const dateStr = startTime ? `${dueDate}T${startTime}:00` : `${dueDate}T00:00:00`;
  const taskTime = new Date(dateStr).getTime();
  return (nowMs ?? Date.now()) >= taskTime;
}

function formatTaskDateTime(dueDate?: string, startTime?: string): string | null {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split('-');
  if (!y || !m || !d) return null;
  const dateStr = `${parseInt(m)}/${parseInt(d)}`;
  return startTime ? `${dateStr} ${startTime}` : dateStr;
}

function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s <= 0) return 'まもなく';
  if (s < 60) return `残り約${s}秒`;
  return `残り約${Math.ceil(s / 60)}分`;
}

export const FloatingBatchGenPanel: React.FC = () => {
  const batches = useBatchGenStore(s => s.batches);
  const panelOpen = useBatchGenStore(s => s.panelOpen);
  const setPanelOpen = useBatchGenStore(s => s.setPanelOpen);
  const cancelBatch = useBatchGenStore(s => s.cancelBatch);
  const dismissBatch = useBatchGenStore(s => s.dismissBatch);
  const retryFailed = useBatchGenStore(s => s.retryFailed);
  const autoSaveToModels = useBatchGenStore(s => s.autoSaveToModels);
  const setAutoSaveToModels = useBatchGenStore(s => s.setAutoSaveToModels);
  const [saving, setSaving] = React.useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addProjectId, setAddProjectId] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [taskHistory, setTaskHistory] = useState<{ title: string; projectId: string }[]>([]);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const autoStartedRef = useRef(new Set<string>());
  const uid = useAuthStore(s => s.currentUser?.uid);
  const projects = useAppStore(s => s.projects);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const setActiveProjectTab = useAppStore(s => s.setActiveProjectTab);
  const isAIChatOpen = useAppStore(s => s.isAIChatOpen);
  const toggleAIChat = useAppStore(s => s.toggleAIChat);
  const setAIChatOpen = useAppStore(s => s.setAIChatOpen);
  const currentMainView = useAppStore(s => s.currentMainView);
  const getActiveWorkspace = useAppStore(s => s.getActiveWorkspace);
  const lastActiveAppScope = useAppStore(s => s.lastActiveAppScope);
  const lastLaunchPayload = useAppStore(s => s.lastLaunchPayload);
  const isAIDriveOpen = useAppStore(s => s.isAIDriveOpen);
  const isAIRenderOpen = useAppStore(s => s.isAIRenderOpen);
  const isAI3DCreateOpen = useAppStore(s => s.isAI3DCreateOpen);
  // SEKKEIYA OS を別ウィンドウへ切り出している間は、右下の AI ハブ・ピルを隠す
  // （操作は別ウィンドウのチャットに集約し、本体の成果物ビューを広く使う）。
  const isChatPoppedOut = useAppStore(s => s.isChatPoppedOut);
  const [aiTasks, setAiTasks] = useState<AiTaskMini[]>([]);
  const [gen3dQuota, setGen3dQuota] = useState<{ used: number; limit: number; plan: string } | null>(null);

  // ── SEKKEIYA Chat ハブ：ピルにホバーすると各AI機能のボタンがふわっと展開する ──
  const [hubOpen, setHubOpen] = useState(false);
  const hubCloseTimer = useRef<number | null>(null);
  const openHub = () => {
    if (hubCloseTimer.current) { clearTimeout(hubCloseTimer.current); hubCloseTimer.current = null; }
    setHubOpen(true);
  };
  // ホバーintent：ピル↔メニュー間の移動で誤クローズしないよう少し待ってから閉じる。
  const scheduleCloseHub = () => {
    if (hubCloseTimer.current) clearTimeout(hubCloseTimer.current);
    hubCloseTimer.current = window.setTimeout(() => setHubOpen(false), 120);
  };
  useEffect(() => () => { if (hubCloseTimer.current) clearTimeout(hubCloseTimer.current); }, []);
  // 本体内フローティング・コックピットを指定タブで開く（Drive/Render/3D/DM 等の専用面用）。
  const openCockpit = (tab: 'chat' | 'drive' | 'teamchat' | 'render' | 'gen3d') => {
    const s = useAppStore.getState();
    // ピン留め／チャット階層サイドバーの状態はいじらず前回を踏襲。
    s.setChatPanelTab(tab);
    s.setAIChatDetached(true);
    s.setAIChatOpen(true);
    setHubOpen(false);
  };
  // ピル本体クリック／Chat項目＝チャットは別ウィンドウ（SEKKEIYA OS）で開く。
  // SEKKEIYA の操作の中心＝別ウィンドウのチャットという方針。Web など窓を開けない環境では
  // 従来どおり本体内フローティング・コックピットにフォールバックする。
  const openChatDirect = (tab: 'chat' | 'drive' | 'teamchat' | 'render' | 'gen3d' = 'chat') => {
    if (tab !== 'chat') { openCockpit(tab); return; }
    setHubOpen(false);
    import('../../../utils/openChatWindow')
      .then(async ({ openChatWindow }) => {
        const ok = await openChatWindow(useAppStore.getState().activeProjectId ?? null);
        if (!ok) openCockpit('chat'); // Web等：別ウィンドウ不可 → 本体内で開く
      })
      .catch(() => openCockpit('chat'));
  };
  // ハブの各項目（配列は上→下の表示順。最下＝ピル直上には別途 Chat を既定として置く）。
  const hubItems = useMemo(() => ([
    { key: 'search', label: 'SEKKEIYA SEARCH', icon: <SearchRoundedIcon sx={{ fontSize: 17 }} />, fg: '#9fe1cb', bg: '#15302a',
      run: () => useAppStore.getState().setGlobalSearchOpen(true) },
    { key: 'gen3d', label: 'AI 3D Generate', icon: <ViewInArRoundedIcon sx={{ fontSize: 17 }} />, fg: '#5dcaa5', bg: '#1d3326',
      run: () => openChatDirect('gen3d') },
    { key: 'render', label: 'AI Render', icon: <ImageRoundedIcon sx={{ fontSize: 17 }} />, fg: '#f0997b', bg: '#332420',
      run: () => openChatDirect('render') },
    { key: 'teamchat', label: 'DM', icon: <AlternateEmailRoundedIcon sx={{ fontSize: 17 }} />, fg: '#ed93b1', bg: '#33202b',
      run: () => openChatDirect('teamchat') },
    { key: 'drive', label: 'SEKKEIYA Drive', icon: <FolderRoundedIcon sx={{ fontSize: 17 }} />, fg: '#85b7eb', bg: '#1d2a33',
      run: () => openChatDirect('drive') },
  ]), []);

  const executeAiTask = async (t: AiTaskMini) => {
    // 1. Firestore status を in_progress へ
    try {
      await updateDoc(doc(db, 'projects', t.projectId, 'tasks', t.id), { status: 'in_progress' });
    } catch (e) {
      console.error('[FloatingPanel] executeAiTask status update failed:', e);
    }
    // 2. デスクトップ通知「タスクを開始しました」
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('send_toast_notification_with_actions', {
        title: '▶ AIタスクを開始しました',
        body: t.title,
        buttons: [['確認', 'ok']],
        key: `started:${t.id}`,
        eventName: 'ai-toast-action',
      });
    } catch (e) {
      console.warn('[FloatingPanel] notification failed:', e);
    }
    // 3. SEKKEIYA Chat にタスク実行メッセージを送信
    const msg = [
      `【AIタスク実行】${t.title}`,
      t.description ? `内容: ${t.description}` : '',
      `プロジェクトID: ${t.projectId}`,
      `タスクID: ${t.id}`,
      `このタスクを実行し、完了したらtask_updateツールでstatusを"done"に更新してください。`,
    ].filter(Boolean).join('\n');
    try {
      const { useCoreOrchestrator } = await import('../../../store/useCoreOrchestrator');
      useCoreOrchestrator.getState().sendMessageToOrchestrator(msg);
      useAppStore.getState().setAIChatOpen(true);
    } catch (e) {
      console.error('[FloatingPanel] chat message failed:', e);
    }
  };

  const handleDeleteTask = async (t: AiTaskMini) => {
    try {
      await deleteDoc(doc(db, 'projects', t.projectId, 'tasks', t.id));
    } catch (e) {
      console.error('[FloatingPanel] handleDeleteTask failed:', e);
    }
  };

  const openSchedulesTab = () => {
    setCurrentMainView('my-site');
    setActiveProjectTab('schedule');
    setPanelOpen(false);
  };

  // フォームを開いたとき履歴を取得
  useEffect(() => {
    if (!showAddForm || !uid) return;
    getDocs(
      query(collection(db, 'users', uid, 'aiTaskHistory'), orderBy('createdAt', 'desc'), limit(50))
    ).then(snap => {
      setTaskHistory(snap.docs.map(d => ({ title: d.data().title as string, projectId: d.data().projectId as string })));
    }).catch(() => {});
  }, [showAddForm, uid]);

  const handleAddTask = async () => {
    if (!addTitle.trim() || addSaving) return;
    const pid = addProjectId || projects[0]?.id;
    if (!pid || !uid) return;
    setAddSaving(true);
    try {
      const title = addTitle.trim();
      await Promise.all([
        addDoc(collection(db, 'projects', pid, 'tasks'), {
          title,
          type: 'ai',
          priority: 'medium',
          status: 'todo',
          dueDate: '',
          description: '',
          createdAt: serverTimestamp(),
          createdBy: uid,
        }),
        // 学習用履歴を保存
        addDoc(collection(db, 'users', uid, 'aiTaskHistory'), {
          title,
          projectId: pid,
          createdAt: serverTimestamp(),
        }),
      ]);
      setAddTitle('');
      setShowAddForm(false);
    } finally {
      setAddSaving(false);
    }
  };

  const aiTaskOuterRight  = useAppStore(s => s.aiTaskOuterRight);
  const aiTaskInnerRight  = useAppStore(s => s.aiTaskInnerRight);
  const aiTaskExtraBottom = useAppStore(s => s.aiTaskExtraBottom);
  const rightPx  = MARGIN + aiTaskOuterRight + aiTaskInnerRight;
  const bottomPx = MARGIN + aiTaskExtraBottom;

  const allItems = batches.flatMap(b => b.items);
  const target = allItems.filter(it => it.status !== 'skipped').length;
  const done = allItems.filter(it => it.status === 'done').length;
  const active = allItems.some(it => it.status === 'queued' || it.status === 'submitting' || it.status === 'generating');
  const activeBatchCount = batches.filter(b =>
    b.items.some(it => it.status === 'queued' || it.status === 'submitting' || it.status === 'generating')
  ).length;
  const activeTaskCount = aiTasks.filter(t => t.status === 'in_progress').length;
  const activeCount = activeBatchCount + activeTaskCount;
  const pct = target > 0 ? Math.round((done / target) * 100) : 0;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // 常時タイマー（10秒間隔）：スケジュール済みタスクの期限チェック用
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  // 開始時刻を過ぎた未着手タスク → 即時実行 + デスクトップ通知
  useEffect(() => {
    aiTasks
      .filter(t =>
        t.status === 'todo' &&
        isTaskOverdue(t.dueDate, t.startTime, now) &&
        !autoStartedRef.current.has(t.id)
      )
      .forEach(t => {
        autoStartedRef.current.add(t.id);
        executeAiTask(t).catch(e => {
          autoStartedRef.current.delete(t.id);
          console.error('[FloatingPanel] auto-run failed:', e);
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiTasks, now]);

  useEffect(() => {
    if (!uid || projects.length === 0) return;
    const taskMap: Record<string, AiTaskMini[]> = {};
    const unsubs = projects.map(p =>
      onSnapshot(
        query(collection(db, 'projects', p.id, 'tasks'), where('type', '==', 'ai')),
        snap => {
          taskMap[p.id] = snap.docs
            .map(d => ({ id: d.id, projectId: p.id, projectName: p.name, ...d.data() } as AiTaskMini))
            .filter(t => t.status === 'todo' || t.status === 'in_progress');
          setAiTasks(
            Object.values(taskMap).flat().sort((a, b) => {
              if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
              if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
              const da = a.dueDate || '';
              const db_ = b.dueDate || '';
              if (!da && !db_) return 0;
              if (!da) return 1;
              if (!db_) return -1;
              return da < db_ ? -1 : da > db_ ? 1 : 0;
            })
          );
        }
      )
    );
    return () => unsubs.forEach(u => u());
  }, [uid, projects]);

  // 3D生成クォータをリアルタイム購読（users/{uid} ドキュメント）
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const isOfficial = OFFICIAL_EMAILS.has(data.email || '');
      const plan = isOfficial ? 'official' : (data.plan || 'free');
      const rawLimit = (AI_3D_LIMITS as any)[plan]?.tripo3d?.monthly ?? 0;
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const usage = data.aiUsage?.tripo3d || {};
      const used = usage.lastMonthlyResetAt === monthStr ? (usage.monthlyCount || 0) : 0;
      setGen3dQuota({ used, limit: rawLimit, plan });
    });
    return () => unsub();
  }, [uid]);

  const avgDurationMs = (() => {
    const finished = allItems.filter(it => it.startedAt && it.completedAt && it.status === 'done');
    if (finished.length === 0) return null;
    const total = finished.reduce((sum, it) => sum + (it.completedAt! - it.startedAt!), 0);
    return total / finished.length;
  })();

  const doneItems = allItems.filter(it => it.status === 'done' && it.glbUrl);
  const saveToSModels = async () => {
    if (doneItems.length === 0 || saving) return;
    setSaving(true);
    try {
      await saveBatchDoneItemsToSModels(doneItems);
      // 保存完了後、完了済みバッチをパネルから除去
      const currentBatches = useBatchGenStore.getState().batches;
      currentBatches.forEach(b => {
        const active = b.items.filter(it => it.status !== 'skipped');
        const allSettled = active.every(it => it.status === 'done' || it.status === 'failed');
        if (allSettled) dismissBatch(b.id);
      });
    } finally {
      setSaving(false);
    }
  };

  const suggestions = useMemo(() => {
    const ws = getActiveWorkspace?.();
    // ws?.workspaceType はプロジェクト内ワークスペースのみ有効。
    // グローバル子アプリビュー（例: S.Model Global）では lastActiveAppScope を使う。
    const appScope = ws?.workspaceType ?? lastActiveAppScope ?? lastLaunchPayload?.appScope ?? undefined;
    return getChatSuggestions({
      scope: currentMainView === 'my-site' ? 'account' : undefined,
      activeWorkspaceType: appScope,
      activeAppScope: appScope,
      isAIDriveOpen,
      isAIRenderOpen,
      isAI3DCreateOpen,
    });
  }, [currentMainView, getActiveWorkspace, lastActiveAppScope, lastLaunchPayload, isAIDriveOpen, isAIRenderOpen, isAI3DCreateOpen]);

  // SEKKEIYA OS が別ウィンドウで開いている間は右下ピル（AIハブ）ごと非表示。窓を閉じれば復帰。
  if (isChatPoppedOut) return null;

  if (!panelOpen) {
    // 枠線（リング）: アイドル時は虹色グラデーション。
    // 実行中は進捗に応じて青が pct% 分だけ一周する「光る枠」に切り替える。
    const conicBg = activeCount > 0
      ? `conic-gradient(from -90deg at 50% 50%, #00BFFF ${pct}%, rgb(var(--brand-fg-rgb) / 0.12) ${pct}%)`
      : 'conic-gradient(from 0deg, #ff0040, #ff8a00, #ffe600, #44d62c, #00c2ff, #4b6cff, #b14bff, #ff3ea5, #ff0040)';

    return (
      <Box
        onMouseEnter={openHub}
        onMouseLeave={scheduleCloseHub}
        sx={{
          position: 'fixed', right: rightPx, bottom: bottomPx, zIndex: 2000,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
        }}
      >
        {/* ホバーで展開する AI 機能ランチャー（下＝ピル寄りほど先にふわっと出す） */}
        <AnimatePresence>
          {hubOpen && (
            <motion.div
              key="chat-hub-fan"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}
            >
              {hubItems.map((it, i) => (
                <motion.div
                  key={it.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.14, delay: (hubItems.length - i) * 0.03, ease: 'easeOut' }}
                >
                  <Box
                    onClick={(e) => { e.stopPropagation(); it.run(); setHubOpen(false); }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      height: 40, pl: '4px', pr: '14px',
                      bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                      borderRadius: '22px', cursor: 'pointer', whiteSpace: 'nowrap',
                      color: 'rgb(var(--brand-fg-rgb) / 0.82)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
                      transition: 'background 0.12s, color 0.12s',
                      '&:hover': { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' },
                    }}
                  >
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: it.bg, color: it.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {it.icon}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{it.label}</Typography>
                  </Box>
                </motion.div>
              ))}
              {/* Chat（既定・ピル直上） */}
              <motion.div
                key="chat-hub-chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.14, delay: 0, ease: 'easeOut' }}
              >
                <Box
                  onClick={(e) => { e.stopPropagation(); openChatDirect(); }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    height: 40, pl: '4px', pr: '14px',
                    bgcolor: 'var(--brand-surface2)', border: '1px solid rgba(52,152,219,0.55)',
                    borderRadius: '22px', cursor: 'pointer', whiteSpace: 'nowrap',
                    color: 'var(--brand-fg)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
                    transition: 'background 0.12s',
                    '&:hover': { bgcolor: 'var(--brand-surface2)' },
                  }}
                >
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#3498db', color: 'var(--brand-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ForumRoundedIcon sx={{ fontSize: 17 }} />
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 500 }}>Chat</Typography>
                  <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', ml: '2px' }}>既定</Typography>
                </Box>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ピル本体：クリック＝チャット直行（バッチ進行中は進捗パネルを再表示）。ホバー＝ランチャー展開。 */}
        <Box
          onClick={() => {
            if (batches.length > 0) { setPanelOpen(true); return; }
            openChatDirect();
          }}
          sx={{
            position: 'relative',
            cursor: 'pointer',
            borderRadius: '22px',
            padding: '2px',
            background: conicBg,
            boxShadow: activeCount > 0
              ? '0 0 12px rgba(0,191,255,0.5), 0 2px 16px rgba(0,0,0,0.6)'
              : '0 2px 12px rgba(0,0,0,0.6)',
            '&:hover .ai-task-inner': { pr: '14px' },
            '&:hover .ai-task-label': { maxWidth: '130px !important', opacity: '1 !important', ml: '7px !important' },
            '&:hover .ai-task-spinner': { maxWidth: '14px !important', opacity: '1 !important', ml: '4px !important' },
          }}
        >
          {/* 実行中タスク数バッジ */}
          {activeCount > 0 && (
            <Box sx={{
              position: 'absolute', top: -6, right: -6,
              minWidth: 16, height: 16, px: '3px',
              bgcolor: '#ff7043', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: 'var(--brand-fg)',
              border: '1.5px solid #1a1f2b', lineHeight: 1,
            }}>
              {activeCount > 9 ? '9+' : activeCount}
            </Box>
          )}
          {/* 内側ピル：収納時はアイコンが丸くボタン全面を覆い、暗い地が見えないようにする。
              ホバー時のみ右側にラベル分の余白（暗い地）が伸びる。 */}
          <Box className="ai-task-inner" sx={{
            display: 'flex', alignItems: 'center',
            bgcolor: 'var(--brand-surface2)',
            borderRadius: '21px',
            p: 0,
            overflow: 'hidden',
            transition: 'padding-right 0.22s ease',
          }}>
            <SekkeiyaIcon size={38} radius="50%" active={activeCount > 0} />
            <Typography className="ai-task-label" sx={{
              fontSize: 12.5, fontWeight: 600,
              color: activeCount > 0 ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.65)',
              userSelect: 'none', maxWidth: 0, opacity: 0, overflow: 'hidden', whiteSpace: 'nowrap',
              transition: 'max-width 0.22s ease, opacity 0.18s ease, margin-left 0.22s ease',
            }}>
              SEKKEIYA OS
            </Typography>
            {active && (
              <Box className="ai-task-spinner" sx={{ maxWidth: 0, opacity: 0, overflow: 'hidden', flexShrink: 0, transition: 'max-width 0.22s ease, opacity 0.18s ease, margin-left 0.22s ease', display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={10} thickness={5} sx={{ color: 'light-dark(#ad6700, #ffb74d)' }} />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      position: 'fixed', right: rightPx, bottom: bottomPx, zIndex: 2000,
      width: 340, maxHeight: '62vh', display: 'flex', flexDirection: 'column',
      bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 2,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden',
    }}>
      <Box sx={{ px: 1.5, pt: 1, pb: target > 0 || doneItems.length > 0 ? 0.75 : 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
        {/* 1行目: アイコン + タイトル + 最小化 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SekkeiyaIcon size={18} active={active} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)', flex: 1 }}>
            {batches.length === 0 ? 'AI タスク' : 'AI タスク — 3D生成'}
          </Typography>
          <Tooltip title={isAIChatOpen ? 'チャットを閉じる' : 'チャットを開く'} placement="top">
            <IconButton size="small" onClick={toggleAIChat} sx={{
              color: isAIChatOpen ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.4)',
              bgcolor: isAIChatOpen ? 'rgba(0,191,255,0.1)' : 'transparent',
              borderRadius: '6px',
              '&:hover': { color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.12)' },
            }}>
              <ForumRoundedIcon sx={{ fontSize: '0.95rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Schedules & Tasks を開く" placement="top">
            <IconButton size="small" onClick={openSchedulesTab} sx={{
              color: 'rgb(var(--brand-fg-rgb) / 0.4)',
              borderRadius: '6px',
              '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
            }}>
              <AssignmentRoundedIcon sx={{ fontSize: '0.95rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="最小化" placement="top">
            <IconButton size="small" onClick={() => setPanelOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}>
              <ExpandMoreRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {/* 2行目: 進捗バッジ + 保存ボタン（どちらかが表示されるときのみ） */}
        {(target > 0 || doneItems.length > 0) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
            {target > 0 && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1, py: 0.25, borderRadius: 1.5,
                bgcolor: active ? 'rgba(255,183,77,0.12)' : 'rgba(102,187,106,0.12)',
                border: `1px solid ${active ? 'rgba(255,183,77,0.3)' : 'rgba(102,187,106,0.3)'}`,
              }}>
                {active && <CircularProgress size={10} thickness={5} sx={{ color: 'light-dark(#ad6700, #ffb74d)' }} />}
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: active ? 'light-dark(#ad6700, #ffb74d)' : '#66bb6a' }}>
                  {pct}%
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                  {done}/{target}
                </Typography>
              </Box>
            )}
            {doneItems.length > 0 && (
              <Button
                size="small" variant="contained" disabled={saving}
                startIcon={saving
                  ? <CircularProgress size={12} thickness={5} sx={{ color: '#0c1f12' }} />
                  : <SaveAltRoundedIcon sx={{ fontSize: '0.85rem' }} />}
                onClick={saveToSModels}
                sx={{ fontSize: '0.62rem', textTransform: 'none', py: 0.25, px: 0.75, bgcolor: '#66bb6a', color: '#0c1f12', '&:hover': { bgcolor: '#81c784' }, '&.Mui-disabled': { bgcolor: 'rgba(102,187,106,0.5)', color: '#0c1f12' } }}
              >
                {saving ? '開いています…' : `S.Modelに保存${doneItems.length > 1 ? `（${doneItems.length}）` : ''}`}
              </Button>
            )}
            <Tooltip title={autoSaveToModels ? '完了時に自動保存 ON' : '完了時に自動保存 OFF'} placement="top" slotProps={{ popper: { sx: { zIndex: 2100 } } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto' }}>
                <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', userSelect: 'none' }}>自動保存</Typography>
                <Switch
                  size="small"
                  checked={autoSaveToModels}
                  onChange={e => setAutoSaveToModels(e.target.checked)}
                  sx={{
                    width: 28, height: 16, p: 0,
                    '& .MuiSwitch-switchBase': { p: '2px', '&.Mui-checked': { transform: 'translateX(12px)', color: 'var(--brand-fg)', '& + .MuiSwitch-track': { bgcolor: '#66bb6a', opacity: 1 } } },
                    '& .MuiSwitch-thumb': { width: 12, height: 12 },
                    '& .MuiSwitch-track': { borderRadius: 8, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.2)', opacity: 1 },
                  }}
                />
              </Box>
            </Tooltip>
          </Box>
        )}
      </Box>

      {target > 0 && (
        <LinearProgress
          variant="determinate" value={pct}
          sx={{ height: 4, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)',
            '& .MuiLinearProgress-bar': { bgcolor: active ? '#ffb74d' : '#66bb6a', transition: 'transform 0.4s ease' } }}
        />
      )}

      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {/* 空の状態（バッチもAIタスクも無い） */}
        {batches.length === 0 && aiTasks.length === 0 && !showAddForm && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4, gap: 1 }}>
            <SekkeiyaIcon size={28} active={false} />
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
              AIタスクはありません
            </Typography>
          </Box>
        )}

        {showAddForm && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00BFFF', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-fg)', flex: 1 }}>AIタスクを追加</Typography>
              <IconButton size="small" onClick={() => setShowAddForm(false)}
                sx={{ p: '3px', color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>

            {/* プロジェクト選択（ネイティブ select） */}
            {projects.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.5 }}>
                  プロジェクト
                </Typography>
                <Box
                  component="select"
                  value={addProjectId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAddProjectId(e.target.value)}
                  sx={{
                    width: '100%', fontSize: 12.5, color: 'var(--brand-fg)',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)',
                    border: '1px solid rgb(var(--brand-fg-rgb) / 0.18)',
                    borderRadius: '6px', px: 1.25, py: 0.75,
                    outline: 'none', cursor: 'pointer', appearance: 'auto',
                    '&:focus': { borderColor: '#00BFFF', outline: 'none' },
                    '& option': { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' },
                  }}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Box>
              </Box>
            )}

            {/* タイトル入力（ネイティブ textarea） */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.5 }}>
                タイトル *
              </Typography>
              <Box
                component="textarea"
                ref={titleInputRef}
                placeholder="タスクのタイトルを入力…"
                value={addTitle}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAddTitle(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTask(); }
                }}
                rows={3}
                sx={{
                  width: '100%', boxSizing: 'border-box',
                  fontSize: 12.5, color: 'var(--brand-fg)', lineHeight: 1.5,
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)',
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.18)',
                  borderRadius: '6px', px: 1.25, py: 0.875,
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  '&::placeholder': { color: 'rgb(var(--brand-fg-rgb) / 0.3)' },
                  '&:focus': { borderColor: '#00BFFF', outline: 'none' },
                }}
              />
              {/* 過去タスクのサジェスト */}
              {(() => {
                const curPid = addProjectId || projects[0]?.id || '';
                // 頻度カウント
                const freq = new Map<string, { count: number; sameProject: boolean }>();
                for (const h of taskHistory) {
                  const key = h.title;
                  const prev = freq.get(key);
                  freq.set(key, {
                    count: (prev?.count ?? 0) + 1,
                    sameProject: (prev?.sameProject ?? false) || h.projectId === curPid,
                  });
                }
                // 重複排除 → スコア順(プロジェクト一致+頻度) → 入力前方一致フィルタ → 上位6件
                const filter = addTitle.trim().toLowerCase();
                const suggestions = [...freq.entries()]
                  .filter(([t]) => !filter || t.toLowerCase().includes(filter))
                  .sort((a, b) => {
                    const sa = (a[1].sameProject ? 100 : 0) + a[1].count;
                    const sb = (b[1].sameProject ? 100 : 0) + b[1].count;
                    return sb - sa;
                  })
                  .slice(0, 6)
                  .map(([t]) => t);
                if (suggestions.length === 0) return null;
                return (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {suggestions.map(s => (
                      <Box
                        key={s}
                        onClick={() => setAddTitle(s)}
                        sx={{
                          fontSize: 10, px: 0.875, py: 0.25,
                          borderRadius: 10,
                          border: '1px solid rgba(0,191,255,0.3)',
                          color: 'rgba(0,191,255,0.8)',
                          bgcolor: 'rgba(0,191,255,0.06)',
                          cursor: 'pointer', userSelect: 'none',
                          whiteSpace: 'nowrap', maxWidth: '100%',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          '&:hover': { bgcolor: 'rgba(0,191,255,0.14)', color: '#00BFFF' },
                        }}
                      >
                        {s}
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </Box>

            {/* ボタン行 */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setShowAddForm(false)}
                sx={{ fontSize: 11, textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}>
                キャンセル
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!addTitle.trim() || addSaving || (!addProjectId && projects.length > 0)}
                onClick={handleAddTask}
                sx={{
                  fontSize: 11, textTransform: 'none', fontWeight: 700,
                  bgcolor: '#00BFFF', color: '#001a26',
                  '&:hover': { bgcolor: '#33ccff' },
                  '&.Mui-disabled': { bgcolor: 'rgba(0,191,255,0.3)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                }}
              >
                {addSaving ? <CircularProgress size={12} sx={{ color: '#001a26' }} /> : '追加'}
              </Button>
            </Box>
          </Box>
        )}

        {/* バッチ生成 */}
        {batches.map(b => {
          const bActive = b.items.some(it => it.status === 'queued' || it.status === 'submitting' || it.status === 'generating');
          const bDone = b.items.filter(it => it.status === 'done').length;
          const bTarget = b.items.filter(it => it.status !== 'skipped').length;
          const bFailed = b.items.filter(it => it.status === 'failed').length;
          const bPct = bTarget > 0 ? Math.round((bDone / bTarget) * 100) : 0;

          const remainingMs = (() => {
            if (!bActive || !avgDurationMs) return null;
            const generatingItems = b.items.filter(it => it.status === 'generating' && it.startedAt);
            const queuedCount = b.items.filter(it => it.status === 'queued' || it.status === 'submitting').length;
            const alreadyMs = generatingItems.reduce((sum, it) => sum + Math.min(now - it.startedAt!, avgDurationMs), 0);
            const totalRemainingWork = (generatingItems.length + queuedCount) * avgDurationMs - alreadyMs;
            return Math.max(0, totalRemainingWork);
          })();

          return (
            <Box key={b.id} sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75 }}>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)', flex: 1 }}>
                  <Box component="span" sx={{ fontWeight: 700, color: bActive ? 'light-dark(#ad6700, #ffb74d)' : '#66bb6a' }}>
                    {bPct}%
                  </Box>
                  {' '}({bDone}/{bTarget} 完了)
                  {b.skipped > 0 ? `・${b.skipped}件 上限超過` : ''}
                  {bFailed > 0 ? `・${bFailed}件 失敗` : ''}
                  {b.cancelled ? '・キャンセル済' : ''}
                </Typography>
                {bActive && remainingMs !== null && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                    <AccessTimeRoundedIcon sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }} />
                    <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.5)', whiteSpace: 'nowrap' }}>
                      {formatRemaining(remainingMs)}
                    </Typography>
                  </Box>
                )}
                {bFailed > 0 && !bActive && (
                  <Button
                    size="small" startIcon={<RefreshRoundedIcon sx={{ fontSize: '0.8rem' }} />}
                    onClick={() => retryFailed(b.id)}
                    sx={{ fontSize: 10, color: 'light-dark(#ad6700, #ffb74d)', minWidth: 'auto', p: 0.25, textTransform: 'none' }}
                  >
                    失敗分を再生成
                  </Button>
                )}
                {bActive && !b.cancelled ? (
                  <Button size="small" onClick={() => cancelBatch(b.id)} sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.6)', minWidth: 'auto', p: 0.25 }}>
                    キャンセル
                  </Button>
                ) : (
                  <IconButton size="small" onClick={() => dismissBatch(b.id)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
                    <CloseRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Box>

              <Box sx={{ px: 1.5, pb: 0.5 }}>
                <LinearProgress
                  variant="determinate" value={bPct}
                  sx={{ height: 2, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)',
                    '& .MuiLinearProgress-bar': { bgcolor: bActive ? '#ffb74d' : '#66bb6a' } }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(54px, 1fr))', gap: 0.5, px: 1.5, pb: 1 }}>
                {b.items.map(it => {
                  const elapsed = it.startedAt ? now - it.startedAt : null;
                  const isGenerating = it.status === 'generating';
                  const completionTime = (it.startedAt && it.completedAt)
                    ? it.completedAt - it.startedAt : null;

                  return (
                    <Tooltip key={it.imageId}
                      title={`${STATUS_LABEL[it.status]}${it.error ? ' — ' + it.error : ''}${completionTime ? ` (${formatDuration(completionTime)})` : ''}`}
                      placement="top">
                      <Box
                        component={it.status === 'done' && it.glbUrl ? 'a' : 'div'}
                        {...(it.status === 'done' && it.glbUrl ? { href: it.glbUrl, target: '_blank', rel: 'noreferrer' } : {})}
                        sx={{
                          position: 'relative', aspectRatio: '1', borderRadius: 1, overflow: 'hidden',
                          border: `1.5px solid ${STATUS_COLOR[it.status]}`,
                          opacity: it.status === 'skipped' ? 0.4 : 1,
                          display: 'block',
                          ...(isGenerating ? {
                            '@keyframes pulse-border': {
                              '0%, 100%': { borderColor: '#ffb74d', boxShadow: '0 0 0 0 rgba(255,183,77,0)' },
                              '50%': { borderColor: '#ffe082', boxShadow: '0 0 6px 2px rgba(255,183,77,0.35)' },
                            },
                            animation: 'pulse-border 1.6s ease-in-out infinite',
                          } : {}),
                        }}
                      >
                        <Box component="img" src={it.inputImageUrl} alt=""
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <Box sx={{
                          position: 'absolute', left: 0, right: 0, bottom: 0,
                          bgcolor: 'rgba(0,0,0,0.65)', textAlign: 'center', py: '2px',
                        }}>
                          {isGenerating && elapsed !== null ? (
                            <Typography sx={{ fontSize: 7.5, color: 'light-dark(#ad6700, #ffb74d)', lineHeight: 1.4, fontWeight: 700 }}>
                              {formatDuration(elapsed)}
                            </Typography>
                          ) : completionTime !== null && it.status === 'done' ? (
                            <Typography sx={{ fontSize: 7.5, color: '#66bb6a', lineHeight: 1.4 }}>
                              {formatDuration(completionTime)}
                            </Typography>
                          ) : (
                            <Typography sx={{ fontSize: 8, color: STATUS_COLOR[it.status], lineHeight: 1.4 }}>
                              {STATUS_LABEL[it.status]}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          );
        })}

        {/* AIタスクリスト */}
        {aiTasks.length > 0 && (
          <>
            {batches.length > 0 && (
              <Box sx={{ mx: 1.5, my: 0.25, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)' }} />
            )}
            <Box sx={{ px: 1.5, pt: 0.75, pb: 0.25 }}>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 600, letterSpacing: 0.8, mb: 0.5, textTransform: 'uppercase' }}>
                タスク ({aiTasks.length})
              </Typography>
              {aiTasks.map(t => {
                const overdue = t.status === 'todo' && isTaskOverdue(t.dueDate, t.startTime, now);
                return (
                <Box key={t.id} sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75,
                  borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.04)',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover .ai-task-delete-btn': { opacity: 1 },
                  ...(overdue ? {
                    mx: -1.5, px: 1.5,
                    bgcolor: 'rgba(239,83,80,0.06)',
                    borderLeft: '2px solid rgba(239,83,80,0.5)',
                  } : {}),
                }}>
                  <Box sx={{
                    width: 7, height: 7, borderRadius: '50%', mt: '5px', flexShrink: 0,
                    bgcolor: overdue ? '#ef5350' : t.status === 'in_progress' ? '#ffb74d' : 'rgba(0,191,255,0.8)',
                    ...((t.status === 'in_progress' || overdue) ? {
                      '@keyframes pulse-dot': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.4 },
                      },
                      animation: 'pulse-dot 1.6s ease-in-out infinite',
                    } : {}),
                  }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: 12, color: 'var(--brand-fg)', lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.2, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
                        {t.projectName}
                      </Typography>
                      <Box component="span" sx={{
                        fontSize: 10,
                        color: overdue ? 'rgba(239,83,80,0.9)' : t.status === 'in_progress' ? 'light-dark(rgba(173,103,0,0.7), rgba(255,183,77,0.7))' : 'rgba(0,191,255,0.6)',
                        fontWeight: overdue ? 700 : 400,
                      }}>
                        {overdue ? '開始待ち' : t.status === 'in_progress' ? '進行中' : '未着手'}
                      </Box>
                      {formatTaskDateTime(t.dueDate, t.startTime) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <AccessTimeRoundedIcon sx={{ fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.25)' }} />
                          <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                            {formatTaskDateTime(t.dueDate, t.startTime)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                  {t.status === 'todo' && (
                    <Tooltip title={overdue ? '開始時刻を過ぎています — 今すぐ実行' : '実行'}>
                      <IconButton
                        size="small"
                        onClick={() => executeAiTask(t)}
                        sx={{
                          flexShrink: 0, p: '3px',
                          color: overdue ? 'rgba(239,83,80,0.8)' : 'rgba(0,191,255,0.5)',
                          border: `1px solid ${overdue ? 'rgba(239,83,80,0.4)' : 'rgba(0,191,255,0.2)'}`,
                          borderRadius: '6px',
                          '&:hover': overdue
                            ? { color: '#ef5350', bgcolor: 'rgba(239,83,80,0.12)', borderColor: 'rgba(239,83,80,0.7)' }
                            : { color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)', borderColor: 'rgba(0,191,255,0.5)' },
                        }}
                      >
                        <PlayArrowRoundedIcon sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="削除">
                    <IconButton
                      className="ai-task-delete-btn"
                      size="small"
                      onClick={() => handleDeleteTask(t)}
                      sx={{
                        flexShrink: 0, p: '3px',
                        opacity: 0,
                        transition: 'opacity 0.15s ease',
                        color: 'rgb(var(--brand-fg-rgb) / 0.4)',
                        borderRadius: '6px',
                        '&:hover': { color: '#ef5350', bgcolor: 'rgba(239,83,80,0.1)' },
                      }}
                    >
                      <CloseRoundedIcon sx={{ fontSize: '0.85rem' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                );
              })}
            </Box>
          </>
        )}

        {/* 3D生成クォータ表示 */}
        {gen3dQuota && !showAddForm && (() => {
          const isUnlimited = gen3dQuota.limit === Infinity;
          const remaining = isUnlimited ? Infinity : Math.max(0, gen3dQuota.limit - gen3dQuota.used);
          const pctUsed = isUnlimited ? 0 : gen3dQuota.limit > 0 ? (gen3dQuota.used / gen3dQuota.limit) * 100 : 100;
          const isLow = !isUnlimited && remaining <= 1;
          const isOut = !isUnlimited && remaining === 0;
          const barColor = isOut ? '#ef5350' : isLow ? '#ffb74d' : '#00BFFF';
          const PLAN_LABEL: Record<string, string> = { free: 'Free', standard: 'Standard', premium: 'Premium', pro: 'Pro', enterprise: 'Enterprise', official: '公式' };
          return (
            <Box sx={{
              mx: 1.5, my: 0.5, p: '8px 10px',
              bgcolor: isOut ? 'rgba(239,83,80,0.07)' : isLow ? 'rgba(255,183,77,0.07)' : 'rgba(0,191,255,0.05)',
              border: `1px solid ${isOut ? 'rgba(239,83,80,0.25)' : isLow ? 'rgba(255,183,77,0.25)' : 'rgba(0,191,255,0.15)'}`,
              borderRadius: '8px',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '5px' }}>
                <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontWeight: 600, letterSpacing: 0.5 }}>
                  3D生成 今月の残り枠
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{
                    fontSize: 9, px: '5px', py: '1px', borderRadius: '4px',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'rgb(var(--brand-fg-rgb) / 0.35)',
                  }}>
                    {PLAN_LABEL[gen3dQuota.plan] ?? gen3dQuota.plan}
                  </Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: barColor }}>
                    {isUnlimited ? '無制限' : `残り ${remaining}件`}
                  </Typography>
                  {!isUnlimited && (
                    <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
                      / {gen3dQuota.limit}件
                    </Typography>
                  )}
                </Box>
              </Box>
              {!isUnlimited && (
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, pctUsed)}
                  sx={{
                    height: 3, borderRadius: 2,
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)',
                    '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 2 },
                  }}
                />
              )}
              {isOut && (
                <Typography sx={{ fontSize: 10, color: '#ef5350', mt: '4px' }}>
                  今月の上限に達しました。来月リセットされます。
                </Typography>
              )}
            </Box>
          );
        })()}

        {/* コンテキスト連動サジェスト */}
        {!showAddForm && suggestions.length > 0 && (
          <Box sx={{ px: 1.5, pt: 0.75, pb: 0.25, borderTop: aiTasks.length > 0 || batches.length > 0 ? '1px solid rgb(var(--brand-fg-rgb) / 0.07)' : 'none' }}>
            <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 600, letterSpacing: 0.8, mb: 0.5, textTransform: 'uppercase' }}>
              候補
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {suggestions.map(s => (
                <Box
                  key={s.label}
                  onClick={async () => {
                    try {
                      const { useCoreOrchestrator } = await import('../../../store/useCoreOrchestrator');
                      useCoreOrchestrator.getState().sendMessageToOrchestrator(s.text);
                      setAIChatOpen(true);
                      setPanelOpen(false);
                    } catch (e) {
                      console.error('[FloatingPanel] suggestion send failed:', e);
                    }
                  }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)',
                    bgcolor: 'rgba(255,215,64,0.06)', border: '1px solid rgba(255,215,64,0.25)',
                    borderRadius: 5, px: 1, py: 0.4, cursor: 'pointer', transition: 'all 0.15s',
                    '&:hover': { bgcolor: 'rgba(255,215,64,0.14)', color: 'var(--brand-fg)', borderColor: 'rgba(255,215,64,0.5)' },
                  }}
                >
                  <AutoAwesomeRoundedIcon sx={{ fontSize: '0.65rem', color: 'light-dark(#ad8900, #ffd740)' }} />
                  {s.label}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* 常時表示の追加ボタン */}
        {!showAddForm && (
          <Box sx={{ px: 1.5, py: 0.75, borderTop: 'none' }}>
            <Button
              fullWidth
              size="small"
              startIcon={<AddRoundedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => {
                setAddTitle('');
                setAddProjectId(projects[0]?.id ?? '');
                setShowAddForm(true);
                setTimeout(() => titleInputRef.current?.focus(), 50);
              }}
              sx={{
                textTransform: 'none', fontWeight: 700, fontSize: '0.72rem',
                px: 1.5, py: 0.5, borderRadius: 2,
                color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.07)',
                border: '1px solid rgba(0,191,255,0.2)',
                justifyContent: 'flex-start',
                '&:hover': { bgcolor: 'rgba(0,191,255,0.15)', borderColor: 'rgba(0,191,255,0.4)' },
              }}
            >
              AIタスクを追加
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};
