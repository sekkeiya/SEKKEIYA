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
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
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
import { ProjectViewStrip } from '../../shared/navigation/ProjectViewStrip';
import ChatHistoryDialog from './ChatHistoryDialog';
import MarkdownMessage from './MarkdownMessage';
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
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { speak, speakSentences, splitSentences, stopSpeaking, pauseSpeaking, resumeSpeaking, isTtsAvailable, getTtsSettings, buildSpeechChunks } from '../../lib/tts';
import { AiTtsPlayer, prepareAiTts, isAiTtsLimited } from '../../lib/aiTts';
import { getProactiveSuggestions, PROACTIVE_MODEL, type ProactiveSuggestions } from './proactiveSuggestions';
import { logReaction, newReactionSetId } from '../../lib/learning/reactions';
import { TtsSettingsDialog } from '../tts/TtsSettingsDialog';
import AIDriveFilePicker from './AIDriveFilePicker';
import { resolveAssetPreviewUrl, type AIDriveAsset } from '../../store/useAIDriveStore';
import { useAIDriveDragStore } from '../../store/useAIDriveDragStore';

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

// 添付として中身をそのままインライン展開できる「テキスト系」ファイルか。
const TEXT_LIKE_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|xml|html?|svg|css|scss|less|js|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|cpp|cc|h|hpp|cs|php|sh|bash|bat|ps1|ini|toml|conf|log|sql|geojson|vue|astro)$/i;
function isTextLikeFile(name: string, mime?: string): boolean {
  if (TEXT_LIKE_EXT.test(name)) return true;
  const m = (mime || '').toLowerCase();
  return m.startsWith('text/') || /json|xml|yaml|csv|javascript|typescript|svg\+xml/.test(m);
}
// 送信時に AI へ渡せるようテキスト内容を取り出す。ローカルは File、Drive 等は url を fetch。
// 巨大ファイルはトークン超過を防ぐため MAX_INLINE_CHARS で打ち切る。
const MAX_INLINE_CHARS = 100_000;
async function readAttachmentText(a: { file?: File; url?: string }): Promise<string | null> {
  try {
    let raw: string | null = null;
    if (a.file) raw = await a.file.text();
    else if (a.url) raw = await (await fetch(a.url)).text();
    if (raw == null) return null;
    return raw.length > MAX_INLINE_CHARS ? raw.slice(0, MAX_INLINE_CHARS) + '\n…（以下省略）' : raw;
  } catch (err) {
    console.error('[Chat] 添付テキストの読み込みに失敗', err);
    return null;
  }
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
        color: copied ? 'light-dark(#347947, #81c995)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
        '&:hover': { bgcolor: 'rgba(26,31,43,1)', color: copied ? 'light-dark(#347947, #81c995)' : 'var(--brand-fg)' }
      }}
    >
      {copied ? <CheckIcon sx={{ fontSize: '0.8rem' }} /> : <ContentCopyIcon sx={{ fontSize: '0.8rem' }} />}
    </IconButton>
  );
};

/**
 * テーブル・見出し・コードフェンス・水平線など「生テキストだと崩れて読みにくい」
 * ブロック Markdown を含むか。含む場合は読み上げ中も Markdown 整形で表示する
 * （プレーンな文章は SpokenText の文ハイライトを優先する）。
 */
