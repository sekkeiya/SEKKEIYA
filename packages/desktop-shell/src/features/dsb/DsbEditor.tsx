import React, { useMemo, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, Button, MenuItem, Chip, InputAdornment,
  ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import HeadphonesRoundedIcon from '@mui/icons-material/HeadphonesRounded';
import { getTtsSettings } from './lib/tts';
import { CircularProgress, Dialog, DialogContent, DialogActions, IconButton, Tooltip } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import { BlogAiDialogue } from './BlogAiDialogue';
import { ArticleInsightPanel } from '../insights/ArticleInsightPanel';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import { BlogSeoPanel } from './BlogSeoPanel';
import { SourceArticleReader } from './SourceArticleReader';
import { loadBlogStyle, saveBlogStyle } from './api/blogApi';
import { BLOG_STYLE_PRESETS, DEFAULT_BLOG_STYLE, type BlogStyle } from './types';
import { useDsbStore } from './store/useDsbStore';
import { useAppStore } from '../../store/useAppStore';
import { useAutosaveDraft } from '../../shared/hooks/useAutosaveDraft';
import { BLOG_CATEGORIES, type BlogPublishTarget } from './types';
import { slugify } from './lib/blogUtils';
import { getUsername, PUBLIC_BASE } from '../sites/publishService';
import { BlogBodyEditor } from './BlogBodyEditor';
import { BlogWritingOverlay } from './BlogWritingOverlay';
import { buildArticleTitleSx, normalizeDesignedMarkdown } from './articleTheme';
import { BlogStyleDialog } from './BlogStyleDialog';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PermMediaRoundedIcon from '@mui/icons-material/PermMediaRounded';
import { sectionsWithoutImages, insertPlaceholdersByHeading, generateAndPlaceBlogImages, generateBlogImageOnce, type BlogImagePlan } from './lib/blogImageGen';
import { MediaPickerDialog } from '../media-picker/MediaPickerDialog';

const ACCENT = '#e57373';

// サイドバーのフォームは一段コンパクトに（既定のMUIサイズは右ペインには大きすぎる）。
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: 'var(--brand-fg)',
    fontSize: 13,
    '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.18)' },
    '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.35)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputBase-input': { fontSize: 13, py: 1 },
  '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.55)', fontSize: 13 },
  // フローティングラベルが縮小した状態（枠上）でも読みやすいサイズに
  '& .MuiInputLabel-root.MuiInputLabel-shrink': { fontSize: 13.5 },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
};

// セレクトのドロップダウン（メニュー）が透けないよう不透明な背景を指定する。
const selectMenuProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        bgcolor: 'var(--brand-surface2)',
        backgroundImage: 'none',
        color: 'var(--brand-fg)',
        border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        '& .MuiMenuItem-root': {
          fontSize: 14,
          '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
          '&.Mui-selected': { bgcolor: `${ACCENT}44` },
          '&.Mui-selected:hover': { bgcolor: `${ACCENT}55` },
        },
      },
    },
  },
} as const;

interface DsbEditorProps {
  uid?: string;
  /** @deprecated 保存は自動・公開は本コンポーネント内で処理するため未使用（後方互換で受けるだけ）。 */
  saving?: boolean;
  /** @deprecated 同上。 */
  onSave?: () => void;
  onToast?: (msg: string, sev: 'success' | 'error' | 'info') => void;
}

// 公開URL等を外部ブラウザで開く（Tauriは既定ブラウザ、Webは新規タブ）。
async function openExternalUrl(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    try { window.open(url, '_blank'); } catch { /* noop */ }
  }
}

