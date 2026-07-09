// ChatWindow — ポップアウトされた SEKKEIYA Chat の中身（独立ネイティブウィンドウ /?chatWindow=true で描画）。
//
// StandaloneWorkspace と同型：認証（AuthGuard）配下でマウントされる前提で、URL の projectId を
// アプリストアへ流し込み、本体からの `sekkeiya://project-changed` ブロードキャストでプロジェクト追従する。
// チャット履歴・アクティブセッションは localStorage 共有（useAIChatStore の persist）なので、
// 窓を開いた時点で本体と同じ会話が表示される。
//
// 左サイドバー（チャット階層 = ProjectChatBrowser）は本体のコックピットが持っていて AIChatPanel
// 単体には無いため、この窓でも本体と同じレイアウト（サイドバー＋パネル）を再現する。開閉は
// AIChatPanel ヘッダーのサイドバー・トグル（useAppStore.isChatHistorySidebarOpen）と共有する。
import { useEffect, useState } from 'react';
import { Box, ThemeProvider, CssBaseline, CircularProgress, Tooltip, IconButton, Typography } from '@mui/material';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import { openSearchWindow } from '../utils/openSearchWindow';
import { openDriveWindow } from '../utils/openDriveWindow';
import { openReaderHome } from '../features/dsb/lib/openReader';
import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
import { useAppStore, TEMPLATE_WORKSPACE_NAME } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAIChatStore } from '../store/useAIChatStore';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';
import { useAppTheme } from '../styles/useAppTheme';
import AIChatPanel from '../components/AI/AIChatPanel';
import ProjectChatBrowser from '../features/team-chat/ProjectChatBrowser';
import { TeamChatPanel } from '../features/team-chat/TeamChatPanel';
import { TeamChatNavigator } from '../features/team-chat/TeamChatNavigator';

type ChatMode = 'chat' | 'dm';

