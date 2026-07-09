import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, TextField, IconButton, Select, MenuItem, CircularProgress, Tooltip, Menu, Popover, useMediaQuery } from '@mui/material';
import sekkeiyaLogo from '../../../src-tauri/src/assets/icons/sekkeiya-s-trans.png';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BRAND } from '../../styles/theme';
import { launchWorkspace } from '../../features/launcher/launchWorkspace';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import { useAiProfileStore } from '../../store/useAiProfileStore';
import { useCoreOrchestrator } from '../../store/useCoreOrchestrator';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { useJournalAiStore } from '../../store/useJournalAiStore';
import { useJournalStore } from '../../store/useJournalStore';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useAIChatStore } from '../../store/useAIChatStore';
import { useChatComposerStore } from '../../store/useChatComposerStore';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';
import ChatHistoryDialog from './ChatHistoryDialog';
import { getChatSuggestions } from './chatSuggestions';
import { useDsdStore } from '../../features/dsd/store/useDsdStore';
import { ChatUiRenderer } from './ChatUiRenderer';
import { ImageLightbox } from '../ImageLightbox';
import { DeliverablesSidebar } from './DeliverablesSidebar';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { speak, speakSentences, splitSentences, stopSpeaking, pauseSpeaking, resumeSpeaking, isTtsAvailable } from '../../lib/tts';
import { getProactiveSuggestions, type ProactiveSuggestions } from './proactiveSuggestions';
import { TtsSettingsDialog } from '../tts/TtsSettingsDialog';

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * 添付画像を Claude マルチモーダル用に base64 化する。
 * Claude 推奨の長辺 1568px へ縮小し JPEG 化（ペイロード削減＋精度維持）。
 * 戻り値: media_type と base64 データ（data URL のプレフィックス無し）、プレビュー用 dataUrl。
 */
async function downscaleImageToBase64(file: File, maxEdge = 1568): Promise<{ mediaType: string; data: string; dataUrl: string }> {
  const srcUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = srcUrl;
  });
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { mediaType: 'image/jpeg', data: srcUrl.split(',')[1] ?? '', dataUrl: srcUrl };
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { mediaType: 'image/jpeg', data: dataUrl.split(',')[1] ?? '', dataUrl };
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      className="copy-btn"
      size="small"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      sx={{
        position: 'absolute',
        top: 4,
        right: 4,
        opacity: copied ? 1 : 0,
        transition: 'opacity 0.2s',
        bgcolor: 'rgba(26,31,43,0.8)',
        color: copied ? '#81c995' : 'rgba(255,255,255,0.7)',
        '&:hover': { bgcolor: 'rgba(26,31,43,1)', color: copied ? '#81c995' : '#fff' }
      }}
    >
      {copied ? <CheckIcon sx={{ fontSize: '0.8rem' }} /> : <ContentCopyIcon sx={{ fontSize: '0.8rem' }} />}
    </IconButton>
  );
};

const AnimatedText = ({ text, isNew, onType }: { text: string; isNew: boolean, onType?: () => void }) => {
  const [displayedText, setDisplayedText] = useState(isNew ? '' : text);

  useEffect(() => {
    if (!isNew) {
      setDisplayedText(text);
      return;
    }
    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex++;
      setDisplayedText(text.substring(0, currentIndex));
      if (onType) onType();
      if (currentIndex >= text.length) {
        clearInterval(interval);
      }
    }, 15); // Adjust typing speed here (15ms per character)
    
    return () => clearInterval(interval);
  }, [text, isNew, onType]);

  return <>{displayedText}</>;
};

/**
 * 読み上げ中メッセージの本文。文単位のスパンで描画し、
 * 現在読んでいる文をハイライト＋任意の文をクリックするとそこから読み直す。
 * splitSentences は全文字を保持するので表示は通常時と同一になる。
 */
const SpokenText = ({ text, currentIdx, onJump }: { text: string; currentIdx: number; onJump: (index: number) => void }) => {
  const sentences = React.useMemo(() => splitSentences(text), [text]);
  return (
    <>
      {sentences.map((s, i) => (
        <Box
          key={i}
          component="span"
          title="クリックでここから読み上げ"
          onClick={() => onJump(i)}
          sx={{
            cursor: 'pointer',
            borderRadius: '3px',
            bgcolor: i === currentIdx ? 'rgba(138,180,248,0.22)' : 'transparent',
            transition: 'background-color 0.2s',
            '&:hover': { bgcolor: i === currentIdx ? 'rgba(138,180,248,0.3)' : 'rgba(255,255,255,0.08)' },
          }}
        >
          {s}
        </Box>
      ))}
    </>
  );
};

