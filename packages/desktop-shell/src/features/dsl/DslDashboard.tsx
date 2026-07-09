import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Button, ButtonGroup, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useAutoLayoutStore } from './layout/store/useAutoLayoutStore';
import { LayoutRulesDialog } from './layout/components/LayoutRulesDialog';
import { DslLayoutTree } from './DslLayoutTree';
import type { ProjectGroup, TreeSection } from './DslLayoutTree';
import { DssProjectsGrid } from '../dss/DssProjectsGrid';
import { useAppStore } from '../../store/useAppStore';
import { useDslFilterStore } from './store/useDslFilterStore';
import type { DslContentTab } from './store/useDslFilterStore';
import { useResolveBaseDocs } from './hooks/useResolveBaseDocs';
import type { BaseRef } from './hooks/useResolveBaseDocs';

const DENSITY_PRESETS = [
  { key: 'compact', label: 'Compact', value: 168 },
  { key: 'default', label: 'Default', value: 210 },
  { key: 'large', label: 'Large', value: 246 },
];

// 画像・動画の管理は S.Image に集約したため、S.Layout ダッシュボードは Layout 階層のみを扱う。
// タブは Base → Plan → Option の階層を切り替えるための種別フィルタ（ALL は全階層のツリー表示）。
const CONTENT_TABS: { key: DslContentTab; label: string }[] = [
  { key: 'ALL', label: 'ALL' },
  { key: 'Base', label: 'Base' },
  { key: 'Plan', label: 'Plan' },
  { key: 'Option', label: 'Option' },
];

function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'string') return new Date(val).getTime();
  if (val?.seconds) return val.seconds * 1000;
  if (val?.toMillis) return (val as any).toMillis();
  return 0;
}

