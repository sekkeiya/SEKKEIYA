// src/features/layout/components/Header/components/ConfirmDialog.jsx
import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";

export default function ConfirmDialog({
  open,
  title,
  description,
  busy = false,
  onClose,
  onConfirm,
}) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: "color-mix(in srgb, var(--brand-surface) 98%, transparent)",
          border: `1px solid ${alpha("#fff", 0.10)}`,
          color: "var(--brand-fg)",
          minWidth: 420,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 900 }}>{title || "Confirm"}</DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ color: "color-mix(in srgb, var(--brand-fg) 72%, transparent)" }}>
          {description || "Are you sure?"}
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={busy}
          sx={{
            borderRadius: 999,
            fontWeight: 900,
            color: "color-mix(in srgb, var(--brand-fg) 90%, transparent)",
            border: `1px solid ${alpha("#fff", 0.18)}`,
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant="contained"
          sx={{
            borderRadius: 999,
            fontWeight: 900,
            background: alpha("#ff5252", 0.95),
            "&:hover": { background: alpha("#ff5252", 1) },
          }}
        >
          {busy ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
