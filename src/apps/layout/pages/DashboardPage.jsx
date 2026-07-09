// src/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Container,
  Stack,
  Typography,
  Card,
  CardActionArea,
  Chip,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Divider,
  useMediaQuery,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import LayoutWorkspacePage from "./LayoutWorkspacePage";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ExploreRoundedIcon from "@mui/icons-material/ExploreRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";

import { collectionGroup, query, where, limit, onSnapshot } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

import { useAuthState } from "@layout/features/auth/useAuthState";
import { useWorkspaces } from "@layout/features/layout/hooks/useWorkspaces";
import { toSekkeiyaLoginUrl } from "@layout/shared/utils/urls/sekkeiyaUrls";

const DSL_COLOR = "#ffb74d";
const BRAND_LINE  = "rgba(255,255,255,0.12)";
const BRAND_LINE2 = "rgba(255,255,255,0.18)";
const BRAND_PANEL = "rgba(255,255,255,0.07)";
const BRAND_BG    = "#0b0f16";
const BRAND_SUB   = "rgba(255,255,255,0.68)";
const BRAND_SUB2  = "rgba(255,255,255,0.52)";
const BRAND_TEXT  = "rgba(255,255,255,0.92)";

export default function DashboardPage() {
  const { user, isLoading: authLoading, isAuthed } = useAuthState();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDownMd = useMediaQuery(theme.breakpoints.down("md"));
  const uid = user?.uid || null;

  const { projectId: pathProjectId, section: pathSection } = useParams();
  const [searchParams] = useSearchParams();
  const queryBoardId = searchParams.get("boardId");
  const queryProjectId = pathProjectId || searchParams.get("projectId");

  // ── Global scope (Explore Layouts / My Layouts) ──────────────────────────
  const [viewScope,     setViewScope]     = useState("project");
  const [globalLayouts, setGlobalLayouts] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalSearch,  setGlobalSearch]  = useState("");
  const [globalDensity, setGlobalDensity] = useState("default");

  const GLOBAL_CARD_SIZE = { compact: 140, default: 180, large: 220 };
  const globalCardSize = GLOBAL_CARD_SIZE[globalDensity] ?? 180;

  useEffect(() => {
    if (viewScope === "project") return;
    setGlobalLoading(true);
    setGlobalLayouts([]);

    let q;
    const layoutsGroup = collectionGroup(db, "layouts");
    if (viewScope === "explore") {
      q = query(layoutsGroup, where("visibility", "==", "public"), limit(60));
    } else if (viewScope === "my" && uid) {
      q = query(layoutsGroup, where("createdBy", "==", uid), limit(60));
    } else {
      setGlobalLoading(false);
      return;
    }

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data();
        const parts = d.ref.path.split("/");
        return {
          id: d.id,
          projectId:   data.projectId   || parts[1],
          workspaceId: data.workspaceId || parts[3],
          ...data,
        };
      });
      setGlobalLayouts(items);
      setGlobalLoading(false);
    }, (err) => {
      console.error("[DashboardPage] global layouts error", err);
      setGlobalLoading(false);
    });

    return () => unsub();
  }, [viewScope, uid]);

  const filteredGlobal = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return globalLayouts;
    return globalLayouts.filter(l =>
      String(l.name || l.title || "").toLowerCase().includes(q) ||
      String(l.ownerName       || "").toLowerCase().includes(q)
    );
  }, [globalLayouts, globalSearch]);

  // Project-Centric Architecture: Render Workspace directly if boardId/workspaceId is in the query params
  // Wait, if it has a specific boardId we just render it? In the new system, we navigate into a workspace URL or render it.
  // We'll keep the direct render fallback just in case.
  if (queryBoardId && queryProjectId) {
    return <LayoutWorkspacePage propBoardKey={queryBoardId} />;
  }

  // Fetch workspaces for current project
  const {
    workspaces: rawWorkspaces,
    loading: workspacesLoading,
    error,
  } = useWorkspaces(queryProjectId, uid);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | recent
  const [view, setView] = useState("grid"); // grid | list

  const workspaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = Array.isArray(rawWorkspaces) ? rawWorkspaces : [];

    if (filter === "recent") {
      list = [...list].sort((a, b) => {
        const aa = a?.updatedAt?.toMillis?.() ?? 0;
        const bb = b?.updatedAt?.toMillis?.() ?? 0;
        return bb - aa;
      });
    }

    if (q) {
      list = list.filter((w) =>
        String(w?.name || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [rawWorkspaces, query, filter]);

  const heroSx = {
    position: "relative",
    borderRadius: 3,
    overflow: "hidden",
    minHeight: 220,
    border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
    background: `
      radial-gradient(1200px 420px at 70% 10%, ${alpha(
        theme.palette.common.white,
        0.1
      )} 0%, transparent 55%),
      linear-gradient(180deg, ${alpha("#1a1f2b", 0.75)} 0%, ${alpha(
      "#0b1020",
      0.95
    )} 100%)
    `,
    boxShadow: `0 18px 60px ${alpha("#000", 0.35)}`,
  };

  const heroOverlaySx = {
    position: "absolute",
    inset: 0,
    background: `
      linear-gradient(90deg, ${alpha("#0b1020", 0.92)} 0%, ${alpha(
      "#0b1020",
      0.7
    )} 40%, transparent 70%)
    `,
    pointerEvents: "none",
  };

  const heroMediaSx = {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "url(https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=60)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "grayscale(0.2) contrast(1.05) brightness(0.85)",
    transform: "scale(1.02)",
  };

  const topBarSx = {
    mt: 2.2,
    p: 1.25,
    borderRadius: 2.25,
    border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
    background: alpha("#0b1020", 0.55),
    backdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    gap: 1.2,
    flexWrap: "wrap",
  };

  const cardSx = {
    borderRadius: 2.5,
    overflow: "hidden",
    border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
    background: alpha("#0b1020", 0.55),
    backdropFilter: "blur(10px)",
    boxShadow: `0 12px 40px ${alpha("#000", 0.25)}`,
    transition:
      "transform .15s ease, border-color .15s ease, background .15s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      borderColor: alpha(theme.palette.common.white, 0.16),
      background: alpha("#0b1020", 0.62),
    },
  };

  const badgeChipSx = {
    height: 26,
    borderRadius: 999,
    background: alpha(theme.palette.common.white, 0.08),
    border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
    color: alpha("#fff", 0.88),
    fontWeight: 600,
    "& .MuiChip-label": { px: 1.1, fontSize: 12 },
  };

  const openWorkspace = useCallback(
    (workspace) => {
      const workspaceId = workspace?.id;
      if (!workspaceId || !queryProjectId) return;
      navigate(`/projects/${queryProjectId}/workspaces/${workspaceId}`); // Keep structure working with App.jsx
    },
    [navigate, queryProjectId]
  );

  const canOpen = true;

  const pageLoading = authLoading || (isAuthed && !uid);

  if (pageLoading) {
    return (
      <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isAuthed) {
    window.location.replace(toSekkeiyaLoginUrl("/app/layout/dashboard"));
    return null;
  }

  // ── Global scope tabs ─────────────────────────────────────────────────────
  const SCOPE_TABS = [
    { id: "project", label: "Project Workspaces", icon: FolderRoundedIcon  },
    { id: "explore", label: "Explore Layouts",    icon: ExploreRoundedIcon },
    ...(isAuthed ? [{ id: "my", label: "My Layouts", icon: GridViewRoundedIcon }] : []),
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%", bgcolor: "transparent" }}>

      {/* ── Scope Tabs (sticky) ── */}
      <Box sx={{
        flexShrink: 0, display: "flex",
        borderBottom: `1px solid ${BRAND_LINE}`,
        px: 2.5, bgcolor: BRAND_BG,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        {SCOPE_TABS.map((s) => {
          const isActive = viewScope === s.id;
          const Icon = s.icon;
          return (
            <Box
              key={s.id}
              onClick={() => setViewScope(s.id)}
              sx={{
                display: "flex", alignItems: "center", gap: 0.75,
                py: 0.9, px: 1.5, mr: 0.25,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? "#fff" : BRAND_SUB,
                cursor: "pointer",
                borderBottom: isActive ? `2px solid ${DSL_COLOR}` : "2px solid transparent",
                mb: "-1px",
                "&:hover": { color: "#fff" },
                transition: "color 0.15s",
              }}
            >
              <Icon sx={{ fontSize: 14 }} />
              {s.label}
            </Box>
          );
        })}
      </Box>

      {/* ── Global Layouts View ── */}
      {viewScope !== "project" && (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", bgcolor: BRAND_BG }}>
          {/* Header */}
          <Box sx={{
            px: 2.5, py: 1.25, flexShrink: 0,
            borderBottom: `1px solid ${BRAND_LINE}`,
            display: "flex", alignItems: "center", gap: 2,
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: BRAND_TEXT }}>
              {viewScope === "explore" ? "Explore Layouts" : "My Layouts"}
            </Typography>
            {!globalLoading && (
              <Chip
                label={filteredGlobal.length}
                size="small"
                sx={{ height: 18, bgcolor: alpha("#fff", 0.08), color: BRAND_SUB, fontSize: 11, "& .MuiChip-label": { px: 0.75 } }}
              />
            )}
            <TextField
              size="small"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="レイアウトを検索..."
              sx={{
                ml: 1, width: 260,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 999, bgcolor: BRAND_PANEL,
                  "& fieldset":             { borderColor: BRAND_LINE  },
                  "&:hover fieldset":       { borderColor: BRAND_LINE2 },
                  "&.Mui-focused fieldset": { borderColor: alpha("#fff", 0.3) },
                },
                "& input": { color: BRAND_TEXT, fontSize: 13 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 16, color: BRAND_SUB }} />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ flex: 1 }} />
            {/* Density */}
            {[
              { id: "compact", label: "コンパクト" },
              { id: "default", label: "デフォルト" },
              { id: "large",   label: "大"         },
            ].map(({ id, label }) => (
              <Tooltip key={id} title={label}>
                <Box
                  onClick={() => setGlobalDensity(id)}
                  sx={{
                    width: 28, height: 28, borderRadius: 1, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                    color:   globalDensity === id ? "#fff"             : BRAND_SUB,
                    bgcolor: globalDensity === id ? alpha("#fff", 0.1) : "transparent",
                    "&:hover": { bgcolor: alpha("#fff", 0.07), color: "#fff" },
                    transition: "all 0.15s",
                  }}
                >
                  {id === "compact" ? "S" : id === "default" ? "M" : "L"}
                </Box>
              </Tooltip>
            ))}
          </Box>

          {/* Grid */}
          <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
            {globalLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 8 }}>
                <CircularProgress size={28} sx={{ color: DSL_COLOR }} />
              </Box>
            ) : filteredGlobal.length === 0 ? (
              <Box sx={{ py: 8, textAlign: "center" }}>
                <ExploreRoundedIcon sx={{ fontSize: 48, color: BRAND_SUB2, mb: 2 }} />
                <Typography sx={{ fontWeight: 600, color: BRAND_TEXT }}>
                  {viewScope === "explore" ? "公開レイアウトがまだありません" : "あなたのレイアウトがまだありません"}
                </Typography>
              </Box>
            ) : (
              <Box sx={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(${globalCardSize}px, 1fr))`,
                gap: 1.5,
              }}>
                {filteredGlobal.map(layout => (
                  <Box
                    key={layout.id}
                    sx={{
                      borderRadius: 2,
                      border: `1px solid ${BRAND_LINE}`,
                      bgcolor: BRAND_PANEL,
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "border-color 0.18s, transform 0.15s",
                      "&:hover": { borderColor: BRAND_LINE2, transform: "translateY(-2px)" },
                    }}
                    onClick={() => {
                      if (layout.projectId && layout.workspaceId) {
                        navigate(`/projects/${layout.projectId}/workspaces/${layout.workspaceId}`);
                      }
                    }}
                  >
                    <Box sx={{
                      width: "100%", height: globalCardSize * 0.72,
                      bgcolor: alpha("#fff", 0.04),
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <GridViewRoundedIcon sx={{ fontSize: globalCardSize * 0.34, color: alpha("#fff", 0.18) }} />
                    </Box>
                    <Box sx={{ p: 1 }}>
                      <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: BRAND_TEXT }}>
                        {layout.name || layout.title || "Untitled"}
                      </Typography>
                      {layout.ownerName && (
                        <Typography sx={{ fontSize: 11, color: BRAND_SUB2, mt: 0.2 }} noWrap>
                          {layout.ownerName}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* ── Project Workspaces View ── */}
      {viewScope === "project" && (
      <Box sx={{ flex: 1 }}>
      <Container maxWidth="lg" sx={{ py: 3.5 }}>
        <Box sx={heroSx}>
          <Box sx={heroMediaSx} />
          <Box sx={heroOverlaySx} />

          <Box sx={{ position: "relative", p: { xs: 2.2, md: 3 } }}>
            <Stack spacing={1} sx={{ maxWidth: 820 }}>
              <Typography
                sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 800 }}
              >
                Project Workspaces
              </Typography>

              <Typography sx={{ opacity: 0.82, lineHeight: 1.6 }}>
                このプロジェクトのワークスペースを選択します。<br />
                Base / Plan の切替・作成・削除はワークスペース内部の作業画面で行います。
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                sx={{ pt: 0.5, flexWrap: "wrap" }}
              >
                <Chip
                  sx={badgeChipSx}
                  icon={<FolderRoundedIcon />}
                  label={workspacesLoading ? "Workspaces ..." : `Workspaces ${workspaces.length}`}
                />
                <Chip
                  sx={badgeChipSx}
                  icon={<AccessTimeRoundedIcon />}
                  label="Go to Workspace"
                />
              </Stack>

              <Box sx={topBarSx}>
                <TextField
                  size="small"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search workspaces..."
                  sx={{
                    minWidth: isDownMd ? "100%" : 360,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 999,
                      background: alpha(theme.palette.common.white, 0.06),
                      "& fieldset": { borderColor: alpha("#fff", 0.1) },
                      "&:hover fieldset": { borderColor: alpha("#fff", 0.16) },
                      "&.Mui-focused fieldset": {
                        borderColor: alpha("#fff", 0.2),
                      },
                    },
                    input: { color: alpha("#fff", 0.92) },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon sx={{ opacity: 0.85 }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={filter}
                  onChange={(_, v) => v && setFilter(v)}
                  sx={{
                    borderRadius: 999,
                    overflow: "hidden",
                    border: `1px solid ${alpha("#fff", 0.1)}`,
                    "& .MuiToggleButton-root": {
                      px: 1.4,
                      border: 0,
                      color: alpha("#fff", 0.78),
                      background: alpha("#fff", 0.03),
                      "&.Mui-selected": {
                        color: "#fff",
                        background: alpha("#2a68ff", 0.32),
                      },
                    },
                  }}
                >
                  <ToggleButton value="all">All</ToggleButton>
                  <ToggleButton value="recent">Updated</ToggleButton>
                </ToggleButtonGroup>

                <Box sx={{ flex: 1 }} />

                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={view}
                  onChange={(_, v) => v && setView(v)}
                  sx={{
                    borderRadius: 999,
                    overflow: "hidden",
                    border: `1px solid ${alpha("#fff", 0.1)}`,
                    "& .MuiToggleButton-root": {
                      px: 1.2,
                      border: 0,
                      color: alpha("#fff", 0.78),
                      background: alpha("#fff", 0.03),
                      "&.Mui-selected": {
                        color: "#fff",
                        background: alpha("#fff", 0.1),
                      },
                    },
                  }}
                >
                  <ToggleButton value="grid">
                    <Tooltip title="Grid">
                      <ViewModuleRoundedIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="list">
                    <Tooltip title="List">
                      <ViewListRoundedIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>

                <Button
                  size="small"
                  startIcon={<AddRoundedIcon />}
                  sx={{
                    borderRadius: 999,
                    px: 1.6,
                    background: alpha("#2a68ff", 0.85),
                    color: "#fff",
                    fontWeight: 800,
                    "&:hover": { background: alpha("#2a68ff", 0.95) },
                  }}
                  onClick={() => navigate(`/projects/${queryProjectId}/boards`)}
                >
                  Manage Workspaces
                </Button>
              </Box>

              {error && (
                <Typography
                  sx={{
                    mt: 1.2,
                    color: alpha("#ff6b6b", 0.95),
                    fontSize: 13,
                  }}
                >
                  Failed to load workspaces: {String(error?.message || error)}
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>

        <Divider sx={{ my: 3, borderColor: alpha("#fff", 0.08) }} />

        {workspacesLoading ? (
          <Box
            sx={{
              py: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                view === "list"
                  ? "1fr"
                  : { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            {workspaces.map((w) => (
              <Card key={w.id} sx={cardSx}>
                <CardActionArea
                  sx={{ p: 2, opacity: canOpen ? 1 : 0.7 }}
                  onClick={() => openWorkspace(w)}
                  disabled={!canOpen}
                >
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                    <Box
                      sx={{
                        width: 66,
                        height: 48,
                        borderRadius: 2,
                        flexShrink: 0,
                        border: `1px solid ${alpha("#fff", 0.1)}`,
                        background: `
                          radial-gradient(120px 60px at 30% 30%, ${alpha(
                            "#fff",
                            0.1
                          )} 0%, transparent 60%),
                          linear-gradient(180deg, ${alpha(
                            "#2a68ff",
                            0.22
                          )} 0%, ${alpha("#0b1020", 0.65)} 100%)
                        `,
                        boxShadow: `0 10px 24px ${alpha("#000", 0.25)}`,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900 }} noWrap>
                        {w.name || "(Untitled Workspace)"}
                      </Typography>
                      <Typography sx={{ opacity: 0.7, fontSize: 12 }}>
                        Updated: {w.updatedAt?.toDate() ? w.updatedAt.toDate().toLocaleDateString() : "-"}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                        <Chip
                          sx={badgeChipSx}
                          label={w.visibility === "public" ? "Public" : "Private"}
                        />
                        <Chip sx={badgeChipSx} label="Open Workspace" />
                      </Stack>
                    </Box>

                    <Chip
                      label="Open"
                      sx={{
                        height: 28,
                        borderRadius: 999,
                        fontWeight: 900,
                        background: alpha("#fff", 0.08),
                        border: `1px solid ${alpha("#fff", 0.12)}`,
                        color: "#fff",
                        "& .MuiChip-label": { px: 1.2 },
                      }}
                    />
                  </Box>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}

        {!workspacesLoading && workspaces.length === 0 && (
          <Box sx={{ py: 6, textAlign: "center", opacity: 0.75 }}>
            <Typography sx={{ fontWeight: 900 }}>No workspaces found</Typography>
            <Typography sx={{ mt: 0.6, fontSize: 13 }}>
              ワークスペース管理から新しいワークスペースを作成してください。
            </Typography>
            <Button
              variant="outlined"
              sx={{ mt: 2, borderColor: alpha("#fff", 0.2), color: "#fff" }}
              onClick={() => navigate(`/projects/${queryProjectId}/boards`)}
            >
              ワークスペース管理画面へ
            </Button>
          </Box>
        )}
      </Container>
      </Box>
      )}

    </Box>
  );
}
