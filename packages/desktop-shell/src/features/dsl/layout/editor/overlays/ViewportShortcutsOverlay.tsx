import React, { useState } from "react";
import { Box, Typography, IconButton, Collapse, Fade } from "@mui/material";
import {
  KeyboardArrowDown as FoldIcon,
  KeyboardArrowUp as ExpandIcon,
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
} from "@mui/icons-material";
import { useViewportUiStore } from "../../store/viewportUiStore";
import { useViewportKeymapStore } from "../../store/viewportKeymapStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { VIEWPORT_HELP_CONFIG } from "../../config/viewportHelpConfig";

const MiniKeyChip = ({ label }: { label: string }) => (
  <Box
    sx={{
      display: "inline-block",
      backgroundColor: "rgb(var(--brand-fg-rgb) / 0.15)",
      borderRadius: "3px",
      padding: "1px 4px",
      fontSize: "0.65rem",
      fontWeight: 500,
      color: "rgb(var(--brand-fg-rgb) / 0.9)",
      mr: 0.5,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </Box>
);

export default function ViewportShortcutsOverlay() {
  const visible = useViewportUiStore((s) => s.shortcutsOverlayVisible);
  const setVisible = useViewportUiStore((s) => s.setShortcutsOverlayVisible);

  // Local state to toggle fold/expand without completely turning off the overlay feature
  const [folded, setFolded] = useState(false);

  const { keymap } = useViewportKeymapStore();

  const formatKeyBinding = (binding: any) => {
    const parts = [];
    if (binding.ctrl) parts.push("Ctrl");
    if (binding.shift) parts.push("Shift");
    if (binding.alt) parts.push("Alt");
    
    if (binding.key.startsWith("Key")) parts.push(binding.key.slice(3));
    else if (binding.key.startsWith("Digit")) parts.push(binding.key.slice(5));
    else parts.push(binding.key);
    
    return parts;
  };

  const dynamicItems = [
    { keys: formatKeyBinding(keymap.view.top), action: "Top View" },
    { keys: formatKeyBinding(keymap.view.front), action: "Front View" },
    { keys: formatKeyBinding(keymap.view.right), action: "Right View" },
    { keys: formatKeyBinding(keymap.view.perspective), action: "Perspective" },
  ];

  // We extract a simplified list of just the most critical actions
  // to avoid cluttering the screen.
  const allItems = VIEWPORT_HELP_CONFIG.flatMap((cat) => cat.items);
  const criticalItems = [
    ...allItems.filter(
      (item) =>
        item.action === "Look Around" ||
        item.action === "Move" ||
        item.action === "Orbit" ||
        item.action === "Pan"
    ),
    ...dynamicItems
  ];

  const mode = useEditorModeStore((s) => s.editorMode);
  
  if (mode !== "normal") return null;

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        left: 24,
        bottom: 24,
        zIndex: 10,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <Fade in={visible}>
        <Box
          sx={{
            backgroundColor: "rgba(20, 20, 20, 0.65)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0px 4px 12px rgba(0,0,0,0.5)",
            transition: "all 0.2s ease-in-out",
          }}
        >
          {/* Header row (Folded view) */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: 1,
              py: 0.5,
              cursor: "pointer",
              "&:hover": { backgroundColor: "rgb(var(--brand-fg-rgb) / 0.05)" },
            }}
            onClick={() => setFolded(!folded)}
          >
            <KeyboardIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
            <Typography variant="caption" fontWeight={600} sx={{ color: "text.secondary", mr: 2 }}>
              Shortcuts
            </Typography>

            <Box sx={{ flexGrow: 1 }} />

            <IconButton size="small" sx={{ p: 0.2, color: "text.secondary" }}>
              {folded ? <ExpandIcon fontSize="small" /> : <FoldIcon fontSize="small" />}
            </IconButton>
            <IconButton
              size="small"
              sx={{ p: 0.2, ml: 0.5, color: "text.secondary" }}
              onClick={(e) => {
                e.stopPropagation();
                setVisible(false);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Collapse in={!folded}>
            <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {criticalItems.map((item, idx) => (
                <Box key={idx} sx={{ display: "flex", alignItems: "center" }}>
                  <Box sx={{ display: "flex", minWidth: "110px" }}>
                    {item.keys.map((k, i) => (
                      <React.Fragment key={i}>
                        <MiniKeyChip label={k} />
                      </React.Fragment>
                    ))}
                  </Box>
                  <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", ml: 1 }}>
                    {item.action}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      </Fade>
    </Box>
  );
}
