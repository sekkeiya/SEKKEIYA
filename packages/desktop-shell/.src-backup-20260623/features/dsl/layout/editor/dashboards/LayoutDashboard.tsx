import React, { useState, useMemo, useCallback } from 'react';
import { Box, Typography, Button, ButtonGroup } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useWorkspaceLayouts } from '../../hooks/useWorkspaces';
import { useAppStore } from '../../../../../store/useAppStore';
import { DslLayoutsGrid } from '../../../../dsl/DslLayoutsGrid';
import { useDslFilterStore } from '../../../../dsl/store/useDslFilterStore';
import { useDslRendersForScope } from '../../../../dsl/hooks/useDslRendersForScope';

const DENSITY_PRESETS = [
  { key: 'compact', label: 'Compact', value: 168 },
  { key: 'default', label: 'Default', value: 210 },
  { key: 'large', label: 'Large', value: 246 },
];

function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'string') return new Date(val).getTime();
  if (val?.seconds) return val.seconds * 1000;
  if (val?.toMillis) return (val as any).toMillis();
  return 0;
}

interface LayoutDashboardProps {
  projectId: string;
}

export default function LayoutDashboard({ projectId }: LayoutDashboardProps) {
  const { layouts, loading, error } = useWorkspaceLayouts(projectId, 'layout');
  const setPanelSelection = useAppStore((s) => s.setPanelSelection);
  const selectedItem = useAppStore((s) => s.panelSelections['layout'] ?? null);

  // 画像・動画の閲覧/管理は S.Image に集約。ダッシュボードは Layout のみ表示する。
  // （生成は Editor 内、レンダーは選択レイアウトの右パネルに表示）
  const { planTypes, sortBy, setSelectedRender } = useDslFilterStore();

  const [cardSize, setCardSize] = useState(210);
  const [searchQuery, setSearchQuery] = useState('');

  const densityKey = useMemo(() => {
    let best = DENSITY_PRESETS[1];
    let bestDiff = Infinity;
    for (const p of DENSITY_PRESETS) {
      const d = Math.abs(p.value - cardSize);
      if (d < bestDiff) { best = p; bestDiff = d; }
    }
    return best.key;
  }, [cardSize]);

  // The flat `layouts` collection also holds Plan/Option docs. The project
  // dashboard only lists the top-level (Base) layouts; Plan/Option are managed
  // inside the editor's Project Hierarchy.
  const mappedLayouts = useMemo(
    () =>
      layouts
        .filter((l: any) => {
          const t = l?.planType;
          return !t || t === 'base' || t === 'layout';
        })
        .map((l: any) => ({
          ...l,
          title: l.name || l.title || 'Untitled Layout',
          projectId: l.projectId || projectId,
          workspaceId: l.workspaceId || 'layout',
          type: l.planType || l.type,
        })),
    [layouts, projectId],
  );

  // Renders are saved under effectiveLayoutId (= selectedOptionId || selectedPlanId || selectedBaseId).
  // Query ALL nodes so we can (a) derive Base-card thumbnails and (b) list a Base's renders in the right panel.
  const allLayoutNodes = useMemo(
    () =>
      layouts.map((l: any) => ({
        id: l.id,
        name: l.name ?? 'Layout',
        projectId: l.projectId || projectId,
        workspaceId: l.workspaceId || 'layout',
      })),
    [layouts, projectId],
  );

  const { renders } = useDslRendersForScope(allLayoutNodes, allLayoutNodes.length > 0);

  // Group renders by their root Base layout (renders live under Plan/Option child nodes).
  const rendersByBase = useMemo(() => {
    const childToBase = new Map<string, string>();
    layouts.forEach((l: any) => {
      if (l.rootBaseId) childToBase.set(l.id, l.rootBaseId);
    });
    const map = new Map<string, any[]>();
    for (const r of renders) {
      const baseId = childToBase.get(r.planId) ?? r.planId;
      const arr = map.get(baseId);
      if (arr) arr.push(r);
      else map.set(baseId, [r]);
    }
    // newest first
    for (const arr of map.values()) arr.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    return map;
  }, [layouts, renders]);

  // ── Derive thumbnails for Base cards ────────────────────────────
  const layoutsWithThumbs = useMemo(() => {
    if (renders.length === 0) return mappedLayouts;
    return mappedLayouts.map((layout) => {
      if (layout.thumbnailUrl) return layout;
      const baseRenders = rendersByBase.get(layout.id) ?? [];
      const hero = baseRenders.find((r) => r.isHero) ?? baseRenders[0];
      return hero ? { ...layout, thumbnailUrl: hero.url } : layout;
    });
  }, [mappedLayouts, rendersByBase, renders.length]);

  // ── Filtering & sorting ──────────────────────────────────────────
  const filteredLayouts = useMemo(() => {
    let list = layoutsWithThumbs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((l: any) => (l.title || '').toLowerCase().includes(q));
    }
    if (planTypes.length > 0) list = list.filter((l: any) => planTypes.includes(l.planType ?? l.type));
    return [...list].sort((a: any, b: any) => {
      if (sortBy === 'name') return (a.title ?? '').localeCompare(b.title ?? '');
      if (sortBy === 'oldest') return toMs(a.createdAt) - toMs(b.createdAt);
      return toMs(b.createdAt) - toMs(a.createdAt);
    });
  }, [layoutsWithThumbs, searchQuery, planTypes, sortBy]);

  // ── Selection ────────────────────────────────────────────────────
  const handleSelectLayout = useCallback(
    (layout: any) => {
      setSelectedRender(null);
      const current = useAppStore.getState().panelSelections['layout'];
      if (current?.id === layout.id) {
        setPanelSelection('layout', null);
        return;
      }
      // 選択レイアウト配下の画像/動画を添付 → 右パネル（レイアウト情報）で表示する
      const layoutRenders = rendersByBase.get(layout.id) ?? [];
      setPanelSelection('layout', { ...layout, dslRenders: layoutRenders });
    },
    [setPanelSelection, setSelectedRender, rendersByBase],
  );

  const handleOpenLayout = useCallback(
    (layout: any) => {
      setPanelSelection('layout', { selectedLayoutId: layout.id, baseId: layout.id });
    },
    [setPanelSelection],
  );

  const handleClearSelection = useCallback(
    (e: React.PointerEvent) => {
      const el = e.target as HTMLElement;
      if (el?.closest?.('[data-model-card="true"]')) return;
      if (el?.closest?.('[data-no-dismiss="true"]')) return;
      if (el?.closest?.('[data-right-sidebar="true"]')) return;
      setPanelSelection('layout', null);
      setSelectedRender(null);
    },
    [setPanelSelection, setSelectedRender],
  );

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: '#0a0c12',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <Box
        data-no-dismiss="true"
        sx={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(2,6,23,0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(148,163,184,0.18)',
          flexShrink: 0,
        }}
      >
        {/* Top bar */}
        <Box sx={{ minHeight: 58, px: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 160 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.85)', lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Project Layouts
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 760, color: '#00BFFF', lineHeight: 1.2 }}>
              Layout Dashboard
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            padding: '7px 10px', borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.30)',
            background: 'rgba(15,23,42,0.62)',
            width: 'min(400px, 100%)', minWidth: 160,
          }}>
            <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgba(148,163,184,0.9)' }} />
            <input
              type="text"
              placeholder="Search layouts..."
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: '#e5e7eb', fontSize: 12 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.85)' }}>Density</Typography>
            <ButtonGroup size="small" variant="outlined" sx={{ '& .MuiButton-root': { textTransform: 'none', borderColor: 'rgba(148,163,184,0.22)' } }}>
              {DENSITY_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  onClick={() => setCardSize(p.value)}
                  sx={densityKey === p.key ? {
                    color: '#0b1220', background: 'rgba(0,191,255,0.9)', borderColor: 'rgba(0,191,255,0.9)',
                    padding: '3px 10px', fontSize: 11, '&:hover': { background: 'rgba(0,191,255,0.95)' },
                  } : {
                    color: 'rgba(229,231,235,0.9)', background: 'rgba(15,23,42,0.32)',
                    borderColor: 'rgba(148,163,184,0.22)', padding: '3px 10px', fontSize: 11,
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        </Box>
      </Box>

      {/* ── Content (Layouts only) ────────────────────────────────── */}
      <Box
        component="main"
        sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onPointerDownCapture={handleClearSelection}
      >
        {error ? (
          <Box sx={{ p: 3, m: 3, bgcolor: 'rgba(255,0,0,0.1)', borderRadius: 2, color: '#ff4d4f' }}>
            エラーが発生しました: {(error as Error).message}
          </Box>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, height: '100%' }}>
            <DslLayoutsGrid
              items={filteredLayouts}
              cardSize={cardSize}
              selectedItemId={selectedItem?.id ?? null}
              onSelectLayout={handleSelectLayout}
              onDoubleClick={handleOpenLayout}
              isInitializing={loading}
              emptyMessage="このプロジェクトにはまだレイアウトがありません"
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