const hasRichMarkdown = (text: string): boolean =>
  /^\s*\|(\s*:?-+:?\s*\|)+\s*$/m.test(text) ||   // 表の区切り行 |---|---|
  /^\s{0,3}#{1,6}\s/m.test(text) ||              // 見出し
  /```/.test(text) ||                            // コードフェンス
  /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/m.test(text); // 水平線

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
            '&:hover': { bgcolor: i === currentIdx ? 'rgba(138,180,248,0.3)' : 'rgb(var(--brand-fg-rgb) / 0.08)' },
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
  /** チャットを独立ネイティブウィンドウへポップアウトする（本体ドック表示時のみ）。 */
  onPopOut?: () => void;
  /** ヘッダー左のクラスタ（サイドバー・トグル＋「SEKKEIYA Chat」＋プロジェクトchip）を隠す。
   *  ポップアウト窓のように、上位のトップバーがこれらを担う場合に使う（アクション群は残す）。 */
  hideHeaderTitle?: boolean;
  /** 子アプリ埋め込み用: このセッションに固定表示する（グローバルの activeSessionId と独立）。
   *  指定時はプロジェクト切替によるセッション自動切替・先回り提案を行わず、
   *  右ドックのグローバルチャットと同時にマウントしても互いのセッションを奪わない。 */
  fixedSessionId?: string;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ detached = false, onToggleDetached, onDragHandleMouseDown, pinned = false, onTogglePinned, hideWindowControls = false, hideHeader = false, onPopOut, hideHeaderTitle = false, fixedSessionId }) => {
  const [chatText, setChatText] = useState("");
  const [showDebugPrompt, setShowDebugPrompt] = useState(false);
  const [debugPromptContent, setDebugPromptContent] = useState<string>("");
  const { contextLevel, watchedScopes, setContextLevel, toggleWatchedScope } = useJournalAiStore();
  const { submitEntry, entries, updateEntry, selectedEntryId } = useJournalStore();
  const [actionAnchorEl, setActionAnchorEl] = useState<{ msgId: string, el: HTMLElement, text: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // コンテキスト設定は歯車から開くポップオーバーに退避（会話上部をすっきりさせる）。
  const [contextAnchor, setContextAnchor] = useState<null | HTMLElement>(null);

  // 添付（写真・ファイル）。+ メニュー / OS からの D&D / SEKKEIYA Drive から追加。
  // 画像は data(base64)+mediaType を保持して AI に中身を渡す。ファイルは現状は名前参照のみ。
  // file: ローカル添付の実体（テキスト系は送信時に中身を読んで AI へ渡す）。url: Drive 等の取得元。
  type Attachment = { id: string; name: string; kind: 'image' | 'file'; url?: string; mediaType?: string; data?: string; file?: File };
  const [attachAnchor, setAttachAnchor] = useState<null | HTMLElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  // OS からのファイル D&D 中のハイライト。ネスト要素の dragenter/leave 揺れは深さカウンタで吸収。
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = React.useRef(0);
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const chatInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const genAttachId = (name: string, salt: number | string) => `${name}-${salt}-${performance.now()}`;

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

  // 実ファイル群を添付に加える共通ロジック。+ メニュー・OS からの D&D で共用。
  // kindHint 未指定時は MIME で画像/ファイルを自動判別（D&D 用）。'file' 指定なら画像でも名前参照。
  const addFiles = async (files: File[], kindHint?: 'image' | 'file') => {
    if (files.length === 0) return;
    const isImage = (f: File) => kindHint === 'image' || (kindHint !== 'file' && f.type.startsWith('image/'));
    const others = files.filter(f => !isImage(f));
    if (others.length > 0) {
      setAttachments(prev => [...prev, ...others.map((f, i) => ({ id: genAttachId(f.name, `${f.size}-${i}`), name: f.name, kind: 'file' as const, file: f }))]);
    }
    // 画像: base64 化（縮小）して中身を AI に渡せるようにする。
    const blocks = await Promise.all(files.filter(isImage).map(async (f, i) => {
      try {
        const b = await downscaleImageToBase64(f);
        return { id: genAttachId(f.name, `${f.size}-${i}`), name: f.name, kind: 'image' as const, url: b.dataUrl, mediaType: b.mediaType, data: b.data };
      } catch (err) {
        console.error('[Chat] 画像の読み込みに失敗', err);
        return null;
      }
    }));
    setAttachments(prev => [...prev, ...blocks.filter(Boolean) as Attachment[]]);
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'file') => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // 同じファイルを再選択できるようにリセット
    await addFiles(files, kind);
  };

  // Drive URL が画像か（拡張子 / 資産 type で判定）。画像は base64 化して中身を AI に渡す。
  const isImageAsset = (asset: AIDriveAsset, url: string | null) => {
    const t = (asset.type || '').toLowerCase();
    if (/^(image|screenshot|cover|render)$/.test(t)) return true;
    return !!url && /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url);
  };

  // SEKKEIYA Drive のアセットを添付に加える（ピッカー / Drive パネルからの D&D で共用）。
  // 画像アセットは URL を取得して base64 化（AI が中身を見られる）、それ以外は名前参照で添付。
  const addDriveAssets = async (assets: AIDriveAsset[]) => {
    if (!assets || assets.length === 0) return;
    const blocks = await Promise.all(assets.map(async (asset, i) => {
      const url = resolveAssetPreviewUrl(asset) || asset.storageUrl || null;
      const name = asset.name || 'file';
      if (isImageAsset(asset, url) && url) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
          const b = await downscaleImageToBase64(file);
          return { id: genAttachId(name, `drive-${asset.id}-${i}`), name, kind: 'image' as const, url: b.dataUrl, mediaType: b.mediaType, data: b.data };
        } catch (err) {
          console.error('[Chat] Drive 画像の取得に失敗', err);
          // 取得に失敗しても名前参照だけは添付として残す。
          return { id: genAttachId(name, `drive-${asset.id}-${i}`), name, kind: 'file' as const, url: url || undefined };
        }
      }
      return { id: genAttachId(name, `drive-${asset.id}-${i}`), name, kind: 'file' as const, url: url || undefined };
    }));
    setAttachments(prev => [...prev, ...blocks.filter(Boolean) as Attachment[]]);
  };

  // OS（エクスプローラ等）からのファイル D&D を受ける。内部の Drive ドラッグ（pointer 方式）や
  // テキストのドラッグは対象外にするため、Files 種別のときだけハイライト/受理する。
  const dropHasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const handleDragEnter = (e: React.DragEvent) => {
    if (!dropHasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!dropHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropHasFiles(e)) return;
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) { dragDepthRef.current = 0; setIsDragOver(false); }
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!dropHasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    void addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // SEKKEIYA Drive パネルからチャットへドラッグ&ドロップされたアセットを添付する。
  // 内部ドラッグは pointer 方式で、data-drop-target="chat-attach" 上で離すと pendingDropAsset に入る。
  const pendingDropAsset = useAIDriveDragStore(s => s.pendingDropAsset);
  const consumeDropAsset = useAIDriveDragStore(s => s.consumeDropAsset);
  useEffect(() => {
    if (!pendingDropAsset || pendingDropAsset.target !== 'chat-attach') return;
    void addDriveAssets(pendingDropAsset.assets?.length ? pendingDropAsset.assets : [pendingDropAsset.asset]);
    consumeDropAsset();
  }, [pendingDropAsset]); // eslint-disable-line react-hooks/exhaustive-deps

  const { isProcessing, currentToolLabel, toolProgress, sendMessageToOrchestrator, stopProcessing } = useCoreOrchestrator();
  const { activeSessionId, createSession, sessions, getSessionsForProject, setActiveSession, createScopedSession, getSessionsForScope, deleteSession, rewindToMessage } = useAIChatStore();
  const allSessions = useAIChatStore(s => s.sessions);
  // 表示・送信対象のセッション。fixedSessionId 指定時（子アプリ埋め込み）はそれを優先し、
  // グローバルの activeSessionId には一切追従しない。
  const effectiveSessionId = fixedSessionId ?? activeSessionId;

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
    if (!effectiveSessionId) return [];
    // アクティブセッションのメッセージをそのまま表示。
    // ユーザーがチャット履歴サイドバーで別プロジェクトのセッションを選択した場合もそのまま表示する。
    // プロジェクト切り替え時のちらつきは useEffect によるセッション切り替えに委ねる。
    return allMessages.filter(m => m.sessionId === effectiveSessionId);
  }, [allMessages, effectiveSessionId]);

  // 開いているチャットのスコープに応じたチャット候補（サジェスト）。
  const activeSession = useAIChatStore(s => s.sessions.find(ss => ss.id === (fixedSessionId ?? s.activeSessionId)));
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
  // AI音声（ニューラルTTS）の連続再生プレーヤー。標準音声(Web Speech)と使い分ける。
  const aiPlayerRef = React.useRef<AiTtsPlayer | null>(null);
  // 読み上げセッション世代。標準/AIの切替・停止・フォールバックで古いコールバックを無効化する。
  const readSessionRef = React.useRef(0);
  // 現在再生中のエンジン（一時停止/再開の呼び分けに使う）。
  const activeEngineRef = React.useRef<'standard' | 'ai'>('standard');
  const stopSpeakingUi = () => {
    readSessionRef.current += 1; // AIの準備ループも止める
    stopSpeaking();
    aiPlayerRef.current?.stop();
    setSpeakingMsgId(null);
    setSpeakingSentenceIdx(-1);
    setTtsPaused(false);
  };
  // メッセージを startIndex 文目から読み上げる（🔊=先頭から、文クリック=その文から）。
  // 設定が「AI音声」なら段落チャンクでニューラル再生し、利用枠切れ/未加入時は
  // その続きの文から標準音声（無料）へ自動フォールバックする。記号は発話前に除去済み。
  const startSpeakingMessage = (msgId: string, text: string, startIndex = 0) => {
    if (!isTtsAvailable()) return;
    readSessionRef.current += 1;
    const session = readSessionRef.current;
    aiPlayerRef.current?.stop();
    stopSpeaking();
    setSpeakingMsgId(msgId);
    setSpeakingSentenceIdx(startIndex);
    setTtsPaused(false);

    // 標準音声（OS・無料）で idx 文目から読む。通常再生とAI音声フォールバックで共用。
    // 呼び出し時点の readSessionRef を世代として捕捉する（フォールバック後も正しく動く）。
    const startStandard = (idx: number) => {
      const s = readSessionRef.current;
      activeEngineRef.current = 'standard';
      setSpeakingSentenceIdx(idx);
      speakSentences(splitSentences(text), {
        startIndex: idx,
        onSentenceStart: (i) => { if (s === readSessionRef.current) setSpeakingSentenceIdx(i); },
        // onEnd は置き換え/停止された旧セッションでは呼ばれない（tts.ts の世代管理）ため、
        // ここが呼ばれた時点でこのメッセージの読み上げが完走したと確定できる。
        onEnd: () => { if (s === readSessionRef.current) { setSpeakingMsgId(null); setSpeakingSentenceIdx(-1); setTtsPaused(false); } },
      });
    };

    const settings = getTtsSettings();
    // AI音声（利用枠内のときのみ）。枠切れは即フォールバック。
    if (settings.engine === 'ai' && !isAiTtsLimited()) {
      activeEngineRef.current = 'ai';
      const chunks = buildSpeechChunks(text);
      // startIndex(文) を含む/直前のチャンクから始める
      let startChunk = 0;
      for (let i = 0; i < chunks.length; i++) {
        if (chunks[i].startSentence <= startIndex) startChunk = i; else break;
      }
      const slice = chunks.slice(startChunk);
      if (slice.length === 0) { startStandard(startIndex); return; }

      // 続きの文から標準音声へ切り替える（枠切れ/未加入時）。
      const fallbackToStandard = (fromChunkInSlice: number) => {
        if (session !== readSessionRef.current) return;
        readSessionRef.current += 1; // AI側の準備・再生コールバックを無効化
        aiPlayerRef.current?.stop();
        startStandard(slice[Math.min(fromChunkInSlice, slice.length - 1)]?.startSentence ?? startIndex);
      };

      // 裏で先行合成（再生は最初のチャンクができ次第すぐ始まる）。
      void prepareAiTts(
        slice.map((c) => c.text),
        { voice: settings.aiVoice, style: settings.aiStyle },
        { shouldStop: () => session !== readSessionRef.current },
      );
      const player = new AiTtsPlayer();
      aiPlayerRef.current = player;
      void player.play(
        slice.map((c) => c.text),
        { voice: settings.aiVoice, style: settings.aiStyle, rate: settings.rate },
        {
          onChunkStart: (i) => { if (session === readSessionRef.current) setSpeakingSentenceIdx(slice[i].startSentence); },
          onEnd: () => { if (session === readSessionRef.current) { setSpeakingMsgId(null); setSpeakingSentenceIdx(-1); setTtsPaused(false); } },
          onError: (_msg, info) => {
            // 枠切れ/プラン外 = 以降の全チャンクが失敗する → その位置から標準音声へ
            if (info?.code === 'TTS_LIMITED' || info?.code === 'PLAN_REQUIRED' || isAiTtsLimited()) {
              fallbackToStandard(info?.index ?? 0);
            }
          },
        },
      );
      return;
    }

    startStandard(startIndex);
  };
  const toggleSpeakMessage = (msgId: string, text: string) => {
    if (speakingMsgId === msgId) { stopSpeakingUi(); return; }
    startSpeakingMessage(msgId, text);
  };
  const togglePauseSpeaking = () => {
    if (activeEngineRef.current === 'ai') {
      if (ttsPaused) { aiPlayerRef.current?.resume(); setTtsPaused(false); }
      else { aiPlayerRef.current?.pause(); setTtsPaused(true); }
    } else if (ttsPaused) { resumeSpeaking(); setTtsPaused(false); }
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
  useEffect(() => () => { stopSpeaking(); aiPlayerRef.current?.stop(); }, []); // アンマウント時に停止
  useEffect(() => { stopSpeakingUi(); }, [effectiveSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // 反応ログ: 表示セットの束ねID。impression と clicked を突合する鍵（表示1回ごとに採番）。
  const proactiveSetIdRef = React.useRef<string | null>(null);
  const isEmptyChat = messages.length === 0;
  useEffect(() => {
    setProactive(null);
    proactiveSetIdRef.current = null;
    // 埋め込み（セッション固定）時は先回り提案を出さない。ノード切替のたびに
    // 生成が走るのを防ぎ、タスク文脈に合わない汎用挨拶も避ける。
    if (fixedSessionId) return;
    if (!isEmptyChat || !activeProject?.id || !activeSessionId) return;
    let alive = true;
    getProactiveSuggestions(activeProject.id, activeProject.name, activeSessionId).then((r) => {
      if (!alive || !r) return;
      setProactive(r.data);
      // 反応ログ: 表示（impression）を1セット1件で記録。「無視」は clicked との差分で導出する。
      const setId = newReactionSetId();
      proactiveSetIdRef.current = setId;
      logReaction({
        surface: 'chat-suggest', action: 'impression', targetType: 'suggestChip',
        setId, model: PROACTIVE_MODEL,
        projectId: activeProject.id, sessionId: activeSessionId,
        features: { fresh: r.fresh, chipCount: r.data.chips.length },
      });
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
    // 埋め込み（セッション固定）時はセッションの自動切替もサイト先行ロードも行わない
    // （グローバルセッションを作る副作用が右ドック側の表示を変えてしまうため）。
    if (fixedSessionId) return;
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
    const snapshot = attachments;
    let text = chatText.trim();

    // 画像は中身(base64)を AI に渡す（吹き出しには出さず content ブロックとして送る）。
    const images = snapshot
      .filter(a => a.kind === 'image' && a.data && a.mediaType)
      .map(a => ({ mediaType: a.mediaType as string, data: a.data as string }));

    // ファイル添付: テキスト系は中身を読んで docs（吹き出しには出さず AI へ渡す追加ブロック）に、
    // それ以外は URL/名前を可視メッセージに載せてオーケストレーター側で取得できるようにする。
    const fileAtts = snapshot.filter(a => a.kind === 'file');
    const docs: { name: string; text: string }[] = [];
    const fileLines: string[] = [];
    for (const a of fileAtts) {
      if (isTextLikeFile(a.name, a.mediaType) && (a.file || a.url)) {
        const content = await readAttachmentText(a);
        if (content != null) {
          docs.push({ name: a.name, text: content });
          fileLines.push(a.url ? `- ${a.name}（${a.url}）` : `- ${a.name}`);
          continue;
        }
      }
      // バイナリ/取得失敗: URL があれば載せる（AI が library_add_pdf 等で取得できる）。
      fileLines.push(a.url ? `- ${a.name}: ${a.url}` : `- ${a.name}`);
    }

    // 可視メッセージへ添付ノートを付す（画像は名前のみ、ファイルは URL 付き）。
    const noteParts: string[] = [];
    const imageNames = snapshot.filter(a => a.kind === 'image').map(a => a.name);
    if (imageNames.length > 0) noteParts.push(`[添付画像: ${imageNames.join(', ')}]`);
    if (fileLines.length > 0) noteParts.push(`[添付ファイル]\n${fileLines.join('\n')}`);
    if (noteParts.length > 0) text = [text, ...noteParts].filter(Boolean).join('\n\n');

    setChatText("");
    setAttachments([]);
    // Phase B: ループ・ツール実行・保存はすべてオーケストレーター内で完結する。
    await sendMessageToOrchestrator(text, { source: 'sidebar_chat', sessionId: effectiveSessionId || undefined, images, docs });
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
    <Box
      data-drop-target="chat-attach"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', position: 'relative' }}
    >
      {/* OS からのファイル D&D 中のオーバーレイ（ドロップでチャットに添付）。 */}
      {isDragOver && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 30, borderRadius: 2,
          border: '2px dashed #90caf9', bgcolor: 'rgba(138,180,248,0.12)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
          pointerEvents: 'none', backdropFilter: 'blur(1px)',
        }}>
          <AttachFileRoundedIcon sx={{ fontSize: 40, color: '#90caf9' }} />
          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, fontSize: '0.9rem' }}>ここにドロップして添付</Typography>
        </Box>
      )}
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
        sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid rgb(var(--brand-fg-rgb) / 0.05)`, minHeight: 48, cursor: detached ? 'move' : 'default' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, overflow: 'hidden' }}>
          {/* サイドバー・トグルは通常時のみ（ポップアウト窓ではトップバーが担うため隠す）。 */}
          {!hideHeaderTitle && (
            <IconButton
              size="small"
              onClick={toggleChatHistorySidebar}
              sx={{ color: isChatHistorySidebarOpen ? 'light-dark(#ad8900, #ffd740)' : 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.25, flexShrink: 0, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
              title="チャット履歴サイドバー"
            >
              <ViewSidebarRoundedIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          )}
          {/* タイトル: 通常はブランド「SEKKEIYA Chat」。ポップアウト窓（hideHeaderTitle）は
              トップバーがブランドを担うので、ここには現在のチャット名を出す（Claude 式の会話ヘッダー）。 */}
          <Typography sx={{
            fontSize: '0.8rem', fontWeight: hideHeaderTitle ? 600 : 500, letterSpacing: '0.3px',
            color: 'rgb(var(--brand-fg-rgb) / 0.85)',
            ...(hideHeaderTitle
              ? { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
              : { flexShrink: 0 }),
          }}>
            {hideHeaderTitle ? (activeSession?.title || '新規チャット') : 'SEKKEIYA OS'}
          </Typography>
          {activeProject && (
            <Typography sx={{
              fontSize: '0.65rem', color: 'light-dark(#0a45a4, #8ab4f8)', fontWeight: 500,
              bgcolor: 'rgba(138,180,248,0.1)', border: '1px solid rgba(138,180,248,0.2)',
              borderRadius: 1, px: 0.75, py: 0.1, flexShrink: 0,
              maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {activeProject.name}
            </Typography>
          )}
          {/* この会話の文脈（プロジェクト／アカウントサイト）のページを開くリモコン。 */}
          <Box sx={{ pl: 0.75, ml: 0.25, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <ProjectViewStrip />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isTtsAvailable() && (
            <>
              <Tooltip title={voiceMode ? '音声モードOFF' : '音声モードON（AIの応答を読み上げながら作業できます）'}>
                <IconButton
                  size="small"
                  onClick={toggleVoiceMode}
                  sx={{ color: voiceMode ? 'light-dark(#ad8900, #ffd740)' : 'rgb(var(--brand-fg-rgb) / 0.4)', bgcolor: voiceMode ? 'rgba(255,215,64,0.12)' : 'transparent', '&:hover': { color: voiceMode ? 'light-dark(#ad8900, #ffd740)' : 'var(--brand-fg)', bgcolor: voiceMode ? 'rgba(255,215,64,0.18)' : 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
                >
                  {voiceMode ? <VolumeUpRoundedIcon sx={{ fontSize: '1.1rem' }} /> : <VolumeOffRoundedIcon sx={{ fontSize: '1.1rem' }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="読み上げの設定（速度・声）">
                <IconButton size="small" onClick={() => setTtsSettingsOpen(true)}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>
                  <TuneRoundedIcon sx={{ fontSize: '1.05rem' }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <IconButton
            size="small"
            onClick={() => activeProject?.id && createSession(activeProject.id)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
            title="New Chat"
          >
            <AddRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setHistoryOpen(true)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
            title="History"
          >
            <HistoryRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setDeliverablesOpen(v => !v)}
            sx={{ color: deliverablesOpen ? 'light-dark(#ad8900, #ffd740)' : 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
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
              sx={{ color: pinned ? '#3498db' : 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: pinned ? '#3498db' : 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
            >
              {pinned
                ? <PushPinRoundedIcon sx={{ fontSize: '1.05rem' }} />
                : <PushPinOutlinedIcon sx={{ fontSize: '1.05rem' }} />}
            </IconButton>
          )}
          {onPopOut && !detached && (
            <IconButton
              size="small"
              onClick={onPopOut}
              title="別ウィンドウで開く（デスクトップへ切り離す）"
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
            >
              <OpenInNewRoundedIcon sx={{ fontSize: '1.05rem' }} />
            </IconButton>
          )}
          {onToggleDetached && (
            <IconButton
              size="small"
              onClick={onToggleDetached}
              title={detached ? 'ドックに戻す' : '切り離す（フローティング）'}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
            >
              {detached
                ? <CloseFullscreenRoundedIcon sx={{ fontSize: '1.05rem' }} />
                : <OpenInFullRoundedIcon sx={{ fontSize: '1.05rem' }} />}
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => setAIChatOpen(false)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
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
                color: contextAnchor ? 'light-dark(#0a45a4, #8ab4f8)' : 'rgb(var(--brand-fg-rgb) / 0.4)',
                '&:hover': { color: 'light-dark(#0a45a4, #8ab4f8)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
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
              fontSize: '1.3rem', fontWeight: 300, color: 'rgb(var(--brand-fg-rgb) / 0.75)',
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
          PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2, width: 300, maxWidth: '92vw', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' } }}
        >
          <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Context Settings
            </Typography>
            <Tooltip
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, mb: 0.5 }}>コンテキスト設定</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
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
              <InfoOutlinedIcon sx={{ fontSize: 14, color: 'rgb(var(--brand-fg-rgb) / 0.4)', cursor: 'help' }} />
            </Tooltip>
          </Box>
              <Box sx={{ p: 1.5, pt: 0 }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', mb: 1 }}>
                  Current Context
                </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>User</Typography>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{currentUser ? currentUser.email : 'Not Logged In'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Project</Typography>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{activeProject ? activeProject.name : 'None'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Workspace</Typography>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{activeWorkspace ? activeWorkspace.name : 'None (Home view)'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem', alignItems: 'center' }}>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Status</Typography>
                <Typography component="div" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {activeWorkspace ? (
                    <><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#4caf50' }} /> App Runtime</>
                  ) : (
                    <><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.3)' }} /> Hub Mode</>
                  )}
                </Typography>
              </Box>
            </Box>

            {lastLaunchPayload && (
              <Box sx={{ mt: 1.5, p: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: `1px solid rgb(var(--brand-fg-rgb) / 0.05)`, borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'light-dark(#0875a6, #4fc3f7)', fontWeight: 500 }}>Scope: {lastLaunchPayload.appScope}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', wordBreak: 'break-all', mt: 0.25 }}>wsId: {lastLaunchPayload.workspaceId}</Typography>
                {!activeWorkspace && (
                  <Button 
                    variant="contained"
                    size="small" 
                    disableElevation
                    onClick={() => launchWorkspace(lastLaunchPayload)}
                    sx={{ mt: 1, width: '100%', textTransform: 'none', fontSize: '0.65rem', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)', py: 0.25, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }}
                  >
                    Resume Workspace
                  </Button>
                )}
              </Box>
            )}

            {/* Watching Context Block */}
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid rgb(var(--brand-fg-rgb) / 0.05)` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'light-dark(#0a45a4, #8ab4f8)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                    color: 'light-dark(#0a45a4, #8ab4f8)', 
                    '& .MuiSelect-select': { py: 0, px: 0.5 },
                    '& .MuiSelect-icon': { color: 'light-dark(#0a45a4, #8ab4f8)', width: '0.8em', height: '0.8em' }
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
                        {active ? <CheckBoxIcon sx={{ fontSize: 12, color: 'light-dark(#0a45a4, #8ab4f8)' }} /> : <CheckBoxOutlineBlankIcon sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />}
                        <Typography sx={{ fontSize: '0.65rem', color: active ? 'rgb(var(--brand-fg-rgb) / 0.9)' : 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'capitalize' }}>
                          {scope}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Injected System Context Debug View */}
            <Box sx={{ mt: 1.5, pt: 1, borderTop: `1px solid rgb(var(--brand-fg-rgb) / 0.05)` }}>
               <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: 'light-dark(#7500ad, #e2a6ff)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <span style={{ fontSize: '9px' }}>🧠</span> Injected System Context
                  </Typography>
                  <Button 
                    size="small" 
                    variant="text" 
                    disableRipple
                    sx={{ fontSize: '0.6rem', p: 0, minWidth: 'auto', textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'transparent' } }}
                    onClick={() => setShowDebugPrompt(!showDebugPrompt)}
                  >
                    {showDebugPrompt ? 'Hide' : 'Inspect'}
                  </Button>
               </Box>
               
               {showDebugPrompt && (
                 <Box sx={{ 
                   mt: 1,
                   bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', 
                   p: 1, 
                   borderRadius: 1.5, 
                   maxHeight: 250, 
                   overflowY: 'auto',
                   border: `1px solid rgba(226, 166, 255, 0.2)`
                 }}>
                   {activeProfile ? (
                     <>
                       {/* Context Metadata */}
                       <Box sx={{ mb: 1, pb: 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                         <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.9)', fontWeight: 500 }}>Profile: {activeProfile.name}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.25, fontWeight: 400 }}>Model: {activeProfile.baseModelId}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 400 }}>Role: {activeProfile.role} | Scopes: {activeProfile.usageScopes.join(', ')}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.25, fontWeight: 400 }}>
                           Memory: {activeProfile.useSaveDataMemories ? <span style={{color: '#4caf50'}}>ON</span> : <span style={{color: '#f44336'}}>OFF</span>}
                         </Typography>
                       </Box>
                       
                       {/* Raw Injected Prompt */}
                       <Typography component="pre" sx={{ 
                         whiteSpace: 'pre-wrap', 
                         wordBreak: 'break-all', 
                         color: 'rgb(var(--brand-fg-rgb) / 0.6)',
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
                     <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 400 }}>
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
                <AutoAwesomeRoundedIcon sx={{ fontSize: '0.7rem', color: 'light-dark(#0a45a4, #8ab4f8)' }} />
                <Typography sx={{ fontSize: '0.6rem', color: 'light-dark(rgba(10,69,164,0.8), rgba(138,180,248,0.8))', fontWeight: 500, textTransform: 'uppercase' }}>
                  AI Assistant
                </Typography>
              </Box>
              <Paper elevation={0} sx={{
                p: 1.25, px: 1.5, maxWidth: '90%',
                bgcolor: 'rgba(138,180,248,0.05)',
                color: 'rgb(var(--brand-fg-rgb) / 0.9)',
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
                <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 500, textTransform: 'uppercase' }}>
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
                    color: 'rgb(var(--brand-fg-rgb) / 0.9)',
                    borderRadius: 2,
                    border: `1px solid rgb(var(--brand-fg-rgb) / 0.05)`,
                    flexGrow: 1
                  }}>
                    <Typography component="div" onClick={(e) => handleAltClickSpeak(e, msg.id, msg.text)} sx={{
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      lineHeight: 1.5,
                      // 文ハイライト（SpokenText）を出すのは、読み上げ中 かつ 生テキストでも崩れない
                      // プレーンな文章のときだけ。表・見出し等を含むメッセージは読み上げ中も Markdown 整形で表示する。
                      whiteSpace: speakingMsgId === msg.id && !hasRichMarkdown(msg.text) ? 'pre-wrap' : 'normal',
                      wordBreak: 'break-word',
                      fontFamily: '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif',
                      WebkitFontSmoothing: 'antialiased'
                    }}>
                      {speakingMsgId === msg.id && !hasRichMarkdown(msg.text) ? (
                        <SpokenText
                          text={msg.text}
                          currentIdx={speakingSentenceIdx}
                          onJump={(i) => startSpeakingMessage(msg.id, msg.text, i)}
                        />
                      ) : (
                        <MarkdownMessage text={msg.text} isNew={index === messages.length - 1 && Date.now() - msg.timestamp < 1000} onType={scrollToBottom} />
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
                            color: speakingMsgId === msg.id ? 'light-dark(#0a45a4, #8ab4f8)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                            '&:hover': { bgcolor: 'rgba(26,31,43,1)', color: speakingMsgId === msg.id ? 'light-dark(#0a45a4, #8ab4f8)' : 'var(--brand-fg)' }
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
                              color: 'light-dark(#0a45a4, #8ab4f8)',
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
                    <Typography sx={{ fontSize: '0.58rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', mr: 0.5 }}>
                      {timeAgo(msg.timestamp)}
                    </Typography>
                    <Tooltip title="コピー" placement="top" arrow>
                      <IconButton
                        size="small"
                        onClick={() => navigator.clipboard.writeText(msg.text)}
                        sx={{ p: 0.4, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' } }}
                      >
                        <ContentCopyIcon sx={{ fontSize: '0.75rem' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ここまで巻き戻す" placement="top" arrow>
                      <IconButton
                        size="small"
                        onClick={() => { if (effectiveSessionId) rewindToMessage(effectiveSessionId, msg.id); }}
                        sx={{ p: 0.4, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'light-dark(#a50808, #f87171)', bgcolor: 'rgba(248,113,113,0.1)' } }}
                      >
                        <ReplayRoundedIcon sx={{ fontSize: '0.75rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Paper elevation={0} sx={{
                    p: 1.25,
                    px: 1.5,
                    maxWidth: '90%',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)',
                    color: 'rgb(var(--brand-fg-rgb) / 0.9)',
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
                      background: 'none', border: 'none', p: 0, color: 'rgb(var(--brand-fg-rgb) / 0.35)',
                      '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' }, transition: 'color 0.15s',
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
                            fontSize: '0.62rem', color: 'light-dark(#0352aa, #93c5fd)', maxWidth: 200,
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
                      minWidth: 'auto', p: 0, px: 1, py: 0.25, fontSize: '0.6rem', color: 'light-dark(#0a45a4, #8ab4f8)', textTransform: 'none',
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
              <AutoAwesomeRoundedIcon sx={{ fontSize: '0.75rem', color: 'light-dark(#0a45a4, #8ab4f8)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.65rem', color: 'light-dark(rgba(10,69,164,0.9), rgba(138,180,248,0.9))', fontWeight: 300, flex: 1 }}>
                {currentToolLabel || 'AI が考えています...'}
              </Typography>
              {toolProgress && (
                <Typography sx={{ fontSize: '0.6rem', color: 'light-dark(rgba(10,69,164,0.7), rgba(138,180,248,0.7))', fontWeight: 600, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
                  {toolProgress.current} / {toolProgress.total}
                </Typography>
              )}
              <CircularProgress size={10} sx={{ color: 'light-dark(#0a45a4, #8ab4f8)', flexShrink: 0 }} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Input Area（一体型: 添付プレビュー + テキスト + ボトムツールバー） */}
      <Box sx={{ p: 2, pt: 1, bgcolor: 'var(--brand-surface2)', flexShrink: 0 }}>
        {/* チャット候補。空チャットで先回り提案があればそれを優先（プロジェクト文脈のパーソナライズ）、
            無ければスコープ別の固定候補（選んで入力欄に投入）。 */}
        {!isProcessing && !chatText.trim() && attachments.length === 0 && (isEmptyChat && proactive?.chips?.length ? proactive.chips : suggestions).length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            <Typography sx={{ width: '100%', fontSize: '0.55rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)', letterSpacing: '1px', textTransform: 'uppercase', mb: 0.25 }}>
              {isEmptyChat && proactive?.chips?.length ? '先回り提案' : '候補'}
            </Typography>
            {(isEmptyChat && proactive?.chips?.length ? proactive.chips : suggestions).map((s, chipIndex) => (
              <Box
                key={s.label}
                onClick={() => {
                  setChatText(s.text);
                  // 反応ログ: 先回りチップのクリックのみ記録（静的候補は対象外）
                  if (isEmptyChat && proactive?.chips?.length) {
                    logReaction({
                      surface: 'chat-suggest', action: 'clicked', targetType: 'suggestChip',
                      setId: proactiveSetIdRef.current ?? undefined,
                      rank: chipIndex, label: s.label, model: PROACTIVE_MODEL,
                      projectId: activeProject?.id, sessionId: activeSessionId ?? undefined,
                    });
                  }
                }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)',
                  bgcolor: 'rgba(255,215,64,0.06)', border: '1px solid rgba(255,215,64,0.25)',
                  borderRadius: 5, px: 1, py: 0.4, cursor: 'pointer', transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(255,215,64,0.14)', color: 'var(--brand-fg)', borderColor: 'rgba(255,215,64,0.5)' },
                }}
                title={s.text}
              >
                <AutoAwesomeRoundedIcon sx={{ fontSize: '0.7rem', color: 'light-dark(#ad8900, #ffd740)' }} />
                {s.label}
              </Box>
            ))}
          </Box>
        )}
        <Box
          component="form"
          onSubmit={handleChatSubmit}
          sx={{
            bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))',
            border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`,
            borderRadius: 3,
            p: 1,
            transition: 'border-color 0.2s',
            '&:focus-within': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' },
          }}
        >
          {/* 添付プレビュー */}
          {attachments.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 0.5, pb: 1 }}>
              {attachments.map(a => (
                <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 1.5, pl: a.kind === 'image' ? 0.25 : 0.75, pr: 0.5, py: 0.25, maxWidth: 170 }}>
                  {a.kind === 'image' && a.url
                    ? <Box component="img" src={a.url} alt={a.name} sx={{ width: 26, height: 26, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }} />
                    : <AttachFileRoundedIcon sx={{ fontSize: '0.95rem', color: 'rgb(var(--brand-fg-rgb) / 0.6)', flexShrink: 0 }} />}
                  <Typography noWrap sx={{ fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)', maxWidth: 96 }}>{a.name}</Typography>
                  <IconButton size="small" onClick={() => removeAttachment(a.id)} sx={{ p: 0.15, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}>
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
                color: 'var(--brand-fg)',
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
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', p: 0.5, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}
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
                MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`, color: 'rgb(var(--brand-fg-rgb) / 0.9)' } } }}
                sx={{
                  height: 24,
                  fontSize: '0.62rem',
                  fontWeight: 300,
                  color: 'rgb(var(--brand-fg-rgb) / 0.6)',
                  bgcolor: 'transparent',
                  borderRadius: 1.5,
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', color: 'rgb(var(--brand-fg-rgb) / 0.8)' },
                  '& .MuiSelect-select': { py: 0, pl: 1, pr: '20px !important', display: 'flex', alignItems: 'center' },
                  '& .MuiSelect-icon': { color: 'rgb(var(--brand-fg-rgb) / 0.4)', width: '0.9em', height: '0.9em' },
                }}
              >
                <MenuItem value="auto" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>自動 ✦ おすすめ（内容で最適化）</MenuItem>
                <MenuItem value="claude-sonnet-4-6" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>Claude Sonnet · 高品質</MenuItem>
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
                    bgcolor: '#ef4444', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#dc2626' },
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
                    bgcolor: (chatText.trim() || attachments.length > 0) ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.12)',
                    color: (chatText.trim() || attachments.length > 0) ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.3)',
                    '&:hover': { bgcolor: (chatText.trim() || attachments.length > 0) ? '#f0f0f0' : 'rgb(var(--brand-fg-rgb) / 0.12)' },
                    '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
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
          PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.9)' } }}
        >
          <MenuItem onClick={() => { imageInputRef.current?.click(); setAttachAnchor(null); }} sx={{ fontSize: '0.8rem', gap: 1 }}>
            <ImageRoundedIcon sx={{ fontSize: '1rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} /> 写真を追加
          </MenuItem>
          <MenuItem onClick={() => { fileInputRef.current?.click(); setAttachAnchor(null); }} sx={{ fontSize: '0.8rem', gap: 1 }}>
            <AttachFileRoundedIcon sx={{ fontSize: '1rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} /> ファイルを追加
          </MenuItem>
          <MenuItem onClick={() => { setDrivePickerOpen(true); setAttachAnchor(null); }} sx={{ fontSize: '0.8rem', gap: 1 }}>
            <CloudOutlinedIcon sx={{ fontSize: '1rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} /> SEKKEIYA Drive から追加
          </MenuItem>
        </Menu>
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={(e) => onPickFiles(e, 'image')} style={{ display: 'none' }} />
        <input ref={fileInputRef} type="file" multiple onChange={(e) => onPickFiles(e, 'file')} style={{ display: 'none' }} />
        <AIDriveFilePicker open={drivePickerOpen} onClose={() => setDrivePickerOpen(false)} onPick={addDriveAssets} />
      </Box>

      <Menu
        anchorEl={actionAnchorEl?.el}
        open={Boolean(actionAnchorEl)}
        onClose={() => setActionAnchorEl(null)}
        PaperProps={{
          sx: {
            bgcolor: 'var(--brand-surface2)',
            border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`,
            color: 'rgb(var(--brand-fg-rgb) / 0.9)'
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