export const DslDashboard: React.FC<{
  items: any[];
  isInitializing: boolean;
}> = ({ items, isInitializing }) => {
  const dslScope = useAppStore((s) => s.dslScope);
  const setPanelSelection = useAppStore((s) => s.setPanelSelection);
  const selectedLayout = useAppStore((s) => s.panelSelections['layout'] ?? null);
  const projects = useAppStore((s) => s.projects);

  const { contentTab, setContentTab, sortBy, setSelectedRender } = useDslFilterStore();

  const [cardSize, setCardSize] = useState(210);
  const [searchQuery, setSearchQuery] = useState('');

  const isGlobalLayoutScope = ['global_layouts', 'global_following_layouts'].includes(dslScope);
  const isProjectsScope = dslScope === 'global_projects';

  const scopeTitle = useMemo(() => {
    switch (dslScope) {
      case 'global_layouts': return 'All Public Layouts';
      case 'global_following_layouts': return 'Following Layouts';
      case 'global_projects': return 'All Public Projects';
      case 'my_public_layouts': return 'My Public Layouts';
      case 'my_private_layouts': return 'My Private Layouts';
      default: return 'Layouts';
    }
  }, [dslScope]);

  const breadcrumb = useMemo(() => {
    if (isGlobalLayoutScope || isProjectsScope) return 'Global Layout Hub';
    if (dslScope === 'my_public_layouts' || dslScope === 'my_private_layouts') return 'My Layouts';
    return 'Layout Hub';
  }, [dslScope, isGlobalLayoutScope, isProjectsScope]);

  const scopeDescription = useMemo(() => {
    switch (dslScope) {
      case 'global_layouts': return '全ユーザーの公開レイアウト';
      case 'global_following_layouts': return 'フォロー中のユーザーの公開レイアウト';
      case 'global_projects': return '全ユーザーの公開プロジェクト';
      case 'my_public_layouts': return '公開中のレイアウト — 他のユーザーが閲覧できます';
      case 'my_private_layouts': return '非公開のレイアウト — あなただけが閲覧できます';
      default: return null;
    }
  }, [dslScope]);

  const densityKey = useMemo(() => {
    let best = DENSITY_PRESETS[1];
    let bestDiff = Infinity;
    for (const p of DENSITY_PRESETS) {
      const d = Math.abs(p.value - cardSize);
      if (d < bestDiff) { best = p; bestDiff = d; }
    }
    return best.key;
  }, [cardSize]);

  // ── Project name resolution ─────────────────────────────────────
  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);
  const projectNameOf = useCallback(
    (pid?: string) => (pid && projectNameMap.get(pid)) || pid || 'プロジェクト未設定',
    [projectNameMap],
  );

  // ── Filtering ───────────────────────────────────────────────────
  const searchFiltered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((m) => {
      const hay = [m.name, m.title, m.ownerName, m.ownerHandle].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, searchQuery]);

  // ── Resolve Base docs missing from `items` ──────────────────────
  // Plan/Option は rootBaseId を持つので「Plan があれば Base は必ず存在する」。
  // items に Base doc が無い参照先だけ個別取得して補完する。
  const typeOf = (d: any) => d?.planType ?? d?.type;
  const isBaseType = (d: any) => {
    const t = typeOf(d);
    return t === 'base' || t === 'layout' || !t;
  };

  const baseDocIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const d of items) if (isBaseType(d)) s.add(d.id);
    return s;
  }, [items]);

  const missingBaseRefs = useMemo<BaseRef[]>(() => {
    const seen = new Set<string>();
    const refs: BaseRef[] = [];
    for (const d of items) {
      const t = typeOf(d);
      if (t !== 'plan' && t !== 'option') continue;
      const bid = d.rootBaseId;
      if (!bid || baseDocIdSet.has(bid) || seen.has(bid)) continue;
      if (!d.projectId || !d.workspaceId) continue;
      seen.add(bid);
      refs.push({ projectId: d.projectId, workspaceId: d.workspaceId, baseId: bid });
    }
    return refs;
  }, [items, baseDocIdSet]);

  const resolvedBases = useResolveBaseDocs(missingBaseRefs);

  // ── Project → Base → Plan/Option tree, per active tab ───────────
  const treeGroups = useMemo<ProjectGroup[]>(() => {
    const isBaseDoc = (d: any) => isBaseType(d);
    const isPlanDoc = (d: any) => typeOf(d) === 'plan';
    const isOptionDoc = (d: any) => typeOf(d) === 'option';

    const q = searchQuery.trim().toLowerCase();
    const match = (d: any) => {
      if (!q) return true;
      const hay = [d.name, d.title].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    };
    const sortFn = (a: any, b: any) => {
      if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
      if (sortBy === 'oldest') return toMs(a.createdAt) - toMs(b.createdAt);
      return toMs(b.createdAt) - toMs(a.createdAt); // newest
    };

    // items の Base に、items から漏れていた解決済み Base を補完してマージ
    const bases = [
      ...items.filter(isBaseDoc),
      ...[...resolvedBases.values()].filter((b) => !baseDocIdSet.has(b.id)),
    ];
    const plans = items.filter(isPlanDoc);
    const options = items.filter(isOptionDoc);

    const projectIds = [...new Set(items.map((i: any) => i.projectId).filter(Boolean))] as string[];
    projectIds.sort((a, b) => projectNameOf(a).localeCompare(projectNameOf(b)));

    const groups: ProjectGroup[] = [];

    for (const pid of projectIds) {
      const pBases = bases.filter((b) => b.projectId === pid).sort(sortFn);
      const pPlans = plans.filter((p) => p.projectId === pid);
      const pOptions = options.filter((o) => o.projectId === pid);
      const baseIds = new Set(pBases.map((b) => b.id));
      const planIds = new Set(pPlans.map((p) => p.id));
      const sections: TreeSection[] = [];

      if (contentTab === 'Base') {
        const matched = pBases.filter(match);
        if (matched.length) sections.push({ key: 'bases', items: matched });
      } else if (contentTab === 'Plan') {
        for (const base of pBases) {
          const bp = pPlans.filter((p) => p.rootBaseId === base.id && match(p)).sort(sortFn);
          if (bp.length) sections.push({ key: base.id, breadcrumb: [base.name || 'Base'], items: bp });
        }
        const orphans = pPlans
          .filter((p) => (!p.rootBaseId || !baseIds.has(p.rootBaseId)) && match(p))
          .sort(sortFn);
        if (orphans.length) sections.push({ key: 'orphan-plans', breadcrumb: ['その他'], items: orphans });
      } else if (contentTab === 'Option') {
        for (const base of pBases) {
          const bp = pPlans.filter((p) => p.rootBaseId === base.id).sort(sortFn);
          for (const plan of bp) {
            const po = pOptions.filter((o) => o.parentPlanId === plan.id && match(o)).sort(sortFn);
            if (po.length) {
              sections.push({
                key: plan.id,
                breadcrumb: [base.name || 'Base', plan.name || 'Plan'],
                items: po,
              });
            }
          }
        }
        const orphanOpts = pOptions
          .filter((o) => (!o.parentPlanId || !planIds.has(o.parentPlanId)) && match(o))
          .sort(sortFn);
        if (orphanOpts.length) sections.push({ key: 'orphan-options', breadcrumb: ['その他'], items: orphanOpts });
      } else {
        // ALL: プロジェクト → Base → Plan の入れ子ツリー（Option は Plan 選択時に右パネル）
        for (const base of pBases) {
          const bp = pPlans.filter((p) => p.rootBaseId === base.id && match(p)).sort(sortFn);
          if (q && bp.length === 0) continue; // 検索中は一致 Plan のない Base を隠す
          sections.push({
            key: base.id,
            breadcrumb: [base.name || 'Base'],
            items: bp,
            emptyHint: bp.length === 0 ? 'プランがありません' : undefined,
          });
        }
        const orphans = pPlans
          .filter((p) => (!p.rootBaseId || !baseIds.has(p.rootBaseId)) && match(p))
          .sort(sortFn);
        if (orphans.length) sections.push({ key: 'orphan-plans', breadcrumb: ['その他'], items: orphans });
      }

      if (sections.length) groups.push({ projectId: pid, projectName: projectNameOf(pid), sections });
    }

    return groups;
  }, [items, contentTab, searchQuery, sortBy, projectNameOf, resolvedBases, baseDocIdSet]);

  // ── Selection ───────────────────────────────────────────────────
  // スコープ変更時に選択をリセット
  useEffect(() => {
    setPanelSelection('layout', null);
    setSelectedRender(null);
  }, [dslScope]);

  // タブ変更時に選択をリセット
  useEffect(() => {
    setPanelSelection('layout', null);
    setSelectedRender(null);
  }, [contentTab]);

  // 「画像・動画は S.Image で管理」への導線
  const goToSImage = useCallback(() => {
    const app = useAppStore.getState();
    if (app.activeProjectId) app.setDsiScope('project_images');
    app.setLastActiveAppScope('3dsi');
    app.setActiveWorkspaceId('image');
    app.setCurrentMainView('workspace');
  }, []);

  const handleSelectLayout = useCallback(
    (item: any) => {
      setSelectedRender(null);
      const current = useAppStore.getState().panelSelections['layout'];
      setPanelSelection('layout', current?.id === item.id ? null : item);
    },
    [setPanelSelection, setSelectedRender],
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
    <Box sx={styles.root}>
      {/* ── Sticky Header ─────────────────────────────────────────── */}
      <Box sx={styles.stickyHeaderWrap} data-no-dismiss="true">
        <Box component="header" sx={styles.topBar}>
          {/* Title block */}
          <Box sx={styles.titleBlock}>
            <Box sx={styles.breadcrumb}>{breadcrumb}</Box>
            {isGlobalLayoutScope ? (
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                {['global_layouts', 'global_following_layouts'].map((sc) => (
                  <Typography
                    key={sc}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      useAppStore.getState().setDslScope(sc as any);
                    }}
                    sx={{
                      fontSize: 24, fontWeight: 700, cursor: 'pointer',
                      color: dslScope === sc ? '#fff' : 'rgba(255,255,255,0.4)',
                      transition: 'color 0.2s',
                      '&:hover': { color: '#fff' },
                    }}
                  >
                    {sc === 'global_layouts' ? 'Explore' : 'Following'}
                  </Typography>
                ))}
              </Box>
            ) : (
              <>
                <Box sx={styles.pageTitle}>{scopeTitle}</Box>
                {scopeDescription && (
                  <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.55)', lineHeight: 1.3, mt: '2px' }}>
                    {scopeDescription}
                  </Typography>
                )}
              </>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          {/* Search */}
          <Box sx={styles.searchWrap}>
            <SearchRoundedIcon sx={styles.searchIcon} />
            <input
              type="text"
              placeholder={isProjectsScope ? 'Search projects...' : 'Search layouts...'}
              style={styles.searchInput as React.CSSProperties}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          {/* レイアウトルール設定（セット家具管理） */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<TuneRoundedIcon sx={{ fontSize: 15 }} />}
            onClick={() => useAutoLayoutStore.getState().openRulesDialog()}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              textTransform: 'none', whiteSpace: 'nowrap', fontSize: 11, mr: 1,
              color: '#a78bfa', borderColor: 'rgba(167,139,250,0.35)',
              '&:hover': { borderColor: '#a78bfa', background: 'rgba(167,139,250,0.08)' },
            }}
          >
            レイアウトルール
          </Button>

          {/* 画像・動画は S.Image へ */}
          {!isProjectsScope && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PhotoLibraryRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={goToSImage}
              onPointerDown={(e) => e.stopPropagation()}
              sx={{
                textTransform: 'none', whiteSpace: 'nowrap', fontSize: 11, mr: 1,
                color: 'rgba(229,231,235,0.9)', borderColor: 'rgba(148,163,184,0.3)',
                '&:hover': { borderColor: '#ec407a', color: '#fff', background: 'rgba(236,64,122,0.08)' },
              }}
            >
              画像・動画は S.Image へ
            </Button>
          )}

          {/* Density */}
          <Box sx={styles.viewBlock}>
            <Box sx={styles.miniLabel}>Density</Box>
            <ButtonGroup size="small" variant="outlined" sx={styles.densityGroup}>
              {DENSITY_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  onClick={() => setCardSize(p.value)}
                  sx={densityKey === p.key ? styles.densityBtnActive : styles.densityBtn}
                >
                  {p.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        </Box>

        {/* ── Content Tabs (Base / Plan / Option 階層) ─────────────── */}
        {!isProjectsScope && (
          <Box sx={styles.tabRow}>
            {CONTENT_TABS.map(({ key, label }) => {
              const active = contentTab === key;
              return (
                <Box
                  key={key}
                  onClick={() => setContentTab(key)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.6,
                    px: 0.5, pb: 0.75, pt: 0.25,
                    cursor: 'pointer',
                    borderBottom: `2px solid ${active ? '#00BFFF' : 'transparent'}`,
                    transition: 'color 0.15s, border-color 0.15s',
                    color: active ? '#fff' : 'rgba(148,163,184,0.55)',
                    '&:hover': { color: active ? '#fff' : 'rgba(229,231,235,0.8)' },
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: active ? 700 : 500, lineHeight: 1 }}>
                    {label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <Box component="main" sx={styles.content} onPointerDownCapture={handleClearSelection}>
        <Box sx={styles.pageBodyInner} data-center-page="true">
          {isProjectsScope ? (
            <Box sx={{ flex: 1, minHeight: 0, height: '100%', opacity: isInitializing ? 0.45 : 1, transition: 'opacity 0.22s ease' }}>
              <DssProjectsGrid
                items={searchFiltered}
                cardSize={cardSize}
                selectedItemId={selectedLayout?.id ?? null}
                onSelectProject={handleSelectLayout}
                isInitializing={isInitializing}
              />
            </Box>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, height: '100%', opacity: isInitializing ? 0.45 : 1, transition: 'opacity 0.22s ease' }}>
              <DslLayoutTree
                groups={treeGroups}
                cardSize={cardSize}
                selectedItemId={selectedLayout?.id ?? null}
                onSelectLayout={handleSelectLayout}
                isInitializing={isInitializing}
                emptyMessage="該当するレイアウトがありません"
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* レイアウトルール設定ダイアログ（セット家具管理） */}
      <LayoutRulesDialog />
    </Box>
  );
};

const styles = {
  root: {
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  stickyHeaderWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgba(2,6,23,0.92)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(148,163,184,0.18)',
    minWidth: 0,
    flexShrink: 0,
  },
  topBar: {
    minHeight: 58,
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    minWidth: 0,
  },
  titleBlock: {
    minWidth: 220,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  breadcrumb: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.85)',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 760,
    letterSpacing: 0.2,
    lineHeight: 1.2,
    color: '#fa709a',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.30)',
    background: 'rgba(15,23,42,0.62)',
    width: 'min(560px, 100%)',
    minWidth: 220,
  },
  searchIcon: { fontSize: 18, color: 'rgba(148,163,184,0.9)' },
  searchInput: {
    width: '100%',
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#e5e7eb',
    fontSize: 12,
  },
  viewBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  miniLabel: { fontSize: 11, color: 'rgba(148,163,184,0.85)' },
  densityGroup: {
    '& .MuiButton-root': { textTransform: 'none', borderColor: 'rgba(148,163,184,0.22)' },
  },
  densityBtn: {
    color: 'rgba(229,231,235,0.9)',
    background: 'rgba(15,23,42,0.32)',
    borderColor: 'rgba(148,163,184,0.22)',
    padding: '3px 10px',
    fontSize: 11,
  },
  densityBtnActive: {
    color: '#0b1220',
    background: 'rgba(250,112,154,0.9)',
    borderColor: 'rgba(250,112,154,0.9)',
    padding: '3px 10px',
    fontSize: 11,
    '&:hover': { background: 'rgba(250,112,154,0.95)' },
  },
  tabRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 2,
    px: 2,
    pb: 0,
    pt: 0.5,
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  content: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
  },
  pageBodyInner: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
} as const;
