import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, TextField, Select, MenuItem,
  InputLabel, FormControl, Divider, Chip, Box,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";

const ZONE_CATEGORIES = [
  { value: "work",      label: "Work（執務）",        color: "#3b82f6" },
  { value: "collab",    label: "Collab（協働）",       color: "#10b981" },
  { value: "lounge",    label: "Lounge（休憩）",       color: "#f59e0b" },
  { value: "meeting",   label: "Meeting（会議）",       color: "#ef4444" },
  { value: "reception", label: "Reception（受付）",     color: "light-dark(#3809a4, #8b5cf6)" },
  { value: "focus",     label: "Focus（集中）",         color: "light-dark(#9d1056, #ec4899)" },
  { value: "other",     label: "Other（その他）",       color: "rgb(var(--brand-fg-rgb) / 0.65)" },
];

const ZONE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

function pickColor(existingCount) {
  return ZONE_COLORS[existingCount % ZONE_COLORS.length];
}

const dialogPaperSx = {
  background: "rgba(14, 18, 36, 0.97)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)",
  borderRadius: 3,
  minWidth: 380,
  color: "var(--brand-fg)",
};

const fieldSx = {
  "& .MuiInputBase-root": {
    background: "rgb(var(--brand-fg-rgb) / 0.06)",
    borderRadius: 1.5,
    color: "var(--brand-fg)",
    fontSize: 13,
  },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgb(var(--brand-fg-rgb) / 0.15)" },
  "& .MuiInputLabel-root": { color: "rgb(var(--brand-fg-rgb) / 0.5)", fontSize: 13 },
  "& .MuiSelect-icon": { color: "rgb(var(--brand-fg-rgb) / 0.5)" },
};

/**
 * ZoneCreateDialog
 *
 * Props:
 *   open: boolean
 *   pendingRect: ZoneRect | null — 描画済み矩形
 *   rooms: Room[]
 *   existingZoneCount: number
 *   onConfirm: (data: ZoneCreatePayload) => void
 *   onCancel: () => void
 */
