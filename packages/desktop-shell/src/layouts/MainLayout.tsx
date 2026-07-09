import React, { type ReactNode, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Box, CssBaseline, ThemeProvider, Slide, useMediaQuery, Typography, IconButton, Tooltip, Badge } from '@mui/material';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import { isTtsAvailable } from '../lib/tts';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import ChatHistoryDialog from '../components/AI/ChatHistoryDialog';
import { useAIChatStore } from '../store/useAIChatStore';
import { useChatNavStore } from '../store/useChatNavStore';
import { useAIRenderStore } from '../store/useAIRenderStore';
import { useAI3DCreateStore } from '../store/useAI3DCreateStore';
import AIDriveScopeSidebar from '../components/AI/AIDriveScopeSidebar';
import AIRenderHistorySidebar from '../components/AI/AIRenderHistorySidebar';
import AI3DCreateHistorySidebar from '../components/AI/AI3DCreateHistorySidebar';
import { Home as HomeIcon, Search, User, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MiniSidebar from '../components/Sidebar/MiniSidebar';
import { ProjectSidebar } from '../shared/layout/project-sidebar/ProjectSidebar';
import AIChatPanel from '../components/AI/AIChatPanel';
import { TeamChatPanel } from '../features/team-chat/TeamChatPanel';
import ProjectChatBrowser from '../features/team-chat/ProjectChatBrowser';
import { TeamChatNavigator } from '../features/team-chat/TeamChatNavigator';
import ChatScopeNavigator from '../components/AI/ChatScopeNavigator';
import AIDrivePanel from '../components/AI/AIDrivePanel';
import AIDriveFullScreen from '../components/AI/AIDriveFullScreen';
import { ModelsSidebar } from '../shared/layout/models-sidebar/ModelsSidebar';
import { AiCanvasSidebar } from '../features/ai-canvas/Sidebar/AiCanvasSidebar';
import { DspSidebar } from '../shared/layout/dsp-sidebar/DspSidebar';
import { DspEditorSidebar } from '../features/dsp/editor/sidebars/DspEditorSidebar';
import { DscEditorSidebar } from '../features/dsc/create/sidebars/DscEditorSidebar';
// @ts-ignore
import LeftSidebar from '../features/dsl/layout/editor/sidebars/LeftSidebar/LeftSidebar';
import { DslSidebar } from '../shared/layout/dsl-sidebar/DslSidebar';
import { DscSidebar } from '../shared/layout/dsc-sidebar/DscSidebar';
import { DsdSidebar } from '../shared/layout/dsd-sidebar/DsdSidebar';
import { DsdEditorSidebar } from '../features/dsd/editor/DsdEditorSidebar';
import { DsrSidebar } from '../shared/layout/dsr-sidebar/DsrSidebar';
import { DsiSidebar } from '../shared/layout/dsi-sidebar/DsiSidebar';
import { DsqSidebar } from '../shared/layout/dsq-sidebar/DsqSidebar';
import { DsfSidebar } from '../shared/layout/dsf-sidebar/DsfSidebar';
import { DskSidebar } from '../shared/layout/dsk-sidebar/DskSidebar';
import { DsbSidebar } from '../shared/layout/dsb-sidebar/DsbSidebar';
import { DsmSidebar } from '../shared/layout/dsm-sidebar/DsmSidebar';
import { DsmEditorSidebar } from '../features/dsm/editor/DsmEditorSidebar';
import { DsmtSidebar } from '../shared/layout/dsmt-sidebar/DsmtSidebar';
import { GallerySidebar } from '../shared/layout/gallery-sidebar/GallerySidebar';
import FloatingLibraryPanel from '../features/dsl/layout/editor/sidebars/LeftSidebar/components/Library/FloatingLibraryPanel';
import { FloatingBatchGenPanel } from '../features/ai-studio/components/FloatingBatchGenPanel';
import AI3DCreatePanel from '../components/AI/AI3DCreatePanel';
import AI3DCreateFullScreen from '../components/AI/AI3DCreateFullScreen';
import AIRenderPanel from '../components/AI/AIRenderPanel';
import AIRenderFullScreen from '../components/AI/AIRenderFullScreen';
import AIToolbar from '../components/AI/AIToolbar';
import { darkDesktopTheme, BRAND } from '../styles/theme';
import MobileFeed from '../pages/MobileFeed';
import CameraCapture from '../components/CameraCapture';
import { useNotificationsStore } from '../store/useNotificationsStore';
import { useAuthStore } from '../store/useAuthStore';
import sekkeiyaChatIcon from '../../src-tauri/src/assets/icons/sekkeiya-s-trans.png';

interface MainLayoutProps {
  children: ReactNode;
}


import { useAppStore } from '../store/useAppStore';
import { useUiLeftSidebarStore } from '../features/dsl/layout/store/uiLeftSidebarStore';
import { useEditorModeStore } from '../features/dsl/layout/store/useEditorModeStore';
import { useDspStore } from '../features/dsp/store/useDspStore';
import { useDscStore } from '../features/dsc/store/useDscStore';

const TEAM_CHAT_WIDTH = 360;

// フローティング・チャットのリサイズ用：方向 → カーソル。
const RESIZE_CURSORS: Record<string, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};
// 各辺・四隅のヒット領域（枠に重ねる薄い帯/角）。
const RESIZE_HANDLES: { dir: string; sx: Record<string, any> }[] = [
  { dir: 'n',  sx: { top: 0, left: 12, right: 12, height: 6 } },
  { dir: 's',  sx: { bottom: 0, left: 12, right: 12, height: 6 } },
  { dir: 'w',  sx: { left: 0, top: 12, bottom: 12, width: 6 } },
  { dir: 'e',  sx: { right: 0, top: 12, bottom: 12, width: 6 } },
  { dir: 'nw', sx: { top: 0, left: 0, width: 14, height: 14 } },
  { dir: 'ne', sx: { top: 0, right: 0, width: 14, height: 14 } },
  { dir: 'sw', sx: { bottom: 0, left: 0, width: 14, height: 14 } },
  { dir: 'se', sx: { bottom: 0, right: 0, width: 14, height: 14 } },
];

// フローティング・チャットの既定は「右端の縦パネル（右レール）」。
const CHAT_RIGHT_MARGIN = 16;
const CHAT_TOP_MARGIN = 80;     // 上部ツールバー/タブの下から
const CHAT_BOTTOM_MARGIN = 72;  // 右下のピルの上まで

