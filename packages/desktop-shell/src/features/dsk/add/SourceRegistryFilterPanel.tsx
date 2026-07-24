// おすすめソース（レジストリ）の右サイドバー絞り込みパネル。
// 種類/状態/追加状況/並び替え/検索を操作し、メインの SourceRegistryList に反映する。
// 仕様: docs/16_sekkeiya_search_spec.md

import React from 'react';
import { Box, Typography, TextField, InputAdornment } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import {
  SOURCE_SECTIONS, ALL_SOURCE_ENTRIES, KIND_COLOR, STATUS_LABEL, entryStatus,
  DEFAULT_REGISTRY_FILTER, type SourceKind, type SourceStatus, type RegistrySort, type RegistryFilter,
} from '../data/sourceRegistry';
import { useDskStore } from '../store/useDskStore';

const normUrl = (u?: string | null) => (u || '').trim().toLowerCase().replace(/\/+$/, '');

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase', mb: 0.75, mt: 2 }}>
    {children}
  </Typography>
);

const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void; color?: string; count?: number }> =
  ({ label, active, onClick, color = '#7dd3fc', count }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 10, cursor: 'pointer',
      border: '1px solid', borderColor: active ? `color-mix(in srgb, ${color} 50%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.12)',
      bgcolor: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent', transition: 'all 0.15s',
      '&:hover': { bgcolor: active ? `color-mix(in srgb, ${color} 20%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.06)' },
    }}
  >
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: active ? color : 'rgb(var(--brand-fg-rgb) / 0.55)' }}>{label}</Typography>
    {count != null && <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>{count}</Typography>}
  </Box>
);

export const SourceRegistryFilterPanel: React.FC<{ filter: RegistryFilter; onChange: (f: RegistryFilter) => void }> =
  ({ filter, onChange }) => {
  const entries = useDskStore((s) => s.entries);
  const addedUrls = new Set(entries.filter((e) => e.kind === 'url').map((e) => normUrl(e.sourceUrl)));

  const kindCount = (k: SourceKind) => ALL_SOURCE_ENTRIES.filter((e) =>
    SOURCE_SECTIONS.find((s) => s.kind === k)?.groups.some((g) => g.entries.some((x) => x.id === e.id))).length;
  const statusCount = (st: SourceStatus) => ALL_SOURCE_ENTRIES.filter((e) => entryStatus(e) === st).length;
  const addedCount = ALL_SOURCE_ENTRIES.filter((e) => addedUrls.has(normUrl(e.url))).length;

  // 単一選択：選ぶと前の選択を解除。アクティブな同じものを再クリックで解除（=すべて）。
  const toggleKind = (k: SourceKind) =>
    onChange({ ...filter, kinds: filter.kinds.length === 1 && filter.kinds[0] === k ? [] : [k] });
  const toggleStatus = (st: SourceStatus) =>
    onChange({ ...filter, statuses: filter.statuses.length === 1 && filter.statuses[0] === st ? [] : [st] });

  const isDefault = JSON.stringify(filter) === JSON.stringify(DEFAULT_REGISTRY_FILTER);

  const ADDED: { key: RegistryFilter['added']; label: string }[] = [
    { key: 'all', label: 'すべて' }, { key: 'notAdded', label: '未追加' }, { key: 'added', label: '追加済み' },
  ];
  const SORTS: { key: RegistrySort; label: string }[] = [
    { key: 'default', label: '既定' }, { key: 'name', label: '名前' }, { key: 'status', label: '状態' },
  ];

  return (
    <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FilterAltRoundedIcon sx={{ fontSize: 16, color: 'light-dark(#0474a9, #7dd3fc)' }} />
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-fg)', flex: 1 }}>絞り込み</Typography>
        {!isDefault && (
          <Box onClick={() => onChange({ ...DEFAULT_REGISTRY_FILTER })}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}>
            <RestartAltRoundedIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 10.5 }}>リセット</Typography>
          </Box>
        )}
      </Box>

      <TextField
        fullWidth size="small" placeholder="サイト・ジャンルで検索"
        value={filter.search}
        onChange={(e) => onChange({ ...filter, search: e.target.value })}
        sx={{ mt: 1.5, '& .MuiOutlinedInput-root': { fontSize: 12.5, color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.12)' } } }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} /></InputAdornment> }}
      />

      <SectionTitle>種類</SectionTitle>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {SOURCE_SECTIONS.map((s) => (
          <Toggle key={s.kind} label={s.label} color={KIND_COLOR[s.kind]} count={kindCount(s.kind)}
            active={filter.kinds.includes(s.kind)} onClick={() => toggleKind(s.kind)} />
        ))}
      </Box>

      <SectionTitle>状態</SectionTitle>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {(['verified', 'experimental', 'reference'] as SourceStatus[]).map((st) => (
          <Toggle key={st} label={STATUS_LABEL[st]} count={statusCount(st)}
            active={filter.statuses.includes(st)} onClick={() => toggleStatus(st)} />
        ))}
      </Box>

      <SectionTitle>追加状況（索引済み {addedCount}）</SectionTitle>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {ADDED.map((a) => (
          <Toggle key={a.key} label={a.label} active={filter.added === a.key} onClick={() => onChange({ ...filter, added: a.key })} />
        ))}
      </Box>

      <SectionTitle>並び替え</SectionTitle>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {SORTS.map((s) => (
          <Toggle key={s.key} label={s.label} active={filter.sort === s.key} onClick={() => onChange({ ...filter, sort: s.key })} />
        ))}
      </Box>
    </Box>
  );
};
