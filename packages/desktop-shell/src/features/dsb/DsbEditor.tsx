import React, { useMemo, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, Button, MenuItem, Chip, InputAdornment,
  ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
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
import { SourceArticleReader } from './SourceArticleReader';
import { loadBlogStyle, saveBlogStyle } from './api/blogApi';
import { BLOG_STYLE_PRESETS, DEFAULT_BLOG_STYLE, type BlogStyle } from './types';
import { useDsbStore } from './store/useDsbStore';
import { useAppStore } from '../../store/useAppStore';
import { useAutosaveDraft } from '../../shared/hooks/useAutosaveDraft';
import { BLOG_CATEGORIES, type BlogPublishTarget } from './types';
import { slugify } from './lib/blogUtils';
import { BlogBodyEditor } from './BlogBodyEditor';

const ACCENT = '#e57373';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
};

// セレクトのドロップダウン（メニュー）が透けないよう不透明な背景を指定する。
const selectMenuProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        bgcolor: '#1a1c22',
        backgroundImage: 'none',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        '& .MuiMenuItem-root': {
          fontSize: 14,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
          '&.Mui-selected': { bgcolor: `${ACCENT}44` },
          '&.Mui-selected:hover': { bgcolor: `${ACCENT}55` },
        },
      },
    },
  },
} as const;

interface DsbEditorProps {
  uid?: string;
  saving: boolean;
  onSave: () => void;
  onToast?: (msg: string, sev: 'success' | 'error' | 'info') => void;
}