export const DsbEditor: React.FC<DsbEditorProps> = ({ uid, onToast }) => {
  const { draft, updateDraft, cancelEdit, categories, saveWorkingDraft, saveDraft } = useDsbStore();
  const projects = useAppStore((s) => s.projects);

  // 📤 公開まわり。保存は自動（useAutosaveDraft）なので保存ボタンは廃止し、公開は明示アクションにする。
  const [publishing, setPublishing] = React.useState(false);
  const [publishedInfo, setPublishedInfo] = React.useState<{ url: string | null; hadUsername: boolean } | null>(null);
  // 自動保存インジケータ（保存ボタン撤去後もユーザーが状態を把握できるように）
  const [autosaveState, setAutosaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle');

  // 公開ページURL用のユーザー名（公開中の「公開ページを開く」ボタンと公開完了ダイアログで使用）
  const [username, setUsername] = React.useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!uid) { setUsername(null); return; }
    void getUsername(uid).then((u) => { if (alive) setUsername(u); }).catch(() => { /* 未設定 */ });
    return () => { alive = false; };
  }, [uid]);

  const [tagInput, setTagInput] = React.useState('');
  // 右パネル: 記事の設定 / AIとの議論。議論の途中、または「議論ファースト」
  // （ホームのフィードから題材だけ持って来た状態）なら議論パネルを開いた状態で始める。
  const [sidePanel, setSidePanel] = React.useState<'settings' | 'dialogue' | 'image' | 'analysis'>(
    (draft?.aiDialogue?.length ?? 0) > 0 || ((draft?.sourceRefs?.length ?? 0) > 0 && !draft?.bodyMarkdown?.trim())
      ? 'dialogue' : 'settings'
  );

  // 🖼 本文中の画像クリック → 右サイドバーで差し替え/再生成/削除
  const [selectedImage, setSelectedImage] = React.useState<{ src: string; alt: string } | null>(null);
  const [imgRegenBusy, setImgRegenBusy] = React.useState(false);
  const [replacePickerOpen, setReplacePickerOpen] = React.useState(false);

  /** 本文中の画像（![alt](oldSrc)）を新URLへ差し替え／replacement=null で削除。カバーに使われていれば追従。 */
  const replaceImageSrc = (oldSrc: string, replacement: string | null, alt: string) => {
    const st = useDsbStore.getState();
    const body = st.draft?.bodyMarkdown ?? '';
    const esc = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`[ \\t]*!\\[[^\\]]*\\]\\(${esc}\\)[ \\t]*`);
    const next = body.replace(re, replacement ? `![${alt}](${replacement})` : '');
    st.updateDraft({
      bodyMarkdown: next,
      ...(st.draft?.coverUrl === oldSrc ? { coverUrl: replacement ?? null } : {}),
    });
    if (uid) void st.saveWorkingDraft(uid);
  };

  /** 選択中の画像を同じテーマでAI再生成して差し替える。 */
  const regenerateSelectedImage = async () => {
    if (!draft || !uid || !selectedImage || imgRegenBusy) return;
    setImgRegenBusy(true);
    try {
      const theme = selectedImage.alt || draft.title || 'architecture and interior design';
      const prompt = `Photorealistic architectural photography style. No text, no logos, no watermarks, no real specific buildings or people. A blog section image expressing: "${theme}" (article: "${draft.title}")`;
      const r = await generateBlogImageOnce(uid, prompt, draft.publishTarget.scope === 'project' ? draft.publishTarget.projectId : null);
      if ('url' in r) {
        replaceImageSrc(selectedImage.src, r.url, selectedImage.alt);
        setSelectedImage({ src: r.url, alt: selectedImage.alt });
        onToast?.('画像を再生成しました', 'success');
      } else if (r.code === 'PLAN_REQUIRED') {
        onToast?.('記事画像は有料プランでご利用いただけます', 'info');
      } else if (r.code === 'BLOG_IMAGE_LIMITED') {
        onToast?.('AI画像の利用枠に達しました（時間経過で回復します）', 'info');
      } else {
        onToast?.('画像の再生成に失敗しました', 'error');
      }
    } finally {
      setImgRegenBusy(false);
    }
  };

  // 🖼 「画像生成」ボタン: 画像が入っていないセクションに1枚ずつ補完（カバー未設定ならサムネも）
  const imageGen = useDsbStore((s) => s.imageGen);
  const setImageGen = useDsbStore((s) => s.setImageGen);
  const [planningImages, setPlanningImages] = React.useState(false);
  const generateSectionImages = async () => {
    if (!draft || !uid || planningImages || imageGen) return;
    if (!draft.bodyMarkdown.trim()) { onToast?.('まず本文を用意してください', 'info'); return; }
    const headings = sectionsWithoutImages(draft.bodyMarkdown);
    const needCover = !draft.coverUrl;
    if (!headings.length && !needCover) { onToast?.('すべてのセクションに画像があります', 'info'); return; }
    setPlanningImages(true);
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({ mode: 'imagePlan', title: draft.title, headings, context: draft.bodyMarkdown.slice(0, 4000), needCover });
      if (!r.data?.success) { onToast?.(`画像プランの作成に失敗しました: ${r.data?.reason || '不明なエラー'}`, 'error'); return; }
      const images: BlogImagePlan[] = Array.isArray(r.data.images) ? r.data.images : [];
      const cover = r.data.cover?.prompt ? r.data.cover as { caption: string; prompt: string } : null;
      if (!images.length && !cover) { onToast?.('追加する画像はありませんでした', 'info'); return; }
      const { body, placeholders } = insertPlaceholdersByHeading(draft.bodyMarkdown, images);
      updateDraft({ bodyMarkdown: body });
      const res = await generateAndPlaceBlogImages({
        uid, images, placeholders, cover,
        projectId: draft.publishTarget.scope === 'project' ? draft.publishTarget.projectId : null,
        getBody: () => useDsbStore.getState().draft?.bodyMarkdown ?? '',
        setBody: (md) => useDsbStore.getState().updateDraft({ bodyMarkdown: md }),
        onCover: (url) => { if (!useDsbStore.getState().draft?.coverUrl) useDsbStore.getState().updateDraft({ coverUrl: url }); },
        onProgress: (done, total) => setImageGen(done >= total ? null : { done, total }),
      });
      if (res.limited === 'PLAN_REQUIRED') onToast?.('記事画像は有料プランでご利用いただけます', 'info');
      else if (res.limited === 'BLOG_IMAGE_LIMITED') onToast?.('AI画像の利用枠に達しました（時間経過で回復します）', 'info');
      else if (res.placed > 0) { onToast?.(`画像を${res.placed}枚配置しました`, 'success'); void saveWorkingDraft(uid); }
    } catch (e: any) {
      onToast?.(`画像生成に失敗しました: ${e.message}`, 'error');
    } finally {
      setPlanningImages(false);
      setImageGen(null);
    }
  };

  // メインエリアの表示: 題材記事リーダー / 執筆エディタ。題材があれば自由に切替できる
  // （読み上げ・議論を聞きながら書く使い方）。「議論から記事を生成」で本文が入ると自動で執筆へ。
  const hasSource = (draft?.sourceRefs?.length ?? 0) > 0;
  const [mainView, setMainView] = React.useState<'reader' | 'editor'>(
    hasSource && !draft?.bodyMarkdown?.trim() ? 'reader' : 'editor'
  );
  const showSourceReader = hasSource && mainView === 'reader';
  const hadBodyRef = React.useRef(!!draft?.bodyMarkdown?.trim());
  React.useEffect(() => {
    const has = !!draft?.bodyMarkdown?.trim();
    if (has && !hadBodyRef.current) setMainView('editor'); // 生成完了 → 執筆へ自動切替
    hadBodyRef.current = has;
  }, [draft?.bodyMarkdown]);

  // ✍ 「議論から記事を生成」実行中: 記事モード（リーダー）のままなら即・執筆モードへ切替え、
  // 執筆演出（BlogWritingOverlay）で「書かれていく」様子を見せる
  const generating = useDsbStore((s) => s.generating);
  React.useEffect(() => {
    if (generating) setMainView('editor');
  }, [generating]);

  // 🎙 音声版（Podcast）生成: 記事全文をAI音声でMP3化して添付（有料プラン限定）
  const [audioGenerating, setAudioGenerating] = React.useState(false);
  const generateAudio = async () => {
    if (!draft || !uid || audioGenerating) return;
    if (!draft.bodyMarkdown.trim()) { onToast?.('まず本文を用意してください', 'info'); return; }
    setAudioGenerating(true);
    try {
      await saveWorkingDraft(uid); // CFがFirestoreの記事docを読むため先に保存
      const tts = getTtsSettings();
      const fn = httpsCallable(functions, 'generateArticleAudio');
      const r: any = await fn({ articleId: draft.id, voice: tts.aiVoice, style: tts.aiStyle });
      if (r.data?.success && r.data.audioUrl) {
        updateDraft({ audioUrl: r.data.audioUrl, audioDurationSec: r.data.durationSec || null });
        onToast?.(`音声版を生成しました（約${Math.ceil((r.data.durationSec || 0) / 60)}分）。公開すると記事ページでも聴けます`, 'success');
      } else {
        onToast?.(r.data?.reason || '音声版の生成に失敗しました', r.data?.code === 'PLAN_REQUIRED' ? 'info' : 'error');
      }
    } catch (e: any) {
      onToast?.(`音声版の生成に失敗しました: ${e.message}`, 'error');
    } finally {
      setAudioGenerating(false);
    }
  };

  // 「✨デザイン」: ブログのスタイル設定に沿って記事全体を整形＋統一デザインの図解/画像を挿入
  const [designing, setDesigning] = React.useState(false);
  const applyDesign = async () => {
    if (!draft || !uid || designing) return;
    if (!draft.bodyMarkdown.trim()) { onToast?.('まず本文（下書き）を用意してください', 'info'); return; }
    setDesigning(true);
    try {
      // 適用前の本文を退避 —「元に戻す」用。記事docに永続化するのでリロード後も戻せる。
      const backup = { bodyMarkdown: draft.bodyMarkdown, excerpt: draft.excerpt, ts: new Date().toISOString() };
      await saveWorkingDraft(uid); // CFがFirestoreの記事docを読むため先に保存
      const fn = httpsCallable(functions, 'designBlogArticle');
      const r: any = await fn({ articleId: draft.id });
      if (r.data?.success && r.data.body) {
        updateDraft({
          bodyMarkdown: normalizeDesignedMarkdown(r.data.body),
          ...(r.data.excerpt ? { excerpt: r.data.excerpt } : {}),
          designBackup: backup,
        });
        void saveWorkingDraft(uid); // バックアップごと即永続化
        onToast?.('デザインを適用しました。「↩ 元に戻す」でいつでも適用前に戻せます（スタイルは🎨から変更）', 'success');
      } else {
        onToast?.(`デザイン適用に失敗しました: ${r.data?.reason || '不明なエラー'}`, 'error');
      }
    } catch (e: any) {
      onToast?.(`デザイン適用に失敗しました: ${e.message}`, 'error');
    } finally {
      setDesigning(false);
    }
  };

  // ↩ デザイン適用を取り消して適用前の本文・抜粋へ戻す。
  const revertDesign = () => {
    const b = draft?.designBackup;
    if (!draft || !b) return;
    updateDraft({ bodyMarkdown: b.bodyMarkdown, excerpt: b.excerpt, designBackup: null });
    if (uid) void saveWorkingDraft(uid);
    onToast?.('デザイン適用前の本文に戻しました', 'success');
  };

  // 🎨 スタイル設定（ブログ全体・全記事共通 = 統一感、色/署名/独自指示 = 独自性）
  // エディタの誌面テーマ（articleTheme）もこの style を参照するため、開いた時点で読み込む。
  const [styleOpen, setStyleOpen] = React.useState(false);
  const [style, setStyle] = React.useState<BlogStyle>({ ...DEFAULT_BLOG_STYLE });
  const [styleSaving, setStyleSaving] = React.useState(false);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    loadBlogStyle(uid).then((s) => { if (alive) setStyle(s); }).catch(() => { /* 既定のまま */ });
    return () => { alive = false; };
  }, [uid]);
  const openStyle = async () => {
    setStyleOpen(true);
    if (uid) { try { setStyle(await loadBlogStyle(uid)); } catch { /* 既定のまま */ } }
  };
  const handleSaveStyle = async () => {
    if (!uid) return;
    setStyleSaving(true);
    try {
      await saveBlogStyle(uid, style);
      setStyleOpen(false);
      onToast?.('スタイルを保存しました。以後の「✨デザイン」すべての記事に適用されます', 'success');
    } catch (e: any) {
      onToast?.(`スタイル保存に失敗: ${e.message}`, 'error');
    } finally {
      setStyleSaving(false);
    }
  };

  // ── 作業中の自動保存（編集が止まったら静かにクラウド保存） ──────────────
  // 開いた直後の無編集保存で updatedAt が動かないよう、読み込み時のスナップショットを基準に差分判定。
  const draftSignal = draft
    ? JSON.stringify({ t: draft.title, b: draft.bodyMarkdown, e: draft.excerpt, c: draft.category, s: draft.status, sl: draft.slug, tg: draft.tags, pt: draft.publishTarget,
        // AIとの議論も保存対象（議論ファーストで本文が空でも、対話ログはリロードで失われてはならない）
        d: draft.aiDialogue?.length ?? 0, dl: draft.aiDialogue?.[draft.aiDialogue.length - 1]?.ts ?? '' })
    : '';
  const baselineRef = useRef<{ id: string | null; sig: string }>({ id: null, sig: '' });
  useEffect(() => {
    if (draft && baselineRef.current.id !== draft.id) baselineRef.current = { id: draft.id, sig: draftSignal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id]);
  const hasContent = !!draft && !!((draft.title && draft.title.trim()) || (draft.bodyMarkdown && draft.bodyMarkdown.trim()) || (draft.excerpt && draft.excerpt.trim())
    || (draft.aiDialogue && draft.aiDialogue.length > 0));

  // リロード復帰用: 編集中の下書きIDを残す（正常に閉じたらアンマウントで消える。
  // リロード/クラッシュではフラグが残り、DsbDashboard が自動で開き直す）
  useEffect(() => {
    if (!draft?.id) return;
    try { localStorage.setItem('dsb-editing-draft', draft.id); } catch { /* noop */ }
    return () => { try { localStorage.removeItem('dsb-editing-draft'); } catch { /* noop */ } };
  }, [draft?.id]);
  const isDirty = hasContent && draftSignal !== baselineRef.current.sig;
  useAutosaveDraft({
    key: draft?.id ?? null,
    dirty: isDirty,
    signal: draftSignal,
    save: async () => {
      if (!uid) return;
      const sigAtStart = draftSignal; // 保存対象のスナップショット（保存完了で基準に取り込む）
      setAutosaveState('saving');
      try {
        await saveWorkingDraft(uid);
        // 基準を保存済みシグナルへ更新 → isDirty が落ち着き「保存済み」表示が安定する
        baselineRef.current = { id: draft?.id ?? null, sig: sigAtStart };
        setAutosaveState('saved');
      } catch { setAutosaveState('idle'); }
    },
  });
  // 編集で dirty になったら「保存済み」表示は一旦解除（次の自動保存まで）
  useEffect(() => { if (isDirty) setAutosaveState((s) => (s === 'saved' ? 'idle' : s)); }, [isDirty, draftSignal]);

  // 📤 公開: status を published にして dual-publish（S.Library/検索連携＋みんなの記事）。
  // 編集は維持し、完了ダイアログで公開先を案内・遷移できるようにする。
  const handlePublish = async () => {
    if (!uid || publishing || !draft) return;
    if (!draft.title.trim()) { onToast?.('タイトルを入力してください', 'info'); return; }
    setPublishing(true);
    updateDraft({ status: 'published' });
    try {
      const res = await saveDraft(uid, { keepEditing: true });
      let url: string | null = null;
      let hadUsername = false;
      try {
        const username = await getUsername(uid);
        const slug = useDsbStore.getState().draft?.slug;
        if (username && slug) { url = `${PUBLIC_BASE}/${username}/blog/${slug}`; hadUsername = true; }
      } catch { /* URL 構築失敗は致命的でない */ }
      setPublishedInfo({ url, hadUsername });
      if (!res.published) onToast?.('公開の連携に一部失敗しました', 'error');
    } catch (e) {
      console.error('[DsbEditor] publish failed', e);
      updateDraft({ status: 'draft' }); // 失敗したら下書きへ戻す
      onToast?.('公開に失敗しました', 'error');
    } finally {
      setPublishing(false);
    }
  };

  // 🔒 非公開に戻す: status を draft にして再保存（みんなの記事ミラー等を撤去）。
  const handleUnpublish = async () => {
    if (!uid || publishing || !draft) return;
    setPublishing(true);
    updateDraft({ status: 'draft' });
    try {
      await saveDraft(uid, { keepEditing: true });
      onToast?.('非公開（下書き）に戻しました', 'success');
    } catch (e) {
      console.error('[DsbEditor] unpublish failed', e);
      onToast?.('非公開への変更に失敗しました', 'error');
    } finally {
      setPublishing(false);
    }
  };

  // カテゴリ候補 = 既定カテゴリ ∪ ユーザー作成カテゴリ ∪ 現在の記事のカテゴリ
  // （カスタム値が選択肢に無いと Select が空表示になるため必ず含める）。
  const categoryOptions = useMemo(() => {
    const set = new Set<string>([...BLOG_CATEGORIES, ...categories]);
    if (draft?.category) set.add(draft.category);
    return [...set];
  }, [categories, draft?.category]);

  const targetValue = useMemo(() => {
    if (!draft) return 'account';
    return draft.publishTarget.scope === 'account' ? 'account' : draft.publishTarget.projectId;
  }, [draft]);

  if (!draft) return null;

  const handleTargetChange = (val: string) => {
    if (val === 'account') {
      updateDraft({ publishTarget: { scope: 'account' } });
    } else {
      const p = projects.find((pr) => pr.id === val);
      const next: BlogPublishTarget = { scope: 'project', projectId: val, projectName: p?.name };
      updateDraft({ publishTarget: next });
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!draft.tags.includes(t)) updateDraft({ tags: [...draft.tags, t] });
    setTagInput('');
  };

  return (
    <Box sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* ツールバー（全幅）。右パネルで幅が狭まっても崩れないよう、折り返さず横スクロール。 */}
      <Box
        sx={{
          flexShrink: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1.5 },
          px: { xs: 1.5, md: 3 }, py: 1.5,
          bgcolor: 'rgba(20,22,27,0.92)',
          borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
          // 折り返しでボタンが分断されるのを防ぎ、入りきらないときは横スクロール
          flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden',
          '& > *': { flexShrink: 0 },
          '& .MuiButton-root': { whiteSpace: 'nowrap' },
          // スクロールバーは細く控えめに
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: 3 },
        }}
      >
        <Button
          onClick={() => { if (uid) void saveWorkingDraft(uid); cancelEdit(); }}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', minWidth: 'auto' }}
        >
          一覧へ
        </Button>
        <Box sx={{ flex: 1 }} />
        {hasSource && (
          <ToggleButtonGroup
            size="small" exclusive value={mainView}
            onChange={(_e, v) => v && setMainView(v)}
            sx={{ mr: 1.5,
              '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', textTransform: 'none', fontSize: 12, px: 1.25 },
              '& .Mui-selected': { color: '#fff !important', bgcolor: 'rgba(100,181,246,0.35) !important' } }}
          >
            <ToggleButton value="reader">📖 記事</ToggleButton>
            <ToggleButton value="editor">✍ 執筆</ToggleButton>
          </ToggleButtonGroup>
        )}
        <Button size="small" disabled={designing} onClick={() => void applyDesign()}
          startIcon={designing ? <CircularProgress size={13} sx={{ color: '#000' }} /> : <AutoFixHighRoundedIcon sx={{ fontSize: 15 }} />}
          sx={{ bgcolor: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}66`, textTransform: 'none', fontSize: 12, fontWeight: 700, px: 1.5, borderRadius: 1.5,
            '&:hover': { bgcolor: ACCENT, color: '#000' }, '&.Mui-disabled': { color: `${ACCENT}88` } }}>
          {designing ? 'デザイン適用中…' : '✨ デザイン'}
        </Button>
        <Tooltip title="画像が入っていないセクションに、内容に合うAI画像を1枚ずつ生成して配置します（カバー未設定ならサムネイルも生成）">
          <span>
            <Button size="small" disabled={planningImages || !!imageGen || generating} onClick={() => void generateSectionImages()}
              startIcon={(planningImages || imageGen) ? <CircularProgress size={13} sx={{ color: '#7fb6f0' }} /> : <ImageRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ ml: 1, bgcolor: 'rgba(100,181,246,0.12)', color: '#7fb6f0', border: '1px solid rgba(100,181,246,0.4)', textTransform: 'none', fontSize: 12, fontWeight: 700, px: 1.5, borderRadius: 1.5,
                '&:hover': { bgcolor: '#64b5f6', color: '#000' }, '&.Mui-disabled': { color: 'rgba(100,181,246,0.5)' } }}>
              {imageGen ? `画像生成中 ${imageGen.done}/${imageGen.total}` : planningImages ? '画像を計画中…' : '🖼 画像生成'}
            </Button>
          </span>
        </Tooltip>
        {draft.designBackup && (
          <Tooltip title="「✨デザイン」適用前の本文・抜粋に戻す">
            <Button size="small" disabled={designing} onClick={revertDesign}
              startIcon={<UndoRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)', textTransform: 'none',
                fontSize: 12, px: 1.25, borderRadius: 1.5, '&:hover': { color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}>
              元に戻す
            </Button>
          </Tooltip>
        )}
        <Tooltip title="スタイル設定（全記事共通のデザイン）">
          <IconButton size="small" onClick={() => void openStyle()} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', mr: 1, '&:hover': { color: ACCENT } }}>
            <PaletteRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        {/* 🔬 記事を分析: 記事を「根拠→解釈→結論」に分解し多視点分析。得た根拠は Research & Memo で再利用 */}
        <Tooltip title="記事を多視点で分析し、根拠→結論の論証グラフを作ります（Research & Memo で再利用可能）">
          <Button size="small" onClick={() => setSidePanel(sidePanel === 'analysis' ? 'settings' : 'analysis')}
            startIcon={<ScienceRoundedIcon sx={{ fontSize: 15 }} />}
            sx={{ mr: 1, textTransform: 'none', fontSize: 12, fontWeight: 700, px: 1.5, borderRadius: 1.5,
              color: sidePanel === 'analysis' ? '#fff' : '#b39ddb',
              bgcolor: sidePanel === 'analysis' ? 'rgba(179,157,219,0.45)' : 'rgba(179,157,219,0.12)',
              border: '1px solid rgba(179,157,219,0.45)',
              '&:hover': { bgcolor: 'rgba(179,157,219,0.3)' } }}>
            記事を分析
          </Button>
        </Tooltip>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sidePanel === 'analysis' ? null : sidePanel}
          onChange={(_e, v) => v && setSidePanel(v)}
          sx={{
            mr: 1,
            '& .MuiToggleButton-root': {
              color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)',
              textTransform: 'none', fontSize: 12, px: 1.5, gap: 0.5,
            },
            '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT}55 !important` },
          }}
        >
          <ToggleButton value="settings"><TuneRoundedIcon sx={{ fontSize: 15 }} />設定</ToggleButton>
          <ToggleButton value="dialogue">
            <ForumRoundedIcon sx={{ fontSize: 15 }} />AIと議論
            {(draft.aiDialogue?.length ?? 0) > 0 && (
              <Box component="span" sx={{ ml: 0.5, px: 0.7, borderRadius: 99, bgcolor: ACCENT, color: '#000', fontSize: 10, fontWeight: 800, lineHeight: '16px' }}>
                {draft.aiDialogue!.length}
              </Box>
            )}
          </ToggleButton>
        </ToggleButtonGroup>
        {/* 💾 自動保存インジケータ（保存ボタンは廃止。保存は自動） */}
        <Tooltip title="変更は自動で保存されます">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5,
            color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 11, whiteSpace: 'nowrap' }}>
            {autosaveState === 'saving'
              ? <><CircularProgress size={11} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} /><span>保存中…</span></>
              : autosaveState === 'saved'
                ? <><CloudDoneRoundedIcon sx={{ fontSize: 14 }} /><span>保存済み</span></>
                : <><CloudDoneRoundedIcon sx={{ fontSize: 14, opacity: 0.5 }} /><span>自動保存</span></>}
          </Box>
        </Tooltip>

        {/* 📤 公開: 下書き→「公開する」/ 公開中→ステータス＋ページを見る＋非公開 */}
        {draft.status === 'published' ? (
          <>
            <Chip icon={<PublicRoundedIcon sx={{ fontSize: '15px !important' }} />} label="公開中" size="small"
              sx={{ height: 26, fontWeight: 800, fontSize: 11.5, bgcolor: 'rgba(129,199,132,0.16)', color: 'light-dark(#2e7d32, #a5d6a7)',
                border: '1px solid rgba(129,199,132,0.5)', '& .MuiChip-icon': { color: 'light-dark(#2e7d32, #a5d6a7)' } }} />
            {/* 🌐 公開ページを開く（ユーザー名設定済みのときだけURLが確定する） */}
            {username && draft.slug?.trim() && (
              <Tooltip title={`公開ページをブラウザで開く\n${PUBLIC_BASE}/${username}/blog/${draft.slug}`}>
                <Button size="small" startIcon={<OpenInNewRoundedIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => void openExternalUrl(`${PUBLIC_BASE}/${username}/blog/${draft.slug}`)}
                  sx={{ color: 'light-dark(#095fa5, #90caf9)', textTransform: 'none', fontSize: 12,
                    '&:hover': { bgcolor: 'rgba(100,181,246,0.08)' } }}>
                  公開ページ
                </Button>
              </Tooltip>
            )}
            <Button size="small" disabled={publishing} onClick={handleUnpublish}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', textTransform: 'none', fontSize: 12, '&:hover': { color: '#ef9a9a' } }}>
              非公開にする
            </Button>
            <Button onClick={() => void handlePublish()} disabled={publishing || !draft.title.trim()}
              variant="contained" startIcon={publishing ? <CircularProgress size={14} sx={{ color: '#191815' }} /> : <PublicRoundedIcon />}
              sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}>
              {publishing ? '更新中…' : '更新'}
            </Button>
          </>
        ) : (
          <Button onClick={() => void handlePublish()} disabled={publishing || !draft.title.trim()}
            variant="contained" startIcon={publishing ? <CircularProgress size={14} sx={{ color: '#191815' }} /> : <PublicRoundedIcon />}
            sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}>
            {publishing ? '公開中…' : '公開する'}
          </Button>
        )}
      </Box>

      {/* メイン（本文）＋ 右サイドバー（各種設定） */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* メインエリア：
            議論ファースト（題材記事あり・本文なし）の間は「題材記事リーダー」を表示し、
            右パネルで議論→「議論から記事を生成」で本文が入ると自動でエディタに切り替わる。 */}
        {showSourceReader ? (
          <SourceArticleReader
            source={draft.sourceRefs![0]}
            onSkipToEditor={() => setMainView('editor')}
          />
        ) : (
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', pt: 2, overflow: 'hidden', position: 'relative' }}>
          {/* 生成中〜完了直後の執筆演出（生成が終わりタイプ表示を終えると自動で消える） */}
          <BlogWritingOverlay generating={generating} bodyMarkdown={draft.bodyMarkdown} title={draft.title} />

          {/* 🖼 画像生成中の浮遊インジケーター（脈打つアイコン＋進捗バー） */}
          {imageGen && (
            <Box sx={{ position: 'absolute', bottom: 18, right: 24, zIndex: 15, display: 'flex', alignItems: 'center', gap: 1.25,
              px: 1.75, py: 1, borderRadius: 99, bgcolor: 'light-dark(rgba(255,255,255,0.96), rgba(13,18,28,0.96))',
              border: '1px solid rgba(100,181,246,0.5)', boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
              <ImageRoundedIcon sx={{ fontSize: 17, color: '#64b5f6',
                animation: 'sekkeiyaImgPulse 1.2s ease-in-out infinite',
                '@keyframes sekkeiyaImgPulse': { '0%,100%': { opacity: 0.45, transform: 'scale(0.92)' }, '50%': { opacity: 1, transform: 'scale(1.1)' } } }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)' }}>
                画像を生成中… {imageGen.done + 1 > imageGen.total ? imageGen.total : imageGen.done + 1}/{imageGen.total}
              </Typography>
              <Box sx={{ width: 72, height: 4, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', overflow: 'hidden' }}>
                <Box sx={{ width: `${Math.round((imageGen.done / Math.max(1, imageGen.total)) * 100)}%`, height: '100%', bgcolor: '#64b5f6', transition: 'width .4s' }} />
              </Box>
            </Box>
          )}
          {/* タイトルは紙面（BlogBodyEditor の header）に載せて本文と一緒にスクロールさせる。
              紙面の色・書体はスタイル設定（articleTheme）が決め、公開ページと同じ見え方で書ける。 */}
          <BlogBodyEditor
            value={draft.bodyMarkdown}
            onChange={(md) => updateDraft({ bodyMarkdown: md })}
            placeholder="本文を書く...（見出し・太字・リスト・画像・動画は上のツールバーから）"
            uid={uid}
            projectId={draft.publishTarget.scope === 'project' ? draft.publishTarget.projectId : null}
            blogStyle={style}
            header={
              <Box sx={{ mb: 3 }}>
                <TextField
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  placeholder="タイトルを入力"
                  variant="standard"
                  fullWidth
                  multiline
                  InputProps={{ disableUnderline: true }}
                  sx={{ '& .MuiInputBase-input': { ...buildArticleTitleSx(style), '&::placeholder': { opacity: 0.45 } } }}
                />
              </Box>
            }
            onImageClick={(src, alt) => { setSelectedImage({ src, alt }); setSidePanel('image'); }}
          />
        </Box>
        )}

        {/* 右サイドバー：記事の各種設定 / AIとの議論 / 記事の分析 */}
        {sidePanel === 'analysis' ? (
          <Box
            sx={{
              width: 380, flexShrink: 0,
              borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
              bgcolor: 'light-dark(rgba(255,255,255,0.55), rgba(10,15,25,0.4))',
              display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            }}
          >
            <ArticleInsightPanel
              uid={uid}
              articleId={draft.id}
              title={draft.title}
              bodyMarkdown={draft.bodyMarkdown}
              excerpt={draft.excerpt}
              sourceUrl={draft.sourceRefs?.[0]?.url ?? null}
              defaultProjectId={draft.publishTarget.scope === 'project' ? draft.publishTarget.projectId : null}
              onToast={(m, s) => onToast?.(m, s)}
            />
          </Box>
        ) : sidePanel === 'dialogue' ? (
          <Box
            sx={{
              width: 380, flexShrink: 0,
              borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
              bgcolor: 'light-dark(rgba(255,255,255,0.55), rgba(10,15,25,0.4))',
              display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            }}
          >
            <BlogAiDialogue onToast={(m, s) => onToast?.(m, s)} />
          </Box>
        ) : sidePanel === 'image' && selectedImage ? (
          <Box
            sx={{
              width: 340, flexShrink: 0,
              borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
              bgcolor: 'light-dark(rgba(255,255,255,0.55), rgba(10,15,25,0.4))',
              display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', p: 2, gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ImageRoundedIcon sx={{ fontSize: 18, color: '#64b5f6' }} />
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: 'var(--brand-fg)' }}>画像</Typography>
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => { setSelectedImage(null); setSidePanel('settings'); }}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            <Box component="img" src={selectedImage.src} alt={selectedImage.alt}
              sx={{ width: '100%', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)' }} />
            {selectedImage.alt && (
              <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>{selectedImage.alt}</Typography>
            )}
            {draft.coverUrl === selectedImage.src && (
              <Chip label="カバー（サムネイル）に使用中" size="small"
                sx={{ alignSelf: 'flex-start', height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: 'rgba(100,181,246,0.15)', color: '#7fb6f0', border: '1px solid rgba(100,181,246,0.4)' }} />
            )}

            <Button fullWidth variant="contained" size="small" disabled={imgRegenBusy}
              startIcon={imgRegenBusy ? <CircularProgress size={13} sx={{ color: '#000' }} /> : <RefreshRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => void regenerateSelectedImage()}
              sx={{ bgcolor: '#64b5f6', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 1.5, '&:hover': { bgcolor: '#90caf9' } }}>
              {imgRegenBusy ? '再生成中…' : 'AIで再生成（同じテーマ）'}
            </Button>
            <Button fullWidth variant="outlined" size="small" disabled={imgRegenBusy}
              startIcon={<PermMediaRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => setReplacePickerOpen(true)}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.75)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', textTransform: 'none', borderRadius: 1.5,
                '&:hover': { borderColor: '#64b5f6', color: '#7fb6f0' } }}>
              メディアから差し替え
            </Button>
            <Button fullWidth size="small" disabled={imgRegenBusy}
              startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => { replaceImageSrc(selectedImage.src, null, selectedImage.alt); setSelectedImage(null); setSidePanel('settings'); onToast?.('画像を削除しました', 'success'); }}
              sx={{ color: '#ef9a9a', textTransform: 'none', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(239,83,80,0.08)' } }}>
              画像を削除
            </Button>
            {draft.coverUrl !== selectedImage.src && (
              <Button fullWidth size="small"
                onClick={() => { updateDraft({ coverUrl: selectedImage.src }); if (uid) void saveWorkingDraft(uid); onToast?.('この画像をカバー（サムネイル）に設定しました', 'success'); }}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none', fontSize: 11.5 }}>
                この画像をカバー（サムネイル）にする
              </Button>
            )}

            {/* 差し替え用メディアピッカー */}
            <MediaPickerDialog
              open={replacePickerOpen}
              onClose={() => setReplacePickerOpen(false)}
              onPick={(item) => {
                if (item.kind === 'image' && selectedImage) {
                  replaceImageSrc(selectedImage.src, item.url, selectedImage.alt);
                  setSelectedImage({ src: item.url, alt: selectedImage.alt });
                  onToast?.('画像を差し替えました', 'success');
                }
                setReplacePickerOpen(false);
              }}
              uid={uid}
              projectId={draft.publishTarget.scope === 'project' ? draft.publishTarget.projectId : null}
              accept={['image']}
            />
          </Box>
        ) : (
        <Box
          sx={{
            width: 340, flexShrink: 0,
            borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
            bgcolor: 'light-dark(rgba(255,255,255,0.55), rgba(10,15,25,0.4))',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 2,
            px: 2.25, py: 2.5,
          }}
        >
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            記事の設定
          </Typography>

          {/* 🔍 SEO対策: 洗い出し（チェックリスト）＋AI自動最適化（スラッグ/メタ説明/タグ） */}
          <BlogSeoPanel onToast={onToast} />

          <TextField
            label="スラッグ (URL)"
            value={draft.slug}
            onChange={(e) => updateDraft({ slug: e.target.value })}
            placeholder={slugify(draft.title) || 'my-first-post'}
            fullWidth size="small"
            sx={fieldSx}
            InputProps={{
              startAdornment: <InputAdornment position="start" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '& p': { fontSize: 13 } }}>/blog/</InputAdornment>,
            }}
          />

          <TextField
            select label="カテゴリ" value={draft.category}
            onChange={(e) => updateDraft({ category: e.target.value })}
            fullWidth size="small"
            sx={fieldSx}
            SelectProps={selectMenuProps}
          >
            {categoryOptions.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>

          <TextField
            select label="公開先" value={targetValue}
            onChange={(e) => handleTargetChange(e.target.value)}
            fullWidth size="small"
            sx={fieldSx}
            helperText="既定はアカウントサイト（記事のホーム）"
            FormHelperTextProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.4)', mx: 0 } }}
            SelectProps={selectMenuProps}
          >
            <MenuItem value="account">アカウントサイト</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>プロジェクト: {p.name}</MenuItem>
            ))}
          </TextField>

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />

          {/* 🎙 音声版（Podcast）: AI音声で全文合成 → 公開ページでも再生できる */}
          <Box>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mb: 1 }}>
              🎙 音声版（Podcast）
            </Typography>
            {draft.audioUrl ? (
              <>
                <Box component="audio" controls preload="none" src={draft.audioUrl}
                  sx={{ width: '100%', height: 36, '&::-webkit-media-controls-panel': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' } }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                  <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', flex: 1 }}>
                    {draft.audioDurationSec ? `約${Math.ceil(draft.audioDurationSec / 60)}分` : ''}・公開すると記事ページでも再生できます
                  </Typography>
                  <Button size="small" disabled={audioGenerating} onClick={() => void generateAudio()}
                    sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontSize: 11, px: 1, '&:hover': { color: ACCENT } }}>
                    {audioGenerating ? '生成中…' : '再生成'}
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Button fullWidth size="small" variant="outlined" disabled={audioGenerating} onClick={() => void generateAudio()}
                  startIcon={audioGenerating ? <CircularProgress size={13} sx={{ color: ACCENT }} /> : <HeadphonesRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={{ color: ACCENT, borderColor: `${ACCENT}55`, textTransform: 'none', fontSize: 12,
                    '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}0f` } }}>
                  {audioGenerating ? '音声を生成しています…（1〜2分）' : 'AI音声で音声版を生成'}
                </Button>
                <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.38)', mt: 0.75, lineHeight: 1.6 }}>
                  記事全文をAI音声（読み上げ設定のトーン・声）でMP3化し、公開ページに音声プレーヤーを表示します。有料プラン限定。
                </Typography>
              </>
            )}
          </Box>

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />

          <TextField
            label="抜粋 (meta description / OGP)"
            value={draft.excerpt}
            onChange={(e) => updateDraft({ excerpt: e.target.value })}
            fullWidth multiline minRows={3} size="small"
            sx={fieldSx}
          />

          {/* タグ */}
          <Box>
            <TextField
              label="タグを追加（Enter）"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              fullWidth size="small"
              sx={fieldSx}
            />
            {draft.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                {draft.tags.map((t) => (
                  <Chip
                    key={t} label={t} size="small"
                    onDelete={() => updateDraft({ tags: draft.tags.filter((x) => x !== t) })}
                    sx={{ bgcolor: `${ACCENT}33`, color: 'var(--brand-fg)', '& .MuiChip-deleteIcon': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' } }}
                  />
                ))}
              </Box>
            )}
          </Box>

          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.6, mt: 'auto' }}>
            ※ Markdown プレビューと画像アップロード、Chat連携（記事にまとめる）は後続フェーズで追加します。
          </Typography>
        </Box>
        )}
      </Box>

      {/* 🎨 スタイル設定（ブログ全体）— プリセットは実在誌風のミニ誌面プレビューで選ぶ */}
      <BlogStyleDialog
        open={styleOpen}
        saving={styleSaving}
        style={style}
        onChange={setStyle}
        onClose={() => !styleSaving && setStyleOpen(false)}
        onSave={() => void handleSaveStyle()}
        authorName={draft.authorName}
      />

      {/* 🎉 公開完了ダイアログ: 公開したことを伝え、公開先へ遷移できる */}
      <Dialog open={!!publishedInfo} onClose={() => setPublishedInfo(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
        <DialogContent sx={{ pt: 3, pb: 2, textAlign: 'center' }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 46, color: '#81c784', mb: 1 }} />
          <Typography sx={{ fontSize: 17, fontWeight: 800, mb: 0.75 }}>公開しました</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)', lineHeight: 1.7, mb: publishedInfo?.url ? 2 : 0 }}>
            記事を公開しました。SEKKEIYAの「みんなの記事」に掲載され、<br />S.Library・Chat / 検索にも連携されます。
          </Typography>
          {publishedInfo?.url && (
            <Box onClick={() => publishedInfo.url && void openExternalUrl(publishedInfo.url)}
              sx={{ mt: 1, px: 1.5, py: 1, borderRadius: 1.5, cursor: 'pointer', textAlign: 'left',
                bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
                display: 'flex', alignItems: 'center', gap: 1, '&:hover': { borderColor: `${ACCENT}88` } }}>
              <OpenInNewRoundedIcon sx={{ fontSize: 16, color: ACCENT, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 11.5, color: 'light-dark(#095fa5, #90caf9)', wordBreak: 'break-all', lineHeight: 1.45 }}>
                {publishedInfo.url}
              </Typography>
            </Box>
          )}
          {publishedInfo && !publishedInfo.hadUsername && (
            <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mt: 1.25, lineHeight: 1.6 }}>
              ※ 公開ページのURLは、アカウントサイトのユーザー名を設定すると発行されます。
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => { setPublishedInfo(null); if (uid) void saveWorkingDraft(uid); cancelEdit(); }}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none' }}>
            記事一覧へ
          </Button>
          <Box sx={{ flex: 1 }} />
          {publishedInfo?.url ? (
            <Button variant="contained" startIcon={<OpenInNewRoundedIcon />}
              onClick={() => { if (publishedInfo?.url) void openExternalUrl(publishedInfo.url); setPublishedInfo(null); }}
              sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}>
              公開ページを開く
            </Button>
          ) : (
            <Button variant="contained" onClick={() => setPublishedInfo(null)}
              sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}>
              編集を続ける
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
