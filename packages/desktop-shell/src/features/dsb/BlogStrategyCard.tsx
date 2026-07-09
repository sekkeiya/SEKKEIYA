/**
 * BlogStrategyCard — 「概要・分析・戦略」に置く運営戦略カード。
 * 保存済みの戦略（AIと議論して決めたもの）を表示し、「AIと戦略を決める / 見直す」で更新できる。
 * 決めた戦略は planBlogContent（AI投稿計画）が最優先の材料に使う。個人/公式で共用。
 */
import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Chip, CircularProgress } from '@mui/material';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import { BlogStrategyDialog } from './BlogStrategyDialog';
import { loadBlogStrategy, type BlogScope } from './api/blogStrategyApi';
import type { BlogStrategy } from './types';

interface BlogStrategyCardProps {
  scope: BlogScope;
  uid?: string;
  accent?: string;
}

export const BlogStrategyCard: React.FC<BlogStrategyCardProps> = ({ scope, uid, accent = '#ce93d8' }) => {
  const [strategy, setStrategy] = useState<BlogStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    void loadBlogStrategy(scope, uid).then((s) => { if (alive) { setStrategy(s); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid, scope]);

  return (
    <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: `color-mix(in srgb, ${accent} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: strategy ? 1 : 0 }}>
        <FlagRoundedIcon sx={{ color: accent, fontSize: 18 }} />
        <Typography sx={{ fontWeight: 800, color: 'var(--brand-fg)', fontSize: 14, flex: 1 }}>運営戦略・目標</Typography>
        <Button onClick={() => setOpen(true)} variant={strategy ? 'text' : 'outlined'} size="small"
          startIcon={<FlagRoundedIcon />}
          sx={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`, textTransform: 'none', fontWeight: 700,
            '&:hover': { borderColor: accent, bgcolor: `color-mix(in srgb, ${accent} 8%, transparent)` } }}>
          {strategy ? 'AIと見直す' : 'AIと戦略を決める'}
        </Button>
      </Box>

      {loading ? (
        <CircularProgress size={16} sx={{ color: accent }} />
      ) : strategy ? (
        <Box>
          <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.82)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{strategy.summary}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            {strategy.audience && <Chip label={`読者: ${strategy.audience}`} size="small" sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} />}
            {(strategy.focus || []).slice(0, 4).map((f) => (
              <Chip key={f} label={f} size="small" sx={{ height: 20, fontSize: 10.5, bgcolor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: 'var(--brand-fg)' }} />
            ))}
          </Box>
          {strategy.goals && (
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.75 }}>🎯 {strategy.goals}</Typography>
          )}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.7 }}>
          まだ戦略が未設定です。AIと数往復で「誰に何を届けたいか」を決めると、AI投稿計画がそれに沿って記事案を出します。
        </Typography>
      )}

      {uid && (
        <BlogStrategyDialog open={open} scope={scope} uid={uid} accent={accent}
          onClose={() => setOpen(false)} onSaved={setStrategy} />
      )}
    </Box>
  );
};
