import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip,
  CircularProgress, Button, ButtonGroup,
  Menu, MenuItem, ListItemIcon,
  useMediaQuery,
} from '@mui/material';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAppStore } from '../../store/useAppStore';
import { DsdSidebar } from '../../shared/layout/dsd-sidebar/DsdSidebar';
import { DsdRightPanel } from './components/DsdRightPanel';

// ─── Styles (mirrors 3DSS DssDashboard) ──────────────────────────────────────

const S = {
  root: {
    flex: 1, height: '100%',
    display: 'flex', flexDirection: 'column' as const,
    bgcolor: 'var(--brand-bg)', overflow: 'hidden',
  },
  stickyHeader: {
    position: 'sticky' as const,
    top: 0, zIndex: 20,
    background: 'rgb(var(--slate-deep-rgb) / 0.92)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgb(var(--slate-ink-rgb) / 0.18)',
    flexShrink: 0,
  },
  topBar: {
    minHeight: 58, padding: '10px 16px',
    display: 'flex', alignItems: 'center', gap: 1, minWidth: 0,
  },
  titleBlock: {
    minWidth: 200, display: 'flex', flexDirection: 'column' as const, gap: '2px',
  },
  breadcrumb: {
    fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.85)',
    lineHeight: 1.2, whiteSpace: 'nowrap' as const,
  },
  pageTitle: {
    fontSize: 18, fontWeight: 760,
    letterSpacing: 0.2, lineHeight: 1.2, color: 'var(--brand-fg)',
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 1,
    padding: '7px 10px', borderRadius: 999,
    border: '1px solid rgb(var(--slate-ink-rgb) / 0.30)',
    background: 'rgb(var(--slate-panel-rgb) / 0.62)',
    width: 'min(480px, 100%)', minWidth: 180,
  },
  searchInput: {
    width: '100%', minWidth: 0,
    border: 'none', outline: 'none',
    background: 'transparent',
    color: 'var(--brand-fg)', fontSize: 12,
  } as React.CSSProperties,
  viewBlock: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'flex-end', gap: '4px',
  },
  miniLabel: { fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.85)' },
  densityGroup: { '& .MuiButton-root': { textTransform: 'none', borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)' } },
  densityBtn: {
    color: 'light-dark(rgba(31,41,55,0.9), rgba(229,231,235,0.9))', background: 'rgb(var(--slate-panel-rgb) / 0.32)',
    borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)', padding: '3px 10px', fontSize: 11,
  },
  densityBtnActive: {
    color: '#0b1220', background: 'rgba(96,165,250,0.9)',
    borderColor: 'rgba(96,165,250,0.9)', padding: '3px 10px', fontSize: 11,
    '&:hover': { background: 'rgba(96,165,250,0.95)' },
  },
  filterRow: {
    padding: '0px 16px 10px',
    display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap' as const,
  },
  tabBtn: (active: boolean, accent = '#aed581') => ({
    textTransform: 'none' as const, fontSize: 11, px: 1.5, py: 0,
    borderRadius: 0, height: 28, minWidth: 0,
    bgcolor: active ? `${accent}26` : 'transparent',
    color: active ? accent : 'rgb(var(--slate-ink-rgb) / 0.7)',
    borderRight: '1px solid rgb(var(--slate-ink-rgb) / 0.15)',
    '&:hover': { bgcolor: active ? `${accent}33` : 'rgb(var(--brand-fg-rgb) / 0.04)' },
  }),
  scrollArea: {
    flex: 1, minHeight: 0, overflowY: 'auto' as const,
    padding: '20px 16px',
  },
};

const DENSITY_PRESETS = [
  { key: 'compact', label: 'Compact', value: 168 },
  { key: 'default', label: 'Default', value: 210 },
  { key: 'large',   label: 'Large',   value: 246 },
];

// ─── Template / filter metadata ───────────────────────────────────────────────

const TEMPLATE_TABS = [
  { key: 'all',    label: 'ALL',       icon: null, color: 'light-dark(#5a822b, #aed581)' },
  { key: 'sun',    label: '日照・日影', icon: <WbSunnyRoundedIcon sx={{ fontSize: 13 }} />, color: 'light-dark(#5a822b, #aed581)' },
  { key: 'site',   label: '敷地・周辺', icon: <PlaceRoundedIcon   sx={{ fontSize: 13 }} />, color: 'light-dark(#198694, #4dd0e1)' },
  { key: 'layout', label: 'ゾーニング', icon: <RouteRoundedIcon   sx={{ fontSize: 13 }} />, color: 'light-dark(#ad6700, #ffb74d)' },
  { key: 'env',    label: '環境・風・音',icon: <AirRoundedIcon    sx={{ fontSize: 13 }} />, color: 'light-dark(#327b74, #80cbc4)' },
];

