/**
 * BlogCategoryManager — カテゴリ管理ビューの左ペイン（一覧）。
 * カテゴリの一覧表示（記事数/公開/下書き）・作成・並べ替え（ドラッグ）と、
 * 行クリックで選択（右インスペクターで編集）／チェブロンでその記事一覧へ移動。
 * 改名・削除は右インスペクター（BlogCategoryInspector）で行う。
 */
import React, { useMemo, useState } from 'react';
import { Box, Typography, IconButton, TextField, Tooltip, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BRAND } from '../../styles/theme';

const ACCENT = '#e57373';
const hueOf = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

interface Row { name: string; total: number; published: number; drafts: number; custom: boolean; }

function CountPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 56 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
      <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)', fontWeight: 700 }}>{value}</Typography>
      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{label}</Typography>
    </Box>
  );
}

interface RowProps { row: Row; selected: boolean; onSelect: () => void; onOpen: () => void; }

function SortableRow({ row, selected, onSelect, onOpen }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.name });
  return (
    <Box
      ref={setNodeRef}
      onClick={onSelect}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 1, cursor: 'pointer',
        borderBottom: `1px solid ${BRAND.line}`, position: 'relative',
        zIndex: isDragging ? 10 : 'auto', opacity: isDragging ? 0.7 : 1,
        boxShadow: selected ? `inset 3px 0 0 ${ACCENT}` : 'none',
        bgcolor: selected ? `${ACCENT}1f` : 'transparent',
        '&:hover': { bgcolor: selected ? `${ACCENT}26` : 'rgb(var(--brand-fg-rgb) / 0.03)' },
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <IconButton size="small" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
        sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.28)', cursor: 'grab', '&:active': { cursor: 'grabbing' }, '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}>
        <DragIndicatorRoundedIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, bgcolor: `hsl(${hueOf(row.name)},65%,62%)` }} />
      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: selected ? ACCENT : 'var(--brand-fg)' }}>{row.name}</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        <CountPill value={row.total} label="記事" color="#607d8b" />
        <CountPill value={row.published} label="公開" color="#43a047" />
        <CountPill value={row.drafts} label="下書き" color="#9e9e9e" />
      </Box>

      <Tooltip title="このカテゴリの記事を見る">
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpen(); }} sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: ACCENT } }}>
          <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

interface ManagerProps {
  selectedName: string | null;
  onSelect: (name: string) => void;
}

export const BlogCategoryManager: React.FC<ManagerProps> = ({ selectedName, onSelect }) => {
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const { articles, categories, addCategory, reorderCategories, setCategoryFilter } = useDsbStore();

  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const rows: Row[] = useMemo(() => {
    const stat = new Map<string, { total: number; published: number; drafts: number }>();
    for (const a of articles) {
      const c = (a.category || '').trim();
      if (!c) continue;
      const s = stat.get(c) ?? { total: 0, published: 0, drafts: 0 };
      s.total++; a.status === 'published' ? s.published++ : s.drafts++;
      stat.set(c, s);
    }
    const extra = [...stat.keys()].filter((n) => !categories.includes(n)).sort((a, b) => a.localeCompare(b, 'ja'));
    return [...categories, ...extra].map((name) => ({
      name, custom: categories.includes(name),
      total: stat.get(name)?.total ?? 0, published: stat.get(name)?.published ?? 0, drafts: stat.get(name)?.drafts ?? 0,
    }));
  }, [articles, categories]);

  const submitNew = () => {
    const n = newCat.trim();
    if (uid && n) { addCategory(uid, n); onSelect(n); }
    setNewCat(''); setAdding(false);
  };
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !uid) return;
    const names = rows.map((r) => r.name);
    const from = names.indexOf(String(active.id));
    const to = names.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderCategories(uid, arrayMove(names, from, to));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, fontWeight: 700 }}>カテゴリ管理</Typography>
        <Button size="small" onClick={() => setAdding((v) => !v)} startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ color: ACCENT, textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
          新規カテゴリ
        </Button>
      </Box>

      <Box sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', borderRadius: 2, overflow: 'hidden' }}>
        {adding && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: `1px solid ${BRAND.line}` }}>
            <LabelOutlinedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
            <TextField
              autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setAdding(false); setNewCat(''); } }}
              placeholder="新しいカテゴリ名…" size="small" variant="standard" fullWidth
              InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 14, '&:before': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:after': { borderColor: ACCENT } } }}
            />
            <Button size="small" onClick={submitNew} disabled={!newCat.trim()} sx={{ color: ACCENT, textTransform: 'none', fontWeight: 700, '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.25)' } }}>追加</Button>
          </Box>
        )}

        {rows.length === 0 && !adding ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 13 }}>
            カテゴリがありません。「新規カテゴリ」からテーマ別に作成しましょう。
          </Box>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((r) => r.name)} strategy={verticalListSortingStrategy}>
              {rows.map((r) => (
                <SortableRow
                  key={r.name} row={r}
                  selected={selectedName === r.name}
                  onSelect={() => onSelect(r.name)}
                  onOpen={() => setCategoryFilter(r.name)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </Box>
    </Box>
  );
};
