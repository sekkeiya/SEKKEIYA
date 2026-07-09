import React from "react";
import { Box, Paper, Stack, Typography, alpha } from "@mui/material";
import { useEnvironmentStore } from "../../store/useEnvironmentStore";

// プリセットの背景色（ワンクリック用）
const PRESET_COLORS = ["#ffffff", "#f2f2f2", "#d9d9d9", "#9aa0a6", "#0a0c12", "#000000"];

export default function BackgroundSettingsDock() {
  const noneBackgroundColor = useEnvironmentStore((s) => s.noneBackgroundColor);
  const setNoneBackgroundColor = useEnvironmentStore((s) => s.setNoneBackgroundColor);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        bgcolor: alpha("#0b1020", 0.62),
        backdropFilter: "blur(10px)",
        border: `1px solid ${alpha("#fff", 0.14)}`,
        borderRadius: 2,
        color: "#fff",
        minWidth: 200,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
        背景色（通常表示）
      </Typography>

      {/* 現在の色 + カラーピッカー */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="caption" sx={{ color: alpha("#fff", 0.6) }}>
          {noneBackgroundColor}
        </Typography>
        <Box sx={{ position: "relative", width: 40, height: 26, borderRadius: 1, overflow: "hidden", border: `1px solid ${alpha("#fff", 0.25)}` }}>
          <Box sx={{ position: "absolute", inset: 0, bgcolor: noneBackgroundColor }} />
          <input
            type="color"
            value={noneBackgroundColor}
            onChange={(e) => setNoneBackgroundColor(e.target.value)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
          />
        </Box>
      </Box>

      {/* プリセット */}
      <Stack direction="row" spacing={0.75}>
        {PRESET_COLORS.map((c) => {
          const selected = c.toLowerCase() === (noneBackgroundColor || "").toLowerCase();
          return (
            <Box
              key={c}
              onClick={() => setNoneBackgroundColor(c)}
              sx={{
                width: 22, height: 22, borderRadius: "50%", cursor: "pointer", bgcolor: c,
                border: `2px solid ${selected ? "#00BFFF" : alpha("#fff", 0.25)}`,
                transition: "border-color 0.15s",
                "&:hover": { borderColor: "#00BFFF" },
              }}
            />
          );
        })}
      </Stack>

      <Typography variant="caption" sx={{ color: alpha("#fff", 0.3), fontSize: 9, lineHeight: 1.5 }}>
        ※ Lighting 表示中は Environment の背景が優先されます。
      </Typography>
    </Paper>
  );
}
