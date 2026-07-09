/**
 * OfficialBlogEditor — 公式ブログ(officialArticles)のエディタ。
 *
 * アカウントブログ(DsbEditor)とUXを揃えた公開フロー:
 *   保存は自動（useAutosaveDraft + インジケータ、保存ボタンなし）/
 *   公開は明示アクション（公開する→完了ダイアログ→公開ページを開く）/
 *   公開中は 公開中バッジ + 公開ページ + 非公開 + 更新。
 * 公式固有のワークフロー（下書き→🎤取材待ち→🤖レビュー）は未公開時のトグルとして維持。
 * SEOは共通 SeoPanel（提案の適用先は seoTitle/seoDescription = 記事タイトルは上書きしない）。
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, Button, Chip, Divider, InputAdornment,
  ToggleButton, ToggleButtonGroup, Switch, FormControlLabel, CircularProgress,
  Tooltip, Dialog, DialogContent, DialogActions,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useOfficialBlogStore } from './store/useOfficialBlogStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAutosaveDraft } from '../../shared/hooks/useAutosaveDraft';
import { OfficialBodyEditor } from './OfficialBodyEditor';
import { SeoPanel } from './BlogSeoPanel';
import type { OfficialStatus } from './officialTypes';

const ACCENT = '#38bdf8'; // 公式モードは水色（アカウントブログの赤 #e57373 と区別）
const OFFICIAL_ARTICLE_BASE = 'https://sekkeiya.com/articles';

// サイドバーのフォームは一段コンパクトに（DsbEditor と同基準）。
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
  '& .MuiInputLabel-root.MuiInputLabel-shrink': { fontSize: 13.5 },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
} as const;

const slugify = (s: string) =>
  (s || '').trim().toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/(^-|-$)/g, '');

// 公開URL等を外部ブラウザで開く（Tauriは既定ブラウザ、Webは新規タブ）。
async function openExternalUrl(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    try { window.open(url, '_blank'); } catch { /* noop */ }
  }
}

interface OfficialBlogEditorProps {
  onToast?: (msg: string, sev: 'success' | 'error' | 'info') => void;
}