// フローティング・チャットの画面端マージン（右レール既定位置などの算出に使用）。
const SNAP_MARGIN = 16;

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // On phones the desktop column layout (mini-rail + 240px sidebar + content + 300-360px panels)
  // would crush the center to ~0px. On mobile we overlay the sidebar/panels instead.
  const isMobile = useMediaQuery('(max-width:768px)');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Mobile bottom-bar tab. feed is the default home experience.
  const [mobileTab, setMobileTab] = useState<'feed' | 'search' | 'mysite' | 'chat' | 'profile'>('feed');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [feedKey, setFeedKey] = useState(0); // bump to remount MobileFeed
  const { unreadCount } = useNotificationsStore();
  const currentUser = useAuthStore(s => s.currentUser);
  const setViewingCreatorId = useAppStore(s => s.setViewingCreatorId);
  // MiniSidebar の onClose を安定参照にして React.memo を効かせる（チャット開閉での再描画を防ぐ）。
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  // 全体購読をやめ、必要な値だけを個別購読する（ホバー等の無関係な更新で
  // 巨大な MainLayout が再描画されてカクつくのを防ぐ）。
  const isAIChatOpen = useAppStore(s => s.isAIChatOpen);
  const isAIChatDetached = useAppStore(s => s.isAIChatDetached);
  const isAIChatPinned = useAppStore(s => s.isAIChatPinned);
  const toggleAIChatPinned = useAppStore(s => s.toggleAIChatPinned);
  const chatPanelTab = useAppStore(s => s.chatPanelTab);
  const setChatPanelTab = useAppStore(s => s.setChatPanelTab);
  const setAIChatOpen = useAppStore(s => s.setAIChatOpen);
  const toggleChatHistorySidebar = useAppStore(s => s.toggleChatHistorySidebar);
  const isChatVoiceModeOn = useAppStore(s => s.isChatVoiceModeOn);
  const toggleChatVoiceMode = useAppStore(s => s.toggleChatVoiceMode);
  const createChatSession = useAIChatStore(s => s.createSession);
  const [chatHistoryDialogOpen, setChatHistoryDialogOpen] = useState(false);
  // チームP共同チャットのアクティブトピック（undefined=「一般」=chatMessages）。
  const [chatTopicId, setChatTopicId] = useState<string | undefined>(undefined);
  const isChatHistorySidebarOpen = useAppStore(s => s.isChatHistorySidebarOpen);
  const isAIDriveOpen = useAppStore(s => s.isAIDriveOpen);
  const isAIDriveExpanded = useAppStore(s => s.isAIDriveExpanded);
  const isAI3DCreateOpen = useAppStore(s => s.isAI3DCreateOpen);
  const isAI3DCreateExpanded = useAppStore(s => s.isAI3DCreateExpanded);
  const isAIRenderOpen = useAppStore(s => s.isAIRenderOpen);
  const isAIRenderExpanded = useAppStore(s => s.isAIRenderExpanded);
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const projects = useAppStore(s => s.projects);
  const currentMainView = useAppStore(s => s.currentMainView);
  const dslLeftPanel = useAppStore(s => s.dslLeftPanel);
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);
  const panelSelections = useAppStore(s => s.panelSelections);
  const dscShellMode = useAppStore(s => s.dscShellMode);
  const dsdShellMode = useAppStore(s => s.dsdShellMode);
  const dsmShellMode = useAppStore(s => s.dsmShellMode);
  const setProjectSidebarOpen = useAppStore(s => s.setProjectSidebarOpen);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const toggleAIChat = useAppStore(s => s.toggleAIChat);
  const setAIDriveOpen = useAppStore(s => s.setAIDriveOpen);
  const setAIRenderOpen = useAppStore(s => s.setAIRenderOpen);
  const setAI3DCreateOpen = useAppStore(s => s.setAI3DCreateOpen);
  const setAiTaskOuterRight = useAppStore(s => s.setAiTaskOuterRight);
  const isTeamChatOpen = useAppStore(s => s.isTeamChatOpen);
  const isTeamChatSidebarOpen = useAppStore(s => s.isTeamChatSidebarOpen);
  const dslLeftVisibleSections = useUiLeftSidebarStore((s) => s.visibleSections);
  const isLibraryDetached = useUiLeftSidebarStore((s) => s.isLibraryDetached);
  const toggleLibraryDetached = useUiLeftSidebarStore((s) => s.toggleLibraryDetached);
  const planId = activeWorkspaceId ? panelSelections?.[activeWorkspaceId]?.planId : undefined;

  // Resizable Sidebars Logic
  const [driveWidth, setDriveWidth] = useState(360);
  const [chatWidth, setChatWidth] = useState(360);
  const [createWidth, setCreateWidth] = useState(360);
  const [renderWidth, setRenderWidth] = useState(360);
  const [isResizingDrive, setIsResizingDrive] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [isResizingCreate, setIsResizingCreate] = useState(false);
  const [isResizingRender, setIsResizingRender] = useState(false);

  // We use refs to capture the latest starting values cleanly in the mousemove handler without causing closure traps
  const dragContext = useRef({ startX: 0, startWidth: 0 });

  const startDragDrive = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startX: e.clientX, startWidth: driveWidth };
    setIsResizingDrive(true);
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = dragContext.current.startX - moveEvent.clientX; 
      const newWidth = Math.max(250, Math.min(800, dragContext.current.startWidth + deltaX));
      setDriveWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingDrive(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [driveWidth]);

  const startDragChat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startX: e.clientX, startWidth: chatWidth };
    setIsResizingChat(true);
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = dragContext.current.startX - moveEvent.clientX; 
      const newWidth = Math.max(250, Math.min(800, dragContext.current.startWidth + deltaX));
      setChatWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingChat(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [chatWidth]);

  // ── SEKKEIYA Chat フローティング（切り離し）時の位置・サイズ ──────────────
  // ドラッグ中は state を更新せず DOM の style を直接書き換えて再レンダーを避ける
  // （重い AIChatPanel を毎フレーム再描画しないので動きが滑らかになる）。確定時のみ
  // state へコミットして永続化する。
  const chatFloatRef = useRef<HTMLDivElement>(null);
  // フローティング・チャットの「ヘッダーのみ折りたたみ」状態（未ピン時のみ）。
  // SEKKEIYA SEARCH と同じく、ホバーが外れたらヘッダーを残して本体を畳む。
  const [chatCollapsed, setChatCollapsed] = useState(false);
  // ピン留め時／閉じている時は常に展開状態に戻す（次回オープンは本体ありで開く）。
  useEffect(() => {
    if (isAIChatPinned || !isAIChatOpen) setChatCollapsed(false);
  }, [isAIChatPinned, isAIChatOpen]);
  // 起動後アイドル時にフローティング・チャットを隠しマウントしておき、
  // 初回ホバー時の「重い AIChatPanel を初めてマウントする」遅延を無くす（プリウォーム）。
  const [prewarmChat, setPrewarmChat] = useState(false);
  useEffect(() => {
    // 初回ホバー時の「重い AIChatPanel を初めてマウントする」遅延を消すため、
    // 起動直後のアイドルで隠しマウントしておく（requestIdleCallback 優先・短いフォールバック）。
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) {
      const rid = ric(() => setPrewarmChat(true), { timeout: 800 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(rid);
    }
    const id = window.setTimeout(() => setPrewarmChat(true), 400);
    return () => window.clearTimeout(id);
  }, []);
  const [chatFloat, setChatFloat] = useState<{ x: number; y: number; w: number; h: number }>(() => {
    const w = 400;
    const W = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const H = typeof window !== 'undefined' ? window.innerHeight : 800;
    // 既定は右端の縦パネル（右レール）。
    const h = Math.max(360, H - CHAT_TOP_MARGIN - CHAT_BOTTOM_MARGIN);
    let base = { x: Math.max(SNAP_MARGIN, W - w - CHAT_RIGHT_MARGIN), y: CHAT_TOP_MARGIN, w, h };
    try {
      const s = JSON.parse(localStorage.getItem('sekkeiya.chatFloat') || '');
      if (s && typeof s.x === 'number') base = s;
    } catch { /* noop */ }
    return base;
  });
  useEffect(() => {
    try { localStorage.setItem('sekkeiya.chatFloat', JSON.stringify(chatFloat)); } catch { /* noop */ }
  }, [chatFloat]);

  // ピン化に伴う右上への自動再配置をスキップするフラグ（ヘッダードラッグで掴んだ位置から動かすため）。
  const skipPinRepositionRef = useRef(false);
  // 統合ヘッダーの左ドラッグでパネルを移動。未ピン（右レール）の場合は、その場の見た目位置を
  // 固定座標に確定して自由移動モードへ切り替える（＝掴んだ瞬間に飛ばない）。ボタン上では移動しない。
  const startChatHeaderDrag = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const el = chatFloatRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!useAppStore.getState().isAIChatPinned) {
      skipPinRepositionRef.current = true;
      setChatFloat({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
      useAppStore.getState().setAIChatPinned(true);
    }
    const start = { mx: e.clientX, my: e.clientY, x: rect.left, y: rect.top };
    let nx = start.x, ny = start.y;
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      nx = Math.min(Math.max(0, start.x + (ev.clientX - start.mx)), window.innerWidth - 140);
      ny = Math.min(Math.max(0, start.y + (ev.clientY - start.my)), window.innerHeight - 56);
      el.style.left = `${nx}px`; el.style.top = `${ny}px`;
      el.style.right = 'auto'; el.style.bottom = 'auto';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // 隅へのスナップはしない。離した位置にそのまま留める。
      setChatFloat(f => ({ ...f, x: nx, y: ny, w: rect.width, h: rect.height }));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // ドックから「切り離す」＝フローティング化。既定は未ピン。
  // 未ピンはホバーを外すとヘッダーを残して畳む（消えはしない）ので、ピン留めしなくても良い。
  // ピン留めは「ドラッグで動かす」「常に開いたまま固定したい」ときに明示的に行う。
  const detachChatToFloat = useCallback(() => {
    const s = useAppStore.getState();
    s.setAIChatDetached(true);
    s.setAIChatPinned(false);
  }, []);
  const dockChat = useCallback(() => {
    useAppStore.getState().setAIChatDetached(false);
  }, []);

  // 開閉はホバーのイベントハンドラ内で同期的に行う（store の
  // openChatPeek / closeChatPeekSoon / cancelChatPeekClose）。
  // useEffect を介さないので、ホバー→表示／離脱→収納がフレーム遅延なく即時。

  // ピン留めした瞬間：保留中の収納をキャンセルし、ピーク（右レール）と同じ位置・サイズを
  // chatFloat に確定して、ドラッグ可能パネルへ滑らかに引き継ぐ（飛ばないように）。
  const prevPinnedRef = useRef(isAIChatPinned);
  useEffect(() => {
    const was = prevPinnedRef.current;
    prevPinnedRef.current = isAIChatPinned;
    if (isAIChatPinned) useAppStore.getState().cancelChatPeekClose();
    if (!was && isAIChatPinned && isAIChatDetached && !isMobile) {
      // ヘッダードラッグ起点のピン化は、掴んだ位置から動かすので右上への再配置はしない。
      if (skipPinRepositionRef.current) {
        skipPinRepositionRef.current = false;
      } else {
        setChatFloat(f => ({
          ...f,
          x: Math.max(SNAP_MARGIN, window.innerWidth - CHAT_RIGHT_MARGIN - f.w),
          y: CHAT_TOP_MARGIN,
          h: Math.max(360, window.innerHeight - CHAT_TOP_MARGIN - CHAT_BOTTOM_MARGIN),
        }));
      }
    }
  }, [isAIChatPinned, isAIChatDetached, isMobile]);

  // 閉じてもピン留め／チャット階層サイドバーの状態は維持する（次回は前回の状態で開く）。
  // ホバーフラグだけ念のためリセットしておく。
  useEffect(() => {
    if (isAIChatOpen) return;
    const s = useAppStore.getState();
    if (s.chatHoverPanel) s.setChatHoverPanel(false);
    if (s.chatHoverPill) s.setChatHoverPill(false);
  }, [isAIChatOpen]);

  // プロジェクトが変わったら共同チャットのトピックを「一般」へ戻す。
  // ただし「前回チャットの復元」でプロジェクトとトピックを同時に戻す時は消さない（ガード）。
  const topicResetGuardRef = useRef(false);
  useEffect(() => {
    if (topicResetGuardRef.current) { topicResetGuardRef.current = false; return; }
    setChatTopicId(undefined);
  }, [activeProjectId]);

  // ── 前回開いていたチャットの保存／復元 ──────────────────────────────
  // ⚠️ 復元 effect は保存 effect より「前に」宣言する。
  //    初回オープン時、保存 effect が復元前の値で nav を上書きする前に、
  //    復元 effect が保存済みの値を読み取れるようにするため（順序依存）。

  // 初回オープン時（リロード後など）に前回のチャット選択を復元する。
  // activeSessionId は useAIChatStore が永続化済みなので、ここでは
  // 選択の文脈（タブ・プロジェクト・トピック）を戻すだけでよい。
  const chatRestoredRef = useRef(false);
  useEffect(() => {
    if (!isAIChatOpen || chatRestoredRef.current) return;
    chatRestoredRef.current = true;
    const nav = useChatNavStore.getState();
    if (nav.lastTab) setChatPanelTab(nav.lastTab as any);
    const nextProjectId = nav.lastProjectId ?? null;
    const willChangeProject = (useAppStore.getState().activeProjectId ?? null) !== nextProjectId;
    // トピックを復元する場合、プロジェクト切替に伴うトピックリセットを一度だけ抑止する。
    if (nav.lastTopicId && willChangeProject) topicResetGuardRef.current = true;
    useAppStore.getState().setActiveProjectId(nextProjectId);
    setChatTopicId(nav.lastTopicId ?? undefined);
  }, [isAIChatOpen, setChatPanelTab]);

  // チャットを開いている間、選択の文脈を永続化する（次回オープン時の復元用）。
  useEffect(() => {
    if (!isAIChatOpen) return;
    useChatNavStore.getState().setLastChatNav({
      tab: chatPanelTab,
      projectId: activeProjectId ?? null,
      topicId: chatTopicId ?? null,
    });
  }, [isAIChatOpen, chatPanelTab, activeProjectId, chatTopicId]);

  // コックピットで Render / 3D Generate タブを開いたら、出力が現在のプロジェクトに
  // 紐づくよう各ストアへコンテキスト（projectId / workspaceId）を渡す。
  useEffect(() => {
    if (chatPanelTab === 'render') {
      useAIRenderStore.getState().setContext(activeProjectId, activeWorkspaceId);
    } else if (chatPanelTab === 'gen3d') {
      useAI3DCreateStore.getState().setContext(activeProjectId, activeWorkspaceId);
    }
  }, [chatPanelTab, activeProjectId, activeWorkspaceId]);

  const startResizeChatFloat = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = chatFloatRef.current;
    const MINW = 320, MINH = 380;
    const start = { mx: e.clientX, my: e.clientY, x: chatFloat.x, y: chatFloat.y, w: chatFloat.w, h: chatFloat.h };
    let nx = start.x, ny = start.y, nw = start.w, nh = start.h;
    document.body.style.cursor = RESIZE_CURSORS[dir] ?? 'nwse-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.mx;
      const dy = ev.clientY - start.my;
      if (dir.includes('e')) nw = Math.min(Math.max(MINW, start.w + dx), window.innerWidth - start.x - 8);
      if (dir.includes('s')) nh = Math.min(Math.max(MINH, start.h + dy), window.innerHeight - start.y - 8);
      if (dir.includes('w')) {
        const right = start.x + start.w;
        nx = Math.min(Math.max(0, start.x + dx), right - MINW);
        nw = right - nx;
      }
      if (dir.includes('n')) {
        const bottom = start.y + start.h;
        ny = Math.min(Math.max(0, start.y + dy), bottom - MINH);
        nh = bottom - ny;
      }
      if (el) {
        el.style.left = `${nx}px`; el.style.top = `${ny}px`;
        el.style.width = `${nw}px`; el.style.height = `${nh}px`;
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setChatFloat({ x: nx, y: ny, w: nw, h: nh });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [chatFloat.x, chatFloat.y, chatFloat.w, chatFloat.h]);

  const startDragCreate = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startX: e.clientX, startWidth: createWidth };
    setIsResizingCreate(true);
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = dragContext.current.startX - moveEvent.clientX; 
      const newWidth = Math.max(250, Math.min(800, dragContext.current.startWidth + deltaX));
      setCreateWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingCreate(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [createWidth]);

  const startDragRender = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startX: e.clientX, startWidth: renderWidth };
    setIsResizingRender(true);
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = dragContext.current.startX - moveEvent.clientX; 
      const newWidth = Math.max(250, Math.min(800, dragContext.current.startWidth + deltaX));
      setRenderWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingRender(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [renderWidth]);

  // 右パネルが開いているとき AI タスクボタンを左に退避（外側パネル合計幅を通知）
  useEffect(() => {
    const rightW =
      (isAIChatOpen && !isAIChatDetached ? chatWidth : 0) +
      (isTeamChatOpen ? TEAM_CHAT_WIDTH : 0) +
      (isAIDriveOpen && !isAIDriveExpanded ? driveWidth : 0) +
      (isAI3DCreateOpen && !isAI3DCreateExpanded ? createWidth : 0) +
      (isAIRenderOpen && !isAIRenderExpanded ? renderWidth : 0);
    setAiTaskOuterRight(rightW);
  }, [isAIChatOpen, isAIChatDetached, chatWidth, isTeamChatOpen, isAIDriveOpen, isAIDriveExpanded, driveWidth, isAI3DCreateOpen, isAI3DCreateExpanded, createWidth, isAIRenderOpen, isAIRenderExpanded, renderWidth, setAiTaskOuterRight]);

  // Show ModelsSidebar if we are in workspace view and the active workspace is models
  const showModelsSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'models';
  
  const dslLeftPanels = useUiLeftSidebarStore((s) => s.leftPanels);

  // Show CanvasSidebar if we are in workspace view and the active workspace is canvas
  const showCanvasSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'canvas';

  // Show DspSidebar if we are in workspace view and the active workspace is presents
  const showDspSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'presents';

  // Show DscSidebar if we are in workspace view and the active workspace is create
  const showDscSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'create';

  // Show DsdSidebar if we are in workspace view and the active workspace is diagram
  const showDsdSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'diagram';

  // Show DsrSidebar if we are in workspace view and the active workspace is drawing
  const showDsrSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'drawing';

  // Show DsiSidebar if we are in workspace view and the active workspace is image
  const showDsiSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'image';

  // Show DsqSidebar if we are in workspace view and the active workspace is quest (S.Quest)
  const showDsqSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'quest';

  // Show DsfSidebar if we are in workspace view and the active workspace is portfolio (S.Portfolio)
  const showDsfSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'portfolio';

  // Show DskSidebar if we are in workspace view and the active workspace is library (S.Library)
  const showDskSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'library';

  // Show DsbSidebar if we are in workspace view and the active workspace is blog (S.Blog)
  const showDsbSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'blog';

  // Show DsmSidebar if we are in workspace view and the active workspace is movie (S.Movie)
  const showDsmSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'movie';

  // Show DsmtSidebar if we are in workspace view and the active workspace is material (S.Material)
  const showDsmtSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'material';

  // 3DSC エディターサイドバー表示制御（3DSP パターンと同様）
  const dscShowProjectBrowser = useDscStore((s) => s.showDscProjectBrowser);

  // 3DSP エディターサイドバー表示制御（3DSL の LeftSidebar 相当）
  // isHydrated を使う: clearWorkspace で false になるため EXIT 後に自動で DspSidebar に戻る
  const dspIsHydrated = useDspStore((s) => s.isHydrated);
  const dspShowProjectBrowser = useDspStore((s) => s.showProjectBrowser);

  const isLayoutWorkspace = currentMainView === 'workspace' && activeWorkspaceId === 'layout';

  const editorMode = useEditorModeStore((s: any) => s.editorMode);
  
  const actualDslLeftVisibleSections = isLibraryDetached
    ? dslLeftVisibleSections?.filter((k: string) => k !== "library")
    : dslLeftVisibleSections;

  const hasDslLeftSections = actualDslLeftVisibleSections?.length > 0;

  const showDslDashboard = !!dslLeftPanels?.dashboard;

  const renderLeftSidebar = () => {
    // ダッシュボード（アカウントサイト）は自前のサイドバー（ページ＋My/Teamナビ）を持つため、グローバル左サイドバーは出さない
    if (currentMainView === 'my-site') return null;
    // SEKKEIYA プロジェクトワークスペース（ホーム＝サイト）はサイト自身のサイドバーに一本化（ダッシュボード経由で切替）
    if (currentMainView === 'workspace' && activeWorkspaceId === null) return null;
    if (currentMainView === 'global-settings' || currentMainView === 'ai-studio' || currentMainView === 'marketplace' || currentMainView === 'creator-profile') return null;
    // サイト管理（プロジェクト管理）画面は一覧自体が主役なので左サイドバーは出さない
    if (currentMainView === 'project-management') return null;
    // モバイルはボトムバー＋一覧画面でナビするため、ナビ系の左サイドバーは出さない
    if (currentMainView === 'gallery') return isMobile ? null : <GallerySidebar />;
    if (showModelsSidebar) return <ModelsSidebar />;
    if (showCanvasSidebar) return <AiCanvasSidebar />;
    if (showDspSidebar) {
      // ファイルが開かれている かつ プロジェクトブラウザトグル OFF → エディターサイドバー（3DSL パターン）
      if (dspIsHydrated && !dspShowProjectBrowser) return <DspEditorSidebar />;
      return <DspSidebar />;
    }

    if (showDscSidebar) {
      // スタジオが開かれている かつ プロジェクトブラウザトグル OFF → エディターサイドバー（3DSP パターン）
      if (dscShellMode === 'studio' && !dscShowProjectBrowser) return <DscEditorSidebar />;
      return <DscSidebar />;
    }

    if (showDsdSidebar) {
      if (dsdShellMode === 'editor') return <DsdEditorSidebar />;
      return <DsdSidebar />;
    }

    if (showDsrSidebar) return <DsrSidebar />;

    if (showDsiSidebar) return <DsiSidebar />;

    if (showDsqSidebar) return <DsqSidebar />;

    if (showDsfSidebar) return <DsfSidebar />;

    if (showDskSidebar) return <DskSidebar />;

    if (showDsbSidebar) return <DsbSidebar />;

    if (showDsmSidebar) {
      // エディター中は素材サイドバー、それ以外はプロジェクトナビ（3DSD パターン）
      if (dsmShellMode === 'editor') return <DsmEditorSidebar />;
      return <DsmSidebar />;
    }

    if (showDsmtSidebar) return <DsmtSidebar />;

    if (isLayoutWorkspace) {
      // hasActiveLayout: true when any level of the Base→Plan→Option hierarchy is selected.
      // planId must be included so that selecting a Plan (before its Option is auto-resolved)
      // does NOT fall back to DslSidebar.
      const hasActiveLayout = !!(
        panelSelections?.layout?.selectedLayoutId ||
        panelSelections?.layout?.optionId ||
        panelSelections?.layout?.planId ||
        panelSelections?.layout?.baseId
      );
      if (!hasActiveLayout) {
        return <DslSidebar />;
      }

      // If we are in 3DSS layout editing but dashboard is toggled ON:
      if (showDslDashboard) {
        return <DslSidebar />;
      }

      // Otherwise, show LeftSidebar if project or library are visible
      if (hasDslLeftSections) {
        return <LeftSidebar />;
      }

      return null;
    }

    // モバイルではプロジェクトナビ用の左サイドバーは不要（ボトムバー＋プロジェクト一覧で代替）
    if (isMobile) return null;
    return <ProjectSidebar />;
  };

  const getSidebarWidth = () => {
    if (!isProjectSidebarOpen) return 0;
    if (showDscSidebar) return 240;
    if (showDsdSidebar) return 240;
    if (showDsrSidebar) return 240;
    if (showDsiSidebar) return 240;
    if (showDsqSidebar) return 240;
    if (showDsfSidebar) return 240;
    if (showDskSidebar) return 240;
    if (showDsbSidebar) return 240;
    if (showDsmSidebar) return 240;
    if (showDsmtSidebar) return 240;
    if (isLayoutWorkspace) {
      const hasActiveLayout = !!(
        panelSelections?.layout?.selectedLayoutId ||
        panelSelections?.layout?.optionId ||
        panelSelections?.layout?.planId ||
        panelSelections?.layout?.baseId
      );
      if (!hasActiveLayout) return 240;
      
      if (showDslDashboard) return 240;
      
      if (hasDslLeftSections) {
        return 240;
      }
      return 0;
    }
    return 240;
  };

  const currentSidebarWidth = getSidebarWidth();
  // 左サイドバーはチャットのホバー開閉（isAIChatOpen/Detached 等の切替）では作り直さない。
  // MainLayout が再描画されるたびに重いサイドバーを再 reconcile すると開閉が一拍重くなるため、
  // 実際の入力（ビュー/ワークスペース/各シェル状態）が変わったときだけ要素を作り直す。
  const leftSidebarEl = useMemo(
    () => renderLeftSidebar(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentMainView, activeWorkspaceId,
      dscShellMode, dscShowProjectBrowser,
      dspIsHydrated, dspShowProjectBrowser,
      dsdShellMode, dsmShellMode,
      panelSelections, hasDslLeftSections, showDslDashboard,
    ],
  );
  const hasSidebarContent = !!leftSidebarEl;

  // アクティブがチームプロジェクトなら、Chat タブは Firestore 共同会話（複数メンバー＋AI）を表示する。
  // MY プロジェクト（または未選択）はローカルのオーケストレーター（AIChatPanel）のまま。
  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeTeamProject = activeProject?.isTeam ? activeProject : undefined;

  // SEKKEIYA Chat コックピットのタブ。すべてパネル内で中身を切り替える。
  const cockpitTabs: { key: string; label: string; icon: React.ReactNode; active: boolean; onClick: () => void }[] = [
    { key: 'chat', label: 'Chat', icon: <ForumRoundedIcon sx={{ fontSize: '1.05rem' }} />, active: chatPanelTab === 'chat', onClick: () => setChatPanelTab('chat') },
    { key: 'drive', label: 'AI Drive', icon: <FolderRoundedIcon sx={{ fontSize: '1.05rem' }} />, active: chatPanelTab === 'drive', onClick: () => setChatPanelTab('drive') },
    { key: 'teamchat', label: 'DM', icon: <AlternateEmailRoundedIcon sx={{ fontSize: '1.05rem' }} />, active: chatPanelTab === 'teamchat', onClick: () => setChatPanelTab('teamchat') },
    { key: 'render', label: 'AI Render', icon: <ImageRoundedIcon sx={{ fontSize: '1.05rem' }} />, active: chatPanelTab === 'render', onClick: () => setChatPanelTab('render') },
    { key: 'gen3d', label: 'AI 3D Generate', icon: <ViewInArRoundedIcon sx={{ fontSize: '1.05rem' }} />, active: chatPanelTab === 'gen3d', onClick: () => setChatPanelTab('gen3d') },
  ];

  return (
    <ThemeProvider theme={darkDesktopTheme}>
      <CssBaseline />
      {/* ネイティブのタイトルバー(Win/macOS とも)の下に webview が配置されるため、
          上部に追加の内側余白は不要。高さは実ウィンドウ(#root=100%)に揃える。 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>

        {/* ── AI ツールバー（デスクトップのみ・ネイティブメニュー直下） ── */}
        {!isMobile && <AIToolbar />}

        {/* 旧モバイルトップバー（SEKKEIYA + 通知ベル）は廃止し画面を広く使用。
            通知はボトムバーのプロフィールアイコンに未読バッジを表示し、中身はマイページ（CreatorProfilePage）から閲覧。 */}

        <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0, width: '100%', overflow: 'hidden', position: 'relative' }}>
          {/* Mobile nav drawer scrim */}
          {isMobile && mobileNavOpen && (
            <Box
              onClick={() => setMobileNavOpen(false)}
              sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1490 }}
            />
          )}
          <MiniSidebar open={mobileNavOpen} onClose={closeMobileNav} />

        {/* Rest of the layout container (relative so fullscreen overlay can cover it all) */}
        <Box sx={{ display: 'flex', flexGrow: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          
          {/* Main Area Container (so inner overlays don't cover Right Panels) */}
          <Box sx={{ display: 'flex', flexGrow: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
            {/* Mobile scrim: tap to dismiss the overlaid sidebar */}
            {isMobile && hasSidebarContent && currentSidebarWidth > 0 && (
              <Box
                onClick={() => setProjectSidebarOpen(false)}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  zIndex: 1340,
                }}
              />
            )}

            {/* Sub-Sidebars */}
            <Box
              sx={{
                display: 'flex',
                height: '100%',
                flexShrink: 0,
                width: hasSidebarContent ? currentSidebarWidth : 0,
                overflow: 'hidden',
                transition: isMobile ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                ...(isMobile && {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: currentSidebarWidth || 240,
                  maxWidth: '85vw',
                  zIndex: 1350,
                  boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
                  bgcolor: BRAND.bg,
                  transform: hasSidebarContent && currentSidebarWidth > 0 ? 'translateX(0)' : 'translateX(-100%)',
                }),
              }}
            >
              {/* To prevent layout shifts inside during transition, force the inner wrapper to target width */}
              <Box sx={{ width: currentSidebarWidth, flexShrink: 0, height: '100%', position: 'relative' }}>
                <AnimatePresence mode="wait">
                  {hasSidebarContent && (
                    <motion.div
                      key={currentMainView + activeWorkspaceId + dslLeftPanel + dsdShellMode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                      {leftSidebarEl}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            </Box>

            {/* Center Content */}
            <Box sx={{ flexGrow: 1, flexBasis: 0, minWidth: 0, overflowX: 'hidden', overflowY: 'auto', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', position: 'relative' }}>
              {/* On mobile, フィードタブ = MobileFeed (except inside a workspace) */}
              {isMobile && mobileTab === 'feed' && currentMainView !== 'workspace'
                ? <MobileFeed key={feedKey} onCameraOpen={() => setCameraOpen(true)} onRetry={() => setFeedKey(k => k + 1)} />
                : children}
            </Box>

            {/* AI Drive FullScreen Overlay - Now isolated to Main Area */}
            <Slide direction="left" in={isAIDriveOpen && isAIDriveExpanded} mountOnEnter unmountOnExit>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200, bgcolor: BRAND.bg }}>
                <AIDriveFullScreen />
              </Box>
            </Slide>

            {/* AI 3DCreate FullScreen Overlay - isolated to Main Area so it doesn't cover Right Panels (e.g. Chat) */}
            <Slide direction="left" in={isAI3DCreateOpen && isAI3DCreateExpanded} mountOnEnter unmountOnExit>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200, bgcolor: BRAND.bg }}>
                <AI3DCreateFullScreen />
              </Box>
            </Slide>

            {/* AI Render FullScreen Overlay - isolated to Main Area so it doesn't cover Right Panels (e.g. Chat) */}
            <Slide direction="left" in={isAIRenderOpen && isAIRenderExpanded} mountOnEnter unmountOnExit>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200, bgcolor: BRAND.bg }}>
                <AIRenderFullScreen />
              </Box>
            </Slide>
          </Box>

          {/* Right Auxiliary Panels */}

        {/* AI Drive Panel */}
        <Box 
          sx={{
            width: isAIDriveOpen && !isAIDriveExpanded ? driveWidth : 0, 
            flexShrink: 0, 
            borderLeft: isAIDriveOpen && !isAIDriveExpanded ? `1px solid ${BRAND.line}` : 'none', 
            bgcolor: BRAND.panel,
            overflow: 'visible',
            position: 'relative',
            zIndex: 1300,
            transition: isResizingDrive ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isMobile && {
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: isAIDriveOpen && !isAIDriveExpanded ? '100%' : 0,
              zIndex: 1320,
            }),
          }}
        >
          {isAIDriveOpen && (
            <Box
              onMouseDown={startDragDrive}
              sx={{
                position: 'absolute',
                left: -3,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                zIndex: 50,
                '&:hover': { bgcolor: '#3498db' },
                ...(isResizingDrive && { bgcolor: '#3498db' })
              }}
            />
          )}
          <Box sx={{ width: '100%', height: '100%', minWidth: isAIDriveOpen && !isAIDriveExpanded ? 250 : 0, overflow: 'hidden' }}>
            <AIDrivePanel />
          </Box>
        </Box>

        {/* AI 3DCreate Panel */}
        <Box 
          sx={{
            width: isAI3DCreateOpen && !isAI3DCreateExpanded ? createWidth : 0, 
            flexShrink: 0, 
            borderLeft: isAI3DCreateOpen && !isAI3DCreateExpanded ? `1px solid ${BRAND.line}` : 'none', 
            bgcolor: BRAND.panel,
            overflow: 'visible',
            position: 'relative',
            zIndex: 1300,
            transition: isResizingCreate ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isMobile && {
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: isAI3DCreateOpen && !isAI3DCreateExpanded ? '100%' : 0,
              zIndex: 1320,
            }),
          }}
        >
          {isAI3DCreateOpen && !isAI3DCreateExpanded && (
            <Box
              onMouseDown={startDragCreate}
              sx={{
                position: 'absolute',
                left: -3,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                zIndex: 50,
                '&:hover': { bgcolor: '#3498db' },
                ...(isResizingCreate && { bgcolor: '#3498db' })
              }}
            />
          )}
          <Box sx={{ width: '100%', height: '100%', minWidth: isAI3DCreateOpen && !isAI3DCreateExpanded ? 300 : 0, overflow: 'hidden' }}>
            <AI3DCreatePanel />
          </Box>
        </Box>

        {/* AI Render Panel */}
        <Box 
          sx={{
            width: isAIRenderOpen && !isAIRenderExpanded ? renderWidth : 0, 
            flexShrink: 0, 
            borderLeft: isAIRenderOpen && !isAIRenderExpanded ? `1px solid ${BRAND.line}` : 'none', 
            bgcolor: BRAND.panel,
            overflow: 'visible',
            position: 'relative',
            zIndex: 1300,
            transition: isResizingRender ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isMobile && {
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: isAIRenderOpen && !isAIRenderExpanded ? '100%' : 0,
              zIndex: 1320,
            }),
          }}
        >
          {isAIRenderOpen && !isAIRenderExpanded && (
            <Box
              onMouseDown={startDragRender}
              sx={{
                position: 'absolute',
                left: -3,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                zIndex: 50,
                '&:hover': { bgcolor: '#3498db' },
                ...(isResizingRender && { bgcolor: '#3498db' })
              }}
            />
          )}
          <Box sx={{ width: '100%', height: '100%', minWidth: isAIRenderOpen && !isAIRenderExpanded ? 300 : 0, overflow: 'hidden' }}>
            <AIRenderPanel />
          </Box>
        </Box>

          {/* Chat Scope Navigator Sidebar (チャット階層) */}
          <Box
            sx={{
              width: isAIChatOpen && !isAIChatDetached && isChatHistorySidebarOpen ? 260 : 0,
              flexShrink: 0,
              borderLeft: isAIChatOpen && !isAIChatDetached && isChatHistorySidebarOpen ? `1px solid rgba(255,255,255,0.06)` : 'none',
              bgcolor: '#161b26',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1299,
              transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              ...(isMobile && { display: 'none' }),
            }}
          >
            {isAIChatOpen && !isAIChatDetached && isChatHistorySidebarOpen && (
              <>
                <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600, flexShrink: 0 }}>
                  チャット階層
                </Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ChatScopeNavigator onSelect={() => {}} />
                </Box>
              </>
            )}
          </Box>

          {/* AI Chat Panel（ドック表示。切り離し中はフローティングへ移動） */}
          <Box
            sx={{
              width: isAIChatOpen && !isAIChatDetached ? chatWidth : 0,
              flexShrink: 0,
              borderLeft: isAIChatOpen && !isAIChatDetached ? `1px solid ${BRAND.line}` : 'none',
              bgcolor: BRAND.panel,
              overflow: 'visible',
              position: 'relative',
              zIndex: 1300,
              transition: isResizingChat ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              ...(isMobile && {
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: isAIChatOpen ? '100%' : 0,
                zIndex: 1320,
              }),
            }}
          >
            {isAIChatOpen && !isAIChatDetached && (
              <Box
                onMouseDown={startDragChat}
                sx={{
                  position: 'absolute',
                  left: -3,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'ew-resize',
                  zIndex: 50,
                  '&:hover': { bgcolor: '#3498db' },
                  ...(isResizingChat && { bgcolor: '#3498db' })
                }}
              />
            )}
            <Box sx={{ width: '100%', height: '100%', minWidth: isAIChatOpen && (isMobile || !isAIChatDetached) ? 250 : 0, overflow: 'hidden' }}>
              {isAIChatOpen && (isMobile || !isAIChatDetached) && (
                <AIChatPanel onToggleDetached={isMobile ? undefined : detachChatToFloat} />
              )}
            </Box>
          </Box>

          {/* AI Chat Panel（切り離し＝フローティング。デスクトップのみ）
              未ピン＝右下ピルから生える“ピーク”（ホバーで開閉・0秒）。
              ピン＝ドラッグ＆リサイズ可能な常駐パネル。
              再マウント遅延を無くすため、切り離し中は常にマウントしたまま
              表示/非表示を animate で切り替える（2回目以降のホバーは瞬時に開く）。 */}
          {!isMobile && (isAIChatDetached || (prewarmChat && !isAIChatOpen)) && (
              <motion.div
                key="sekkeiya-chat-float"
                ref={chatFloatRef}
                // 未ピン時：ホバーが外れたらヘッダーを残して本体を畳む（SEKKEIYA SEARCH と同じ）。
                // ピン時：ドラッグ／リサイズ可能な常駐パネル（畳まない）。閉じるのは×ボタン。
                onMouseEnter={isAIChatPinned ? undefined : () => setChatCollapsed(false)}
                onMouseLeave={isAIChatPinned ? undefined : (e) => {
                  // ドラッグ中（スクロールバーのドラッグ・テキスト選択・移動など、マウスボタン押下中）は
                  // 端からカーソルが少し外れても畳まない。畳むと本体が消えてドラッグが切れてしまうため。
                  if (e.buttons !== 0) return;
                  // メニュー／ダイアログ表示中はアンカー消失で位置が崩れるため畳まない。
                  if (typeof document !== 'undefined' &&
                      document.querySelector('.MuiPopover-root, .MuiMenu-root, .MuiDialog-root, .MuiModal-root')) return;
                  setChatCollapsed(true);
                }}
                initial={false}
                // 縦長パネルを大きく拡大すると毎回の再ラスタライズで重くなるため、
                // スケールは使わず純粋なフェードのみ（コンポジタ合成だけで最速・ジャンクなし）。
                // ホバー表示は「瞬時に出て瞬時に消える」体感を優先し、ごく短いフェードにする。
                animate={isAIChatOpen ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.05, ease: 'linear' }}
                style={{
                  position: 'fixed',
                  // ピン＝保存位置・サイズ（ドラッグ可）。未ピン＝右端の縦パネル（右レール）。
                  ...(isAIChatPinned
                    ? { left: chatFloat.x, top: chatFloat.y, width: chatFloat.w, height: chatFloat.h }
                    // 未ピン＝右レール。畳んでいる時は bottom を外して高さ自動（ヘッダーのみ）にする。
                    : { right: CHAT_RIGHT_MARGIN, top: CHAT_TOP_MARGIN, width: chatFloat.w, ...(chatCollapsed ? {} : { bottom: CHAT_BOTTOM_MARGIN }) }),
                  transformOrigin: isAIChatPinned ? 'center' : 'bottom right',
                  // MUI のメニュー/ダイアログ（z-index 1300）より下にして、
                  // モデル選択・添付メニュー・履歴ダイアログがチャットの上に出るようにする。
                  zIndex: 1290,
                  // 非表示中はクリックを透過させる。
                  pointerEvents: isAIChatOpen ? 'auto' : 'none',
                  // レイヤーを温存して表示/非表示の切替を速くする。
                  willChange: 'transform, opacity',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'visible',
                }}
              >
                {/* 本体（枠・影・クリップ）。フローティングは任意のコンテンツ上に重なるため、
                    半透明の BRAND.panel ではなく不透明色にして透けないようにする。 */}
                <Box sx={{
                  position: 'relative',
                  width: '100%', height: (chatCollapsed && !isAIChatPinned) ? 'auto' : '100%',
                  bgcolor: '#1a1f2b',
                  border: `1px solid ${BRAND.line}`,
                  borderRadius: '8px',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* 統合ヘッダー（全幅・1行）。左ドラッグでパネルを移動（ボタン上は除く）。
                      タブ｜（Chat時のみ）階層・新規・履歴｜ピン・閉じる をこの1行に集約。 */}
                  <Box
                    onMouseDown={startChatHeaderDrag}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.25,
                      px: 0.75, py: 0.5, flexShrink: 0,
                      bgcolor: '#161b26',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'move',
                    }}
                  >
                    {cockpitTabs.map((t) => (
                      <Tooltip key={t.key} title={t.label} placement="bottom">
                        <IconButton
                          size="small"
                          onClick={t.onClick}
                          sx={{
                            color: t.active ? '#3498db' : 'rgba(255,255,255,0.5)',
                            bgcolor: t.active ? 'rgba(52,152,219,0.15)' : 'transparent',
                            borderRadius: 1.5,
                            '&:hover': { color: t.active ? '#3498db' : '#fff', bgcolor: t.active ? 'rgba(52,152,219,0.22)' : 'rgba(255,255,255,0.08)' },
                          }}
                        >
                          {t.icon}
                        </IconButton>
                      </Tooltip>
                    ))}
                    <Box sx={{ flex: 1 }} />
                    {/* 左サイドバーの表示トグル（全タブ共通：各タブ専用の左サイドバーを開閉） */}
                    <Tooltip title="左サイドバー" placement="bottom">
                      <IconButton size="small" onClick={toggleChatHistorySidebar}
                        sx={{ color: isChatHistorySidebarOpen ? '#ffd740' : 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <ViewSidebarRoundedIcon sx={{ fontSize: '1.05rem' }} />
                      </IconButton>
                    </Tooltip>
                    {/* Chat タブ専用アクション（新規チャット・履歴）。ローカルのオーケストレーター用なので
                        チームPの共有会話表示中は出さない。 */}
                    {chatPanelTab === 'chat' && !activeTeamProject && (
                      <>
                        {isTtsAvailable() && (
                          <Tooltip title={isChatVoiceModeOn ? '音声モードOFF' : '音声モードON（AIの応答を読み上げながら作業できます）'} placement="bottom">
                            <IconButton size="small" onClick={toggleChatVoiceMode}
                              sx={{ color: isChatVoiceModeOn ? '#ffd740' : 'rgba(255,255,255,0.4)', bgcolor: isChatVoiceModeOn ? 'rgba(255,215,64,0.12)' : 'transparent', '&:hover': { color: isChatVoiceModeOn ? '#ffd740' : '#fff', bgcolor: isChatVoiceModeOn ? 'rgba(255,215,64,0.18)' : 'rgba(255,255,255,0.05)' } }}>
                              {isChatVoiceModeOn ? <VolumeUpRoundedIcon sx={{ fontSize: '1.05rem' }} /> : <VolumeOffRoundedIcon sx={{ fontSize: '1.05rem' }} />}
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="新規チャット" placement="bottom">
                          <IconButton size="small" onClick={() => { if (activeProjectId) createChatSession(activeProjectId); }}
                            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                            <AddRoundedIcon sx={{ fontSize: '1.05rem' }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="履歴" placement="bottom">
                          <IconButton size="small" onClick={() => setChatHistoryDialogOpen(true)}
                            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                            <HistoryRoundedIcon sx={{ fontSize: '1.05rem' }} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip title={isAIChatPinned ? 'ピンを外す' : 'ピン留め'} placement="bottom">
                      <IconButton size="small" onClick={toggleAIChatPinned}
                        sx={{ color: isAIChatPinned ? '#3498db' : 'rgba(255,255,255,0.4)', '&:hover': { color: isAIChatPinned ? '#3498db' : '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        {isAIChatPinned ? <PushPinRoundedIcon sx={{ fontSize: '1rem' }} /> : <PushPinOutlinedIcon sx={{ fontSize: '1rem' }} />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="閉じる" placement="bottom">
                      <IconButton size="small" onClick={() => setAIChatOpen(false)}
                        sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <CloseRoundedIcon sx={{ fontSize: '1.05rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* コックピット本体（タブで中身を切替。各タブが専用の左サイドバーを持つ）。
                      未ピン折りたたみ時は display:none で隠す（アンマウントせず状態・プリウォーム維持）。 */}
                  <Box sx={{ flex: 1, minHeight: 0, display: (chatCollapsed && !isAIChatPinned) ? 'none' : 'flex', overflow: 'hidden', bgcolor: '#1a1f2b' }}>
                    {/* 左サイドバー（全タブ共通の枠。中身はタブごとに差し替え。トグルで開閉） */}
                    {isChatHistorySidebarOpen && (
                      <Box sx={{ width: 200, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', bgcolor: '#161b26', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {chatPanelTab === 'chat' && (
                          <ProjectChatBrowser
                            activeTopicId={chatTopicId}
                            onSelectTeamChat={(projectId, topicId) => {
                              const s = useAppStore.getState();
                              if (s.activeProjectId !== projectId) s.setActiveProjectId(projectId);
                              setChatTopicId(topicId);
                            }}
                            onSelectMyChat={(projectId, sessionId) => {
                              const s = useAppStore.getState();
                              if (s.activeProjectId !== projectId) s.setActiveProjectId(projectId);
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
                        )}
                        {chatPanelTab === 'teamchat' && <TeamChatNavigator dmOnly />}
                        {chatPanelTab === 'drive' && <AIDriveScopeSidebar />}
                        {chatPanelTab === 'render' && <AIRenderHistorySidebar />}
                        {chatPanelTab === 'gen3d' && <AI3DCreateHistorySidebar />}
                      </Box>
                    )}
                    {/* メイン本体 */}
                    {chatPanelTab === 'chat' && (
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {activeTeamProject ? (
                          <TeamChatPanel
                            embedded
                            forcedTarget={{ kind: 'project', id: activeTeamProject.id, name: activeTeamProject.name, topicId: chatTopicId }}
                          />
                        ) : (
                          <AIChatPanel detached hideHeader pinned={isAIChatPinned} />
                        )}
                      </Box>
                    )}
                    {chatPanelTab === 'drive' && (
                      <Box sx={{ flex: 1, minWidth: 0 }}><AIDrivePanel /></Box>
                    )}
                    {chatPanelTab === 'teamchat' && (
                      <Box sx={{ flex: 1, minWidth: 0 }}><TeamChatPanel embedded /></Box>
                    )}
                    {chatPanelTab === 'render' && (
                      <Box sx={{ flex: 1, minWidth: 0 }}><AIRenderPanel /></Box>
                    )}
                    {chatPanelTab === 'gen3d' && (
                      <Box sx={{ flex: 1, minWidth: 0 }}><AI3DCreatePanel /></Box>
                    )}
                  </Box>
                  {/* リサイズハンドル（ピン留め時のみ。各辺・四隅でカーソルが変わる） */}
                  {isAIChatPinned && RESIZE_HANDLES.map(({ dir, sx }) => (
                    <Box
                      key={dir}
                      onMouseDown={(e) => startResizeChatFloat(e, dir)}
                      sx={{ position: 'absolute', zIndex: dir.length === 2 ? 7 : 6, cursor: RESIZE_CURSORS[dir], ...sx }}
                    />
                  ))}
                </Box>
                {/* ピル↔パネルを繋ぐ透明ブリッジ（ピーク時のみ。ホバーが途切れないように） */}
                {!isAIChatPinned && (
                  <Box sx={{ position: 'absolute', right: 0, bottom: -18, width: 90, height: 22 }} />
                )}
              </motion.div>
          )}

          {/* チャット履歴ダイアログ（統合ヘッダーの「履歴」から開く。シェル所有） */}
          <ChatHistoryDialog open={chatHistoryDialogOpen} onClose={() => setChatHistoryDialogOpen(false)} />

          {/* Project Chat トーク選択サイドバー（LINE のトーク一覧に相当） */}
          <Box
            sx={{
              width: isTeamChatOpen && isTeamChatSidebarOpen ? 260 : 0,
              flexShrink: 0,
              borderLeft: isTeamChatOpen && isTeamChatSidebarOpen ? `1px solid rgba(255,255,255,0.06)` : 'none',
              bgcolor: '#161b26',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1299,
              transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              ...(isMobile && { display: 'none' }),
            }}
          >
            {isTeamChatOpen && isTeamChatSidebarOpen && <TeamChatNavigator />}
          </Box>

          {/* Project Chat Panel (メンバー間チャット) */}
          <Box
            sx={{
              width: isTeamChatOpen ? TEAM_CHAT_WIDTH : 0,
              flexShrink: 0,
              borderLeft: isTeamChatOpen ? `1px solid ${BRAND.line}` : 'none',
              bgcolor: BRAND.panel,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1300,
              transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              ...(isMobile && {
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: isTeamChatOpen ? '100%' : 0,
                zIndex: 1320,
              }),
            }}
          >
            <Box sx={{ width: '100%', height: '100%', minWidth: isTeamChatOpen ? 250 : 0, overflow: 'hidden' }}>
              {isTeamChatOpen && <TeamChatPanel />}
            </Box>
          </Box>

          {/* Floating Library Panel */}
          {isLayoutWorkspace && !!(panelSelections?.layout?.selectedLayoutId || panelSelections?.layout?.optionId) && !dslLeftPanels?.dashboard && isLibraryDetached && (
            <FloatingLibraryPanel
              toggleLibraryDetached={toggleLibraryDetached}
              projectId={activeProjectId}
              workspaceId={activeWorkspaceId}
              planId={planId}
            />
          )}

          {/* 3D一括生成の進捗（非ブロッキング・グローバル） */}
          <FloatingBatchGenPanel />

        </Box>
        </Box>

        {/* Mobile bottom navigation. アイコンのみ・チャット中央を主役に。#root が safe-area-inset-bottom を確保済み */}
        {isMobile && (
          <Box sx={{
            flexShrink: 0, display: 'flex', alignItems: 'center',
            height: 56, bgcolor: BRAND.bg, borderTop: `1px solid ${BRAND.line}`,
          }}>
            {([
              {
                id: 'feed',
                icon: <HomeIcon size={24} />,
                active: mobileTab === 'feed' && currentMainView !== 'workspace',
                onClick: () => {
                  setMobileTab('feed');
                  setAIDriveOpen(false); setAIRenderOpen(false); setAI3DCreateOpen(false);
                  setCurrentMainView('my-site');
                },
              },
              {
                id: 'search',
                icon: <Search size={24} />,
                active: mobileTab === 'search' && currentMainView === 'gallery',
                onClick: () => {
                  setMobileTab('search');
                  setAIDriveOpen(false); setAIRenderOpen(false); setAI3DCreateOpen(false);
                  setCurrentMainView('gallery');
                },
              },
              {
                id: 'chat',
                primary: true,
                icon: <Box component="img" src={sekkeiyaChatIcon} alt="SEKKEIYA Chat" sx={{ width: 24, height: 24, objectFit: 'contain', display: 'block' }} />,
                active: isAIChatOpen,
                onClick: () => { setMobileTab('chat'); toggleAIChat(); },
              },
              {
                // アカウントサイト（マイサイト）プレビュー。プロジェクト一覧はサイト左上メニューのサイドバーから
                id: 'mysite',
                icon: <Globe size={24} />,
                active: mobileTab === 'mysite' && currentMainView === 'my-site',
                onClick: () => {
                  setMobileTab('mysite');
                  setAIDriveOpen(false); setAIRenderOpen(false); setAI3DCreateOpen(false);
                  setCurrentMainView('my-site');
                },
              },
              {
                id: 'profile',
                // 未読通知数を人型アイコンにバッジ表示（旧ヘッダーのベルを置き換え）。通知の中身はマイページから閲覧。
                icon: (
                  <Badge
                    badgeContent={unreadCount}
                    max={99}
                    sx={{ '& .MuiBadge-badge': { bgcolor: '#3498db', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16 } }}
                  >
                    <User size={24} />
                  </Badge>
                ),
                active: mobileTab === 'profile' && currentMainView === 'creator-profile',
                onClick: () => {
                  setMobileTab('profile');
                  setAIDriveOpen(false); setAIRenderOpen(false); setAI3DCreateOpen(false);
                  if (currentUser?.uid) {
                    setViewingCreatorId(currentUser.uid);
                    setCurrentMainView('creator-profile');
                  } else {
                    setMobileNavOpen(true);
                  }
                },
              },
            ] as const).map(item => (
              <Box
                key={item.id}
                component="button"
                onClick={item.onClick}
                aria-label={item.id}
                sx={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
                  border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent', '&:active': { opacity: 0.7 },
                }}
              >
                {'primary' in item && item.primary ? (
                  // チャット = SEKKEIYA の主役。白〜シルバーのグラデ立体ボタン＋枠線＋筆書きS
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f2f4f6 45%, #d6dbe0 100%)',
                    border: '1px solid rgba(0,0,0,0.18)',
                    boxShadow: item.active
                      ? 'inset 0 2px 4px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.3), 0 0 0 2px rgba(52,152,219,0.7)'
                      : '0 3px 7px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -3px 5px rgba(0,0,0,0.14)',
                    transition: 'box-shadow 0.12s, transform 0.1s',
                    '&:active': { transform: 'scale(0.95)' },
                  }}>
                    {item.icon}
                  </Box>
                ) : (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: item.active ? '#3498db' : 'rgba(255,255,255,0.55)',
                    transition: 'color 0.15s',
                  }}>
                    {item.icon}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* カメラ撮影オーバーレイ（MobileFeed から起動） */}
        {isMobile && (
          <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} projectId={activeProjectId ?? null} />
        )}
      </Box>
    </ThemeProvider>
  );
};

export default MainLayout;
