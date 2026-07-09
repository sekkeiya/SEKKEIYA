import React, { useState } from "react";
import { Modal, Box, Typography, Button, Stack, Divider, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useViewportKeymapStore } from "../../store/viewportKeymapStore";
import type { KeymapBinding, ViewportKeymap } from "../../config/viewportKeymapConfig";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const formatBinding = (binding: KeymapBinding) => {
  const parts = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");
  
  if (binding.key.startsWith("Key")) parts.push(binding.key.slice(3));
  else if (binding.key.startsWith("Digit")) parts.push(binding.key.slice(5));
  else parts.push(binding.key);
  
  return parts.join(" + ");
};

const KeyBindingRow = ({ 
  label, 
  group, 
  action, 
  binding 
}: { 
  label: string, 
  group: keyof ViewportKeymap, 
  action: string, 
  binding: KeymapBinding 
}) => {
  const setKey = useViewportKeymapStore(s => s.setKey);
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only key presses
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

    setKey(group, action, {
      key: e.code,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey
    });
    setIsRecording(false);
  };

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>{label}</Typography>
      <Button 
        variant={isRecording ? "contained" : "outlined"} 
        color={isRecording ? "primary" : "inherit"}
        size="small"
        sx={{ minWidth: 120, textTransform: "none", borderColor: "divider" }}
        onClick={() => setIsRecording(true)}
        onKeyDown={isRecording ? handleKeyDown : undefined}
        onBlur={() => setIsRecording(false)}
      >
        {isRecording ? "Press any key..." : formatBinding(binding)}
      </Button>
    </Stack>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { keymap, resetToDefault } = useViewportKeymapStore();

  return (
    <Modal open={open} onClose={onClose} disableRestoreFocus>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 24,
        p: 3,
        outline: 'none',
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Keymap Settings</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1, color: "text.primary" }}>View Controls</Typography>
        <Box sx={{ mb: 3 }}>
          <KeyBindingRow label="Top View" group="view" action="top" binding={keymap.view.top} />
          <KeyBindingRow label="Front View" group="view" action="front" binding={keymap.view.front} />
          <KeyBindingRow label="Right View" group="view" action="right" binding={keymap.view.right} />
          <KeyBindingRow label="Perspective View" group="view" action="perspective" binding={keymap.view.perspective} />
        </Box>

        <Typography variant="subtitle2" sx={{ mb: 1, color: "text.primary" }}>Speed Controls</Typography>
        <Box sx={{ mb: 3 }}>
          <KeyBindingRow label="Inspect Speed" group="speed" action="inspect" binding={keymap.speed.inspect} />
          <KeyBindingRow label="Walk Speed" group="speed" action="walk" binding={keymap.speed.walk} />
          <KeyBindingRow label="Cycle Speed" group="speed" action="cycle" binding={keymap.speed.cycle} />
          <KeyBindingRow label="Drive Speed" group="speed" action="drive" binding={keymap.speed.drive} />
          <KeyBindingRow label="Fly Speed" group="speed" action="fly" binding={keymap.speed.fly} />
        </Box>

        <Stack direction="row" justifyContent="space-between">
          <Button size="small" color="error" onClick={resetToDefault}>
            Reset to Defaults
          </Button>
          <Button size="small" variant="contained" onClick={onClose}>
            Done
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};
