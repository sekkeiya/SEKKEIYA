import React, { useState, useEffect } from "react";
import { Box, Typography, Menu, MenuItem, Tooltip, Divider } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { BRAND } from "@/shared/ui/theme";
import { useProjectContext } from "@sekkeiya/global-panel";

const SEKKEIYA_TAB = { scope: "sekkeiya", label: "SEKKEIYA（Overview）", color: "#64b5f6", path: "landing" };

const ALL_CHILD_TABS = [
  { scope: "3dss", label: "S.Model",   color: "#ff5252",  getPath: (pid) => `/app/share/dashboard${pid ? `?projectId=${pid}` : ""}` },
  { scope: "3dsl", label: "S.Layout",   color: "#ffb74d",  getPath: (pid) => pid ? `/app/layout/dashboard?projectId=${pid}` : `/app/layout/dashboard` },
  { scope: "3dsp", label: "S.Slide", color: "#ba68c8",  getPath: (pid) => pid ? `/app/presents/projects/${pid}/workspaces/presents` : `/app/presents/dashboard` },
  { scope: "3dsc", label: "S.Create",   color: "#ffa726",  getPath: (pid) => pid ? `/app/create/dashboard?projectId=${pid}` : `/app/create/dashboard` },
];

const TAB_BASE_SX = (isActive) => ({
  display: "flex",
  alignItems: "center",
  height: "100%",
  minWidth: 100,
  maxWidth: 190,
  px: 1.5,
  pl: 2,
  borderRight: `1px solid ${BRAND.line}`,
  bgcolor: isActive ? BRAND.bg : "transparent",
  color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
  cursor: "pointer",
  position: "relative",
  transition: "background-color 0.2s, color 0.2s",
  userSelect: "none",
  flexShrink: 0,
  "&:before": isActive
    ? {
        content: '""',
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 2,
        bgcolor: "#90caf9",
        boxShadow: "0 0 8px rgba(144,202,249,0.5)",
      }
    : {},
  "&:hover": {
    bgcolor: isActive ? BRAND.bg : "rgba(255,255,255,0.03)",
    color: "#fff",
    "& .tab-actions": { opacity: 1 },
  },
});

const menuPaperSx = {
  bgcolor: "#1a1c22",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
  minWidth: 200,
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
};

