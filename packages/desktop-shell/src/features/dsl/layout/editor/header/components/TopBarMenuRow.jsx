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
}) {
  return (
    <MenuItem
      disabled={disabled}
      selected={selected}
      onClick={onClick}
      sx={{
        ...menuItemSx,
        display: "flex",
        alignItems: "center",
        gap: 1,
        pr: 0.75,
        "& ._act": { opacity: 0, pointerEvents: "none" },
        "&:hover ._act": { opacity: 1, pointerEvents: "auto" },
      }}
    >
      <ListItemIcon sx={{ minWidth: 28, color: "#fff" }}>
        {selected ? <CheckRoundedIcon fontSize="small" /> : null}
      </ListItemIcon>

      <ListItemText
        primary={primary}
        secondary={secondary || ""}
        primaryTypographyProps={{ fontWeight: 900, fontSize: 13 }}
        secondaryTypographyProps={{ fontSize: 11, color: alpha("#fff", 0.65) }}
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
                color: alpha("#fff", 0.9),
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
              color: dangerDelete ? danger : alpha("#fff", 0.9),
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
