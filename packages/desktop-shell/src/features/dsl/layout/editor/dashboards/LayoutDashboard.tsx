import React, { useState, useMemo, useCallback } from 'react';
import { Box, Typography, Button, ButtonGroup, useMediaQuery } from '@mui/material';
// 全幅ヘッダー化: グローバル閲覧(DslDashboard)と同じく、ヘッダー下の3ゾーン行に
// 左=デフォルトのプロジェクトナビ(DslSidebar) / 右=選択レイアウト情報パネルを埋め込む。
import { DslSidebar } from '../../../../../shared/layout/dsl-sidebar/DslSidebar';
import { DslDashboardRightPanel } from '../../../../../shared/layout/workspace/RightPanelHost';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useAutoLayoutStore } from '../../store/useAutoLayoutStore';
import { useWorkspaceLayouts } from '../../hooks/useWorkspaces';
import { useAppStore } from '../../../../../store/useAppStore';
import { useAuthStore } from '../../../../../store/useAuthStore';
import { DslLayoutsGrid } from '../../../../dsl/DslLayoutsGrid';
import { LayoutHierarchyView, type HierarchySection } from './LayoutHierarchyView';
import { useDslFilterStore } from '../../../../dsl/store/useDslFilterStore';
import { useDslRendersForScope } from '../../../../dsl/hooks/useDslRendersForScope';
import { useWorkspaceStructureStore } from '../../store/useWorkspaceStructureStore';
import { useDslWorkspaceContextStore } from '../../store/useDslWorkspaceContextStore';
import { CreateLayoutDialog } from '../../components/CreateLayoutDialog';
import { deleteStructureCascade, createStructureNode, cloneStructureNode } from '../../utils/workspaceStubs';

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

