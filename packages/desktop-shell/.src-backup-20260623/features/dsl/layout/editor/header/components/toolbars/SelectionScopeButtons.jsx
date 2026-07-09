import React, { useCallback } from "react";
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SelectAllRoundedIcon from "@mui/icons-material/SelectAllRounded";
import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";

import { useSelectionScopeStore } from "@desktop/features/dsl/layout/store/useSelectionScopeStore";
import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";
import { useUiPropertiesSelectionStore } from "@desktop/features/dsl/layout/store/uiPropertiesSelectionStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";

const OPTIONS = [
  { value: "all",      label: "ALL",      icon: <SelectAllRoundedIcon sx={{ fontSize: 13 }} />, tooltip: "すべて選択可" },
  { value: "item",     label: "Item",     icon: <ChairRoundedIcon sx={{ fontSize: 13 }} />,     tooltip: "家具（Item）のみ選択" },
  { value: "lighting", label: "Lighting", icon: <LightbulbRoundedIcon sx={{ fontSize: 13 }} />, tooltip: "照明（Lighting）のみ選択" },
  { value: "zone",     label: "Zone",     icon: <CropFreeRoundedIcon sx={{ fontSize: 13 }} />,  tooltip: "ゾーン（Zone）のみ選択" },
];

export default function SelectionScopeButtons() {
  const theme = useTheme();
  const scope = useSelectionScopeStore((s) => s.scope);
  const setScope = useSelectionScopeStore((s) => s.setScope);

  const handleChange = useCallback(
    (_e, next) => {
      if (!next) return;
      setScope(next);

      // Clear selections that no longer fit the new scope so the user does not
      // end up holding a hidden selection from a different kind.
      if (next === "item") {
        const sel = useUiPropertiesSelectionStore.getState().selection;
        if (sel?.kind === "light") useUiPropertiesSelectionStore.getState().clearSelection();
        useLayoutTaskStore.getState().setActiveZoneId(null);
      } else if (next === "lighting") {
        useUiSelectionStore.getState().setSelectedItemIds([]);
        useLayoutTaskStore.getState().setActiveZoneId(null);
      } else if (next === "zone") {
        useUiSelectionStore.getState().setSelectedItemIds([]);
        const sel = useUiPropertiesSelectionStore.getState().selection;
        if (sel?.kind === "light") useUiPropertiesSelectionStore.getState().clearSelection();
      }
    },
    [setScope]
  );

  const accent = theme.palette.primary.main;
  const line = alpha(theme.palette.common.white, 0.12);

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={scope}
        onChange={handleChange}
        sx={{
          height: 26,
          borderRadius: 1,
          background: alpha("#fff", 0.04),
          border: `1px solid ${line}`,
          "& .MuiToggleButton-root": {
            height: 24,
            px: 1,
            border: "none",
            borderRadius: 0.75,
            color: alpha("#fff", 0.65),
            fontSize: 11,
            fontWeight: 800,
            textTransform: "none",
            letterSpacing: 0.2,
            gap: 0.4,
            minWidth: 0,
            "&:hover": {
              background: alpha("#fff", 0.06),
              color: alpha("#fff", 0.9),
            },
            "&.Mui-selected": {
              background: alpha(accent, 0.22),
              color: alpha("#fff", 0.95),
              "&:hover": {
                background: alpha(accent, 0.3),
              },
            },
          },
        }}
      >
        {OPTIONS.map((opt) => (
          <ToggleButton key={opt.value} value={opt.value} disableRipple>
            <Tooltip title={opt.tooltip} arrow>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                {opt.icon}
                {opt.label}
              </Box>
            </Tooltip>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
