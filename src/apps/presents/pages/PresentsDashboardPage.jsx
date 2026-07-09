import React, { useState, useEffect, useMemo } from 'react';
import { Box, Tabs, Tab, CircularProgress, Typography, TextField, InputAdornment, Chip } from '@mui/material';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { DashboardHeader } from '../features/dashboard/components/DashboardHeader';
import { FilterPanel } from '../features/dashboard/components/FilterPanel';
import { PresentationGrid } from '../features/dashboard/components/PresentationGrid';
import { usePresentationUiStore } from '../features/presentation/store/usePresentationUiStore';
import { usePresentations } from '../features/presentation/api/usePresentations';
import { tokens } from '../shared/theme/tokens';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import SlideshowRoundedIcon from '@mui/icons-material/SlideshowRounded';
import { alpha } from '@mui/material/styles';
import { collectionGroup, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '@/features/auth/context/AuthContext';

const DSP_COLOR   = "#ba68c8";
const BRAND_LINE  = "rgba(255,255,255,0.12)";
const BRAND_LINE2 = "rgba(255,255,255,0.18)";
const BRAND_PANEL = "rgba(255,255,255,0.07)";
const BRAND_BG    = "#0b0f16";
const BRAND_SUB   = "rgba(255,255,255,0.68)";
const BRAND_SUB2  = "rgba(255,255,255,0.52)";
const BRAND_TEXT  = "rgba(255,255,255,0.92)";

const PresentsDashboardPage = () => {
  const { dashboardType, setDashboardType } = usePresentationUiStore();
  const { user } = useAuth();

  const { projectId: pathProjectId, section: pathSection } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = pathProjectId || searchParams.get('projectId');
  const boardId = searchParams.get('boardId');
  const section = pathSection || "slides";
  const [resolvingBoard, setResolvingBoard] = useState(false);

  // ── Global scope state ─────────────────────────────────────────────────────
  const [viewScope,        setViewScope]        = useState("project");
  const [globalItems,      setGlobalItems]      = useState([]);
  const [globalLoading,    setGlobalLoading]    = useState(false);
  const [globalSearch,     setGlobalSearch]     = useState("");

  useEffect(() => {
    if (viewScope === "project") return;
    setGlobalLoading(true);
    setGlobalItems([]);

    const wfGroup = collectionGroup(db, "workFiles");
    let q;
    if (viewScope === "explore") {
      q = query(wfGroup, where("appScope", "==", "3dsp"), where("visibility", "==", "public"), limit(60));
    } else if (viewScope === "my" && user?.uid) {
      q = query(wfGroup, where("appScope", "==", "3dsp"), where("createdBy", "==", user.uid), limit(60));
    } else {
      setGlobalLoading(false);
      return;
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, projectId: d.ref.parent.parent?.id, ...d.data() }))
        .filter(item => item.status !== "archived" && item.isArchived !== true);
      setGlobalItems(data);
      setGlobalLoading(false);
    }, (err) => {
      console.error("[PresentsDashboardPage] global", err);
      setGlobalLoading(false);
    });
    return () => unsub();
  }, [viewScope, user?.uid]);

  const filteredGlobal = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return globalItems;
    return globalItems.filter(p =>
      String(p.title || p.name || "").toLowerCase().includes(q)
    );
  }, [globalItems, globalSearch]);

  // ── Scope tabs config ──────────────────────────────────────────────────────
  const SCOPE_TABS = [
    { id: "project", label: "Project",        icon: FolderRoundedIcon  },
    { id: "explore", label: "Explore",         icon: ExploreRoundedIcon },
    ...(user ? [{ id: "my", label: "My Presentations", icon: PersonRoundedIcon }] : []),
  ];

  // Fetch from Firestore
  const { presentations, loading } = usePresentations(viewScope === "project" ? projectId : null);

  React.useEffect(() => {
    if (projectId && !boardId) {
      let cancelled = false;
      const resolve = async () => {
        setResolvingBoard(true);
        try {
          const { resolveDefaultBoard } = await import('@sekkeiya/global-panel');
          const board = await resolveDefaultBoard(projectId, section);
          if (!cancelled && board) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('boardId', board.id);
            navigate({ search: nextParams.toString() }, { replace: true });
          }
        } catch(e) {
          console.error("Failed to resolve default board:", e);
        } finally {
          if (!cancelled) setResolvingBoard(false);
        }
      };
      resolve();
      return () => { cancelled = true; };
    }
  }, [projectId, boardId, navigate, searchParams]);

  if (resolvingBoard) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', width: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Filter only by type (since project scoping handles the rest in the OS)
  const filteredPresentations = presentations.filter(p => {
     return dashboardType === 'all' || p.type === dashboardType;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', bgcolor: BRAND_BG }}>

      {/* ── Scope Tabs ── */}
      <Box sx={{
        display: 'flex', flexShrink: 0,
        borderBottom: `1px solid ${BRAND_LINE}`,
        px: 2.5, bgcolor: BRAND_BG,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        {SCOPE_TABS.map((s) => {
          const isActive = viewScope === s.id;
          const Icon = s.icon;
          return (
            <Box
              key={s.id}
              onClick={() => setViewScope(s.id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                py: 0.9, px: 1.5, mr: 0.25,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : BRAND_SUB,
                cursor: 'pointer',
                borderBottom: isActive ? `2px solid ${DSP_COLOR}` : '2px solid transparent',
                mb: '-1px',
                '&:hover': { color: '#fff' },
                transition: 'color 0.15s',
              }}
            >
              <Icon sx={{ fontSize: 14 }} />
              {s.label}
            </Box>
          );
        })}
      </Box>

      {/* ── Global View (Explore / My) ── */}
      {viewScope !== "project" && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Global header */}
          <Box sx={{
            px: 2.5, py: 1.25, flexShrink: 0,
            borderBottom: `1px solid ${BRAND_LINE}`,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: BRAND_TEXT }}>
              {viewScope === 'explore' ? 'Explore Presentations' : 'My Presentations'}
            </Typography>
            {!globalLoading && (
              <Chip
                label={filteredGlobal.length}
                size="small"
                sx={{ height: 18, bgcolor: alpha('#fff', 0.08), color: BRAND_SUB, fontSize: 11, '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
            <TextField
              size="small"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="プレゼンを検索..."
              sx={{
                ml: 1, width: 260,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 999, bgcolor: BRAND_PANEL,
                  '& fieldset':             { borderColor: BRAND_LINE  },
                  '&:hover fieldset':       { borderColor: BRAND_LINE2 },
                  '&.Mui-focused fieldset': { borderColor: alpha('#fff', 0.3) },
                },
                '& input': { color: BRAND_TEXT, fontSize: 13 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 16, color: BRAND_SUB }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Global grid */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
            {globalLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={28} sx={{ color: DSP_COLOR }} />
              </Box>
            ) : filteredGlobal.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <SlideshowRoundedIcon sx={{ fontSize: 48, color: BRAND_SUB2, mb: 2 }} />
                <Typography sx={{ fontWeight: 600, color: BRAND_TEXT }}>
                  {viewScope === 'explore' ? '公開プレゼンがまだありません' : 'あなたのプレゼンがまだありません'}
                </Typography>
              </Box>
            ) : (
              <PresentationGrid items={filteredGlobal} />
            )}
          </Box>
        </Box>
      )}

      {/* ── Project View ── */}
      {viewScope === "project" && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
          <DashboardHeader title="Project Presentations" count={filteredPresentations.length} />

          {/* Type Filter Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.06)', px: 3, pt: 1, bgcolor: tokens.background.panel, backdropFilter: 'blur(12px)', zIndex: 10 }}>
            <Tabs
              value={dashboardType}
              onChange={(e, v) => setDashboardType(v)}
              sx={{
                minHeight: 40,
                '& .MuiTab-root': { minHeight: 40, py: 1, fontSize: '0.85rem', color: 'text.secondary', fontWeight: 'bold', px: 3 },
                '& .Mui-selected': { color: 'primary.main' }
              }}
            >
              <Tab label="ALL" value="all" />
              <Tab label="コンペ" value="competition" />
              <Tab label="提案書" value="proposal" />
              <Tab label="レポート" value="report" />
              <Tab label="マテリアル" value="material" />
              <Tab label="商品提案" value="product" />
            </Tabs>
          </Box>

          <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
            <PresentationGrid items={filteredPresentations} />
            <FilterPanel />
          </Box>
        </Box>
      )}

    </Box>
  );
};

export default PresentsDashboardPage;
