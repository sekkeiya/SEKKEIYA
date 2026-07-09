import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Paper,
  Divider,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useViewportUiStore } from "../../store/viewportUiStore";
import { VIEWPORT_HELP_CONFIG } from "../../config/viewportHelpConfig";

const KeyChip = ({ label }: { label: string }) => (
  <Box
    sx={{
      display: "inline-block",
      backgroundColor: "rgb(var(--brand-fg-rgb) / 0.1)",
      border: "1px solid rgb(var(--brand-fg-rgb) / 0.2)",
      borderRadius: "4px",
      padding: "2px 6px",
      fontSize: "0.75rem",
      fontWeight: 600,
      color: "text.primary",
      boxShadow: "0px 1px 2px rgba(0,0,0,0.3)",
      mr: 0.5,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </Box>
);

export default function ViewportHelpModal() {
  const open = useViewportUiStore((s) => s.helpModalOpen);
  const setOpen = useViewportUiStore((s) => s.setHelpModalOpen);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            backgroundColor: "var(--brand-surface2)",
            backgroundImage: "none",
            borderRadius: "12px",
            border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)",
          },
        },
      }}
    >
      <DialogTitle sx={{ pr: 6, display: "flex", alignItems: "center", pb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          3DSL 操作ガイド
        </Typography>
        <IconButton
          onClick={handleClose}
          sx={{ position: "absolute", right: 12, top: 12, color: "text.secondary" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 3, px: 3 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 3 }}>
          {VIEWPORT_HELP_CONFIG.map((category, idx) => (
            <Paper
              key={idx}
              elevation={0}
              sx={{
                p: 2,
                backgroundColor: "rgb(var(--brand-fg-rgb) / 0.03)",
                border: "1px solid rgb(var(--brand-fg-rgb) / 0.08)",
                borderRadius: "8px",
              }}
            >
              <Typography variant="subtitle1" fontWeight={600} color="primary.main" gutterBottom>
                {category.title}
              </Typography>
              <Divider sx={{ mb: 2, borderColor: "rgb(var(--brand-fg-rgb) / 0.05)" }} />

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {category.items.map((item, itemIdx) => (
                  <Box key={itemIdx} sx={{ pl: 0.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {item.keys.map((k, i) => (
                          <React.Fragment key={i}>
                            <KeyChip label={k} />
                            {i < item.keys.length - 1 && (
                              <Typography variant="caption" sx={{ color: "text.secondary", mx: 0.5 }}>
                                +
                              </Typography>
                            )}
                          </React.Fragment>
                        ))}
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: "12px" }} />
                      <Typography variant="body2" fontWeight={600} sx={{ color: "text.primary" }}>
                        {item.action}
                      </Typography>
                    </Box>
                    {item.description && (
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                        {item.description}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Paper>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
