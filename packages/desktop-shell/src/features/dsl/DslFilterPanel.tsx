import React from 'react';
import { Box, Typography, Chip, Divider, Button } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useDslFilterStore } from './store/useDslFilterStore';
import type { DslPlanType, DslQuality, DslSortBy } from './store/useDslFilterStore';

const PLAN_TYPE_OPTIONS: { value: DslPlanType; label: string; color: string }[] = [
  { value: 'base', label: 'Base', color: '#34d399' },
  { value: 'plan', label: 'Plan', color: '#00BFFF' },
  { value: 'option', label: 'Option', color: 'light-dark(#a10d5a, #f472b6)' },
];

const QUALITY_OPTIONS: { value: DslQuality; label: string; color: string }[] = [
  { value: 'cycles', label: 'Cycles', color: 'light-dark(#2f07a6, #a78bfa)' },
  { value: 'standard', label: '標準', color: 'light-dark(#0020ad, #6c87ff)' },
];

const SORT_OPTIONS: { value: DslSortBy; label: string }[] = [
  { value: 'newest', label: '新しい順' },
  { value: 'oldest', label: '古い順' },
  { value: 'name', label: '名前順' },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography
    sx={{
      fontSize: 10,
      fontWeight: 700,
      color: 'rgb(var(--slate-ink-rgb) / 0.75)',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      mb: 1,
    }}
  >
    {children}
  </Typography>
);

export const DslFilterPanel: React.FC = () => {
  const { contentTab, planTypes, qualities, sortBy, togglePlanType, toggleQuality, setSortBy, reset } =
    useDslFilterStore();

  const hasFilters = planTypes.length > 0 || qualities.length > 0 || sortBy !== 'newest';
  // 種別の切り替えは ALL/Base/Plan/Option タブが担い、画像・動画は S.Image へ集約したため、
  // フィルタパネルでは PLAN TYPE / QUALITY を出さず Sort のみを表示する。
  void contentTab;
  const showPlanType = false;
  const showQuality = false;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'light-dark(rgba(31,41,55,0.9), rgba(229,231,235,0.9))' }}>
          Search & Filter
        </Typography>
        {hasFilters && (
          <Button
            size="small"
            onClick={reset}
            sx={{
              fontSize: 11,
              textTransform: 'none',
              color: 'rgb(var(--slate-ink-rgb) / 0.65)',
              minWidth: 0,
              px: 1,
              py: 0.25,
              '&:hover': { color: 'var(--brand-fg)' },
            }}
          >
            Reset
          </Button>
        )}
      </Box>

      {/* Filter body */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 1.75,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { background: 'rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2 },
        }}
      >
        {/* Sort */}
        <Box>
          <SectionLabel>SORT</SectionLabel>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            {SORT_OPTIONS.map((opt) => (
              <Box
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                sx={{
                  px: 1.25,
                  py: 0.65,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  background: sortBy === opt.value ? alpha('#00BFFF', 0.14) : 'transparent',
                  border: `1px solid ${sortBy === opt.value ? alpha('#00BFFF', 0.38) : 'transparent'}`,
                  transition: 'background 0.15s, border-color 0.15s',
                  '&:hover': { background: sortBy === opt.value ? alpha('#00BFFF', 0.18) : alpha('#fff', 0.05) },
                }}
              >
                <Typography
                  sx={{
                    fontSize: 12,
                    color: sortBy === opt.value ? '#00BFFF' : 'light-dark(rgba(31,41,55,0.65), rgba(229,231,235,0.65))',
                    fontWeight: sortBy === opt.value ? 700 : 400,
                  }}
                >
                  {opt.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.06)' }} />

        {/* Plan Type */}
        {showPlanType && (
          <Box>
            <SectionLabel>PLAN TYPE</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {PLAN_TYPE_OPTIONS.map((opt) => {
                const active = planTypes.includes(opt.value);
                return (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    size="small"
                    onClick={() => togglePlanType(opt.value)}
                    sx={{
                      height: 24,
                      fontSize: 11,
                      fontWeight: 700,
                      border: `1px solid ${active ? opt.color : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
                      background: active ? `color-mix(in srgb, ${opt.color} 18%, transparent)` : 'transparent',
                      color: active ? opt.color : 'light-dark(rgba(31,41,55,0.6), rgba(229,231,235,0.6))',
                      cursor: 'pointer',
                      '& .MuiChip-label': { px: 1 },
                      '&:hover': { background: active ? `color-mix(in srgb, ${opt.color} 28%, transparent)` : alpha('#fff', 0.06) },
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {/* Quality */}
        {showQuality && (
          <Box>
            <SectionLabel>QUALITY</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {QUALITY_OPTIONS.map((opt) => {
                const active = qualities.includes(opt.value);
                return (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    size="small"
                    onClick={() => toggleQuality(opt.value)}
                    sx={{
                      height: 24,
                      fontSize: 11,
                      fontWeight: 700,
                      border: `1px solid ${active ? opt.color : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
                      background: active ? `color-mix(in srgb, ${opt.color} 18%, transparent)` : 'transparent',
                      color: active ? opt.color : 'light-dark(rgba(31,41,55,0.6), rgba(229,231,235,0.6))',
                      cursor: 'pointer',
                      '& .MuiChip-label': { px: 1 },
                      '&:hover': { background: active ? `color-mix(in srgb, ${opt.color} 28%, transparent)` : alpha('#fff', 0.06) },
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
