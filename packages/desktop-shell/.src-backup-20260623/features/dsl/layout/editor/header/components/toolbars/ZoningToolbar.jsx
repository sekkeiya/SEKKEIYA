import React from "react";
import { Box, ToggleButtonGroup, ToggleButton, Divider, Select, MenuItem, Typography, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useZoningStore } from "@desktop/features/dsl/layout/store/useZoningStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";

import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PanToolAltRoundedIcon from "@mui/icons-material/PanToolAltRounded";
import AddLocationAltRoundedIcon from "@mui/icons-material/AddLocationAltRounded";
import WrongLocationRoundedIcon from "@mui/icons-material/WrongLocationRounded";

export default function ZoningToolbar() {
  const zoningSubMode = useZoningStore((s) => s.zoningSubMode);
  const setZoningSubMode = useZoningStore((s) => s.setZoningSubMode);
  const isZoningActionSelect = useZoningStore((s) => s.isZoningActionSelect);
  const setIsZoningActionSelect = useZoningStore((s) => s.setIsZoningActionSelect);
  const selectedCirculationId = useZoningStore((s) => s.selectedCirculationId);
  const circulations = useLayoutTaskStore((s) => s.circulations);
  const selectedCirc = circulations.find((c) => c.id === selectedCirculationId);

  const circulationType = useZoningStore((s) => s.circulationType);
  const setCirculationType = useZoningStore((s) => s.setCirculationType);
  const circulationWidths = useZoningStore((s) => s.circulationWidths);
  const setCirculationWidth = useZoningStore((s) => s.setCirculationWidth);
  const circulationEditMode = useZoningStore((s) => s.circulationEditMode);
  const setCirculationEditMode = useZoningStore((s) => s.setCirculationEditMode);

  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setZoningSubMode(newMode);
    }
  };

  const updateSelectedCirc = (updates) => {
    if (!selectedCirculationId) return;
    const nextCircs = circulations.map(c => c.id === selectedCirculationId ? { ...c, ...updates } : c);
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateCirculations", { detail: { circulations: nextCircs } }));
  };

  const deleteSelectedCirc = () => {
    if (!selectedCirculationId) return;
    const nextCircs = circulations.filter((c) => c.id !== selectedCirculationId);
    useZoningStore.getState().setSelectedCirculationId(null);
    useZoningStore.getState().setSelectedCirculationNodeIndex(null);
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateCirculations", { detail: { circulations: nextCircs } }));
  };

  const tbStyle = {
    px: 1.5,
    height: 28,
    textTransform: "none",
    fontWeight: 700,
    fontSize: 12,
    color: alpha("#fff", 0.6),
    borderColor: alpha("#fff", 0.1),
    "&.Mui-selected": {
      color: "#fff",
      backgroundColor: alpha("#fff", 0.15),
    },
    gap: 0.5,
  };

  const selectStyle = {
    height: 28,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: alpha("#fff", 0.15),
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: alpha("#fff", 0.3),
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: alpha("#fff", 0.5),
    },
    "& .MuiSvgIcon-root": {
      color: alpha("#fff", 0.6),
    },
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5, minHeight: 30 }}>
      <ToggleButtonGroup
        value={zoningSubMode}
        exclusive
        onChange={handleModeChange}
        size="small"
      >
        <ToggleButton value="zone" sx={tbStyle}>
          <DashboardCustomizeRoundedIcon sx={{ fontSize: 16 }} />
          ゾーン
        </ToggleButton>
        {/* Area is intentionally hidden for now (Retroactive Space Programming) */}
        <ToggleButton value="circulation" sx={tbStyle}>
          <TimelineRoundedIcon sx={{ fontSize: 16 }} />
          導線
        </ToggleButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8, borderColor: alpha("#fff", 0.15) }} />

      <ToggleButtonGroup
        value={isZoningActionSelect ? "select" : "create"}
        exclusive
        onChange={(e, v) => {
          if (v !== null) setIsZoningActionSelect(v === "select");
        }}
        size="small"
      >
        <ToggleButton value="create" sx={tbStyle}>
          <AddRoundedIcon sx={{ fontSize: 16, mr: 0.5 }} />
          作成
        </ToggleButton>
        <ToggleButton value="select" sx={tbStyle}>
          <NearMeRoundedIcon sx={{ fontSize: 16, mr: 0.5 }} />
          選択
        </ToggleButton>
      </ToggleButtonGroup>

      {zoningSubMode === "circulation" && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8, borderColor: alpha("#fff", 0.15) }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <ToggleButtonGroup
              value={isZoningActionSelect && selectedCirc ? selectedCirc.type : circulationType}
              exclusive
              onChange={(e, v) => {
                if (!v) return;
                if (isZoningActionSelect && selectedCirc) {
                  updateSelectedCirc({ type: v });
                } else {
                  setCirculationType(v);
                }
              }}
              size="small"
            >
              <ToggleButton value="main" sx={tbStyle}>Main</ToggleButton>
              <ToggleButton value="sub" sx={tbStyle}>Sub</ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Select
                value={isZoningActionSelect && selectedCirc ? (selectedCirc.width || 600) : circulationWidths[circulationType]}
                onChange={(e) => {
                  const w = Number(e.target.value);
                  if (isZoningActionSelect && selectedCirc) {
                    updateSelectedCirc({ width: w });
                  } else {
                    setCirculationWidth(circulationType, w);
                  }
                }}
                sx={{ ...selectStyle, width: 90 }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: "#1e293b",
                      border: `1px solid ${alpha("#fff", 0.1)}`,
                      "& .MuiMenuItem-root": { fontSize: 13, color: "#fff" }
                    }
                  }
                }}
              >
                <MenuItem value={600}>600</MenuItem>
                <MenuItem value={900}>900</MenuItem>
                <MenuItem value={1200}>1200</MenuItem>
                <MenuItem value={1500}>1500</MenuItem>
              </Select>
              <Typography sx={{ fontSize: 11, color: alpha('#fff', 0.5) }}>mm</Typography>
            </Box>

            {isZoningActionSelect && selectedCirc && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8, borderColor: alpha("#fff", 0.15) }} />

                <ToggleButtonGroup
                  value={circulationEditMode}
                  exclusive
                  onChange={(e, v) => {
                    if (v) setCirculationEditMode(v);
                  }}
                  size="small"
                >
                  <ToggleButton value="move" sx={tbStyle} title="ノードの移動 (Move Node)">
                    <PanToolAltRoundedIcon sx={{ fontSize: 16 }} />
                  </ToggleButton>
                  <ToggleButton value="add" sx={tbStyle} title="ノードの追加 (Add Node)">
                    <AddLocationAltRoundedIcon sx={{ fontSize: 16 }} />
                  </ToggleButton>
                  <ToggleButton value="delete" sx={tbStyle} title="ノードの削除 (Delete Node)">
                    <WrongLocationRoundedIcon sx={{ fontSize: 16 }} />
                  </ToggleButton>
                </ToggleButtonGroup>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8, borderColor: alpha("#fff", 0.15) }} />
                <IconButton
                  size="small"
                  onClick={deleteSelectedCirc}
                  sx={{
                    p: 0.5,
                    color: "error.light",
                    "&:hover": { color: "error.main", bgcolor: alpha("#f44336", 0.1) }
                  }}
                  title="導線を削除 (Delete)"
                >
                  <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
