/**
 * SeoPanel / BlogSeoPanel — 記事設定サイドバーのSEOセクション。
 *
 * SeoPanel = 汎用（アカウント/公式の両ブログから使う）:
 *   ①洗い出し: analyzeSeoFields() で各SEO要素（タイトル/スラッグ/メタ説明/タグ/カバー/見出し/alt）を
 *     採点し、チェックリストで「OK・要改善」を可視化する（詳細は開閉できる）。
 *   ②自動最適化: 「✨ SEOを自動最適化」でCFに提案（スラッグ/メタ説明/タグ/フォーカスキーワード/
 *     タイトル案）を作らせ、確認して個別/一括で適用する。適用先のマッピングは onApply で呼び出し側が決める
 *     （アカウント=title/excerpt へ、公式=seoTitle/seoDescription へ、など）。
 * BlogSeoPanel = アカウントブログ用の薄いラッパー（useDsbStore 直結・従来互換）。
 */
import React, { useMemo, useState } from 'react';
import { Box, Typography, Button, Chip, CircularProgress, Collapse } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import { useDsbStore } from './store/useDsbStore';
import {
  analyzeSeoFields, fetchSeoSuggestionsFor,
  type SeoFields, type SeoSuggestion, type SeoStatus,
} from './lib/blogSeo';

const GREEN = '#81c784';
const AMBER = '#ffb74d';

const statusColor = (s: SeoStatus) => (s === 'ok' ? GREEN : s === 'warn' ? AMBER : '#ef5350');
const StatusIcon: React.FC<{ s: SeoStatus }> = ({ s }) => {
  if (s === 'ok') return <CheckCircleRoundedIcon sx={{ fontSize: 14, color: GREEN }} />;
  if (s === 'warn') return <WarningAmberRoundedIcon sx={{ fontSize: 14, color: AMBER }} />;
  return <ErrorOutlineRoundedIcon sx={{ fontSize: 14, color: '#ef5350' }} />;
};

/** 提案から適用するパッチ。呼び出し側が自分のデータモデルへマッピングする。 */
export interface SeoApplyPatch {
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  /** 既存タグとマージ済みの最終配列 */
  tags?: string[];
}

export interface SeoPanelProps {
  fields: SeoFields;
  onApply: (patch: SeoApplyPatch) => void;
  onToast?: (msg: string, sev: 'success' | 'error' | 'info') => void;
  accent?: string;          // 既定 #e57373（アカウント）。公式は #38bdf8
  slugPrefix?: string;      // 既定 '/blog/'。公式は '/articles/'
  metaTitleLabel?: string;  // 既定 'タイトル案'。公式は 'SEOタイトル案'
}