const TEMPLATE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sun:    { label: '日照・日影',   icon: <WbSunnyRoundedIcon sx={{ fontSize: 14 }} />, color: 'light-dark(#5a822b, #aed581)' },
  site:   { label: '敷地・周辺',   icon: <PlaceRoundedIcon   sx={{ fontSize: 14 }} />, color: 'light-dark(#198694, #4dd0e1)' },
  layout: { label: 'ゾーニング',   icon: <RouteRoundedIcon   sx={{ fontSize: 14 }} />, color: 'light-dark(#ad6700, #ffb74d)' },
  env:    { label: '環境・風・音', icon: <AirRoundedIcon     sx={{ fontSize: 14 }} />, color: 'light-dark(#327b74, #80cbc4)' },
};

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

// ─── Diagram Card ─────────────────────────────────────────────────────────────

interface DiagramCardProps {
  item: any;
  cardSize: number;
  isOwn?: boolean;
  onOpen?: (item: any) => void;
  onSelect?: (item: any) => void;
  onDelete?: (item: any) => void;
}

const DiagramCard: React.FC<DiagramCardProps> = ({ item, cardSize, isOwn, onOpen, onSelect, onDelete }) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [imgError, setImgError] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = item.currentTemplate ?? 'sun';
  const meta = TEMPLATE_META[template] ?? TEMPLATE_META.sun;
  const title = item.diagramTitle || 'Untitled Diagram';
  const updatedAt = item.updatedAt ?? item.createdAt;

  const handleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      if (isOwn) onOpen?.(item);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        onSelect?.(item);
      }, 240);
    }
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        borderRadius: '8px',
        border: `1px solid rgb(var(--slate-ink-rgb) / 0.13)`,
        background: 'rgb(var(--slate-panel-rgb) / 0.62)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        '&:hover': {
          border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)`,
          boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
          background: 'rgb(var(--slate-panel-rgb) / 0.82)',
          '& .card-actions': { opacity: 1 },
        },
      }}
    >
      {/* Thumbnail area */}
      <Box sx={{
        position: 'relative',
        aspectRatio: '16/9',
        bgcolor: `color-mix(in srgb, ${meta.color} 7%, transparent)`,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 0.5,
      }}>
        {item.thumbnailUrl && !imgError ? (
          <Box
            component="img"
            src={item.thumbnailUrl}
            onError={() => setImgError(true)}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
          />
        ) : (
          <>
            <Box sx={{ color: meta.color, opacity: 0.6 }}>
              {React.cloneElement(meta.icon as React.ReactElement, {
                sx: { fontSize: Math.max(24, cardSize * 0.14) },
              })}
            </Box>
            <Typography sx={{
              color: meta.color, opacity: 0.5,
              fontSize: '0.55rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              DIAGRAM
            </Typography>
          </>
        )}

        {/* Visibility badge */}
        <Box sx={{ position: 'absolute', top: 5, left: 5 }}>
          {item.visibility === 'public'
            ? <PublicRoundedIcon sx={{ fontSize: 13, color: 'light-dark(rgba(90,130,43,0.7), rgba(174,213,129,0.7))' }} />
            : <LockRoundedIcon sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }} />
          }
        </Box>

        {/* Hover actions (own items) */}
        {isOwn && (
          <Box className="card-actions" sx={{
            position: 'absolute', top: 5, right: 5,
            display: 'flex', gap: 0.5,
            opacity: 0, transition: 'opacity 0.15s ease',
          }}>
            <Tooltip title="エディタで開く" placement="top">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
                  onOpen?.(item);
                }}
                sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'var(--brand-fg)', width: 24, height: 24, '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
              >
                <EditRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            {onDelete && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
                sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'var(--brand-fg)', width: 24, height: 24, '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
              >
                <MoreVertRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        )}
      </Box>

      {/* Info */}
      <Box sx={{ p: '10px 12px 12px' }}>
        <Typography sx={{
          fontSize: Math.max(11, cardSize * 0.055),
          fontWeight: 600, color: 'var(--brand-fg)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          mb: 0.75,
        }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            icon={meta.icon as React.ReactElement}
            label={meta.label}
            size="small"
            sx={{
              height: 18, fontSize: '0.6rem', fontWeight: 600,
              bgcolor: `color-mix(in srgb, ${meta.color} 9%, transparent)`, color: meta.color,
              border: `1px solid color-mix(in srgb, ${meta.color} 20%, transparent)`,
              '& .MuiChip-icon': { color: meta.color, ml: 0.5 },
            }}
          />
          {updatedAt && (
            <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--slate-ink-rgb) / 0.7)', ml: 'auto' }}>
              {formatDate(updatedAt)}
            </Typography>
          )}
        </Box>
        {item.category && cardSize >= 200 && (
          <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--slate-ink-rgb) / 0.55)', mt: 0.5 }}>
            {item.category}
          </Typography>
        )}
      </Box>

      {/* Context menu */}
      {isOwn && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={(e: any) => { e?.stopPropagation?.(); setMenuAnchor(null); }}
          PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--slate-ink-rgb) / 0.15)', minWidth: 140 } }}
        >
          {onDelete && (
            <MenuItem onClick={(e) => { e.stopPropagation(); onDelete(item); setMenuAnchor(null); }} sx={{ color: '#ef5350' }}>
              <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" sx={{ color: '#ef5350' }} /></ListItemIcon>
              <Typography variant="body2" sx={{ color: '#ef5350' }}>削除</Typography>
            </MenuItem>
          )}
        </Menu>
      )}
    </Box>
  );
};

// ─── Project Card ─────────────────────────────────────────────────────────────

const ProjectCard: React.FC<{ project: any; onClick: () => void }> = ({ project, onClick }) => {
  const name = project.name || project.title || 'Untitled Project';
  const coverUrl = project.coverImageUrl ?? project.thumbnailUrl;

  return (
    <Box
      onClick={onClick}
      sx={{
        borderRadius: '8px',
        border: '1px solid rgb(var(--slate-ink-rgb) / 0.13)',
        background: 'rgb(var(--slate-panel-rgb) / 0.62)',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.18s ease',
        '&:hover': {
          border: '1px solid rgba(52,152,219,0.5)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          background: 'rgb(var(--slate-panel-rgb) / 0.82)',
        },
      }}
    >
      <Box sx={{
        aspectRatio: '16/9', bgcolor: 'rgba(52,152,219,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {coverUrl ? (
          <Box component="img" src={coverUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <FolderRoundedIcon sx={{ fontSize: 36, color: 'rgba(52,152,219,0.4)' }} />
        )}
      </Box>
      <Box sx={{ p: '10px 12px 12px' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', mb: 0.5 }}>
          {name}
        </Typography>
        {project.ownerName && (
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.65)' }}>
            {project.ownerName}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ─── Project Diagrams Drill-down ───────────────────────────────────────────────

const ProjectDiagramsPanel: React.FC<{
  project: any;
  cardSize: number;
  onBack: () => void;
  onSelect?: (item: any) => void;
}> = ({ project, cardSize, onBack, onSelect }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project.id) return;
    setLoading(true);
    const q = query(
      collection(db, `projects/${project.id}/workFiles`),
      where('appScope', '==', '3dsd'),
      where('type', '==', 'diagram-state'),
      limit(60),
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, projectId: project.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error('[ProjectDiagramsPanel]', err); setLoading(false); });
    return () => unsub();
  }, [project.id]);

  const name = project.name || project.title || 'Untitled Project';

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Sub-header */}
      <Box sx={{ ...S.stickyHeader, borderTop: '1px solid rgb(var(--slate-ink-rgb) / 0.10)' }}>
        <Box sx={{ ...S.topBar, minHeight: 48 }}>
          <IconButton size="small" onClick={onBack} sx={{ color: 'rgb(var(--slate-ink-rgb) / 0.7)', '&:hover': { color: 'var(--brand-fg)' }, mr: 0.5 }}>
            <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Box sx={S.titleBlock}>
            <Box sx={S.breadcrumb}>Public Projects</Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderRoundedIcon sx={{ fontSize: 14, color: '#3498db' }} />
              <Typography sx={{ ...S.pageTitle, fontSize: 15 }}>{name}</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1 }} />
          {!loading && (
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.65)' }}>
              {items.length} 件
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={S.scrollArea}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress size={24} sx={{ color: '#3498db' }} />
          </Box>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<WbSunnyRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--slate-ink-rgb) / 0.2)' }} />}
            message="このプロジェクトにはまだ公開ダイアグラムがありません。"
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`, gap: '12px' }}>
            {items.map(item => (
              <DiagramCard key={item.id} item={item} cardSize={cardSize} isOwn={false} onSelect={onSelect} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
    {icon}
    <Typography sx={{ fontSize: 13, color: 'rgb(var(--slate-ink-rgb) / 0.55)', textAlign: 'center', maxWidth: 300, lineHeight: 1.7 }}>
      {message}
    </Typography>
  </Box>
);

// ─── DsdGlobalDashboard ───────────────────────────────────────────────────────

interface DsdGlobalDashboardProps {
  items: any[];
  projectItems: any[];
  isInitializing: boolean;
  onOpenDiagram?: (item: any) => void;
  onSelectDiagram?: (item: any) => void;
  onDeleteDiagram?: (item: any) => void;
}

export const DsdGlobalDashboard: React.FC<DsdGlobalDashboardProps> = ({
  items,
  projectItems,
  isInitializing,
  onOpenDiagram,
  onSelectDiagram,
  onDeleteDiagram,
}) => {
  const dsdScope         = useAppStore(s => s.dsdScope);
  const dsdGlobalFilter  = useAppStore(s => s.dsdGlobalFilter);
  const setDsdGlobalFilter = useAppStore(s => s.setDsdGlobalFilter);

  const [searchQuery, setSearchQuery]   = useState('');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [cardSize, setCardSize]         = useState(210);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  // Reset template filter when scope changes
  useEffect(() => { setTemplateFilter('all'); setSearchQuery(''); setSelectedProject(null); }, [dsdScope]);

  const isProjectsScope = dsdScope === 'global_projects';
  const isGlobalDiagramsScope = dsdScope === 'global_diagrams';
  const isOwnScope = dsdScope === 'my_public_diagrams' || dsdScope === 'my_private_diagrams';

  // ── Derived density label ─────────────────────────────────────
  const densityKey = useMemo(() => {
    let best = DENSITY_PRESETS[1], bestDiff = Infinity;
    for (const p of DENSITY_PRESETS) {
      const d = Math.abs(p.value - cardSize);
      if (d < bestDiff) { best = p; bestDiff = d; }
    }
    return best.key;
  }, [cardSize]);

  // ── Scope metadata for breadcrumb / title ─────────────────────
  const { breadcrumb, scopeTitle } = useMemo(() => {
    switch (dsdScope) {
      case 'global_diagrams':   return { breadcrumb: 'Global Diagram Hub', scopeTitle: null }; // use toggle
      case 'global_projects':   return { breadcrumb: 'Global Diagram Hub', scopeTitle: 'Public Projects' };
      case 'my_public_diagrams':  return { breadcrumb: 'My Diagrams', scopeTitle: 'Public Diagrams' };
      case 'my_private_diagrams': return { breadcrumb: 'My Diagrams', scopeTitle: 'Private Diagrams' };
      default: return { breadcrumb: 'Diagram Hub', scopeTitle: 'Diagrams' };
    }
  }, [dsdScope]);

  // ── Filtered data ─────────────────────────────────────────────
  const filteredDiagrams = useMemo(() => {
    let list = items;
    if (templateFilter !== 'all') {
      list = list.filter(i => (i.currentTemplate ?? 'sun') === templateFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        [i.diagramTitle, i.category, ...(i.tags ?? [])].filter(Boolean).join(' ').toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, templateFilter, searchQuery]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projectItems;
    const q = searchQuery.toLowerCase();
    return projectItems.filter(p => (p.name ?? p.title ?? '').toLowerCase().includes(q));
  }, [projectItems, searchQuery]);

  // ── 全幅ヘッダー化レイアウト用の埋め込みパネル（デスクトップのみ） ──────────────
  // デスクトップでは MainLayout の左サイドバー / RightPanelHost の右パネルを抑止し、
  // 代わりにここ（ヘッダー下の 3 ゾーン行）へ埋め込む。これによりヘッダーが全幅になる。
  const isMobile = useMediaQuery('(max-width:768px)');
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);
  // DsdSidebar は root が width:100% のため、ラッパーで開閉幅（240/0）を制御する
  const embeddedLeftSidebar = !isMobile ? (
    <Box sx={{ width: isProjectSidebarOpen ? 240 : 0, flexShrink: 0, height: '100%', overflow: 'hidden', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <DsdSidebar />
    </Box>
  ) : null;
  // 右パネル（旧 RightPanelHost と同じ 320px ゾーン + タイトル行）
  const embeddedRightPanel = !isMobile ? (
    <Box
      sx={{
        width: 320, flexShrink: 0, height: '100%',
        borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        bgcolor: 'light-dark(rgba(255, 255, 255, 0.85), rgba(10, 15, 25, 0.6))',
        display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden',
      }}
    >
      <Box sx={{ px: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
          S.Diagram プロパティ
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden', overflowY: 'auto' }}>
        <DsdRightPanel />
      </Box>
    </Box>
  ) : null;

  // ── Project drill-down ────────────────────────────────────────
  if (isProjectsScope && selectedProject) {
    return (
      <Box sx={S.root}>
        {/* Breadcrumb top bar (minimal, above sub-panel header) */}
        <Box sx={S.stickyHeader}>
          <Box sx={{ ...S.topBar, minHeight: 40, padding: '6px 16px' }}>
            <Box sx={S.breadcrumb} component="span">Global Diagram Hub</Box>
            <Box component="span" sx={{ mx: 0.75, color: 'rgb(var(--slate-ink-rgb) / 0.4)', fontSize: 11 }}>/</Box>
            <Box
              component="span"
              onClick={() => setSelectedProject(null)}
              sx={{ ...S.breadcrumb, cursor: 'pointer', '&:hover': { color: 'var(--brand-fg)' } }}
            >
              Public Projects
            </Box>
            <Box component="span" sx={{ mx: 0.75, color: 'rgb(var(--slate-ink-rgb) / 0.4)', fontSize: 11 }}>/</Box>
            <Box component="span" sx={{ ...S.breadcrumb, color: 'var(--brand-fg)' }}>
              {selectedProject.name || selectedProject.title}
            </Box>
          </Box>
        </Box>
        {/* 全幅ヘッダー下の 3 ゾーン行: 左プロジェクトサイドバー | ドリルダウン | 右プロパティ */}
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {embeddedLeftSidebar}
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ProjectDiagramsPanel
              project={selectedProject}
              cardSize={cardSize}
              onBack={() => setSelectedProject(null)}
              onSelect={onSelectDiagram}
            />
          </Box>
          {embeddedRightPanel}
        </Box>
      </Box>
    );
  }

  // ── Main view ─────────────────────────────────────────────────
  const displayCount = isProjectsScope ? filteredProjects.length : filteredDiagrams.length;

  return (
    <Box sx={S.root}>
      {/* ── Sticky header ──────────────────────────────────────────── */}
      <Box sx={S.stickyHeader}>
        {/* Top bar */}
        <Box sx={S.topBar}>
          {/* Title block */}
          <Box sx={S.titleBlock}>
            <Box sx={S.breadcrumb}>{breadcrumb}</Box>

            {/* global_diagrams: Explore / Following toggle */}
            {isGlobalDiagramsScope ? (
              <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'baseline' }}>
                <Typography
                  onPointerDown={(e) => { e.stopPropagation(); setDsdGlobalFilter('all'); }}
                  sx={{
                    ...S.pageTitle, fontSize: 22, cursor: 'pointer',
                    color: dsdGlobalFilter === 'all' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.3)',
                    transition: 'color 0.2s',
                    '&:hover': { color: dsdGlobalFilter === 'all' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.6)' },
                  }}
                >
                  Explore
                </Typography>
                <Typography
                  onPointerDown={(e) => { e.stopPropagation(); setDsdGlobalFilter('following'); }}
                  sx={{
                    ...S.pageTitle, fontSize: 22, cursor: 'pointer',
                    color: dsdGlobalFilter === 'following' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.3)',
                    transition: 'color 0.2s',
                    '&:hover': { color: dsdGlobalFilter === 'following' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.6)' },
                  }}
                >
                  Following
                </Typography>
              </Box>
            ) : (
              <Box sx={S.pageTitle}>{scopeTitle}</Box>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          {/* Search */}
          <Box sx={S.searchWrap} onPointerDown={e => e.stopPropagation()}>
            <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--slate-ink-rgb) / 0.9)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={isProjectsScope ? 'Search projects...' : 'Search diagrams...'}
              style={S.searchInput}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          {/* Density + count */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!isInitializing && (
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.6)', whiteSpace: 'nowrap' }}>
                {displayCount} 件
              </Typography>
            )}
            <Box sx={S.viewBlock}>
              <Box sx={S.miniLabel}>Density</Box>
              <ButtonGroup size="small" variant="outlined" sx={S.densityGroup}>
                {DENSITY_PRESETS.map(p => (
                  <Button
                    key={p.key}
                    onClick={() => setCardSize(p.value)}
                    sx={densityKey === p.key ? S.densityBtnActive : S.densityBtn}
                  >
                    {p.label}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>
          </Box>
        </Box>

        {/* Filter row — template tabs (not shown for project scope) */}
        {!isProjectsScope && (
          <Box sx={S.filterRow}>
            <Box sx={{
              display: 'flex', borderRadius: '6px', overflow: 'hidden',
              border: '1px solid rgb(var(--slate-ink-rgb) / 0.15)', flexShrink: 0,
            }}>
              {TEMPLATE_TABS.map((tab, i) => (
                <Button
                  key={tab.key}
                  size="small"
                  onClick={() => setTemplateFilter(tab.key)}
                  sx={{
                    ...S.tabBtn(templateFilter === tab.key, tab.color),
                    borderRight: i < TEMPLATE_TABS.length - 1 ? '1px solid rgb(var(--slate-ink-rgb) / 0.15)' : 'none',
                    gap: 0.5,
                  }}
                >
                  {tab.icon && React.cloneElement(tab.icon as React.ReactElement, {
                    sx: { fontSize: 12, color: templateFilter === tab.key ? tab.color : 'rgb(var(--slate-ink-rgb) / 0.5)' },
                  })}
                  {tab.label}
                </Button>
              ))}
            </Box>

            {/* Active template chip hint */}
            {templateFilter !== 'all' && (() => {
              const t = TEMPLATE_TABS.find(t => t.key === templateFilter);
              return t ? (
                <Chip
                  label={`${filteredDiagrams.length} 件`}
                  size="small"
                  onDelete={() => setTemplateFilter('all')}
                  sx={{
                    height: 22, fontSize: 11,
                    bgcolor: `color-mix(in srgb, ${t.color} 9%, transparent)`, color: t.color,
                    border: `1px solid color-mix(in srgb, ${t.color} 20%, transparent)`,
                    '& .MuiChip-deleteIcon': { color: `color-mix(in srgb, ${t.color} 60%, transparent)`, fontSize: 14 },
                  }}
                />
              ) : null;
            })()}
          </Box>
        )}
      </Box>

      {/* ── 全幅ヘッダー下の 3 ゾーン行: 左プロジェクトサイドバー | グリッド | 右プロパティ ── */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {embeddedLeftSidebar}

        {/* ── Scroll area ────────────────────────────────────────────── */}
        <Box sx={{ ...S.scrollArea, minWidth: 0 }}>
        {isInitializing ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress size={28} sx={{ color: 'light-dark(#5a822b, #aed581)' }} />
          </Box>
        ) : isProjectsScope ? (
          filteredProjects.length === 0 ? (
            <EmptyState icon={<FolderRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--slate-ink-rgb) / 0.2)' }} />} message="公開プロジェクトが見つかりませんでした。" />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`, gap: '12px' }}>
              {filteredProjects.map(p => (
                <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />
              ))}
            </Box>
          )
        ) : (
          filteredDiagrams.length === 0 ? (
            <EmptyState
              icon={<WbSunnyRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--slate-ink-rgb) / 0.2)' }} />}
              message={
                dsdGlobalFilter === 'following' && isGlobalDiagramsScope
                  ? 'フォロー中のユーザーの公開ダイアグラムがありません。'
                  : dsdScope === 'my_public_diagrams'
                  ? 'まだ公開ダイアグラムがありません。エディタで作成後、右パネルから「公開」に設定してください。'
                  : dsdScope === 'my_private_diagrams'
                  ? 'まだ非公開ダイアグラムがありません。'
                  : '公開ダイアグラムが見つかりませんでした。'
              }
            />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`, gap: '12px' }}>
              {filteredDiagrams.map(item => (
                <DiagramCard
                  key={item.id}
                  item={item}
                  cardSize={cardSize}
                  isOwn={isOwnScope}
                  onOpen={isOwnScope ? onOpenDiagram : undefined}
                  onSelect={onSelectDiagram}
                  onDelete={isOwnScope ? onDeleteDiagram : undefined}
                />
              ))}
            </Box>
          )
        )}
        </Box>

        {embeddedRightPanel}
      </Box>
    </Box>
  );
};