// 既存の "Plan N" / "Option N" 連番から次の名前を決める。
function nextName(list: any[], prefix: string): string {
  const nums = (list || [])
    .map((o) => String(o?.name || ''))
    .map((s) => { const m = s.match(new RegExp(`^${prefix}\\s*(\\d+)$`, 'i')); return m ? Number(m[1]) : NaN; })
    .filter((n) => Number.isFinite(n));
  return `${prefix} ${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

interface LayoutDashboardProps {
  projectId: string;
}

export default function LayoutDashboard({ projectId }: LayoutDashboardProps) {
  const { layouts, loading, error } = useWorkspaceLayouts(projectId, 'layout');
  const setPanelSelection = useAppStore((s) => s.setPanelSelection);
  const selectedItem = useAppStore((s) => s.panelSelections['layout'] ?? null);
  const { currentUser } = useAuthStore();

  // 画像・動画の閲覧/管理は S.Image に集約。ダッシュボードは Layout のみ表示する。
  // （生成は Editor 内、レンダーは選択レイアウトの右パネルに表示）
  const { planTypes, sortBy, setSelectedRender } = useDslFilterStore();

  const [cardSize, setCardSize] = useState(210);
  const [searchQuery, setSearchQuery] = useState('');
  // 'tree' = Base→Plan→Option のセクション表示（既定） / 'flat' = 従来の Base カード一覧
  const [groupMode, setGroupMode] = useState<'flat' | 'tree'>('tree');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const handleOpenCreateDialog = useCallback(() => setShowCreateDialog(true), []);

  // 全幅ヘッダー化: 埋め込みサイドバー用（モバイルは従来どおり外部ドロワー）
  const isMobile = useMediaQuery('(max-width:768px)');
  const isProjectSidebarOpen = useAppStore((s) => s.isProjectSidebarOpen);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // 削除確認（Base/Plan/Option 共通、カスケード件数つき）
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; kind: 'base' | 'plan' | 'option'; planCount: number; optionCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Renders grouped by the node they were saved under (render.planId === effectiveLayoutId).
  // Used to derive per-Plan / per-Option thumbnails in the hierarchy (tree) view.
  const rendersByNode = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of renders) {
      const arr = m.get(r.planId);
      if (arr) arr.push(r);
      else m.set(r.planId, [r]);
    }
    for (const arr of m.values()) arr.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    return m;
  }, [renders]);

  const thumbForNode = useCallback(
    (nodeId: string): string | undefined => {
      const rs = rendersByNode.get(nodeId) ?? [];
      const hero = rs.find((r) => r.isHero) ?? rs[0];
      return hero?.url;
    },
    [rendersByNode],
  );

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

  // ── Hierarchy (tree) sections: Base → Plan → Option ──────────────
  const baseSections = useMemo<HierarchySection[]>(() => {
    // Group Plan / Option docs by their parent.
    const plansByBase = new Map<string, any[]>();
    const optionsByPlan = new Map<string, any[]>();
    layouts.forEach((l: any) => {
      if (l?.planType === 'plan' && l?.rootBaseId) {
        const arr = plansByBase.get(l.rootBaseId);
        if (arr) arr.push(l); else plansByBase.set(l.rootBaseId, [l]);
      } else if (l?.planType === 'option' && l?.parentPlanId) {
        const arr = optionsByPlan.get(l.parentPlanId);
        if (arr) arr.push(l); else optionsByPlan.set(l.parentPlanId, [l]);
      }
    });

    const q = searchQuery.trim().toLowerCase();
    const matches = (s: any) => !q || String(s ?? '').toLowerCase().includes(q);
    const nameOf = (n: any) => n?.name ?? n?.title ?? '';
    const cmp = (a: any, b: any) => {
      if (sortBy === 'name') return nameOf(a).localeCompare(nameOf(b));
      if (sortBy === 'oldest') return toMs(a.createdAt) - toMs(b.createdAt);
      return toMs(b.createdAt) - toMs(a.createdAt);
    };
    // Decorate a raw doc into a card item (title / type / thumbnail).
    const toCard = (n: any, baseId: string) => ({
      ...n,
      title: n.name || n.title || (n.planType === 'option' ? 'Option' : 'Plan'),
      type: n.planType || n.type,
      projectId: n.projectId || projectId,
      workspaceId: n.workspaceId || 'layout',
      thumbnailUrl: n.thumbnailUrl || thumbForNode(n.id),
      __baseId: baseId,
    });

    return [...layoutsWithThumbs]
      .sort(cmp)
      .map((base: any) => {
        const baseMatch = matches(nameOf(base));
        const rawPlans = [...(plansByBase.get(base.id) ?? [])].sort(cmp);
        const plans = rawPlans
          .map((plan: any) => {
            const rawOptions = [...(optionsByPlan.get(plan.id) ?? [])].sort(cmp);
            const planMatch = baseMatch || matches(nameOf(plan));
            const options = rawOptions
              .filter((o: any) => planMatch || matches(nameOf(o)))
              .map((o: any) => toCard(o, base.id));
            // Plan のサムネが無いときは配下 Option のレンダーにだけフォールバックする。
            // （Option はそのプランの正当なバリエーション。Base のサムネは別プラン由来の
            //  家具画像になりうるので使わない＝誤解防止）
            const planCard = toCard(plan, base.id);
            if (!planCard.thumbnailUrl) {
              planCard.thumbnailUrl = options.find((o: any) => o.thumbnailUrl)?.thumbnailUrl || undefined;
            }
            return { plan: planCard, options, _keep: planMatch || options.length > 0 };
          })
          .filter((p) => p._keep)
          .map(({ plan, options }) => ({ plan, options }));
        return { base, plans, _keep: baseMatch || plans.length > 0 };
      })
      .filter((s) => s._keep)
      .map(({ base, plans }) => ({ base, plans }));
  }, [layouts, layoutsWithThumbs, searchQuery, sortBy, projectId, thumbForNode]);

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

  // Base カードをクリック → エディターを開く（最後の Plan / 先頭 Plan を自動オープン）
  const handleOpenLayout = useCallback(
    (layout: any) => {
      useWorkspaceStructureStore.getState().openLayout(layout.id);
    },
    [],
  );

  // 階層ビュー：任意のノード（Base/Plan/Option）を選択 → 右パネルに情報表示。
  const handleSelectNode = useCallback(
    (node: any) => {
      setSelectedRender(null);
      const current = useAppStore.getState().panelSelections['layout'];
      if (current?.id === node.id) {
        setPanelSelection('layout', null);
        return;
      }
      const nodeRenders = rendersByNode.get(node.id) ?? [];
      setPanelSelection('layout', { ...node, dslRenders: nodeRenders });
    },
    [setPanelSelection, setSelectedRender, rendersByNode],
  );

  // 階層ビュー：Plan / Option をダブルクリック → そのノードを直接開く。
  const handleOpenNode = useCallback(
    (node: any) => {
      const t = node.planType ?? node.type;
      const structure = useWorkspaceStructureStore.getState();
      if (t === 'plan') {
        const baseId = node.rootBaseId ?? node.__baseId;
        if (baseId) {
          useDslWorkspaceContextStore.getState().setLastPlanForBase(baseId, node.id);
          structure.openLayout(baseId);
        }
        structure.selectPlan(node.id);
      } else if (t === 'option') {
        const baseId = node.__baseId;
        const planId = node.parentPlanId;
        if (baseId && planId) useDslWorkspaceContextStore.getState().setLastPlanForBase(baseId, planId);
        if (baseId) structure.openLayout(baseId);
        if (planId) structure.selectPlan(planId);
        structure.selectOption(node.id);
      } else {
        structure.openLayout(node.id);
      }
    },
    [],
  );

  // ── Delete (cascade) ─────────────────────────────────────────────
  const requestDelete = useCallback(
    (node: any) => {
      const t = node?.planType ?? node?.type;
      const kind: 'base' | 'plan' | 'option' = t === 'plan' ? 'plan' : t === 'option' ? 'option' : 'base';
      let planCount = 0;
      let optionCount = 0;
      if (kind === 'base') {
        const planIds = new Set<string>();
        layouts.forEach((l: any) => { if (l?.planType === 'plan' && l?.rootBaseId === node.id) planIds.add(l.id); });
        planCount = planIds.size;
        layouts.forEach((l: any) => {
          if (l?.planType === 'option' && (l?.rootBaseId === node.id || planIds.has(l?.parentPlanId))) optionCount += 1;
        });
      } else if (kind === 'plan') {
        layouts.forEach((l: any) => { if (l?.planType === 'option' && l?.parentPlanId === node.id) optionCount += 1; });
      }
      setDeleteTarget({ id: node.id, name: node.title || node.name || (kind === 'base' ? 'Base' : kind === 'plan' ? 'Plan' : 'Option'), kind, planCount, optionCount });
    },
    [layouts],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteStructureCascade(projectId, 'layout', deleteTarget.id, deleteTarget.kind);
      const current = useAppStore.getState().panelSelections['layout'];
      if (current?.id === deleteTarget.id || current?.baseId === deleteTarget.id) {
        setPanelSelection('layout', null);
        setSelectedRender(null);
      }
      setDeleteTarget(null);
    } catch (e) {
      console.error('[LayoutDashboard] delete failed:', e);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting, projectId, setPanelSelection, setSelectedRender]);

  // ── Create Plan / Option ─────────────────────────────────────────
  const handleCreatePlan = useCallback(
    async (base: any) => {
      if (!currentUser?.uid || !base?.id) return;
      try {
        const plans = layouts.filter((l: any) => l?.planType === 'plan' && l?.rootBaseId === base.id);
        await createStructureNode({
          projectId, workspaceId: 'layout', userId: currentUser.uid,
          name: nextName(plans, 'Plan'), planType: 'plan', rootBaseId: base.id,
        });
      } catch (e) {
        console.error('[LayoutDashboard] create plan failed:', e);
      }
    },
    [currentUser, projectId, layouts],
  );

  const handleCreateOption = useCallback(
    async (plan: any) => {
      if (!currentUser?.uid || !plan?.id) return;
      const baseId = plan.rootBaseId ?? plan.__baseId;
      try {
        const options = layouts.filter((l: any) => l?.planType === 'option' && l?.parentPlanId === plan.id);
        await cloneStructureNode({
          projectId, workspaceId: 'layout', sourceId: plan.id, userId: currentUser.uid,
          newName: nextName(options, 'Option'),
          overrides: { planType: 'option', rootBaseId: baseId, parentPlanId: plan.id },
        });
      } catch (e) {
        console.error('[LayoutDashboard] create option failed:', e);
      }
    },
    [currentUser, projectId, layouts],
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
        bgcolor: 'var(--brand-bg)',
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
          background: 'rgb(var(--slate-deep-rgb) / 0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgb(var(--slate-ink-rgb) / 0.18)',
          flexShrink: 0,
        }}
      >
        {/* Top bar */}
        <Box sx={{ minHeight: 58, px: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 160 }}>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.85)', lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
            border: '1px solid rgb(var(--slate-ink-rgb) / 0.30)',
            background: 'rgb(var(--slate-panel-rgb) / 0.62)',
            width: 'min(400px, 100%)', minWidth: 160,
          }}>
            <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }} />
            <input
              type="text"
              placeholder="Search layouts..."
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--brand-fg)', fontSize: 12 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          <Button
            size="small"
            startIcon={<TuneRoundedIcon sx={{ fontSize: 15 }} />}
            onClick={() => useAutoLayoutStore.getState().openRulesDialog()}
            sx={{
              textTransform: 'none', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0,
              color: 'light-dark(#2f07a6, #a78bfa)', border: '1px solid rgba(167,139,250,0.35)',
              borderRadius: 999, px: 1.5, py: 0.5,
              '&:hover': { bgcolor: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.6)' },
            }}
          >
            レイアウトルール
          </Button>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.85)' }}>View</Typography>
            <ButtonGroup size="small" variant="outlined" sx={{ '& .MuiButton-root': { textTransform: 'none', borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)' } }}>
              {([
                { key: 'flat', label: 'Base' },
                { key: 'tree', label: '階層' },
              ] as const).map((m) => (
                <Button
                  key={m.key}
                  onClick={() => setGroupMode(m.key)}
                  sx={groupMode === m.key ? {
                    color: '#0b1220', background: 'rgba(0,191,255,0.9)', borderColor: 'rgba(0,191,255,0.9)',
                    padding: '3px 10px', fontSize: 11, '&:hover': { background: 'rgba(0,191,255,0.95)' },
                  } : {
                    color: 'light-dark(rgba(31,41,55,0.9), rgba(229,231,235,0.9))', background: 'rgb(var(--slate-panel-rgb) / 0.32)',
                    borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)', padding: '3px 10px', fontSize: 11,
                  }}
                >
                  {m.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.85)' }}>Density</Typography>
            <ButtonGroup size="small" variant="outlined" sx={{ '& .MuiButton-root': { textTransform: 'none', borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)' } }}>
              {DENSITY_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  onClick={() => setCardSize(p.value)}
                  sx={densityKey === p.key ? {
                    color: '#0b1220', background: 'rgba(0,191,255,0.9)', borderColor: 'rgba(0,191,255,0.9)',
                    padding: '3px 10px', fontSize: 11, '&:hover': { background: 'rgba(0,191,255,0.95)' },
                  } : {
                    color: 'light-dark(rgba(31,41,55,0.9), rgba(229,231,235,0.9))', background: 'rgb(var(--slate-panel-rgb) / 0.32)',
                    borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)', padding: '3px 10px', fontSize: 11,
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        </Box>
      </Box>

      {/* ── 全幅ヘッダー下の3ゾーン行: 左ナビ | コンテンツ | 右パネル（グローバル閲覧と同構成） ── */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!isMobile && (
          <Box sx={{ width: isProjectSidebarOpen ? 240 : 0, flexShrink: 0, height: '100%', overflow: 'hidden', transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)' }}>
            <DslSidebar />
          </Box>
        )}

      {/* ── Content (Layouts only) ────────────────────────────────── */}
      <Box
        component="main"
        sx={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onPointerDownCapture={handleClearSelection}
      >
        {error ? (
          <Box sx={{ p: 3, m: 3, bgcolor: 'rgba(255,0,0,0.1)', borderRadius: 2, color: '#ff4d4f' }}>
            エラーが発生しました: {(error as Error).message}
          </Box>
        ) : (
          <>
          <Box sx={{ flex: 1, minHeight: 0, height: '100%' }}>
            {groupMode === 'tree' ? (
              <LayoutHierarchyView
                sections={baseSections}
                cardSize={cardSize}
                selectedItemId={selectedItem?.id ?? null}
                onSelectNode={handleSelectNode}
                onOpenNode={handleOpenNode}
                onOpenBase={handleOpenLayout}
                onDeleteNode={requestDelete}
                onDeleteBase={requestDelete}
                onCreatePlan={handleCreatePlan}
                onCreateOption={handleCreateOption}
                isInitializing={loading}
                emptyMessage="このプロジェクトにはまだレイアウトがありません"
              />
            ) : (
              <DslLayoutsGrid
                items={filteredLayouts}
                cardSize={cardSize}
                selectedItemId={selectedItem?.id ?? null}
                onSelectLayout={handleSelectLayout}
                onDoubleClick={handleOpenLayout}
                onDelete={requestDelete}
                isInitializing={loading}
                emptyMessage="このプロジェクトにはまだレイアウトがありません"
                onCreateNew={handleOpenCreateDialog}
              />
            )}
          </Box>

          <CreateLayoutDialog
            open={showCreateDialog}
            projectId={projectId}
            currentUser={currentUser}
            onClose={() => setShowCreateDialog(false)}
            onCreated={(baseId, planId, name, baseSetup) => {
              setShowCreateDialog(false);
              setPanelSelection('layout', { selectedLayoutId: baseId, baseId });
              useWorkspaceStructureStore.getState().selectBase(baseId);
              useDslWorkspaceContextStore.getState().setContext(projectId, 'layout', {
                baseId,
                planId,
                optionId: null,
                baseName: name,
                planName: 'Plan 1',
                optionName: null,
                pendingBaseSetup: baseSetup,
              });
            }}
          />

          {/* 削除確認ダイアログ（カスケード） */}
          {deleteTarget && (
            <Box
              data-no-dismiss="true"
              onClick={() => !deleting && setDeleteTarget(null)}
              sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.55)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Box onClick={(e) => e.stopPropagation()} sx={{ width: 440, bgcolor: 'var(--brand-surface2)', p: 4, borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
                <Typography sx={{ color: 'var(--brand-fg)', mb: 2, fontWeight: 700, fontSize: 18 }}>
                  {deleteTarget.kind === 'base' ? 'Base を削除' : deleteTarget.kind === 'plan' ? 'Plan を削除' : 'Option を削除'}
                </Typography>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: deleteTarget.planCount + deleteTarget.optionCount > 0 ? 1.5 : 3, fontSize: 14 }}>
                  「{deleteTarget.name}」を削除しますか？この操作は元に戻せません。
                </Typography>
                {(deleteTarget.planCount > 0 || deleteTarget.optionCount > 0) && (
                  <Box sx={{ mb: 3, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.25)' }}>
                    <Typography sx={{ color: 'light-dark(#ad0003, #ff8a8c)', fontSize: 13 }}>
                      紐づく
                      {deleteTarget.planCount > 0 ? ` ${deleteTarget.planCount} 件の Plan` : ''}
                      {deleteTarget.planCount > 0 && deleteTarget.optionCount > 0 ? ' と' : ''}
                      {deleteTarget.optionCount > 0 ? ` ${deleteTarget.optionCount} 件の Option` : ''}
                      も同時に削除されます。
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                  <Typography onClick={() => !deleting && setDeleteTarget(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: 'var(--brand-fg)' } }}>キャンセル</Typography>
                  <Typography onClick={handleDeleteConfirm} sx={{ color: '#ff4d4f', fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer', py: 1, fontWeight: 600, opacity: deleting ? 0.5 : 1 }}>
                    {deleting ? '削除中…' : '削除'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
          </>
        )}
      </Box>

        {!isMobile && (
          <Box
            data-right-sidebar="true"
            sx={{
              width: 320, flexShrink: 0, height: '100%',
              borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
              background: 'light-dark(rgba(255,255,255,0.85), rgba(10,15,25,0.6))',
              display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden',
            }}
          >
            <DslDashboardRightPanel
              selectedItem={selectedItem}
              updatingVisibility={updatingVisibility}
              setUpdatingVisibility={setUpdatingVisibility}
              setPanelSelection={setPanelSelection}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
