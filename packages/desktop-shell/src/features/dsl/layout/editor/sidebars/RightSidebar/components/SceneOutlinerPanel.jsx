// src/features/layout/components/RightSidebar/components/SceneOutlinerPanel.jsx
import React, { useMemo, useState, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import FlareRoundedIcon from "@mui/icons-material/FlareRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import SegmentIcon from "@mui/icons-material/Segment";
import HighlightRoundedIcon from "@mui/icons-material/HighlightRounded";
import CropDinRoundedIcon from "@mui/icons-material/CropDinRounded";
import LandscapeRoundedIcon from "@mui/icons-material/LandscapeRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";

// ✅ 自前の展開▶アイコン
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

// ✅ Menu icons
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import FolderOffRoundedIcon from "@mui/icons-material/FolderOffRounded";

// ✅ MUI X Tree View（v7+）
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";

const iconByType = (type, lightType) => {
  switch (type) {
    case "scene":
      return <PublicRoundedIcon sx={{ fontSize: 18, opacity: 0.9 }} />;
    case "ambience":
      // Hemisphere/sky ambient light — soft radial glow icon, sky-blue tint
      return <FlareRoundedIcon sx={{ fontSize: 18, opacity: 0.9, color: "light-dark(#0d65a0, #a8d8f8)" }} />;
    case "group":
      return <FolderRoundedIcon sx={{ fontSize: 18, opacity: 0.9 }} />;
    case "landscape-flat":
      return <LandscapeRoundedIcon sx={{ fontSize: 18, opacity: 0.9, color: "light-dark(#497637, #9bc88a)" }} />;
    case "landscape-sky":
      return <CloudRoundedIcon sx={{ fontSize: 18, opacity: 0.9, color: "light-dark(#1a5793, #9fc7ee)" }} />;
    case "light":
      // Spot light — cone/highlight icon, cyan-blue
      if (lightType === "spot") return <HighlightRoundedIcon sx={{ fontSize: 18, opacity: 0.9, color: "light-dark(#0073ad, #80d4ff)" }} />;
      // Rect area light — rectangular panel icon, soft purple
      if (lightType === "rect") return <CropDinRoundedIcon sx={{ fontSize: 18, opacity: 0.9, color: "light-dark(#2500ad, #b4a0ff)" }} />;
      // Directional / Sun — clear sun icon, warm gold
      return <WbSunnyRoundedIcon sx={{ fontSize: 18, opacity: 0.9, color: "light-dark(#ad7400, #ffd580)" }} />;
    default:
      return <ViewInArRoundedIcon sx={{ fontSize: 18, opacity: 0.9 }} />;
  }
};

function filterTree(nodes, q) {
  const query = q.trim().toLowerCase();
  if (!query) return nodes;

  const match = (label) => String(label || "").toLowerCase().includes(query);

  const walk = (list) =>
    list
      .map((n) => {
        const kids = n.children?.length ? walk(n.children) : [];
        const keep = match(n.label) || kids.length > 0;
        return keep ? { ...n, children: kids } : null;
      })
      .filter(Boolean);

  return walk(nodes);
}

const SceneOutlinerPanel = ({
  tree = [],
  selectedId,
  onSelectNode,
  expanded,
  onExpandedChange,
  isVisible,
  onToggleVisible,

  // ✅ A: …メニュー用（任意）
  onFocusNode,      // (nodeId) => void
  onRenameNode,     // (nodeId) => void
  onDuplicateNode,  // (nodeId) => void
  onDeleteNode,     // (nodeId) => void
  onGroupSelected,  // (nodeId) => void   ※「選択中をこのノード配下に」など用途自由
  onUngroupNode,    // (nodeId) => void
}) => {
  const theme = useTheme();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterTree(tree, query), [tree, query]);

  // ✅ A: Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuNode, setMenuNode] = useState(null); // {id,label,type...} を保持
  const menuOpen = Boolean(menuAnchorEl);

  const openNodeMenu = useCallback((node, e) => {
    setMenuNode(node);
    setMenuAnchorEl(e.currentTarget);
  }, []);

  const closeNodeMenu = useCallback(() => {
    setMenuAnchorEl(null);
    setMenuNode(null);
  }, []);

  const runMenuAction = useCallback((fn) => {
    if (!menuNode?.id) return;
    closeNodeMenu();
    fn?.(menuNode.id);
  }, [menuNode, closeNodeMenu]);

  // ✅ 自前展開トグル（標準の展開▶は消す）
  const isExpanded = useCallback(
    (id) => Array.isArray(expanded) && expanded.includes(id),
    [expanded]
  );

  const toggleExpanded = useCallback(
    (id) => {
      const cur = Array.isArray(expanded) ? expanded : [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      onExpandedChange?.(next);
    },
    [expanded, onExpandedChange]
  );

  const renderNode = useCallback(
    (node) => {
      const visible = isVisible?.(node.id) ?? true;
      const hasChildren = !!(node.children && node.children.length > 0);
      const open = isExpanded(node.id);

      return (
        <TreeItem
          key={node.id}
          itemId={node.id}
          label={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                minHeight: 28,
                gap: 0.5,
                pr: 0.25,
                position: "relative",
              }}
            >
              {/* ✅ 👁 ＝ 最左 */}
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisible?.(node.id);
                }}
                sx={{
                  p: 0.25,
                  opacity: visible ? 0.85 : 0.18, // ←OFFは抑えめがTwinmotion寄り
                  flexShrink: 0,
                }}
              >
                {visible ? (
                  <VisibilityRoundedIcon sx={{ fontSize: 16 }} />
                ) : (
                  <VisibilityOffRoundedIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>

              {/* ✅ 自前の展開▶（👁の次の列） */}
              {hasChildren ? (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(node.id);
                  }}
                  sx={{
                    p: 0.25,
                    opacity: 0.85,
                    flexShrink: 0,
                  }}
                >
                  {open ? (
                    <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              ) : (
                <Box sx={{ width: 28, height: 28, flexShrink: 0 }} />
              )}

              {/* 種類アイコン */}
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  display: "grid",
                  placeItems: "center",
                  opacity: 0.9,
                  flexShrink: 0,
                }}
              >
                {iconByType(node.type, node.lightType)}
              </Box>

              {/* 名前 */}
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  opacity: 0.92,
                  fontWeight: selectedId === node.id ? 500 : 400, // ←選択中は少し太く
                }}
              >
                {node.label}
              </Typography>

              {/* …（右端固定：ホバー時だけ表示） */}
              <IconButton
                className="tm-more"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  openNodeMenu(node, e);
                }}
                sx={{
                  p: 0.25,
                  opacity: 0,
                  transition: "opacity 120ms ease",
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          }
          sx={{
            "& .MuiTreeItem-content": {
              minHeight: 28,
              py: 0,
              px: 0.5,
              pr: 3.5,
              borderRadius: 6,
              gap: 0.5,

              "&:hover": {
                bgcolor: alpha(theme.palette.common.white, 0.06),
              },
              "&.Mui-selected": {
                bgcolor: alpha(theme.palette.primary.main, 0.18),
              },
              "&.Mui-selected:hover": {
                bgcolor: alpha(theme.palette.primary.main, 0.22),
              },

              "&:hover .tm-more": { opacity: 0.9 },
              "&.Mui-selected .tm-more": { opacity: 0.9 },
            },

            "& .MuiTreeItem-label": {
              width: "100%",
              pr: 0,
            },
          }}
        >
          {node.children?.map(renderNode)}
        </TreeItem>
      );
    },
    [
      isVisible,
      onToggleVisible,
      theme,
      isExpanded,
      toggleExpanded,
      openNodeMenu,
      selectedId,
    ]
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 1.25, pb: 1 }}>
        <TextField
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 18, opacity: 0.7 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              bgcolor: alpha(theme.palette.common.white, 0.03),
            },
          }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <SegmentIcon sx={{ fontSize: 18, opacity: 0.9 }} />
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Scene
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 0.75, pb: 1 }}>
        <SimpleTreeView
          selectedItems={selectedId ? [selectedId] : []}
          onSelectedItemsChange={(e, ids) => {
            const id = Array.isArray(ids) ? ids[0] : ids;
            if (id) onSelectNode?.(id);
          }}
          expandedItems={expanded ?? []}
          onExpandedItemsChange={(e, ids) => onExpandedChange?.(ids)}
          sx={{
            "& .MuiTreeItem-iconContainer": {
              width: 0,
              marginRight: 0,
              padding: 0,
              overflow: "hidden",
              display: "none",
            },
            "& .MuiTreeItem-group": {
              ml: 1.25,
              pl: 1,
              borderLeft: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
            },
          }}
        >
          {filtered.map(renderNode)}
        </SimpleTreeView>
      </Box>

      {/* ✅ A: …メニュー（Twinmotion風） */}
      <Menu
        anchorEl={menuAnchorEl}
        open={menuOpen}
        onClose={closeNodeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            minWidth: 200,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.background.paper, 0.9),
            backdropFilter: "blur(10px)",
            border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
          },
        }}
      >
        <MenuItem onClick={() => runMenuAction(onFocusNode)}>
          <ListItemIcon>
            <CenterFocusStrongRoundedIcon fontSize="small" />
          </ListItemIcon>
          Focus
        </MenuItem>

        <Divider sx={{ my: 0.5, borderColor: alpha(theme.palette.common.white, 0.08) }} />

        <MenuItem onClick={() => runMenuAction(onRenameNode)}>
          <ListItemIcon>
            <DriveFileRenameOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          Rename
        </MenuItem>

        <MenuItem onClick={() => runMenuAction(onDuplicateNode)}>
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          Duplicate
        </MenuItem>

        <Divider sx={{ my: 0.5, borderColor: alpha(theme.palette.common.white, 0.08) }} />

        <MenuItem onClick={() => runMenuAction(onGroupSelected)}>
          <ListItemIcon>
            <CreateNewFolderRoundedIcon fontSize="small" />
          </ListItemIcon>
          Group selection
        </MenuItem>

        <MenuItem
          disabled={menuNode?.type !== "group"}
          onClick={() => runMenuAction(onUngroupNode)}
        >
          <ListItemIcon>
            <FolderOffRoundedIcon fontSize="small" />
          </ListItemIcon>
          Ungroup
        </MenuItem>

        <Divider sx={{ my: 0.5, borderColor: alpha(theme.palette.common.white, 0.08) }} />

        <MenuItem
          onClick={() => runMenuAction(onDeleteNode)}
          sx={{ color: theme.palette.error.main }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default SceneOutlinerPanel;