export const DsbEditor: React.FC<DsbEditorProps> = ({ uid, saving, onSave, onToast }) => {
  const { draft, updateDraft, cancelEdit, categories, saveWorkingDraft } = useDsbStore();
  const projects = useAppStore((s) => s.projects);

  const [tagInput, setTagInput] = React.useState('');
  // 右パネル: 記事の設定 / AIとの議論。議論の途中、または「議論ファースト」
  // （ホームのフィードから題材だけ持って来た状態）なら議論パネルを開いた状態で始める。
  const [sidePanel, setSidePanel] = React.useState<'settings' | 'dialogue'>(
    (draft?.aiDialogue?.length ?? 0) > 0 || ((draft?.sourceRefs?.length ?? 0) > 0 && !draft?.bodyMarkdown?.trim())
      ? 'dialogue' : 'settings'
  );

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
      await saveWorkingDraft(uid); // CFがFirestoreの記事docを読むため先に保存
      const fn = httpsCallable(functions, 'designBlogArticle');
      const r: any = await fn({ articleId: draft.id });
      if (r.data?.success && r.data.body) {
        updateDraft({ bodyMarkdown: r.data.body, ...(r.data.excerpt ? { excerpt: r.data.excerpt } : {}) });
        onToast?.('デザインを適用しました。仕上がりを確認してください（スタイルは🎨から変更できます）', 'success');
      } else {
        onToast?.(`デザイン適用に失敗しました: ${r.data?.reason || '不明なエラー'}`, 'error');
      }
    } catch (e: any) {
      onToast?.(`デザイン適用に失敗しました: ${e.message}`, 'error');
    } finally {
      setDesigning(false);
    }
  };

  // 🎨 スタイル設定（ブログ全体・全記事共通 = 統一感、色/署名/独自指示 = 独自性）
  const [styleOpen, setStyleOpen] = React.useState(false);
  const [style, setStyle] = React.useState<BlogStyle>({ ...DEFAULT_BLOG_STYLE });
  const [styleSaving, setStyleSaving] = React.useState(false);
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
    ? JSON.stringify({ t: draft.title, b: draft.bodyMarkdown, e: draft.excerpt, c: draft.category, s: draft.status, sl: draft.slug, tg: draft.tags, pt: draft.publishTarget })
    : '';
  const baselineRef = useRef<{ id: string | null; sig: string }>({ id: null, sig: '' });
  useEffect(() => {
    if (draft && baselineRef.current.id !== draft.id) baselineRef.current = { id: draft.id, sig: draftSignal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id]);
  const hasContent = !!draft && !!((draft.title && draft.title.trim()) || (draft.bodyMarkdown && draft.bodyMarkdown.trim()) || (draft.excerpt && draft.excerpt.trim()));
  const isDirty = hasContent && draftSignal !== baselineRef.current.sig;
  useAutosaveDraft({
    key: draft?.id ?? null,
    dirty: isDirty,
    signal: draftSignal,
    save: async () => { if (uid) await saveWorkingDraft(uid); },
  });

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
      {/* ツールバー（全幅） */}
      <Box
        sx={{
          flexShrink: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 3, py: 1.5,
          bgcolor: 'rgba(20,22,27,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Button
          onClick={() => { if (uid) void saveWorkingDraft(uid); cancelEdit(); }}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}
        >
          一覧へ
        </Button>
        <Box sx={{ flex: 1 }} />
        {hasSource && (
          <ToggleButtonGroup
            size="small" exclusive value={mainView}
            onChange={(_e, v) => v && setMainView(v)}
            sx={{ mr: 1.5,
              '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', textTransform: 'none', fontSize: 12, px: 1.25 },
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
        <Tooltip title="スタイル設定（全記事共通のデザイン）">
          <IconButton size="small" onClick={() => void openStyle()} sx={{ color: 'rgba(255,255,255,0.55)', mr: 1, '&:hover': { color: ACCENT } }}>
            <PaletteRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sidePanel}
          onChange={(_e, v) => v && setSidePanel(v)}
          sx={{
            mr: 1,
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)',
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
        <ToggleButtonGroup
          size="small"
          exclusive
          value={draft.status}
          onChange={(_e, v) => v && updateDraft({ status: v })}
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)',
              textTransform: 'none', fontSize: 12, px: 1.5,
            },
            '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT}55 !important` },
          }}
        >
          <ToggleButton value="draft">下書き</ToggleButton>
          <ToggleButton value="published">公開</ToggleButton>
        </ToggleButtonGroup>
        <Button
          onClick={onSave}
          disabled={saving || !draft.title.trim()}
          variant="contained"
          startIcon={<SaveRoundedIcon />}
          sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
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
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', px: 4, py: 3, gap: 2, overflow: 'hidden' }}>
          <TextField
            value={draft.title}
            onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="タイトルを入力"
            variant="standard"
            fullWidth
            InputProps={{ disableUnderline: true }}
            sx={{
              flexShrink: 0,
              '& .MuiInputBase-input': {
                color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1.3,
                '&::placeholder': { color: 'rgba(255,255,255,0.3)', opacity: 1 },
              },
            }}
          />

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

          <BlogBodyEditor
            value={draft.bodyMarkdown}
            onChange={(md) => updateDraft({ bodyMarkdown: md })}
            placeholder="本文を書く...（見出し・太字・リスト・画像・動画は上のツールバーから）"
            uid={uid}
            projectId={draft.publishTarget.scope === 'project' ? draft.publishTarget.projectId : null}
          />
        </Box>
        )}

        {/* 右サイドバー：記事の各種設定 / AIとの議論 */}
        {sidePanel === 'dialogue' ? (
          <Box
            sx={{
              width: 380, flexShrink: 0,
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(10,15,25,0.4)',
              display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            }}
          >
            <BlogAiDialogue onToast={(m, s) => onToast?.(m, s)} />
          </Box>
        ) : (
        <Box
          sx={{
            width: 340, flexShrink: 0,
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(10,15,25,0.4)',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 2.5,
            px: 2.5, py: 3,
          }}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            記事の設定
          </Typography>

          <TextField
            label="スラッグ (URL)"
            value={draft.slug}
            onChange={(e) => updateDraft({ slug: e.target.value })}
            placeholder={slugify(draft.title) || 'my-first-post'}
            fullWidth size="small"
            sx={fieldSx}
            InputProps={{
              startAdornment: <InputAdornment position="start" sx={{ color: 'rgba(255,255,255,0.4)', '& p': { fontSize: 13 } }}>/blog/</InputAdornment>,
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
            FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)', mx: 0 } }}
            SelectProps={selectMenuProps}
          >
            <MenuItem value="account">アカウントサイト</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>プロジェクト: {p.name}</MenuItem>
            ))}
          </TextField>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* 🎙 音声版（Podcast）: AI音声で全文合成 → 公開ページでも再生できる */}
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mb: 1 }}>
              🎙 音声版（Podcast）
            </Typography>
            {draft.audioUrl ? (
              <>
                <Box component="audio" controls preload="none" src={draft.audioUrl}
                  sx={{ width: '100%', height: 36, '&::-webkit-media-controls-panel': { bgcolor: 'rgba(255,255,255,0.08)' } }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                  <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', flex: 1 }}>
                    {draft.audioDurationSec ? `約${Math.ceil(draft.audioDurationSec / 60)}分` : ''}・公開すると記事ページでも再生できます
                  </Typography>
                  <Button size="small" disabled={audioGenerating} onClick={() => void generateAudio()}
                    sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontSize: 11, px: 1, '&:hover': { color: ACCENT } }}>
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
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.38)', mt: 0.75, lineHeight: 1.6 }}>
                  記事全文をAI音声（読み上げ設定のトーン・声）でMP3化し、公開ページに音声プレーヤーを表示します。有料プラン限定。
                </Typography>
              </>
            )}
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

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
                    sx={{ bgcolor: `${ACCENT}33`, color: '#fff', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.6)' } }}
                  />
                ))}
              </Box>
            )}
          </Box>

          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, mt: 'auto' }}>
            ※ Markdown プレビューと画像アップロード、Chat連携（記事にまとめる）は後続フェーズで追加します。
          </Typography>
        </Box>
        )}
      </Box>

      {/* 🎨 スタイル設定（ブログ全体） */}
      <Dialog open={styleOpen} onClose={() => !styleSaving && setStyleOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#16181d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 3, color: '#fff' } }}>
        <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontWeight: 800, color: ACCENT }}>🎨 ブログのスタイル</Typography>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
              全記事に共通のデザイン。「✨デザイン」がこの設定に沿って記事を整形します
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setStyleOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
        </Box>
        <DialogContent sx={{ pt: 1 }}>
          {/* プリセット（統一感） */}
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', mb: 1, letterSpacing: 1 }}>スタイルプリセット</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2.5 }}>
            {(Object.keys(BLOG_STYLE_PRESETS) as BlogStyle['preset'][]).map((key) => {
              const p = BLOG_STYLE_PRESETS[key];
              const on = style.preset === key;
              return (
                <Box key={key} onClick={() => setStyle((s) => ({ ...s, preset: key, accent: s.accent === BLOG_STYLE_PRESETS[s.preset].accent ? p.accent : s.accent }))}
                  sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer',
                    bgcolor: on ? `${p.accent}1f` : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${on ? p.accent : 'rgba(255,255,255,0.1)'}`,
                    '&:hover': { borderColor: p.accent } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: p.accent }} />
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{p.label}</Typography>
                  </Box>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, mt: 0.5, lineHeight: 1.5 }}>{p.desc}</Typography>
                </Box>
              );
            })}
          </Box>

          {/* 独自性: アクセント色・署名・ビジュアル量・独自指示 */}
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', mb: 1, letterSpacing: 1 }}>アクセント色（図解・装飾）</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2.5, alignItems: 'center' }}>
            {['#e57373', '#e6a06f', '#64b5f6', '#81c784', '#ba68c8', '#8b919c'].map((c) => (
              <Box key={c} onClick={() => setStyle((s) => ({ ...s, accent: c }))}
                sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                  border: style.accent === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)' }} />
            ))}
            <TextField size="small" value={style.accent} onChange={(e) => setStyle((s) => ({ ...s, accent: e.target.value }))}
              sx={{ width: 110, ml: 1, '& .MuiOutlinedInput-root': { color: '#fff', fontSize: 12, '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }} />
          </Box>

          <TextField
            label="図解の署名（あなたのブログ名など）" fullWidth size="small"
            value={style.brandLabel || ''} onChange={(e) => setStyle((s) => ({ ...s, brandLabel: e.target.value }))}
            placeholder={`未設定なら著者名（${draft.authorName || 'BLOG'}）`}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
          />

          <TextField
            select label="挿入するビジュアル" fullWidth size="small"
            value={style.visuals} onChange={(e) => setStyle((s) => ({ ...s, visuals: e.target.value as BlogStyle['visuals'] }))}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
          >
            <MenuItem value="none">なし（文章の整形のみ）</MenuItem>
            <MenuItem value="slides">図解スライド（節末のまとめ）</MenuItem>
            <MenuItem value="slides+images">図解＋AI画像（冒頭ヒーロー）</MenuItem>
          </TextField>

          <TextField
            label="文体・トーンの独自指示（任意）" fullWidth size="small" multiline rows={2}
            value={style.customNote || ''} onChange={(e) => setStyle((s) => ({ ...s, customNote: e.target.value }))}
            placeholder="例: 絵文字は使わない / 専門用語には短い注釈 / 一文は短めに"
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setStyleOpen(false)} disabled={styleSaving} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={() => void handleSaveStyle()} disabled={styleSaving} variant="contained"
            startIcon={styleSaving ? <CircularProgress size={14} sx={{ color: '#000' }} /> : undefined}
            sx={{ bgcolor: ACCENT, color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#ef9a9a' } }}>
            保存（全記事に適用）
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