export default function ZoneCreateDialog({
  open,
  pendingRect,
  rooms = [],
  existingZoneCount = 0,
  onConfirm,
  onCancel,
}) {
  const [roomId, setRoomId] = useState("__new__");
  const [newRoomName, setNewRoomName] = useState("");
  const [category, setCategory] = useState("work");
  const [zoneName, setZoneName] = useState("");
  const [targetSeats, setTargetSeats] = useState(4);

  // カテゴリが変わったとき Zone 名を自動生成
  useEffect(() => {
    if (!open) return;
    const cat = ZONE_CATEGORIES.find((c) => c.value === category);
    const roomLabel = roomId !== "__new__"
      ? rooms.find((r) => r.id === roomId)?.name ?? ""
      : newRoomName.trim();
    setZoneName(roomLabel ? `${roomLabel} / ${cat?.label?.split("（")[0] ?? category}` : (cat?.label?.split("（")[0] ?? category));
  }, [category, roomId, newRoomName, open]);

  // ダイアログが開くたびリセット
  useEffect(() => {
    if (!open) return;
    setRoomId("__new__");
    setNewRoomName("");
    setCategory("work");
    setTargetSeats(4);
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (!pendingRect) return;
    const cat = ZONE_CATEGORIES.find((c) => c.value === category);
    const color = cat?.color ?? pickColor(existingZoneCount);

    onConfirm?.({
      rect: pendingRect,
      color,
      zoneName: zoneName.trim() || `Zone ${existingZoneCount + 1}`,
      category,
      targetSeats: Number(targetSeats) || 4,
      roomId: roomId !== "__new__" ? roomId : null,
      newRoomName: roomId === "__new__" ? newRoomName.trim() : null,
      createdBy: "user",
      createdAtMs: Date.now(),
    });
  }, [pendingRect, category, zoneName, targetSeats, roomId, newRoomName, existingZoneCount, onConfirm]);

  const selectedCat = ZONE_CATEGORIES.find((c) => c.value === category);

  return (
    <Dialog open={open} onClose={onCancel} PaperProps={{ sx: dialogPaperSx }}>
      <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <GridOnRoundedIcon sx={{ fontSize: 20, color: "light-dark(#2f07a6, #a78bfa)" }} />
        <Typography sx={{ fontWeight: 800, fontSize: 15 }}>ゾーンを作成</Typography>
        {pendingRect && (
          <Chip
            size="small"
            label={`${pendingRect.width.toFixed(1)}m × ${pendingRect.depth.toFixed(1)}m`}
            sx={{ ml: "auto", fontSize: 11, height: 20, background: alpha("#7c3aed", 0.25), color: "light-dark(#2705a9, #c4b5fd)", border: `1px solid ${alpha("#7c3aed", 0.4)}` }}
          />
        )}
      </DialogTitle>

      <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.08)" }} />

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        <Stack spacing={2.5}>

          {/* Room */}
          <Stack spacing={1}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, opacity: 0.7, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Room（部屋・エリア）
            </Typography>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <MenuItem value="__new__">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <AddRoundedIcon sx={{ fontSize: 14 }} />
                    <span>新しいRoomを作成...</span>
                  </Box>
                </MenuItem>
                {rooms.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {roomId === "__new__" && (
              <TextField
                fullWidth
                size="small"
                placeholder="Room 名を入力（例: 執務エリアA）"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                sx={fieldSx}
                inputProps={{ style: { color: "var(--brand-fg)" } }}
              />
            )}
          </Stack>

          {/* Zone Category */}
          <Stack spacing={1}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, opacity: 0.7, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Zone カテゴリ
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {ZONE_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.value}
                  size="small"
                  label={cat.label}
                  clickable
                  onClick={() => setCategory(cat.value)}
                  sx={{
                    fontSize: 11.5,
                    height: 26,
                    fontWeight: category === cat.value ? 800 : 500,
                    background: category === cat.value ? `color-mix(in srgb, ${cat.color} 30%, transparent)` : alpha("#fff", 0.06),
                    border: `1px solid ${category === cat.value ? `color-mix(in srgb, ${cat.color} 60%, transparent)` : alpha("#fff", 0.12)}`,
                    color: category === cat.value ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 65%, transparent)",
                    "&:hover": { background: `color-mix(in srgb, ${cat.color} 20%, transparent)` },
                  }}
                />
              ))}
            </Box>
          </Stack>

          {/* Zone Name */}
          <Stack spacing={1}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, opacity: 0.7, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Zone 名
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              sx={fieldSx}
              inputProps={{ style: { color: "var(--brand-fg)" } }}
              placeholder="Zone 名を入力"
            />
          </Stack>

          {/* Target Seats */}
          <Stack spacing={1}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, opacity: 0.7, letterSpacing: 0.5, textTransform: "uppercase" }}>
              目標席数
            </Typography>
            <TextField
              size="small"
              type="number"
              value={targetSeats}
              onChange={(e) => setTargetSeats(Math.max(1, Number(e.target.value)))}
              inputProps={{ min: 1, style: { color: "var(--brand-fg)", width: 80 } }}
              sx={{ ...fieldSx, width: 100 }}
            />
          </Stack>

        </Stack>
      </DialogContent>

      <Divider sx={{ mt: 2, borderColor: "rgb(var(--brand-fg-rgb) / 0.08)" }} />

      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onCancel} size="small" sx={{ color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)", fontSize: 12 }}>
          キャンセル
        </Button>
        <Button
          onClick={handleConfirm}
          size="small"
          variant="contained"
          sx={{
            background: selectedCat?.color ?? "#7c3aed",
            fontSize: 12,
            fontWeight: 700,
            px: 2.5,
            borderRadius: 1.5,
            "&:hover": { background: selectedCat?.color ? `color-mix(in srgb, ${selectedCat.color} 80%, transparent)` : "#6d28d9" },
          }}
        >
          作成する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
