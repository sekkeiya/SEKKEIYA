import React, { useState, useCallback } from "react";
import { Box, Typography, Grid, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import WeekendRoundedIcon from "@mui/icons-material/WeekendRounded";
import { getItemDisplayLabel } from "../../../../../utils/labels/itemLabelUtils";

/**
 * Plan スコープ：選択中プランの選定家具をサムネ一覧表示し、
 * 削除 / 他プランへコピー・移動を行う。
 * 実際のアイテム操作は LayoutShell がイベントで受けて行う（ライブな items を持つため）。
 */
export default function PlanFurniturePanel({ models, modelTitleMap, planId, plans }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuModel, setMenuModel] = useState(null);
  const [submenu, setSubmenu] = useState(null); // "copy" | "move" | null

  const openMenu = useCallback((e, m) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setMenuModel(m);
    setSubmenu(null);
  }, []);
  const closeMenu = useCallback(() => {
    setAnchorEl(null);
    setMenuModel(null);
    setSubmenu(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (menuModel?.id) {
      window.dispatchEvent(new CustomEvent("remove-model-from-layout", { detail: { modelId: menuModel.id } }));
    }
    closeMenu();
  }, [menuModel, closeMenu]);

  const handleCopyMove = useCallback((targetPlanId, move) => {
    if (menuModel?.id && targetPlanId) {
      window.dispatchEvent(new CustomEvent("copy-model-to-plan", {
        detail: { modelId: menuModel.id, targetPlanId, move: !!move },
      }));
    }
    closeMenu();
  }, [menuModel, closeMenu]);

  const otherPlans = (plans || []).filter((p) => p?.id && p.id !== planId);

  if (!planId) {
    return (
      <Box sx={{ px: 2, py: 6, textAlign: "center", color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>
        プランを選択すると、そのプランの家具が表示されます。
      </Box>
    );
  }

  if (!models || models.length === 0) {
    return (
      <Box sx={{ px: 2, py: 6, textAlign: "center", color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>
        このプランにはまだ家具が選定されていません。<br />AI 家具選定ボタンから追加できます。
      </Box>
    );
  }

  return (
    <Box sx={{ px: 1, py: 1 }}>
      <Grid container spacing={1}>
        {models.map((m) => {
          const modelId = m?.id;
          if (!modelId) return null;
          const thumbUrl = m?.thumbUrl || m?.thumbnailUrl || null;
          const displayName = getItemDisplayLabel({ id: modelId, modelId, name: m?.name, title: m?.title }, modelTitleMap);
          return (
            <Grid item xs={6} size={6} key={modelId}>
              <Box
                sx={{
                  position: "relative", borderRadius: 1.5, overflow: "hidden",
                  border: `1px solid ${alpha("#fff", 0.1)}`, bgcolor: "color-mix(in srgb, var(--brand-bg) 25%, transparent)",
                }}
              >
                <Box sx={{ position: "relative", width: "100%", aspectRatio: "1 / 1", bgcolor: "color-mix(in srgb, var(--brand-bg) 35%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {thumbUrl
                    ? <Box component="img" src={thumbUrl} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <WeekendRoundedIcon sx={{ fontSize: 28, color: "color-mix(in srgb, var(--brand-fg) 25%, transparent)" }} />}
                  <Tooltip title="操作">
                    <IconButton
                      size="small"
                      onClick={(e) => openMenu(e, m)}
                      sx={{ position: "absolute", top: 2, right: 2, bgcolor: "color-mix(in srgb, var(--brand-bg) 50%, transparent)", color: "var(--brand-fg)", "&:hover": { bgcolor: "color-mix(in srgb, var(--brand-bg) 70%, transparent)" } }}
                    >
                      <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography sx={{ px: 0.75, py: 0.5, fontSize: 10.5, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName || modelId}
                </Typography>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        PaperProps={{ sx: { bgcolor: "var(--brand-surface2)", color: "var(--brand-fg)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", minWidth: 200 } }}
      >
        {submenu === null && [
          <MenuItem key="del" onClick={handleDelete} sx={{ fontSize: 13, color: "light-dark(#ad0000, #ff8a8a)" }}>
            <ListItemIcon sx={{ color: "light-dark(#ad0000, #ff8a8a)", minWidth: 30 }}><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13 }}>プランから削除</ListItemText>
          </MenuItem>,
          <Divider key="d1" sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.08)" }} />,
          <MenuItem key="copy" disabled={otherPlans.length === 0} onClick={() => setSubmenu("copy")} sx={{ fontSize: 13 }}>
            <ListItemIcon sx={{ color: "var(--brand-fg)", minWidth: 30 }}><ContentCopyRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13 }}>別プランへコピー</ListItemText>
          </MenuItem>,
          <MenuItem key="move" disabled={otherPlans.length === 0} onClick={() => setSubmenu("move")} sx={{ fontSize: 13 }}>
            <ListItemIcon sx={{ color: "var(--brand-fg)", minWidth: 30 }}><DriveFileMoveRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13 }}>別プランへ移動</ListItemText>
          </MenuItem>,
        ]}

        {submenu !== null && [
          <Typography key="hdr" sx={{ px: 2, py: 1, fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.5)" }}>
            {submenu === "copy" ? "コピー先のプラン" : "移動先のプラン"}
          </Typography>,
          ...otherPlans.map((p) => (
            <MenuItem key={p.id} onClick={() => handleCopyMove(p.id, submenu === "move")} sx={{ fontSize: 13 }}>
              <ListItemText primaryTypographyProps={{ fontSize: 13 }}>{p.name || "Plan"}</ListItemText>
            </MenuItem>
          )),
        ]}
      </Menu>
    </Box>
  );
}