export const OfficialBlogEditor: React.FC<OfficialBlogEditorProps> = ({ onToast }) => {
  const { draft, updateDraft, cancelEdit, save } = useOfficialBlogStore();
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const author = {
    uid: (currentUser?.uid as string | undefined) ?? null,
    displayName: (currentUser?.displayName as string | undefined) || (currentUser?.email as string | undefined) || 'Admin',
  };
  const [tagInput, setTagInput] = useState('');

  // 📤 公開まわり（保存は自動なので保存ボタンは無し）
  const [publishing, setPublishing] = useState(false);
  const [publishedInfo, setPublishedInfo] = useState<{ url: string } | null>(null);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ── 自動保存（編集が止まったら静かに保存。公開状態は変えない） ──
  const draftSignal = draft
    ? JSON.stringify({ t: draft.title, b: draft.body, e: draft.excerpt, sl: draft.slug, st: draft.status,
        tg: draft.tags, cn: draft.categoryName, cs: draft.categorySlug, f: draft.featured,
        cv: draft.coverUrl, sT: draft.seoTitle, sD: draft.seoDescription })
    : '';
  const draftKey = draft ? (draft.id ?? 'new') : null;
  const baselineRef = useRef<{ key: string | null; sig: string }>({ key: null, sig: '' });
  useEffect(() => {
    if (draft && baselineRef.current.key !== draftKey) baselineRef.current = { key: draftKey, sig: draftSignal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  const hasContent = !!draft && !!(draft.title.trim() || draft.body.trim());
  const isDirty = hasContent && draftSignal !== baselineRef.current.sig;
  useAutosaveDraft({
    key: draftKey,
    dirty: isDirty,
    signal: draftSignal,
    save: async () => {
      const sigAtStart = draftSignal;
      setAutosaveState('saving');
      const ok = await save(author);
      if (ok) {
        // 新規は保存で id が確定する（'new'→id）。基準も追随させ「保存済み」を安定させる
        baselineRef.current = { key: useOfficialBlogStore.getState().draft?.id ?? 'new', sig: sigAtStart };
        setAutosaveState('saved');
      } else {
        setAutosaveState('idle');
      }
    },
  });
  useEffect(() => { if (isDirty) setAutosaveState((s) => (s === 'saved' ? 'idle' : s)); }, [isDirty, draftSignal]);

  if (!draft) return null;

  const effectiveSlug = slugify(draft.slug || draft.title);
  const publicUrl = `${OFFICIAL_ARTICLE_BASE}/${effectiveSlug}`;

  // 📤 公開/更新: status を published にして保存。完了ダイアログで公開先へ遷移できる。
  const handlePublish = async () => {
    if (publishing) return;
    if (!draft.title.trim()) { onToast?.('タイトルを入力してください', 'info'); return; }
    const prevStatus = draft.status;
    setPublishing(true);
    updateDraft({ status: 'published' });
    try {
      const ok = await save(author);
      if (ok) {
        // 保存後の正規化済み slug（refresh 済みの一覧から取得。無ければローカル正規化）
        const st = useOfficialBlogStore.getState();
        const saved = st.articles.find((a) => a.id === st.draft?.id);
        setPublishedInfo({ url: `${OFFICIAL_ARTICLE_BASE}/${saved?.slug || effectiveSlug}` });
      } else {
        updateDraft({ status: prevStatus });
        onToast?.('公開に失敗しました', 'error');
      }
    } finally {
      setPublishing(false);
    }
  };

  // 🔒 非公開に戻す（下書きへ）
  const handleUnpublish = async () => {
    if (publishing) return;
    setPublishing(true);
    updateDraft({ status: 'draft' });
    try {
      const ok = await save(author);
      if (ok) onToast?.('非公開（下書き）に戻しました', 'success');
      else { updateDraft({ status: 'published' }); onToast?.('非公開への変更に失敗しました', 'error'); }
    } finally {
      setPublishing(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!draft.tags.includes(t)) updateDraft({ tags: [...draft.tags, t] });
    setTagInput('');
  };

  const isPublished = draft.status === 'published';

  return (
    <Box sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* ツールバー（狭い幅では折り返さず横スクロール。DsbEditor と同基準） */}
      <Box sx={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1.5 },
        px: { xs: 1.5, md: 3 }, py: 1.5,
        bgcolor: 'rgba(20,22,27,0.92)', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden',
        '& > *': { flexShrink: 0 },
        '& .MuiButton-root': { whiteSpace: 'nowrap' },
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': { background: 'rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: 3 },
      }}>
        <Button
          onClick={() => { if (isDirty) void save(author); cancelEdit(); }}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', minWidth: 'auto' }}>
          一覧へ
        </Button>
        <Chip label="公式ブログ" size="small" sx={{ height: 22, fontWeight: 700, fontSize: '0.68rem', color: ACCENT, bgcolor: `${ACCENT}1f`, border: `1px solid ${ACCENT}55` }} />
        <Box sx={{ flex: 1 }} />

        {/* 公式固有ワークフロー（未公開時のみ）: 下書き → 🎤取材待ち → 🤖レビュー */}
        {!isPublished && (
          <ToggleButtonGroup
            size="small" exclusive value={draft.status}
            onChange={(_e, v: OfficialStatus | null) => v && updateDraft({ status: v })}
            sx={{ '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', textTransform: 'none', fontSize: 12, px: 1.25, whiteSpace: 'nowrap' },
              '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT}55 !important` } }}>
            <ToggleButton value="draft">下書き</ToggleButton>
            <ToggleButton value="interview">🎤 取材待ち</ToggleButton>
            <ToggleButton value="review">🤖 レビュー</ToggleButton>
          </ToggleButtonGroup>
        )}

        {/* 💾 自動保存インジケータ */}
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

        {/* 📤 公開: 未公開→「公開する」/ 公開中→バッジ + 公開ページ + 非公開 + 更新 */}
        {isPublished ? (
          <>
            <Chip icon={<PublicRoundedIcon sx={{ fontSize: '15px !important' }} />} label="公開中" size="small"
              sx={{ height: 26, fontWeight: 800, fontSize: 11.5, bgcolor: 'rgba(129,199,132,0.16)', color: 'light-dark(#2e7d32, #a5d6a7)',
                border: '1px solid rgba(129,199,132,0.5)', '& .MuiChip-icon': { color: 'light-dark(#2e7d32, #a5d6a7)' } }} />
            <Tooltip title={`公開ページをブラウザで開く\n${publicUrl}`}>
              <Button size="small" startIcon={<OpenInNewRoundedIcon sx={{ fontSize: '14px !important' }} />}
                onClick={() => void openExternalUrl(publicUrl)}
                sx={{ color: 'light-dark(#095fa5, #90caf9)', textTransform: 'none', fontSize: 12,
                  '&:hover': { bgcolor: 'rgba(100,181,246,0.08)' } }}>
                公開ページ
              </Button>
            </Tooltip>
            <Button size="small" disabled={publishing} onClick={() => void handleUnpublish()}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', textTransform: 'none', fontSize: 12, '&:hover': { color: '#ef9a9a' } }}>
              非公開にする
            </Button>
            <Button onClick={() => void handlePublish()} disabled={publishing || !draft.title.trim()}
              variant="contained" startIcon={publishing ? <CircularProgress size={14} sx={{ color: '#001018' }} /> : <PublicRoundedIcon />}
              sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#0ea5e9' } }}>
              {publishing ? '更新中…' : '更新'}
            </Button>
          </>
        ) : (
          <Button onClick={() => void handlePublish()} disabled={publishing || !draft.title.trim()}
            variant="contained" startIcon={publishing ? <CircularProgress size={14} sx={{ color: '#001018' }} /> : <PublicRoundedIcon />}
            sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#0ea5e9' } }}>
            {publishing ? '公開中…' : '公開する'}
          </Button>
        )}
      </Box>

      {/* 本文 ＋ 右設定 */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', px: 4, py: 3, gap: 2, overflow: 'hidden' }}>
          <TextField
            value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="タイトルを入力" variant="standard" fullWidth InputProps={{ disableUnderline: true }}
            sx={{ flexShrink: 0, '& .MuiInputBase-input': { color: 'var(--brand-fg)', fontSize: 28, fontWeight: 700, lineHeight: 1.3, '&::placeholder': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', opacity: 1 } } }}
          />
          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0 }} />
          {draft.contentFormat === 'markdown' ? (
            // 旧 Markdown 記事はプレーンテキストで編集（HTML変換で壊さない）。
            <TextField
              value={draft.body} onChange={(e) => updateDraft({ body: e.target.value })}
              multiline minRows={18} fullWidth placeholder="本文（Markdown・旧互換）"
              sx={{ ...fieldSx, '& .MuiOutlinedInput-root': { ...fieldSx['& .MuiOutlinedInput-root'], fontFamily: 'monospace', color: '#a3e635', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))' } }}
            />
          ) : (
            <OfficialBodyEditor value={draft.body} onChange={(html) => updateDraft({ body: html, contentFormat: 'html' })} />
          )}
        </Box>

        {/* 右：公開設定 */}
        <Box sx={{ width: 340, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'light-dark(rgba(255,255,255,0.55), rgba(10,15,25,0.4))', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, px: 2.25, py: 2.5 }}>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>公開設定</Typography>

          {/* 🔍 SEO対策（共通SeoPanel）。提案は seoTitle/seoDescription へ適用（記事タイトルは上書きしない） */}
          <SeoPanel
            accent={ACCENT}
            slugPrefix="/articles/"
            metaTitleLabel="SEOタイトル案"
            fields={{
              title: draft.title || '',
              seoTitle: draft.seoTitle || '',
              slug: draft.slug || effectiveSlug,
              description: draft.seoDescription || draft.excerpt || '',
              tags: draft.tags || [],
              coverUrl: draft.coverUrl,
              body: draft.body || '',
              bodyIsHtml: draft.contentFormat !== 'markdown',
              category: draft.categoryName,
              brand: true, // 公式は製品リンク・CTAの集客チェックも採点
            }}
            onApply={(p) => {
              const patch: any = {};
              if (p.slug) patch.slug = p.slug;
              if (p.metaTitle) patch.seoTitle = p.metaTitle;
              if (p.metaDescription) {
                patch.seoDescription = p.metaDescription;
                if (!draft.excerpt.trim()) patch.excerpt = p.metaDescription;
              }
              if (p.tags) patch.tags = p.tags;
              updateDraft(patch);
            }}
            onToast={onToast}
          />

          <TextField
            label="スラッグ (URL)" value={draft.slug} onChange={(e) => updateDraft({ slug: e.target.value })}
            placeholder={slugify(draft.title) || 'my-first-post'} fullWidth size="small" sx={fieldSx}
            InputProps={{ startAdornment: <InputAdornment position="start" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '& p': { fontSize: 13 } }}>/articles/</InputAdornment> }}
          />

          <FormControlLabel
            sx={{ ml: 0 }}
            control={<Switch checked={draft.featured} onChange={(e) => updateDraft({ featured: e.target.checked })} sx={{ '& .Mui-checked': { color: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }} />}
            label={<Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>おすすめ記事に設定</Typography>}
          />

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>カテゴリ・タグ</Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField label="カテゴリ名" value={draft.categoryName} onChange={(e) => updateDraft({ categoryName: e.target.value })} fullWidth size="small" sx={fieldSx} />
            <TextField label="スラッグ" value={draft.categorySlug} onChange={(e) => updateDraft({ categorySlug: e.target.value })} placeholder={slugify(draft.categoryName)} fullWidth size="small" sx={fieldSx} />
          </Box>

          <Box>
            <TextField
              label="タグを追加（Enter）" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              fullWidth size="small" sx={fieldSx}
            />
            {draft.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                {draft.tags.map((t) => (
                  <Chip key={t} label={t} size="small" onDelete={() => updateDraft({ tags: draft.tags.filter((x) => x !== t) })}
                    sx={{ bgcolor: `${ACCENT}33`, color: 'var(--brand-fg)', '& .MuiChip-deleteIcon': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' } }} />
                ))}
              </Box>
            )}
          </Box>

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>メディア & SEO</Typography>

          <TextField label="カバー画像 URL" value={draft.coverUrl} onChange={(e) => updateDraft({ coverUrl: e.target.value })} fullWidth size="small" sx={fieldSx} />
          {draft.coverUrl && (
            <Box sx={{ width: '100%', height: 120, backgroundImage: `url(${draft.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }} />
          )}
          <TextField label="抜粋 (meta description / OGP)" value={draft.excerpt} onChange={(e) => updateDraft({ excerpt: e.target.value })} fullWidth multiline minRows={3} size="small" sx={fieldSx} />
          <TextField label="SEO タイトル (任意)" value={draft.seoTitle} onChange={(e) => updateDraft({ seoTitle: e.target.value })} fullWidth size="small" sx={fieldSx} />
          <TextField label="SEO ディスクリプション (任意)" value={draft.seoDescription} onChange={(e) => updateDraft({ seoDescription: e.target.value })} fullWidth multiline rows={2} size="small" sx={fieldSx} />

          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.6, mt: 'auto' }}>
            ※ AI記者の取材・図解/AI画像の挿入・仕上げは Content Strategy（後続フェーズ）で連携します。
          </Typography>
        </Box>
      </Box>

      {/* 🎉 公開完了ダイアログ */}
      <Dialog open={!!publishedInfo} onClose={() => setPublishedInfo(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
        <DialogContent sx={{ pt: 3, pb: 2, textAlign: 'center' }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 46, color: '#81c784', mb: 1 }} />
          <Typography sx={{ fontSize: 17, fontWeight: 800, mb: 0.75 }}>公開しました</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)', lineHeight: 1.7, mb: 2 }}>
            公式ブログ（sekkeiya.com/articles）に公開されました。<br />
            サイトマップ・Google向けレンダリングには自動で反映されます。
          </Typography>
          {publishedInfo?.url && (
            <Box onClick={() => publishedInfo && void openExternalUrl(publishedInfo.url)}
              sx={{ mt: 1, px: 1.5, py: 1, borderRadius: 1.5, cursor: 'pointer', textAlign: 'left',
                bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
                display: 'flex', alignItems: 'center', gap: 1, '&:hover': { borderColor: `${ACCENT}88` } }}>
              <OpenInNewRoundedIcon sx={{ fontSize: 16, color: ACCENT, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 11.5, color: 'light-dark(#095fa5, #90caf9)', wordBreak: 'break-all', lineHeight: 1.45 }}>
                {publishedInfo.url}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => { setPublishedInfo(null); cancelEdit(); }}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none' }}>
            記事一覧へ
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<OpenInNewRoundedIcon />}
            onClick={() => { if (publishedInfo?.url) void openExternalUrl(publishedInfo.url); setPublishedInfo(null); }}
            sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#0ea5e9' } }}>
            公開ページを開く
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
