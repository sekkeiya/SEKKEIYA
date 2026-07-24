import React from "react";
import { Box, Paper, Stack, Typography, Slider, alpha, Switch, Button, IconButton, InputBase } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import { useEditorModeStore } from "../../store/useEditorModeStore";

export default function GridSettingsDock() {
  const isGridVisible = useEditorModeStore((s) => s.isGridVisible);
  const setIsGridVisible = useEditorModeStore((s) => s.setIsGridVisible);

  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm);
  const setGridHeightMm = useEditorModeStore((s) => s.setGridHeightMm);

  const gridCellSizeMm = useEditorModeStore((s) => s.gridCellSizeMm);
  const setGridCellSizeMm = useEditorModeStore((s) => s.setGridCellSizeMm);

  const gridLineStyle = useEditorModeStore((s) => s.gridLineStyle);
  const setGridLineStyle = useEditorModeStore((s) => s.setGridLineStyle);
  const gridLineColor = useEditorModeStore((s) => s.gridLineColor);
  const setGridLineColor = useEditorModeStore((s) => s.setGridLineColor);
  const gridLineOpacity = useEditorModeStore((s) => s.gridLineOpacity);
  const setGridLineOpacity = useEditorModeStore((s) => s.setGridLineOpacity);

  const isGridPickingMode = useEditorModeStore((s) => s.isGridPickingMode);
  const setIsGridPickingMode = useEditorModeStore((s) => s.setIsGridPickingMode);

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
        gap: 1.5,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
          Floor Grid
        </Typography>
        <Switch
          size="small"
          checked={isGridVisible}
          onChange={(e) => setIsGridVisible(e.target.checked)}
        />
      </Box>

      {isGridVisible && (
        <Stack spacing={1}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6) }}>
              Height
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", bgcolor: alpha("#000", 0.3), borderRadius: 1, px: 1, py: 0.25 }}>
               <InputBase
                 value={gridHeightMm}
                 onChange={(e) => {
                   const rawValue = e.target.value;
                   console.log(`[GridSettingsDock] Height onChange raw: "${rawValue}" (type: ${typeof rawValue})`);
                   if (rawValue === "" || rawValue === "-") {
                     return; // Allow typing negative numbers or clearing temporarily without saving NaN to store
                   }
                   const val = Number(rawValue);
                   console.log(`[GridSettingsDock] Height parsed: ${val} (isNaN: ${isNaN(val)})`);
                   if (!isNaN(val)) {
                      setGridHeightMm(val);
                   }
                 }}
                 inputProps={{ 
                   style: { textAlign: "right", padding: 0, width: "50px", fontSize: "0.75rem", fontFamily: "monospace", color: "#fff", fontWeight: "bold" },
                   type: "number"
                 }}
               />
               <Typography variant="caption" sx={{ ml: 0.5, color: alpha("#fff", 0.5), fontSize: "0.7rem" }}>
                 mm
               </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6) }}>
              Grid Size
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", bgcolor: alpha("#000", 0.3), borderRadius: 1, px: 1, py: 0.25 }}>
               <InputBase
                 value={gridCellSizeMm}
                 onChange={(e) => {
                   const rawValue = e.target.value;
                   console.log(`[GridSettingsDock] CellSize onChange raw: "${rawValue}" (type: ${typeof rawValue})`);
                   if (rawValue === "") return;
                   const val = Number(rawValue);
                   console.log(`[GridSettingsDock] CellSize parsed: ${val} (isNaN: ${isNaN(val)})`);
                   if (!isNaN(val)) {
                      setGridCellSizeMm(val);
                   }
                 }}
                 inputProps={{ 
                   style: { textAlign: "right", padding: 0, width: "50px", fontSize: "0.75rem", fontFamily: "monospace", color: "#fff", fontWeight: "bold" },
                   type: "number",
                   step: 100
                 }}
               />
               <Typography variant="caption" sx={{ ml: 0.5, color: alpha("#fff", 0.5), fontSize: "0.7rem" }}>
                 mm
               </Typography>
            </Box>
          </Box>
          
          {/* よく使うグリッド寸法のプリセット（455=半間 / 910=1間 / 1000=メートル）。 */}
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {[455, 910, 1000].map((v) => {
              const active = gridCellSizeMm === v;
              return (
                <Button
                  key={v}
                  size="small"
                  onClick={() => setGridCellSizeMm(v)}
                  variant={active ? "contained" : "outlined"}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    px: 0.5,
                    py: 0.25,
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    textTransform: "none",
                    lineHeight: 1.2,
                    color: active ? "#fff" : alpha("#fff", 0.8),
                    borderColor: active ? "transparent" : alpha("#fff", 0.2),
                    bgcolor: active ? alpha("#2080ff", 0.6) : "transparent",
                    "&:hover": { bgcolor: active ? alpha("#2080ff", 0.7) : alpha("#fff", 0.12) },
                  }}
                >
                  {v}
                </Button>
              );
            })}
          </Box>

          {/* 線種（実線 / 破線 / 点線） */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6) }}>
              Line
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flex: 1, justifyContent: "flex-end" }}>
              {[["solid", "実線"], ["dashed", "破線"], ["dotted", "点線"]].map(([val, label]) => {
                const active = gridLineStyle === val;
                return (
                  <Button
                    key={val}
                    size="small"
                    onClick={() => setGridLineStyle(val)}
                    variant={active ? "contained" : "outlined"}
                    sx={{
                      minWidth: 0,
                      px: 1,
                      py: 0.25,
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      textTransform: "none",
                      lineHeight: 1.2,
                      color: active ? "#fff" : alpha("#fff", 0.8),
                      borderColor: active ? "transparent" : alpha("#fff", 0.2),
                      bgcolor: active ? alpha("#2080ff", 0.6) : "transparent",
                      "&:hover": { bgcolor: active ? alpha("#2080ff", 0.7) : alpha("#fff", 0.12) },
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </Box>
          </Box>

          {/* 線の色 */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6) }}>
              Color
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: alpha("#fff", 0.5), fontFamily: "monospace", fontSize: "0.7rem" }}>
                {gridLineColor}
              </Typography>
              <Box
                component="input"
                type="color"
                value={gridLineColor}
                onChange={(e) => setGridLineColor(e.target.value)}
                sx={{
                  width: 26,
                  height: 22,
                  p: 0,
                  border: `1px solid ${alpha("#fff", 0.2)}`,
                  borderRadius: 1,
                  bgcolor: "transparent",
                  cursor: "pointer",
                }}
              />
            </Box>
          </Box>

          {/* 透明度 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6), minWidth: 52 }}>
              Opacity
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.05}
              value={gridLineOpacity}
              onChange={(_, v) => setGridLineOpacity(Array.isArray(v) ? v[0] : v)}
              sx={{ color: "#2080ff", flex: 1 }}
            />
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6), minWidth: 30, textAlign: "right", fontFamily: "monospace", fontSize: "0.7rem" }}>
              {Math.round(gridLineOpacity * 100)}%
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button
              fullWidth
              size="small"
              variant={isGridPickingMode ? "contained" : "outlined"}
              color={isGridPickingMode ? "primary" : "inherit"}
              startIcon={<CenterFocusStrongIcon fontSize="small" />}
              onClick={() => setIsGridPickingMode(!isGridPickingMode)}
              sx={{
                textTransform: "none",
                fontSize: "0.7rem",
                borderColor: isGridPickingMode ? "transparent" : alpha("#fff", 0.2),
                color: isGridPickingMode ? "#fff" : alpha("#fff", 0.8),
                boxShadow: isGridPickingMode ? `0 0 10px ${alpha("#2080ff", 0.5)}` : "none"
              }}
            >
              {isGridPickingMode ? "Picking..." : "Pick Surface"}
            </Button>
          </Box>
        </Stack>
      )}
    </Paper>
  );
}
