/**
 * StrategyRoadmapBoard — 運営戦略・目標を「ボード」で一目で把握するメイン表示。
 * 保存済みの BlogStrategy（右サイドバーのチャットでAIと決めたもの）を、
 * 複数のビューで切り替えて多角的に見る:
 *  - ロードマップ: 誰に → 何を（柱）→ どうなりたい（ゴール）の方向性フロー
 *  - コンテンツの柱: 重視テーマをピラーカードで
 *  - キャンバス: 読者/ゴール/トーン/要約/テーマを一覧するストラテジーキャンバス
 */
import React, { useState } from 'react';
import { Box, Typography, Chip, ToggleButton, ToggleButtonGroup, CircularProgress } from '@mui/material';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import SouthRoundedIcon from '@mui/icons-material/SouthRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import type { BlogStrategy } from './types';

type BoardView = 'roadmap' | 'pillars' | 'canvas';

interface StrategyRoadmapBoardProps {
  strategy: BlogStrategy | null;
  loading?: boolean;
  accent?: string;
}

const Card: React.FC<{ icon?: React.ReactNode; label: string; accent: string; children: React.ReactNode; sx?: any }> = ({ icon, label, accent, children, sx }) => (
  <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', display: 'flex', flexDirection: 'column', ...sx }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
      <Box sx={{ color: accent, display: 'flex', '& svg': { fontSize: 17 } }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '.04em', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{label}</Typography>
    </Box>
    {children}
  </Box>
);

export const StrategyRoadmapBoard: React.FC<StrategyRoadmapBoardProps> = ({ strategy, loading, accent = '#c084fc' }) => {
  const [view, setView] = useState<BoardView>('roadmap');

  const focus = strategy?.focus?.filter(Boolean) ?? [];

  const switcher = (
    <ToggleButtonGroup value={view} exclusive size="small" onChange={(_, v) => v && setView(v)}
      sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.12)', px: 1.5, gap: 0.5 },
        '& .Mui-selected': { color: `${accent} !important`, bgcolor: `color-mix(in srgb, ${accent} 12%, transparent) !important`, borderColor: `color-mix(in srgb, ${accent} 40%, transparent) !important` } }}>
      <ToggleButton value="roadmap"><RouteRoundedIcon sx={{ fontSize: 16 }} />ロードマップ</ToggleButton>
      <ToggleButton value="pillars"><ViewColumnRoundedIcon sx={{ fontSize: 16 }} />コンテンツの柱</ToggleButton>
      <ToggleButton value="canvas"><DashboardRoundedIcon sx={{ fontSize: 16 }} />キャンバス</ToggleButton>
    </ToggleButtonGroup>
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: accent }} /></Box>;
  }

  if (!strategy) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>{switcher}</Box>
        <Box sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: `1px dashed color-mix(in srgb, ${accent} 35%, transparent)`, bgcolor: `color-mix(in srgb, ${accent} 4%, transparent)` }}>
          <FlagRoundedIcon sx={{ color: accent, fontSize: 34, mb: 1 }} />
          <Typography sx={{ fontWeight: 800, color: 'var(--brand-fg)', mb: 0.5 }}>まだ運営戦略が未設定です</Typography>
          <Typography sx={{ fontSize: '0.84rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.7, maxWidth: 460, mx: 'auto' }}>
            右のチャットでAIと「誰に・何を・どう届けたいか」を数往復で話すと、方向性がここにロードマップとして描かれます。
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* ビュー切替 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {switcher}
        {strategy.updatedAt && (
          <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
            更新: {(() => { try { return new Date(strategy.updatedAt).toLocaleDateString('ja-JP', { year: '2-digit', month: 'numeric', day: 'numeric' }); } catch { return ''; } })()}
          </Typography>
        )}
      </Box>

      {/* 要約バンド（全ビュー共通の見出し） */}
      <Box sx={{ p: 2.25, borderRadius: 3, mb: 2.5, bgcolor: `color-mix(in srgb, ${accent} 7%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 26%, transparent)` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <FlagRoundedIcon sx={{ color: accent, fontSize: 18 }} />
          <Typography sx={{ fontWeight: 800, color: 'var(--brand-fg)', fontSize: '0.9rem' }}>運営戦略</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.9rem', color: 'rgb(var(--brand-fg-rgb) / 0.85)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{strategy.summary}</Typography>
      </Box>

      {/* ── ロードマップ ── 誰に → 何を（柱）→ どうなりたい */}
      {view === 'roadmap' && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'stretch', gap: 1.5 }}>
          <Card icon={<PeopleAltRoundedIcon />} label="誰に（読者）" accent={accent} sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.9rem', color: 'var(--brand-fg)', fontWeight: 700, lineHeight: 1.6 }}>{strategy.audience || '—'}</Typography>
          </Card>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: `color-mix(in srgb, ${accent} 65%, transparent)` }}>
            <EastRoundedIcon sx={{ display: { xs: 'none', md: 'block' } }} />
            <SouthRoundedIcon sx={{ display: { xs: 'block', md: 'none' } }} />
          </Box>
          <Card icon={<CategoryRoundedIcon />} label="何を（コンテンツの柱）" accent={accent} sx={{ flex: 1.4 }}>
            {focus.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {focus.map((f) => <Chip key={f} label={f} size="small" sx={{ fontWeight: 700, bgcolor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: 'var(--brand-fg)', border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)` }} />)}
              </Box>
            ) : <Typography sx={{ fontSize: '0.85rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>—</Typography>}
          </Card>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: `color-mix(in srgb, ${accent} 65%, transparent)` }}>
            <EastRoundedIcon sx={{ display: { xs: 'none', md: 'block' } }} />
            <SouthRoundedIcon sx={{ display: { xs: 'block', md: 'none' } }} />
          </Box>
          <Card icon={<FlagRoundedIcon />} label="どうなりたい（ゴール）" accent={accent} sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.9rem', color: 'var(--brand-fg)', fontWeight: 700, lineHeight: 1.6 }}>{strategy.goals || '—'}</Typography>
          </Card>
        </Box>
      )}

      {/* ── コンテンツの柱 ── */}
      {view === 'pillars' && (
        focus.length ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
            {focus.map((f, i) => (
              <Box key={f} sx={{ p: 2, borderRadius: 2.5, minHeight: 96, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                bgcolor: `color-mix(in srgb, ${accent} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 26%, transparent)` }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: `color-mix(in srgb, ${accent} 70%, var(--brand-fg))` }}>柱 {String(i + 1).padStart(2, '0')}</Typography>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--brand-fg)', lineHeight: 1.4 }}>{f}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography sx={{ fontSize: '0.85rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', py: 3, textAlign: 'center' }}>重視テーマ（柱）が未設定です。チャットで「重点テーマ」を話すとここに並びます。</Typography>
        )
      )}

      {/* ── キャンバス ── */}
      {view === 'canvas' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Card icon={<PeopleAltRoundedIcon />} label="読者" accent={accent}>
            <Typography sx={{ fontSize: '0.88rem', color: 'var(--brand-fg)', lineHeight: 1.7 }}>{strategy.audience || '—'}</Typography>
          </Card>
          <Card icon={<FlagRoundedIcon />} label="ゴール" accent={accent}>
            <Typography sx={{ fontSize: '0.88rem', color: 'var(--brand-fg)', lineHeight: 1.7 }}>{strategy.goals || '—'}</Typography>
          </Card>
          <Card icon={<CategoryRoundedIcon />} label="コンテンツの柱" accent={accent} sx={{ gridColumn: { sm: '1 / -1' } }}>
            {focus.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {focus.map((f) => <Chip key={f} label={f} size="small" sx={{ fontWeight: 700, bgcolor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: 'var(--brand-fg)' }} />)}
              </Box>
            ) : <Typography sx={{ fontSize: '0.85rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>—</Typography>}
          </Card>
          <Card icon={<RecordVoiceOverRoundedIcon />} label="トーン・文体" accent={accent} sx={{ gridColumn: { sm: '1 / -1' } }}>
            <Typography sx={{ fontSize: '0.88rem', color: 'var(--brand-fg)', lineHeight: 1.7 }}>{strategy.tone || '—'}</Typography>
          </Card>
        </Box>
      )}
    </Box>
  );
};