export const SeoPanel: React.FC<SeoPanelProps> = ({
  fields, onApply, onToast, accent = '#e57373', slugPrefix = '/blog/', metaTitleLabel = 'タイトル案',
}) => {
  const [checksOpen, setChecksOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sug, setSug] = useState<SeoSuggestion | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  const fieldsKey = JSON.stringify(fields);
  const { checks, score, total } = useMemo(
    () => analyzeSeoFields(fields),
    [fieldsKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const scoreColor = score === total ? GREEN : score >= total - 1 ? AMBER : '#ef5350';

  const runAuto = async () => {
    if (loading) return;
    if (!fields.title.trim() && !fields.body.trim()) {
      onToast?.('先にタイトルか本文を用意してください', 'info');
      return;
    }
    setLoading(true);
    setApplied({});
    try {
      setSug(await fetchSeoSuggestionsFor({
        title: fields.seoTitle || fields.title,
        body: fields.body,
        bodyIsHtml: fields.bodyIsHtml,
        excerpt: fields.description,
        category: fields.category,
      }));
    } catch (e: any) {
      onToast?.(e.message || 'SEO提案の取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  const markApplied = (k: string) => setApplied((p) => ({ ...p, [k]: true }));
  const mergedTags = () => [...new Set([...(fields.tags || []), ...(sug?.tags || [])])].slice(0, 8);
  const applySlug = () => { if (sug?.slug) { onApply({ slug: sug.slug }); markApplied('slug'); } };
  const applyTitle = () => { if (sug?.metaTitle) { onApply({ metaTitle: sug.metaTitle }); markApplied('title'); } };
  const applyDesc = () => { if (sug?.metaDescription) { onApply({ metaDescription: sug.metaDescription }); markApplied('desc'); } };
  const applyTags = () => { if (sug?.tags?.length) { onApply({ tags: mergedTags() }); markApplied('tags'); } };
  const applyAll = () => {
    if (!sug) return;
    const patch: SeoApplyPatch = {};
    if (sug.slug) patch.slug = sug.slug;
    if (sug.metaTitle) patch.metaTitle = sug.metaTitle;
    if (sug.metaDescription) patch.metaDescription = sug.metaDescription;
    if (sug.tags.length) patch.tags = mergedTags();
    onApply(patch);
    setApplied({ slug: true, title: true, desc: true, tags: true });
    onToast?.('SEO提案を反映しました。内容を確認してください', 'success');
  };

  // 提案1項目（提案値、適用ボタン）
  const Proposal: React.FC<{ k: string; label: string; value: string; onApplyOne: () => void; mono?: boolean }> = ({ k, label, value, onApplyOne, mono }) => {
    if (!value) return null;
    const done = applied[k];
    return (
      <Box sx={{ px: 1, py: 0.85, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.5)', letterSpacing: 0.3, flex: 1 }}>{label}</Typography>
          <Button size="small" disabled={done} onClick={onApplyOne}
            sx={{ minWidth: 0, px: 0.85, py: 0, fontSize: 10, fontWeight: 700, textTransform: 'none',
              color: done ? GREEN : accent, '&.Mui-disabled': { color: GREEN } }}>
            {done ? '✓ 反映済み' : '反映'}
          </Button>
        </Box>
        <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.85)', lineHeight: 1.5,
          ...(mono ? { fontFamily: 'monospace', wordBreak: 'break-all' } : {}) }}>
          {value}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2, p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* ヘッダー: タイトル + スコア */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
        <TravelExploreRoundedIcon sx={{ fontSize: 16, color: scoreColor }} />
        <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand-fg)', flex: 1 }}>SEO対策</Typography>
        <Chip label={`${score}/${total}`} size="small"
          sx={{ height: 17, fontSize: 10, fontWeight: 800, bgcolor: `${scoreColor}22`, color: scoreColor, border: `1px solid ${scoreColor}66` }} />
      </Box>

      {/* 主アクション: 自動最適化（常時表示） */}
      <Button fullWidth size="small" variant="contained" disabled={loading} onClick={() => void runAuto()}
        startIcon={loading ? <CircularProgress size={12} sx={{ color: '#000' }} /> : <AutoFixHighRoundedIcon sx={{ fontSize: 15 }} />}
        sx={{ bgcolor: accent, color: '#000', textTransform: 'none', fontSize: 11.5, fontWeight: 700, py: 0.5, borderRadius: 1.5,
          '&:hover': { opacity: 0.85, bgcolor: accent }, '&.Mui-disabled': { bgcolor: `${accent}55`, color: 'rgba(0,0,0,0.5)' } }}>
        {loading ? 'SEOを分析中…' : sug ? '✨ もう一度提案' : '✨ SEOを自動最適化'}
      </Button>

      {/* 提案 */}
      {sug && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
          {sug.focusKeyword && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>フォーカスKW</Typography>
              <Chip label={sug.focusKeyword} size="small"
                sx={{ height: 19, fontSize: 10.5, fontWeight: 700, bgcolor: `${accent}22`, color: 'var(--brand-fg)', border: `1px solid ${accent}55` }} />
            </Box>
          )}
          <Proposal k="slug" label="スラッグ (URL)" value={sug.slug ? `${slugPrefix}${sug.slug}` : ''} onApplyOne={applySlug} mono />
          <Proposal k="title" label={metaTitleLabel} value={sug.metaTitle} onApplyOne={applyTitle} />
          <Proposal k="desc" label="メタディスクリプション" value={sug.metaDescription} onApplyOne={applyDesc} />
          {sug.tags.length > 0 && (
            <Box sx={{ px: 1, py: 0.85, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.5)', letterSpacing: 0.3, flex: 1 }}>タグ（キーワード）</Typography>
                <Button size="small" disabled={applied.tags} onClick={applyTags}
                  sx={{ minWidth: 0, px: 0.85, py: 0, fontSize: 10, fontWeight: 700, textTransform: 'none',
                    color: applied.tags ? GREEN : accent, '&.Mui-disabled': { color: GREEN } }}>
                  {applied.tags ? '✓ 反映済み' : '反映'}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                {sug.tags.map((t) => (
                  <Chip key={t} label={t} size="small"
                    sx={{ height: 19, fontSize: 10, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', color: 'rgb(var(--brand-fg-rgb) / 0.8)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)' }} />
                ))}
              </Box>
            </Box>
          )}
          {sug.notes && (
            <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.6 }}>💡 {sug.notes}</Typography>
          )}
          <Button fullWidth size="small" variant="outlined" onClick={applyAll}
            sx={{ color: accent, borderColor: `${accent}66`, textTransform: 'none', fontSize: 11, fontWeight: 700, py: 0.35, borderRadius: 1.5,
              '&:hover': { borderColor: accent, bgcolor: `${accent}0f` } }}>
            すべて反映
          </Button>
        </Box>
      )}

      {/* チェックリスト（洗い出し。開閉可・既定は開） */}
      <Box onClick={() => setChecksOpen((v) => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', mt: 0.25,
          '&:hover .seo-toggle': { color: 'var(--brand-fg)' } }}>
        <Typography className="seo-toggle" sx={{ fontSize: 10.5, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.5)', flex: 1 }}>
          チェックリスト（{score}/{total} 達成）
        </Typography>
        <ExpandMoreRoundedIcon className="seo-toggle" sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)', transform: checksOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </Box>
      <Collapse in={checksOpen}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {checks.map((c) => (
            <Box key={c.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.6 }}>
              <Box sx={{ mt: '1px' }}><StatusIcon s={c.status} /></Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1.3 }}>{c.label}</Typography>
                <Typography sx={{ fontSize: 10, color: statusColor(c.status), opacity: 0.9, lineHeight: 1.4 }}>{c.detail}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

/** アカウントブログ用ラッパー（useDsbStore 直結・従来互換）。 */
interface BlogSeoPanelProps {
  onToast?: (msg: string, sev: 'success' | 'error' | 'info') => void;
}

export const BlogSeoPanel: React.FC<BlogSeoPanelProps> = ({ onToast }) => {
  const { draft, updateDraft } = useDsbStore();
  if (!draft) return null;
  return (
    <SeoPanel
      fields={{
        title: draft.title || '',
        slug: draft.slug || '',
        description: draft.excerpt || '',
        tags: draft.tags || [],
        coverUrl: draft.coverUrl,
        body: draft.bodyMarkdown || '',
        category: draft.category,
      }}
      onApply={(p) => {
        const patch: any = {};
        if (p.slug) patch.slug = p.slug;
        if (p.metaTitle) patch.title = p.metaTitle;          // アカウントは記事タイトル自体を最適化
        if (p.metaDescription) patch.excerpt = p.metaDescription;
        if (p.tags) patch.tags = p.tags;
        updateDraft(patch);
      }}
      onToast={onToast}
    />
  );
};