interface AIChatPanelProps {
  /** 右ドックから切り離したフローティング表示か。 */
  detached?: boolean;
  /** ドック ⇄ フローティング を切り替える。 */
  onToggleDetached?: () => void;
  /** フローティング時のドラッグ移動ハンドル（ヘッダーで使用）。 */
  onDragHandleMouseDown?: (e: React.MouseEvent) => void;
  /** ピン留め中か（フローティング時のみ）。未ピンはホバーを外すと自動収納。 */
  pinned?: boolean;
  /** ピン留めのトグル。 */
  onTogglePinned?: () => void;
  /** コックピット（タブ式パネル）に埋め込む際、ウィンドウ操作（ピン/ドック/閉じる）をシェル側へ委譲して非表示にする。 */
  hideWindowControls?: boolean;
  /** コックピットの統合ヘッダーを使う際、本コンポーネント側のヘッダー行をまるごと非表示にする。 */
  hideHeader?: boolean;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ detached = false, onToggleDetached, onDragHandleMouseDown, pinned = false, onTogglePinned, hideWindowControls = false, hideHeader = false }) => {
  const [chatText, setChatText] = useState("");
  const [showDebugPrompt, setShowDebugPrompt] = useState(false);
  const [debugPromptContent, setDebugPromptContent] = useState<string>("");
  const { contextLevel, watchedScopes, setContextLevel, toggleWatchedScope } = useJournalAiStore();
  const { submitEntry, entries, updateEntry, selectedEntryId } = useJournalStore();
  const [actionAnchorEl, setActionAnchorEl] = useState<{ msgId: string, el: HTMLElement, text: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // コンテキスト設定は歯車から開くポップオーバーに退避（会話上部をすっきりさせる）。
  const [contextAnchor, setContextAnchor] = useState<null | HTMLElement>(null);

  // 添付（写真・ファイル）。+ メニューから選択。
  // 画像は data(base64)+mediaType を保持して AI に中身を渡す。ファイルは現状は名前参照のみ。
  type Attachment = { id: string; name: string; kind: 'image' | 'file'; url?: string; mediaType?: string; data?: string };
  const [attachAnchor, setAttachAnchor] = useState<null | HTMLElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const chatInputRef = React.useRef<HTMLTextAreaElement | null>(null);

  // 自動化作業リスト等から「チャットに挿入」された依頼文を取り込む（送信はしない）。
  const pendingInsert = useChatComposerStore(s => s.pendingInsert);
  const consumeInsert = useChatComposerStore(s => s.consumeInsert);
  useEffect(() => {
    if (!pendingInsert) return;
    setChatText(prev => {
      const base = prev.replace(/\s+$/, '');
      return base ? `${base}\n${pendingInsert.text}` : pendingInsert.text;
    });
    consumeInsert();
    // 入力欄にフォーカスし、末尾へキャレットを移動（次フレームで DOM 反映後に実行）。
    requestAnimationFrame(() => {
      const el = chatInputRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      try { el.setSelectionRange(len, len); } catch { /* noop */ }
    });
  }, [pendingInsert, consumeInsert]);

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'file') => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // 同じファイルを再選択できるようにリセット
    if (kind === 'file') {
      setAttachments(prev => [...prev, ...files.map((f, i) => ({ id: `${f.name}-${f.size}-${i}-${performance.now()}`, name: f.name, kind: 'file' as const }))]);
      return;
    }
    // 画像: base64 化（縮小）して中身を AI に渡せるようにする。
    const blocks = await Promise.all(files.map(async (f, i) => {
      try {
        const b = await downscaleImageToBase64(f);
        return { id: `${f.name}-${f.size}-${i}-${performance.now()}`, name: f.name, kind: 'image' as const, url: b.dataUrl, mediaType: b.mediaType, data: b.data };
      } catch (err) {
        console.error('[Chat] 画像の読み込みに失敗', err);
        return null;
      }
    }));
    setAttachments(prev => [...prev, ...blocks.filter(Boolean) as Attachment[]]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const { isProcessing, currentToolLabel, toolProgress, sendMessageToOrchestrator, stopProcessing } = useCoreOrchestrator();
  const { activeSessionId, createSession, sessions, getSessionsForProject, setActiveSession, createScopedSession, getSessionsForScope, deleteSession, rewindToMessage } = useAIChatStore();
  const allSessions = useAIChatStore(s => s.sessions);

  // ストア全体ではなく必要な値だけを購読する（ホバー等の無関係な更新で
  // 重い AIChatPanel が丸ごと再描画されるのを防ぐ）。
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const projects = useAppStore(s => s.projects);
  const getActiveWorkspace = useAppStore(s => s.getActiveWorkspace);
  const lastLaunchPayload = useAppStore(s => s.lastLaunchPayload);
  const selectedLlmModel = useAppStore(s => s.selectedLlmModel);
  const setSelectedLlmModel = useAppStore(s => s.setSelectedLlmModel);
  const setAIChatOpen = useAppStore(s => s.setAIChatOpen);
  const toggleChatHistorySidebar = useAppStore(s => s.toggleChatHistorySidebar);
  const isChatHistorySidebarOpen = useAppStore(s => s.isChatHistorySidebarOpen);
  const isAIDriveOpen = useAppStore(s => s.isAIDriveOpen);
  const isAIRenderOpen = useAppStore(s => s.isAIRenderOpen);
  const isAI3DCreateOpen = useAppStore(s => s.isAI3DCreateOpen);
  const currentMainView = useAppStore(s => s.currentMainView);
  const { currentUser } = useAuthStore();
  
  const activeProfile = useAiProfileStore(s => s.aiProfiles.find(p => p.status === 'Active'));
  const buildCompleteSystemPrompt = useAiProfileStore(s => s.buildCompleteSystemPrompt);

  const activeProject = React.useMemo(
    () => projects.find(p => p.id === activeProjectId),
    [projects, activeProjectId],
  );
  const activeWorkspace = React.useMemo(
    () => getActiveWorkspace(),
    [getActiveWorkspace, activeWorkspaceId, activeProject],
  );

  const allMessages = useAIChatStore(s => s.messages);
  const messages = React.useMemo(() => {
    if (!activeSessionId) return [];
    // アクティブセッションのメッセージをそのまま表示。
    // ユーザーがチャット履歴サイドバーで別プロジェクトのセッションを選択した場合もそのまま表示する。
    // プロジェクト切り替え時のちらつきは useEffect によるセッション切り替えに委ねる。
    return allMessages.filter(m => m.sessionId === activeSessionId);
  }, [allMessages, activeSessionId]);

  // 開いているチャットのスコープに応じたチャット候補（サジェスト）。
  const activeSession = useAIChatStore(s => s.sessions.find(ss => ss.id === s.activeSessionId));
  const dsdTemplate = useDsdStore(s => s.currentTemplate);
  const suggestions = React.useMemo(() => getChatSuggestions({
    scope: activeSession?.scope,
    appScope: activeSession?.appScope,
    taskId: activeSession?.taskId,
    activeAppScope: lastLaunchPayload?.appScope,
    diagramTemplate: dsdTemplate,
    activeWorkspaceType: activeWorkspace?.workspaceType,
    isAIDriveOpen,
    isAIRenderOpen,
    isAI3DCreateOpen,
  }), [activeSession?.scope, activeSession?.appScope, activeSession?.taskId, lastLaunchPayload?.appScope, dsdTemplate, activeWorkspace?.workspaceType, isAIDriveOpen, isAIRenderOpen, isAI3DCreateOpen]);

  // 🔊 音声モード: ONにするとAIの応答を自動で読み上げる（S.Blog議論と同じUX）。
  // 状態は useAppStore（コックピット統合ヘッダーのトグルと共有）。
  const voiceMode = useAppStore(s => s.isChatVoiceModeOn);
  const toggleVoiceMode = useAppStore(s => s.toggleChatVoiceMode);
  // 読み上げ中のメッセージ id / 現在読んでいる文のインデックス / 一時停止状態。
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [speakingSentenceIdx, setSpeakingSentenceIdx] = useState(-1);
  const [ttsSettingsOpen, setTtsSettingsOpen] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const stopSpeakingUi = () => {
    stopSpeaking();
    setSpeakingMsgId(null);
    setSpeakingSentenceIdx(-1);
    setTtsPaused(false);
  };
  // メッセージを startIndex 文目から読み上げる（🔊=先頭から、文クリック=その文から）。
  const startSpeakingMessage = (msgId: string, text: string, startIndex = 0) => {
    setSpeakingMsgId(msgId);
    setSpeakingSentenceIdx(startIndex);
    setTtsPaused(false);
    speakSentences(splitSentences(text), {
      startIndex,
      onSentenceStart: (i) => setSpeakingSentenceIdx(i),
      // onEnd は置き換え/停止された旧セッションでは呼ばれない（tts.ts の世代管理）ため、
      // ここが呼ばれた時点でこのメッセージの読み上げが完走したと確定できる。
      onEnd: () => { setSpeakingMsgId(null); setSpeakingSentenceIdx(-1); setTtsPaused(false); },
    });
  };
  const toggleSpeakMessage = (msgId: string, text: string) => {
    if (speakingMsgId === msgId) { stopSpeakingUi(); return; }
    startSpeakingMessage(msgId, text);
  };
  const togglePauseSpeaking = () => {
    if (ttsPaused) { resumeSpeaking(); setTtsPaused(false); }
    else { pauseSpeaking(); setTtsPaused(true); }
  };
  // Alt+クリック: 本文のクリック位置の文からそのまま読み上げを開始する。
  // 通常表示はプレーンテキストなので、クリック座標→文字オフセット→文インデックスに変換する
  // （splitSentences は全文字を保持するため、表示文字列のオフセットが文境界へ正確に対応する）。
  const handleAltClickSpeak = (e: React.MouseEvent, msgId: string, text: string) => {
    if (!e.altKey || !isTtsAvailable()) return;
    if (speakingMsgId === msgId) return; // 読み上げ中は文スパンのクリック（ジャンプ）に任せる
    e.preventDefault();
    e.stopPropagation();
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    const range = doc.caretRangeFromPoint?.(e.clientX, e.clientY);
    const pos = range
      ? { node: range.startContainer, offset: range.startOffset }
      : (() => { const p = doc.caretPositionFromPoint?.(e.clientX, e.clientY); return p ? { node: p.offsetNode, offset: p.offset } : null; })();
    let startIndex = 0;
    if (pos) {
      // コンテナ先頭からクリック位置までの通し文字数を数える
      let abs = -1; let total = 0;
      const walker = document.createTreeWalker(e.currentTarget as HTMLElement, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n === pos.node) { abs = total + pos.offset; break; }
        total += (n.textContent || '').length;
      }
      if (abs >= 0) {
        const sentences = splitSentences(text);
        let acc = 0;
        for (let i = 0; i < sentences.length; i++) {
          acc += sentences[i].length;
          if (abs < acc) { startIndex = i; break; }
        }
      }
    }
    startSpeakingMessage(msgId, text, startIndex);
  };
  useEffect(() => {
    if (!voiceMode) stopSpeakingUi(); // OFFにしたら読み上げ中も止める
  }, [voiceMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeaking(), []); // アンマウント時に停止
  useEffect(() => { stopSpeakingUi(); }, [activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 音声モード: 新しく届いたAI応答を自動読み上げ。
  // timestamp の鮮度で「到着直後」を判定し、履歴の再表示・セッション切替では読まない
  // （AnimatedText の isNew と同じ考え方）。読了済み id を覚えて二重読みも防ぐ。
  const spokenIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'ai' || !last.text.trim()) return;
    if (spokenIdRef.current === last.id) return;
    spokenIdRef.current = last.id;
    if (!voiceMode || !isTtsAvailable() || Date.now() - last.timestamp > 3000) return;
    startSpeakingMessage(last.id, last.text);
  }, [messages, voiceMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 先回り提案: 空のチャット（新規含む）を開いたとき、同プロジェクトの他チャットの
  // 進捗から「先回りの挨拶+提案チップ」を生成して表示する（表示専用・履歴には保存しない）。
  const [proactive, setProactive] = useState<ProactiveSuggestions | null>(null);
  const isEmptyChat = messages.length === 0;
  useEffect(() => {
    setProactive(null);
    if (!isEmptyChat || !activeProject?.id || !activeSessionId) return;
    let alive = true;
    getProactiveSuggestions(activeProject.id, activeProject.name, activeSessionId).then((r) => {
      if (!alive || !r) return;
      setProactive(r.data);
      // 新規生成時のみ、音声モードONなら挨拶を読み上げる（キャッシュ再表示では読まない）
      if (r.fresh && useAppStore.getState().isChatVoiceModeOn && isTtsAvailable()) speak(r.data.greeting);
    });
    return () => { alive = false; };
  }, [activeSessionId, isEmptyChat, activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [deliverablesOpen, setDeliverablesOpen] = useState(false);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // プロジェクト切り替え時: ① セッション自動切り替え ② サイト先行ロード
  // どのタブにいても site snapshot が正しいプロジェクトを指すようにする。
  const prevProjectIdRef = React.useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // プロジェクトが「実際に変わった」かを判定（初回マウント＝再オープン時は変更扱いしない）。
    const projChanged = prevProjectIdRef.current !== undefined && prevProjectIdRef.current !== (activeProject?.id ?? null);
    prevProjectIdRef.current = activeProject?.id ?? null;

    // 永続化された前回のアクティブセッションがまだ存在するか。
    const activeStillValid = !!activeSessionId && sessions.some(s => s.id === activeSessionId);

    // ① セッション選択。プロジェクトが実際に変わったとき、または有効なアクティブセッションが
    //    無いときだけ切り替える。チャットを閉じて再度開いた（＝再マウント）だけのときは、
    //    前回開いていたセッションをそのまま維持する。
    if (projChanged || !activeStillValid) {
      if (!activeProject?.id) {
        // プロジェクト未選択（全プロジェクトモード）: 有効なセッションが無い場合のみ用意。
        if (!activeStillValid) {
          const globalSessions = getSessionsForScope({ projectId: '__global__' });
          if (globalSessions.length === 0) createScopedSession('global', {});
          else setActiveSession(globalSessions[0].id);
        }
      } else {
        const projectSessions = getSessionsForProject(activeProject.id);
        if (projectSessions.length === 0) {
          createSession(activeProject.id);
        } else if (!activeSessionId || !projectSessions.find(s => s.id === activeSessionId)) {
          setActiveSession(projectSessions[0].id);
        }
      }
    }

    // ② サイト先行ロード（ProjectSiteCanvas が未マウントでも snapshot が正しくなる）
    // my-site 表示中はアカウントサイトが ProjectSiteCanvas を占有しているためスキップ。
    if (activeProject?.id && currentMainView !== 'my-site') {
      const { source: cur, load: loadSite } = useProjectSiteStore.getState();
      if (!cur || cur.kind !== 'project' || cur.id !== activeProject.id) {
        loadSite({ kind: 'project', id: activeProject.id }, activeProject.name);
      }
    }
  }, [activeProject?.id, currentMainView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    if (showDebugPrompt && activeProfile) {
      setDebugPromptContent("Loading system prompt...");
      buildCompleteSystemPrompt(activeProfile.id).then(content => {
        if (active) setDebugPromptContent(content);
      }).catch(err => {
        if (active) setDebugPromptContent("Error loading prompt.");
      });
    }
    return () => { active = false; };
  }, [showDebugPrompt, activeProfile, buildCompleteSystemPrompt, contextLevel, watchedScopes]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatText.trim() && attachments.length === 0) || isProcessing) return;
    let text = chatText.trim();
    if (attachments.length > 0) {
      const names = attachments.map(a => a.name).join(', ');
      text = text ? `${text}\n\n[添付: ${names}]` : `[添付: ${names}]`;
    }
    // 画像は中身(base64)を AI に渡す。
    const images = attachments
      .filter(a => a.kind === 'image' && a.data && a.mediaType)
      .map(a => ({ mediaType: a.mediaType as string, data: a.data as string }));
    setChatText("");
    setAttachments([]);
    // Phase B: ループ・ツール実行・保存はすべてオーケストレーター内で完結する。
    await sendMessageToOrchestrator(text, { source: 'sidebar_chat', sessionId: activeSessionId || undefined, images });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit(e as unknown as React.FormEvent);
    }
  };

  const isMobile = useMediaQuery('(max-width:768px)');

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    const name = currentUser?.displayName?.split(' ')[0] ?? currentUser?.email?.split('@')[0] ?? '';
    const timeWord = h < 12 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'こんばんは';
    return name ? `${timeWord}、${name}さん` : timeWord;
  }, [currentUser]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1a1f2b', color: '#fff', position: 'relative' }}>
      {/* 画像ライトボックス（レンダー結果等の拡大＋←→ナビ）。共有オーバーレイ。 */}
      <ImageLightbox />
      {/* 右サイドバー成果物ギャラリー（プロジェクト範囲・横断プレビュー）。 */}
      <DeliverablesSidebar open={deliverablesOpen} onClose={() => setDeliverablesOpen(false)} projectId={activeProject?.id ?? null} />
      {/* Header（フローティング時は余白を掴んで移動。ボタン上では移動を開始しない）。
          コックピットの統合ヘッダー使用時は hideHeader でまるごと非表示。 */}
      {!hideHeader && (
      <Box
        onMouseDown={(e) => {
          if (detached && onDragHandleMouseDown && !(e.target as HTMLElement).closest('button')) {
            onDragHandleMouseDown(e);
          }
        }}
        sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid rgba(255,255,255,0.05)`, minHeight: 48, cursor: detached ? 'move' : 'default' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, overflow: 'hidden' }}>
          <IconButton
            size="small"
            onClick={toggleChatHistorySidebar}
            sx={{ color: isChatHistorySidebarOpen ? '#ffd740' : 'rgba(255,255,255,0.4)', p: 0.25, flexShrink: 0, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
            title="チャット履歴サイドバー"
          >
            <ViewSidebarRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}>
            SEKKEIYA Chat
          </Typography>
          {activeProject && (
            <Typography sx={{
              fontSize: '0.65rem', color: '#8ab4f8', fontWeight: 500,
              bgcolor: 'rgba(138,180,248,0.1)', border: '1px solid rgba(138,180,248,0.2)',
              borderRadius: 1, px: 0.75, py: 0.1, flexShrink: 0,
              maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {activeProject.name}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isTtsAvailable() && (
            <>
              <Tooltip title={voiceMode ? '音声モードOFF' : '音声モードON（AIの応答を読み上げながら作業できます）'}>
                <IconButton
                  size="small"
                  onClick={toggleVoiceMode}
                  sx={{ color: voiceMode ? '#ffd740' : 'rgba(255,255,255,0.4)', bgcolor: voiceMode ? 'rgba(255,215,64,0.12)' : 'transparent', '&:hover': { color: voiceMode ? '#ffd740' : '#fff', bgcolor: voiceMode ? 'rgba(255,215,64,0.18)' : 'rgba(255,255,255,0.05)' } }}
                >
                  {voiceMode ? <VolumeUpRoundedIcon sx={{ fontSize: '1.1rem' }} /> : <VolumeOffRoundedIcon sx={{ fontSize: '1.1rem' }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="読み上げの設定（速度・声）">
                <IconButton size="small" onClick={() => setTtsSettingsOpen(true)}
                  sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                  <TuneRoundedIcon sx={{ fontSize: '1.05rem' }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <IconButton
            size="small"
            onClick={() => activeProject?.id && createSession(activeProject.id)}
            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
            title="New Chat"
          >
            <AddRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setHistoryOpen(true)}
            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
            title="History"
          >
            <HistoryRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setDeliverablesOpen(v => !v)}
            sx={{ color: deliverablesOpen ? '#ffd740' : 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
            title="成果物ギャラリー"
          >
            <CollectionsRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          {!hideWindowControls && (<>
          {detached && onTogglePinned && (
            <IconButton
              size="small"
              onClick={onTogglePinned}
              title={pinned ? 'ピンを外す（ホバーを外すと自動で閉じる）' : 'ピン留め（開いたまま維持）'}
              sx={{ color: pinned ? '#3498db' : 'rgba(255,255,255,0.4)', '&:hover': { color: pinned ? '#3498db' : '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              {pinned
                ? <PushPinRoundedIcon sx={{ fontSize: '1.05rem' }} />
                : <PushPinOutlinedIcon sx={{ fontSize: '1.05rem' }} />}
            </IconButton>
          )}
          {onToggleDetached && (
            <IconButton
              size="small"
              onClick={onToggleDetached}
              title={detached ? 'ドックに戻す' : '切り離す（フローティング）'}
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              {detached
                ? <CloseFullscreenRoundedIcon sx={{ fontSize: '1.05rem' }} />
                : <OpenInFullRoundedIcon sx={{ fontSize: '1.05rem' }} />}
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => setAIChatOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          </>)}
        </Box>
      </Box>
      )}

      {/* コンテキスト設定（歯車）— 会話上部に小さく置き、クリックでポップオーバー表示。
          以前は大きな折りたたみブロックだったが、上級者向け設定なので歯車に退避した。 */}
      {!isMobile && (
        <Box sx={{ px: 2, pt: 1, pb: 0.25, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <Tooltip title="コンテキスト設定" placement="left">
            <Box
              onClick={(e) => setContextAnchor(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.25, borderRadius: 1, cursor: 'pointer',
                color: contextAnchor ? '#8ab4f8' : 'rgba(255,255,255,0.4)',
                '&:hover': { color: '#8ab4f8', bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <TuneRoundedIcon sx={{ fontSize: 15 }} />
              <Typography sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                {contextLevel}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      )}

      {/* Main Chat Area */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', pb: 2 }}>

        {/* Mobile empty state: Claude-style centered logo + greeting */}
        {isMobile && messages.length === 0 && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, pt: 6, pb: 4 }}>
            <Box
              component="img"
              src={sekkeiyaLogo}
              alt="SEKKEIYA"
              sx={{ width: 64, height: 64, objectFit: 'contain', opacity: 0.9 }}
            />
            <Typography sx={{
              fontSize: '1.3rem', fontWeight: 300, color: 'rgba(255,255,255,0.75)',
              letterSpacing: '0.5px', textAlign: 'center',
              fontFamily: '"Yu Gothic UI", "Hiragino Sans", "Noto Sans JP", sans-serif',
            }}>
              {greeting}
            </Typography>
          </Box>
        )}

        {/* Context Settings — 歯車から開くポップオーバー（会話上部から退避） */}
        {!isMobile && (
        <Popover
          open={Boolean(contextAnchor)}
          anchorEl={contextAnchor}
          onClose={() => setContextAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { bgcolor: '#1a1f2b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, width: 300, maxWidth: '92vw', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' } }}
        >
          <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Context Settings
            </Typography>
            <Tooltip
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, mb: 0.5 }}>コンテキスト設定</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)' }}>
                    AIにプロジェクト内のどの情報（要件、レイアウト、議事録など）を事前に共有するかを設定します。<br/><br/>
                    <b>Project:</b> プロジェクト全体の情報を加味して回答します。<br/>
                    <b>Workspace:</b> 現在開いている画面の情報のみ加味します。<br/>
                    <b>OFF:</b> 一般的な知識のみで回答します（最速）。
                  </Typography>
                </Box>
              }
              placement="bottom"
              arrow
            >
              <InfoOutlinedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', cursor: 'help' }} />
            </Tooltip>
          </Box>
              <Box sx={{ p: 1.5, pt: 0 }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', mb: 1 }}>
                  Current Context
                </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>User</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{currentUser ? currentUser.email : 'Not Logged In'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Project</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{activeProject ? activeProject.name : 'None'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Workspace</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{activeWorkspace ? activeWorkspace.name : 'None (Home view)'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem', alignItems: 'center' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Status</Typography>
                <Typography component="div" sx={{ color: 'rgba(255,255,255,0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {activeWorkspace ? (
                    <><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#4caf50' }} /> App Runtime</>
                  ) : (
                    <><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)' }} /> Hub Mode</>
                  )}
                </Typography>
              </Box>
            </Box>

            {lastLaunchPayload && (
              <Box sx={{ mt: 1.5, p: 1, bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#4fc3f7', fontWeight: 500 }}>Scope: {lastLaunchPayload.appScope}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all', mt: 0.25 }}>wsId: {lastLaunchPayload.workspaceId}</Typography>
                {!activeWorkspace && (
                  <Button 
                    variant="contained"
                    size="small" 
                    disableElevation
                    onClick={() => launchWorkspace(lastLaunchPayload)}
                    sx={{ mt: 1, width: '100%', textTransform: 'none', fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', py: 0.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                  >
                    Resume Workspace
                  </Button>
                )}
              </Box>
            )}

            {/* Watching Context Block */}
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#8ab4f8', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <MemoryIcon sx={{ fontSize: 12 }} /> Watching Context
                </Typography>
                <Select
                  value={contextLevel}
                  onChange={(e) => setContextLevel(e.target.value as any)}
                  size="small"
                  variant="standard"
                  disableUnderline
                  sx={{ 
                    fontSize: '0.6rem', 
                    color: '#8ab4f8', 
                    '& .MuiSelect-select': { py: 0, px: 0.5 },
                    '& .MuiSelect-icon': { color: '#8ab4f8', width: '0.8em', height: '0.8em' }
                  }}
                >
                  <MenuItem value="off" sx={{ fontSize: '0.65rem' }}>OFF</MenuItem>
                  <MenuItem value="workspace" sx={{ fontSize: '0.65rem' }}>Workspace</MenuItem>
                  <MenuItem value="project" sx={{ fontSize: '0.65rem' }}>Project</MenuItem>
                  <MenuItem value="custom" sx={{ fontSize: '0.65rem' }}>Custom</MenuItem>
                </Select>
              </Box>

              {contextLevel !== 'off' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pl: 0.5 }}>
                  {['requirements', 'workfiles', 'models', 'layout', 'presents', 'journal'].map(scope => {
                    const isWatched = contextLevel === 'project' || (contextLevel === 'custom' && watchedScopes.includes(scope as any));
                    const isWorkspaceAndCurrent = contextLevel === 'workspace' && scope === 'journal'; // Simple mock mapping
                    
                    const active = isWatched || isWorkspaceAndCurrent;

                    return (
                      <Box 
                        key={scope} 
                        onClick={() => contextLevel === 'custom' && toggleWatchedScope(scope as any)}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5, 
                          opacity: active ? 1 : 0.3,
                          cursor: contextLevel === 'custom' ? 'pointer' : 'default',
                          '&:hover': { opacity: contextLevel === 'custom' ? 0.8 : (active ? 1 : 0.3) }
                        }}
                      >
                        {active ? <CheckBoxIcon sx={{ fontSize: 12, color: '#8ab4f8' }} /> : <CheckBoxOutlineBlankIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />}
                        <Typography sx={{ fontSize: '0.65rem', color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                          {scope}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Injected System Context Debug View */}
            <Box sx={{ mt: 1.5, pt: 1, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
               <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#e2a6ff', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <span style={{ fontSize: '9px' }}>🧠</span> Injected System Context
                  </Typography>
                  <Button 
                    size="small" 
                    variant="text" 
                    disableRipple
                    sx={{ fontSize: '0.6rem', p: 0, minWidth: 'auto', textTransform: 'none', color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'transparent' } }}
                    onClick={() => setShowDebugPrompt(!showDebugPrompt)}
                  >
                    {showDebugPrompt ? 'Hide' : 'Inspect'}
                  </Button>
               </Box>
               
               {showDebugPrompt && (
                 <Box sx={{ 
                   mt: 1,
                   bgcolor: 'rgba(0,0,0,0.3)', 
                   p: 1, 
                   borderRadius: 1.5, 
                   maxHeight: 250, 
                   overflowY: 'auto',
                   border: `1px solid rgba(226, 166, 255, 0.2)`
                 }}>
                   {activeProfile ? (
                     <>
                       {/* Context Metadata */}
                       <Box sx={{ mb: 1, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                         <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Profile: {activeProfile.name}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', mt: 0.25, fontWeight: 400 }}>Model: {activeProfile.baseModelId}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>Role: {activeProfile.role} | Scopes: {activeProfile.usageScopes.join(', ')}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', mt: 0.25, fontWeight: 400 }}>
                           Memory: {activeProfile.useSaveDataMemories ? <span style={{color: '#4caf50'}}>ON</span> : <span style={{color: '#f44336'}}>OFF</span>}
                         </Typography>
                       </Box>
                       
                       {/* Raw Injected Prompt */}
                       <Typography component="pre" sx={{ 
                         whiteSpace: 'pre-wrap', 
                         wordBreak: 'break-all', 
                         color: 'rgba(255,255,255,0.6)',
                         fontSize: '0.6rem',
                         lineHeight: 1.4,
                         fontFamily: 'monospace',
                         m: 0,
                         fontWeight: 400
                       }}>
                         {debugPromptContent}
                       </Typography>
                     </>
                   ) : (
                     <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
                       No active AI profile found.
                     </Typography>
                   )}
                 </Box>
               )}
            </Box>

              </Box>
        </Popover>
        )}

        {/* Chat Messages */}
        <Box sx={{ px: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 先回り挨拶（空チャット時のみ・表示専用で履歴には残らない） */}
          {isEmptyChat && proactive && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.25, gap: 0.5 }}>
                <AutoAwesomeRoundedIcon sx={{ fontSize: '0.7rem', color: '#8ab4f8' }} />
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(138,180,248,0.8)', fontWeight: 500, textTransform: 'uppercase' }}>
                  AI Assistant
                </Typography>
              </Box>
              <Paper elevation={0} sx={{
                p: 1.25, px: 1.5, maxWidth: '90%',
                bgcolor: 'rgba(138,180,248,0.05)',
                color: 'rgba(255,255,255,0.9)',
                borderRadius: 2,
                border: '1px solid rgba(138,180,248,0.15)',
              }}>
                <Typography sx={{
                  fontSize: '0.75rem', fontWeight: 300, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                }}>
                  {proactive.greeting}
                </Typography>
              </Paper>
            </Box>
          )}
          {messages.map((msg, index) => (
            <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.25, gap: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'uppercase' }}>
                  {msg.role === 'user' ? 'You' : 'AI Assistant'}
                </Typography>
              </Box>
              {msg.role === 'ai' ? (
                <Box sx={{ position: 'relative', width: '100%', display: 'flex', '&:hover .copy-btn': { opacity: 1 } }}>
                  <Paper elevation={0} sx={{ 
                    p: 1.25, 
                    px: 1.5,
                    maxWidth: '90%', 
                    bgcolor: 'transparent', 
                    color: 'rgba(255,255,255,0.9)',
                    borderRadius: 2,
                    border: `1px solid rgba(255,255,255,0.05)`,
                    flexGrow: 1
                  }}>
                    <Typography onClick={(e) => handleAltClickSpeak(e, msg.id, msg.text)} sx={{
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif',
                      WebkitFontSmoothing: 'antialiased'
                    }}>
                      {speakingMsgId === msg.id ? (
                        <SpokenText
                          text={msg.text}
                          currentIdx={speakingSentenceIdx}
                          onJump={(i) => startSpeakingMessage(msg.id, msg.text, i)}
                        />
                      ) : (
                        <AnimatedText text={msg.text} isNew={index === messages.length - 1 && Date.now() - msg.timestamp < 1000} onType={scrollToBottom} />
                      )}
                    </Typography>
                  </Paper>
                  <CopyButton text={msg.text} />
                  {isTtsAvailable() && !!msg.text.trim() && (
                    <>
                      <Tooltip title={speakingMsgId === msg.id ? '読み上げを停止' : 'このメッセージを読み上げ（本文を Alt+クリックでその文から）'} placement="top" arrow>
                        <IconButton
                          className="copy-btn"
                          size="small"
                          onClick={() => toggleSpeakMessage(msg.id, msg.text)}
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 32,
                            opacity: speakingMsgId === msg.id ? 1 : 0,
                            transition: 'opacity 0.2s',
                            bgcolor: 'rgba(26,31,43,0.8)',
                            color: speakingMsgId === msg.id ? '#8ab4f8' : 'rgba(255,255,255,0.7)',
                            '&:hover': { bgcolor: 'rgba(26,31,43,1)', color: speakingMsgId === msg.id ? '#8ab4f8' : '#fff' }
                          }}
                        >
                          {speakingMsgId === msg.id ? <StopRoundedIcon sx={{ fontSize: '0.8rem' }} /> : <VolumeUpRoundedIcon sx={{ fontSize: '0.8rem' }} />}
                        </IconButton>
                      </Tooltip>
                      {speakingMsgId === msg.id && (
                        <Tooltip title={ttsPaused ? '再開' : '一時停止'} placement="top" arrow>
                          <IconButton
                            size="small"
                            onClick={togglePauseSpeaking}
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 60,
                              bgcolor: 'rgba(26,31,43,0.8)',
                              color: '#8ab4f8',
                              '&:hover': { bgcolor: 'rgba(26,31,43,1)' }
                            }}
                          >
                            {ttsPaused ? <PlayArrowRoundedIcon sx={{ fontSize: '0.8rem' }} /> : <PauseRoundedIcon sx={{ fontSize: '0.8rem' }} />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </Box>
              ) : (
                <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', '&:hover .user-msg-actions': { opacity: 1 } }}>
                  {/* ホバーアクション行 */}
                  <Box className="user-msg-actions" sx={{
                    opacity: 0, transition: 'opacity 0.15s',
                    display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5,
                  }}>
                    <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', mr: 0.5 }}>
                      {timeAgo(msg.timestamp)}
                    </Typography>
                    <Tooltip title="コピー" placement="top" arrow>
                      <IconButton
                        size="small"
                        onClick={() => navigator.clipboard.writeText(msg.text)}
                        sx={{ p: 0.4, color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}
                      >
                        <ContentCopyIcon sx={{ fontSize: '0.75rem' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ここまで巻き戻す" placement="top" arrow>
                      <IconButton
                        size="small"
                        onClick={() => { if (activeSessionId) rewindToMessage(activeSessionId, msg.id); }}
                        sx={{ p: 0.4, color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.1)' } }}
                      >
                        <ReplayRoundedIcon sx={{ fontSize: '0.75rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Paper elevation={0} sx={{
                    p: 1.25,
                    px: 1.5,
                    maxWidth: '90%',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.9)',
                    borderRadius: 2,
                    border: 'none'
                  }}>
                    <Typography sx={{
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif',
                      WebkitFontSmoothing: 'antialiased'
                    }}>
                      {msg.text}
                    </Typography>
                  </Paper>
                </Box>
              )}
              {msg.role === 'ai' && msg.ui && <ChatUiRenderer ui={msg.ui} />}
              {msg.role === 'ai' && msg.citations && msg.citations.length > 0 && (
                <Box sx={{ mt: 0.75, width: '100%', maxWidth: '90%' }}>
                  <Box
                    component="button"
                    onClick={() => setExpandedCitations(prev => {
                      const next = new Set(prev);
                      if (next.has(msg.id)) { next.delete(msg.id); } else { next.add(msg.id); }
                      return next;
                    })}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                      background: 'none', border: 'none', p: 0, color: 'rgba(255,255,255,0.35)',
                      '&:hover': { color: 'rgba(255,255,255,0.6)' }, transition: 'color 0.15s',
                    }}
                  >
                    <MenuBookRoundedIcon sx={{ fontSize: '0.65rem' }} />
                    <Typography sx={{ fontSize: '0.6rem' }}>
                      出典 {msg.citations.length}件
                    </Typography>
                    <KeyboardArrowDownIcon sx={{
                      fontSize: '0.75rem',
                      transform: expandedCitations.has(msg.id) ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }} />
                  </Box>
                  {expandedCitations.has(msg.id) && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {msg.citations.map((c) => (
                        <Box
                          key={c.id}
                          sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.4,
                            px: 0.75, py: 0.2, borderRadius: 1,
                            bgcolor: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)',
                            fontSize: '0.62rem', color: '#93c5fd', maxWidth: 200,
                          }}
                          title={c.title}
                        >
                          <MenuBookRoundedIcon sx={{ fontSize: '0.7rem' }} />
                          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
              {msg.role === 'ai' && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', maxWidth: '90%', mt: 0.5 }}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<BookmarkAddOutlinedIcon sx={{ fontSize: '0.7rem' }} />}
                    sx={{
                      minWidth: 'auto', p: 0, px: 1, py: 0.25, fontSize: '0.6rem', color: '#8ab4f8', textTransform: 'none',
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'rgba(138, 180, 248, 0.1)' }
                    }}
                    onClick={(e) => setActionAnchorEl({ msgId: msg.id, el: e.currentTarget, text: msg.text })}
                  >
                    アクション
                  </Button>
                </Box>
              )}
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* ツール実行中の進捗インジケーター */}
        {isProcessing && (
          <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              bgcolor: 'rgba(138,180,248,0.06)', border: '1px solid rgba(138,180,248,0.15)',
              borderRadius: 2, px: 1.5, py: 0.75,
            }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: '0.75rem', color: '#8ab4f8', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(138,180,248,0.9)', fontWeight: 300, flex: 1 }}>
                {currentToolLabel || 'AI が考えています...'}
              </Typography>
              {toolProgress && (
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(138,180,248,0.7)', fontWeight: 600, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
                  {toolProgress.current} / {toolProgress.total}
                </Typography>
              )}
              <CircularProgress size={10} sx={{ color: '#8ab4f8', flexShrink: 0 }} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Input Area（一体型: 添付プレビュー + テキスト + ボトムツールバー） */}
      <Box sx={{ p: 2, pt: 1, bgcolor: '#1a1f2b', flexShrink: 0 }}>
        {/* チャット候補。空チャットで先回り提案があればそれを優先（プロジェクト文脈のパーソナライズ）、
            無ければスコープ別の固定候補（選んで入力欄に投入）。 */}
        {!isProcessing && !chatText.trim() && attachments.length === 0 && (isEmptyChat && proactive?.chips?.length ? proactive.chips : suggestions).length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            <Typography sx={{ width: '100%', fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', textTransform: 'uppercase', mb: 0.25 }}>
              {isEmptyChat && proactive?.chips?.length ? '先回り提案' : '候補'}
            </Typography>
            {(isEmptyChat && proactive?.chips?.length ? proactive.chips : suggestions).map((s) => (
              <Box
                key={s.label}
                onClick={() => setChatText(s.text)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)',
                  bgcolor: 'rgba(255,215,64,0.06)', border: '1px solid rgba(255,215,64,0.25)',
                  borderRadius: 5, px: 1, py: 0.4, cursor: 'pointer', transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(255,215,64,0.14)', color: '#fff', borderColor: 'rgba(255,215,64,0.5)' },
                }}
                title={s.text}
              >
                <AutoAwesomeRoundedIcon sx={{ fontSize: '0.7rem', color: '#ffd740' }} />
                {s.label}
              </Box>
            ))}
          </Box>
        )}
        <Box
          component="form"
          onSubmit={handleChatSubmit}
          sx={{
            bgcolor: 'rgba(0,0,0,0.2)',
            border: `1px solid rgba(255,255,255,0.1)`,
            borderRadius: 3,
            p: 1,
            transition: 'border-color 0.2s',
            '&:focus-within': { borderColor: 'rgba(255,255,255,0.3)' },
          }}
        >
          {/* 添付プレビュー */}
          {attachments.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 0.5, pb: 1 }}>
              {attachments.map(a => (
                <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5, pl: a.kind === 'image' ? 0.25 : 0.75, pr: 0.5, py: 0.25, maxWidth: 170 }}>
                  {a.kind === 'image' && a.url
                    ? <Box component="img" src={a.url} alt={a.name} sx={{ width: 26, height: 26, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }} />
                    : <AttachFileRoundedIcon sx={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />}
                  <Typography noWrap sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.8)', maxWidth: 96 }}>{a.name}</Typography>
                  <IconButton size="small" onClick={() => removeAttachment(a.id)} sx={{ p: 0.15, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
                    <CloseRoundedIcon sx={{ fontSize: '0.8rem' }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          {/* テキスト入力 */}
          <TextField
            fullWidth
            multiline
            maxRows={6}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={handleKeyDown}
            inputRef={chatInputRef}
            placeholder={isMobile ? "SEKKEIYAとチャット" : "何でもできます"}
            variant="standard"
            InputProps={{ disableUnderline: true, sx: { p: 0.5, px: 1 } }}
            inputProps={{
              style: {
                fontSize: '0.75rem',
                fontWeight: 300,
                color: '#fff',
                lineHeight: 1.5,
                fontFamily: '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif',
                WebkitFontSmoothing: 'antialiased',
              },
            }}
          />

          {/* ボトムツールバー: ＋添付 / モデル / 送信 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5, px: 0.25 }}>
            <Tooltip title="写真とファイルを追加">
              <IconButton
                size="small"
                onClick={(e) => setAttachAnchor(e.currentTarget)}
                sx={{ color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.12)', p: 0.5, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}
              >
                <AddRoundedIcon sx={{ fontSize: '1.15rem' }} />
              </IconButton>
            </Tooltip>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Select
                value={selectedLlmModel}
                onChange={(e) => setSelectedLlmModel(e.target.value)}
                size="small"
                variant="outlined"
                MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1f2b', border: `1px solid rgba(255,255,255,0.1)`, color: 'rgba(255,255,255,0.9)' } } }}
                sx={{
                  height: 24,
                  fontSize: '0.62rem',
                  fontWeight: 300,
                  color: 'rgba(255,255,255,0.6)',
                  bgcolor: 'transparent',
                  borderRadius: 1.5,
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' },
                  '& .MuiSelect-select': { py: 0, pl: 1, pr: '20px !important', display: 'flex', alignItems: 'center' },
                  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)', width: '0.9em', height: '0.9em' },
                }}
              >
                <MenuItem value="claude-sonnet-4-6" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>Claude Sonnet ✦ 推奨</MenuItem>
                <MenuItem value="claude-haiku-4-5-20251001" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>Claude Haiku · 高速/低コスト</MenuItem>
                <MenuItem value="gemini-2.5-flash" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>Gemini 2.5 Flash · 無料枠</MenuItem>
                <MenuItem value="gemini-1.5-flash" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>Gemini 1.5 Flash (Free)</MenuItem>
                <MenuItem value="gemini-1.5-pro" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>Gemini 1.5 Pro</MenuItem>
                <MenuItem value="gpt-4o" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>GPT-4o</MenuItem>
              </Select>

              {isProcessing ? (
                <IconButton
                  type="button"
                  onClick={(e) => { e.preventDefault(); stopProcessing(); }}
                  title="停止"
                  sx={{
                    width: 30, height: 30, p: 0, borderRadius: '50%', transition: 'all 0.2s',
                    bgcolor: '#ef4444', color: '#fff', '&:hover': { bgcolor: '#dc2626' },
                  }}
                >
                  <StopRoundedIcon sx={{ fontSize: '1.05rem' }} />
                </IconButton>
              ) : (
                <IconButton
                  type="submit"
                  disabled={!chatText.trim() && attachments.length === 0}
                  sx={{
                    width: 30, height: 30, p: 0, borderRadius: '50%', transition: 'all 0.2s',
                    bgcolor: (chatText.trim() || attachments.length > 0) ? '#fff' : 'rgba(255,255,255,0.12)',
                    color: (chatText.trim() || attachments.length > 0) ? '#000' : 'rgba(255,255,255,0.3)',
                    '&:hover': { bgcolor: (chatText.trim() || attachments.length > 0) ? '#f0f0f0' : 'rgba(255,255,255,0.12)' },
                    '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.08)' },
                  }}
                >
                  <ArrowUpwardRoundedIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>

        {/* ＋ 添付メニュー + 隠しファイル入力 */}
        <Menu
          anchorEl={attachAnchor}
          open={Boolean(attachAnchor)}
          onClose={() => setAttachAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          PaperProps={{ sx: { bgcolor: '#1a1f2b', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' } }}
        >
          <MenuItem onClick={() => { imageInputRef.current?.click(); setAttachAnchor(null); }} sx={{ fontSize: '0.8rem', gap: 1 }}>
            <ImageRoundedIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)' }} /> 写真を追加
          </MenuItem>
          <MenuItem onClick={() => { fileInputRef.current?.click(); setAttachAnchor(null); }} sx={{ fontSize: '0.8rem', gap: 1 }}>
            <AttachFileRoundedIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)' }} /> ファイルを追加
          </MenuItem>
        </Menu>
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={(e) => onPickFiles(e, 'image')} style={{ display: 'none' }} />
        <input ref={fileInputRef} type="file" multiple onChange={(e) => onPickFiles(e, 'file')} style={{ display: 'none' }} />
      </Box>

      <Menu
        anchorEl={actionAnchorEl?.el}
        open={Boolean(actionAnchorEl)}
        onClose={() => setActionAnchorEl(null)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2b',
            border: `1px solid rgba(255,255,255,0.1)`,
            color: 'rgba(255,255,255,0.9)'
          }
        }}
      >
        {selectedEntryId && (
          <MenuItem
            onClick={async () => {
              const text = actionAnchorEl?.text;
              setActionAnchorEl(null);
              if (text && selectedEntryId) {
                const targetEntry = entries.find(e => e.id === selectedEntryId);
                if (targetEntry) {
                  const newContent = text;
                  try {
                    await updateEntry(selectedEntryId, newContent);
                  } catch (err) {
                    console.error("Failed to replace journal content", err);
                  }
                }
              }
            }}
            sx={{ fontSize: '0.8rem' }}
          >
            開いている記事に置き換え
          </MenuItem>
        )}
        <MenuItem
          onClick={async () => {
            const text = actionAnchorEl?.text;
            setActionAnchorEl(null);
            if (text) {
              try {
                await submitEntry(text, "AIサマリー", {
                  contextLevel,
                  watchedScopes,
                  activeProfileId: activeProfile?.id,
                  activeProfileName: activeProfile?.name,
                  workspaceId: activeWorkspace?.workspaceId || null,
                  workspaceName: activeWorkspace?.name || null
                });
              } catch(err) {
                console.error("Failed to save to journal", err);
              }
            }
          }}
          sx={{ fontSize: '0.8rem' }}
        >
          新規ジャーナルとして保存
        </MenuItem>
        <MenuItem
          onClick={() => {
            const text = actionAnchorEl?.text;
            setActionAnchorEl(null);
            if (text) {
              useAiProfileStore.getState().addManualMemory(text, 'チャットメモ');
            }
          }}
          sx={{ fontSize: '0.8rem' }}
        >
          AIに記憶させる（メモリ）
        </MenuItem>
      </Menu>
      <ChatHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <TtsSettingsDialog open={ttsSettingsOpen} onClose={() => setTtsSettingsOpen(false)} />
    </Box>
  );
};

// 親（MainLayout）がホバー等で再描画されても、props 不変なら AIChatPanel は
// 再描画しない（重い Markdown/メッセージ描画の無駄打ちを防ぐ）。
export default React.memo(AIChatPanel);