// Chat / DM の切り替えセグメント・トグル（Claude 風）。サイドバー最上部（新規チャットの上）に置く。
const ChatDmToggle = ({ mode, onChange }: { mode: ChatMode; onChange: (m: ChatMode) => void }) => {
  const items: { key: ChatMode; label: string; icon: React.ReactNode }[] = [
    { key: 'chat', label: 'Agent', icon: <ForumRoundedIcon sx={{ fontSize: '0.9rem' }} /> },
    { key: 'dm', label: 'DM', icon: <AlternateEmailRoundedIcon sx={{ fontSize: '0.9rem' }} /> },
  ];
  return (
    <Box sx={{ p: 1, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', gap: 0.5, p: '3px', borderRadius: '9px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' }}>
        {items.map(it => {
          const active = mode === it.key;
          return (
            <Box
              key={it.key}
              onClick={() => onChange(it.key)}
              sx={{
                flex: 1, py: 0.5, borderRadius: '7px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                fontSize: '0.72rem', fontWeight: active ? 600 : 500,
                color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.55)',
                bgcolor: active ? 'var(--brand-surface2)' : 'transparent',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.25)' : 'none',
                transition: 'color 0.15s, background-color 0.15s',
                '&:hover': { color: 'var(--brand-fg)' },
              }}
            >
              {it.icon}{it.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
import { ALL_CHILD_TABS, OPEN_SUBAPP_EVENT, ACTIVE_SUBAPP_EVENT, REQUEST_ACTIVE_SUBAPP_EVENT } from '../shared/layout/workspace/WorkspaceTabBar';
import { CHAT_KICKOFF_EVENT, runKickoffHere, type ChatKickoffPayload } from '../features/projects/chat/chatKickoff';

// ポップアウト Chat 窓の最上部トップバー（Claude 風）。
//   左: サイドバー開閉トグル ＋「SEKKEIYA Chat」＋プロジェクト chip
//   右: 本体の子アプリを切り替えるリモコン・アイコン列（右寄せ）。クリックで本体（メイン
//       SEKKEIYA ウィンドウ）の表示をその子アプリへ切り替える。表示アイコンは本体ヘッダーと
//       同じ pinnedTabIds（localStorage 共有）に従う。
const WindowTopBar = () => {
  const pinnedTabIds = useAppStore(s => s.pinnedTabIds);
  const isChatHistorySidebarOpen = useAppStore(s => s.isChatHistorySidebarOpen);
  const toggleChatHistorySidebar = useAppStore(s => s.toggleChatHistorySidebar);
  const [activeScope, setActiveScope] = useState<string | null>(null);
  // Reader は購読フィード取得（数秒）を挟んでから窓が開くため、その間ボタンにスピナーを出す。
  const [readerLoading, setReaderLoading] = useState(false);
  const handleOpenReader = async () => {
    if (readerLoading) return;
    setReaderLoading(true);
    try { await openReaderHome(); } finally { setReaderLoading(false); }
  };

  // 本体が配信する「現在表示中の子アプリ scope」を受けてハイライトする。
  // 購読を張ってから現在値を問い合わせる（後から開いた窓でも初期ハイライトが付く）。
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<{ scope: string | null }>(ACTIVE_SUBAPP_EVENT, (e) => {
      setActiveScope(e.payload?.scope ?? null);
    }).then(fn => {
      unlisten = fn;
      emit(REQUEST_ACTIVE_SUBAPP_EVENT).catch(() => {});
    });
    return () => { unlisten?.(); };
  }, []);

  const tabs = pinnedTabIds
    .map(id => ALL_CHILD_TABS.find(t => t.scope === id))
    .filter((t): t is (typeof ALL_CHILD_TABS)[number] => !!t);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 1, pr: 1.25, height: 44, flexShrink: 0, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'var(--brand-surface)' }}>
      {/* 左: サイドバー開閉トグル */}
      <Tooltip title="チャット履歴サイドバー" placement="bottom">
        <IconButton
          size="small"
          onClick={toggleChatHistorySidebar}
          sx={{ color: isChatHistorySidebarOpen ? 'light-dark(#ad8900, #ffd740)' : 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}
        >
          <ViewSidebarRoundedIcon sx={{ fontSize: '1.15rem' }} />
        </IconButton>
      </Tooltip>
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.3px', color: 'var(--brand-fg)', flexShrink: 0 }}>
        SEKKEIYA OS
      </Typography>

      {/* SEKKEIYA SEARCH / READER をここから開く（どちらも独立ウィンドウ・1枚使い回し）。 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 0.5, pl: 0.5, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', flexShrink: 0 }}>
        <Tooltip title="SEKKEIYA Search（横断検索）" placement="bottom">
          <IconButton
            size="small"
            onClick={() => { void openSearchWindow(); }}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}
          >
            <SearchRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="SEKKEIYA Drive（資産の保管庫）" placement="bottom">
          <IconButton
            size="small"
            onClick={() => { void openDriveWindow(); }}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}
          >
            <CloudRoundedIcon sx={{ fontSize: '1.05rem' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={readerLoading ? '記事を読み込み中…' : 'SEKKEIYA Reader（記事リーダー）'} placement="bottom">
          <span>
            <IconButton
              size="small"
              onClick={() => { void handleOpenReader(); }}
              disabled={readerLoading}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}
            >
              {readerLoading
                ? <CircularProgress size={15} thickness={5} sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
                : <MenuBookRoundedIcon sx={{ fontSize: '1.05rem' }} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* スペーサ（子アプリアイコンを右寄せ） */}
      <Box sx={{ flex: 1, minWidth: 8 }} />

      {/* 右: 子アプリ・リモコン（横スクロール可・スクロールバー非表示） */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
        {tabs.map(tab => {
          const isActive = tab.scope === activeScope;
          return (
            <Tooltip key={tab.scope} title={tab.label} placement="bottom">
              <Box
                onClick={() => { emit(OPEN_SUBAPP_EVENT, { scope: tab.scope }).catch(() => {}); }}
                sx={{
                  width: 28, height: 28, borderRadius: '7px', flexShrink: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: `color-mix(in srgb, ${tab.color} ${isActive ? 28 : 12}%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${tab.color} ${isActive ? 70 : 28}%, transparent)`,
                  boxShadow: isActive ? `0 0 8px color-mix(in srgb, ${tab.color} 45%, transparent)` : 'none',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
                  '&:hover': { transform: 'translateY(-1px) scale(1.08)', bgcolor: `color-mix(in srgb, ${tab.color} 22%, transparent)` },
                }}
              >
                {tab.icon
                  ? <img src={tab.icon} alt={tab.label} style={{ width: 19, height: 19, objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
                  : <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tab.color }} />}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

export const ChatWindow = () => {
  const appTheme = useAppTheme();
  const params = new URLSearchParams(window.location.search);
  const initialProjectId = params.get('projectId');

  const [ready, setReady] = useState(false);
  const isChatHistorySidebarOpen = useAppStore(s => s.isChatHistorySidebarOpen);
  const [chatTopicId, setChatTopicId] = useState<string | undefined>(undefined);
  // Chat（AI/プロジェクト会話）⇄ DM（メンバー間ダイレクト）の切り替え。
  const [chatMode, setChatMode] = useState<ChatMode>('chat');

  // チームプロジェクトが選択されているときは本体同様チームチャットを表示する。
  const projects = useAppStore(s => s.projects);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeTeamProject = activeProject?.isTeam ? activeProject : undefined;

  useEffect(() => {
    useAppStore.setState({
      activeProjectId: initialProjectId || null,
      // メインビューには依存しないが、初期化済みにしておく（ローディング固まり防止）。
      isInitialized: true,
    });
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // プロジェクト一覧を取得（サイドバーのプロジェクト階層・プロジェクト名チップのため）。
  // AuthGuard 配下でマウントされるため currentUser は確定している。
  const currentUser = useAuthStore(s => s.currentUser);
  useEffect(() => {
    if (!currentUser) return;
    fetchUserProjects(currentUser.uid)
      // テンプレ下書き用の隠しワークスペースは一覧に載せない
      .then(ps => useAppStore.setState({ projects: ps.filter(p => (p as any)?.name !== TEMPLATE_WORKSPACE_NAME) }))
      .catch(e => console.warn('[ChatWindow] プロジェクト取得に失敗:', e));
  }, [currentUser]);

  // 本体ウィンドウからのプロジェクト切替を追従する。
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<{ projectId: string | null }>('sekkeiya://project-changed', (e) => {
      useAppStore.setState({ activeProjectId: e.payload.projectId });
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // 本体のUIボタン（例:「SEKKEIYA OS に相談」）からのキックオフ委譲を受け、この窓の
  // オーケストレーターで対話を開始する（本体でチャットが畳まれているときの受け皿）。
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<ChatKickoffPayload>(CHAT_KICKOFF_EVENT, (e) => {
      if (!e.payload) return;
      runKickoffHere(e.payload).catch(err => console.error('[ChatWindow] kickoff failed:', err));
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', overflow: 'hidden', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        {ready ? (
          <>
            {/* トップバー：サイドバー開閉＋タイトル（左）＋子アプリ・リモコン（右寄せ）。 */}
            <WindowTopBar />
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            {/* 左サイドバー。最上部に Chat/DM トグル（新規チャットの上）、その下に階層 or DM 一覧。 */}
            {isChatHistorySidebarOpen && (
              <Box sx={{ width: 220, flexShrink: 0, height: '100%', borderRight: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'var(--brand-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <ChatDmToggle mode={chatMode} onChange={setChatMode} />
                {chatMode === 'chat' ? (
                  <ProjectChatBrowser
                    activeTopicId={chatTopicId}
                    onSelectTeamChat={(projectId, topicId) => {
                      useAppStore.getState().setActiveProjectId(projectId);
                      setChatTopicId(topicId);
                    }}
                    onSelectMyChat={(projectId, sessionId) => {
                      useAppStore.getState().setActiveProjectId(projectId);
                      setChatTopicId(undefined);
                      if (sessionId) useAIChatStore.getState().setActiveSession(sessionId);
                    }}
                    onNewGlobalChat={() => {
                      useAppStore.getState().setActiveProjectId(null);
                      const id = useAIChatStore.getState().createScopedSession('account', { title: '新しいチャット' });
                      useAIChatStore.getState().setActiveSession(id);
                      setChatTopicId(undefined);
                    }}
                    onSelectGlobalChat={(sessionId) => {
                      useAppStore.getState().setActiveProjectId(null);
                      useAIChatStore.getState().setActiveSession(sessionId);
                      setChatTopicId(undefined);
                    }}
                  />
                ) : (
                  <TeamChatNavigator dmOnly />
                )}
              </Box>
            )}
            {/* メイン本体。DM=ダイレクトメッセージ、チームP=チームチャット、それ以外=AIチャット。
                hideWindowControls: 窓内では独自のピン/ドック/閉じるは不要（OSのタイトルバーで閉じる）。 */}
            <Box sx={{ flex: 1, minWidth: 0, height: '100%' }}>
              {chatMode === 'dm' ? (
                // DM: ターゲットは TeamChatNavigator が useTeamChatStore に設定（forcedTarget なし）。
                <TeamChatPanel embedded />
              ) : activeTeamProject ? (
                <TeamChatPanel
                  embedded
                  forcedTarget={{ kind: 'project', id: activeTeamProject.id, name: activeTeamProject.name, topicId: chatTopicId }}
                />
              ) : (
                // hideHeaderTitle: サイドバー・トグルとタイトルはトップバーが担うため二重表示しない。
                <AIChatPanel hideWindowControls hideHeaderTitle />
              )}
            </Box>
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
            <CircularProgress size={32} sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
};
