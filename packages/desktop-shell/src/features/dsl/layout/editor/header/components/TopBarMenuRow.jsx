// src/features/layout/components/Header/components/TopBarMenuRow.jsx
import React from "react";
import { MenuItem, ListItemIcon, ListItemText, IconButton, Tooltip, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";

import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";

export default function TopBarMenuRow({
  selected,
  primary,
  secondary,
  onClick,

  menuItemSx,
  danger,
  dangerDelete = false,

  onAskDuplicate,
  duplicateTooltip,
  duplicateDisabled = false,
  duplicateLoading = false,

  onAskDelete,
  deleteTooltip,
  disabled = false,
  // MUI の `disabled` は pointer-events: none を子要素にも及ぼすため、削除アイコンだけは
  // 生かしたい壊れた行（参照先が見つからない等）向けに、見た目だけ減光する別経路。
  // `disabled` と併用しない（disabled が優先されて操作不能になるだけになる）。
  dim = false,
}) {
  return (
    <MenuItem
      disabled={disabled}
      selected={selected}
      onClick={dim ? undefined : onClick}
      sx={{
        ...menuItemSx,
        display: "flex",
        alignItems: "center",
        gap: 1,
        pr: 0.75,
        ...(dim ? { opacity: 0.55, cursor: "default" } : null),
        "& ._act": { opacity: 0, pointerEvents: "none" },
        "&:hover ._act": { opacity: 1, pointerEvents: "auto" },
      }}
    >
      <ListItemIcon sx={{ minWidth: 28, color: "var(--brand-fg)" }}>
        {selected ? <CheckRoundedIcon fontSize="small" /> : null}
      </ListItemIcon>

      <ListItemText
        primary={primary}
        secondary={secondary || ""}
        primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }}
        secondaryTypographyProps={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 65%, transparent)" }}
      />

      {/* Duplicate */}
      {onAskDuplicate ? (
        <Tooltip title={duplicateTooltip || "Duplicate"}>
          <span>
            <IconButton
              className="_act"
              size="small"
              disabled={duplicateDisabled || duplicateLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAskDuplicate();
              }}
              sx={{
                ml: 0.5,
                width: 30,
                height: 30,
                borderRadius: 1.8,
                color: "color-mix(in srgb, var(--brand-fg) 90%, transparent)",
                background: alpha("#fff", 0.04),
                border: `1px solid ${alpha("#fff", 0.10)}`,
                "&:hover": { background: alpha("#fff", 0.08), borderColor: alpha("#fff", 0.18) },
                "&.Mui-disabled": { opacity: 0.45 },
              }}
            >
              {duplicateLoading ? <CircularProgress size={16} /> : <ContentCopyRoundedIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      ) : null}

      {/* Delete */}
      {onAskDelete ? (
        <Tooltip title={deleteTooltip || "Delete"}>
          <IconButton
            className="_act"
            size="small"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAskDelete();
            }}
            sx={{
              ml: 0.5,
              width: 30,
              height: 30,
              borderRadius: 1.8,
              color: dangerDelete ? danger : "color-mix(in srgb, var(--brand-fg) 90%, transparent)",
              background: alpha("#fff", 0.04),
              border: `1px solid ${alpha("#fff", 0.10)}`,
              "&:hover": { background: alpha("#fff", 0.08), borderColor: alpha("#fff", 0.18) },
            }}
          >
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </MenuItem>
  );
}