export default function WorkspaceTabBar() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const storedProjectId = useProjectContext((s) => s.activeProjectId);
  const setStoredProjectId = useProjectContext((s) => s.setActiveProjectId);

  // /projects/{pid}/... のパスパターンから projectId を抽出（3DSP など path 埋め込みの場合に対応）
  const pathMatch = location.pathname.match(/\/projects\/([^/?#]+)/);
  const urlProjectId =
    params.projectId ||
    searchParams.get("projectId") ||
    pathMatch?.[1] ||
    null;
  const projectId = urlProjectId || storedProjectId || null;

  // URL から取得できた projectId はストアに同期（サイドバー経由での遷移後もタブを有効化するため）
  useEffect(() => {
    if (urlProjectId && urlProjectId !== storedProjectId) {
      setStoredProjectId(urlProjectId);
    }
  }, [urlProjectId, storedProjectId, setStoredProjectId]);

  const [visibleScopes, setVisibleScopes] = useState(ALL_CHILD_TABS.map((t) => t.scope));
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // URLパスからアクティブなアプリを判定
  const pathname = location.pathname;
  const activeScope =
    pathname.startsWith("/app/layout") ? "3dsl" :
    pathname.startsWith("/app/presents") ? "3dsp" :
    pathname.startsWith("/app/create") ? "3dsc" :
    pathname.startsWith("/app/share") ? "3dss" :
    /\/projects\/[^/]+\/models/.test(pathname) ? "3dss" :
    null;
  const isSekkeiyaActive = activeScope === null;

  const visibleTabs = ALL_CHILD_TABS.filter((t) => visibleScopes.includes(t.scope));
  const hiddenTabs = ALL_CHILD_TABS.filter((t) => !visibleScopes.includes(t.scope));

  const toggleTab = (scope) => {
    setVisibleScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const getTabPath = (tab) => tab.getPath(projectId);

  const navigateToApp = (tab) => {
    navigate(getTabPath(tab));
  };

  const openInNewTab = (tab) => {
    window.open(getTabPath(tab), "_blank");
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        bgcolor: "#14161B",
        borderBottom: `1px solid ${BRAND.line}`,
        height: 40,
        overflowX: "auto",
        flexShrink: 0,
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {/* SEKKEIYA tab — always fixed */}
      <Box
        onClick={() => navigate(`/projects/${projectId}/landing`)}
        sx={TAB_BASE_SX(isSekkeiyaActive)}
      >
        <Box
          sx={{ position: "absolute", left: 0, top: "25%", bottom: "25%", width: 2, bgcolor: SEKKEIYA_TAB.color }}
        />
        <Typography
          variant="caption"
          fontWeight={isSekkeiyaActive ? 600 : 400}
          noWrap
          sx={{ flex: 1, fontSize: "0.75rem" }}
        >
          {SEKKEIYA_TAB.label}
        </Typography>
      </Box>

      {/* Child tabs */}
      {visibleTabs.map((tab) => {
        const isActive = activeScope === tab.scope;
        return (
          <Tooltip key={tab.scope} title="" placement="bottom">
            <Box
              onClick={() => navigateToApp(tab)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, tab }); }}
              sx={{
                ...TAB_BASE_SX(isActive),
                pr: 0.5,
                cursor: "pointer",
              }}
            >
              <Box
                sx={{ position: "absolute", left: 0, top: "25%", bottom: "25%", width: 2, bgcolor: tab.color }}
              />
              <Typography
                variant="caption"
                fontWeight={isActive ? 600 : 400}
                noWrap
                sx={{ flex: 1, fontSize: "0.75rem" }}
              >
                {tab.label}
              </Typography>

              <Box
                className="tab-actions"
                sx={{ opacity: 0, display: "flex", alignItems: "center", gap: 0.25, ml: 0.5, flexShrink: 0, transition: "opacity 0.15s" }}
              >
                <Box
                  onClick={(e) => { e.stopPropagation(); openInNewTab(tab); }}
                  sx={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 16, height: 16, borderRadius: "3px",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 10 }} />
                </Box>
                <Box
                  onClick={(e) => { e.stopPropagation(); toggleTab(tab.scope); }}
                  sx={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 16, height: 16, borderRadius: "50%",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 10 }} />
                </Box>
              </Box>
            </Box>
          </Tooltip>
        );
      })}

      {/* + button */}
      <Tooltip title="アプリを追加" placement="bottom">
        <Box
          onClick={(e) => setAddMenuAnchor(e.currentTarget)}
          sx={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", width: 32, flexShrink: 0,
            color: "rgba(255,255,255,0.4)", cursor: "pointer",
            "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.05)" },
          }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>

      {/* + dropdown */}
      <Menu
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={() => setAddMenuAnchor(null)}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        {hiddenTabs.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>
            すべて表示中
          </MenuItem>
        ) : (
          hiddenTabs.map((tab) => (
            <MenuItem
              key={tab.scope}
              onClick={() => { toggleTab(tab.scope); setAddMenuAnchor(null); }}
              sx={{ fontSize: "0.8rem", gap: 1.5, "&:hover": { bgcolor: "rgba(255,255,255,0.08)" } }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tab.color, flexShrink: 0 }} />
              {tab.label}
            </MenuItem>
          ))
        )}
      </Menu>

      {/* Right-click context menu */}
      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        <MenuItem
          onClick={() => { if (contextMenu) openInNewTab(contextMenu.tab); setContextMenu(null); }}
          sx={{ fontSize: "0.85rem", gap: 1.5, "&:hover": { bgcolor: "rgba(255,255,255,0.08)" } }}
        >
          <OpenInNewIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }} />
          新しいウィンドウで開く
        </MenuItem>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 0.5 }} />
        <MenuItem
          onClick={() => { if (contextMenu) toggleTab(contextMenu.tab.scope); setContextMenu(null); }}
          sx={{ fontSize: "0.85rem", gap: 1.5, "&:hover": { bgcolor: "rgba(255,255,255,0.08)" } }}
        >
          <CloseIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }} />
          タブを閉じる
        </MenuItem>
      </Menu>
    </Box>
  );
}
