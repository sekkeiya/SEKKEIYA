// src/features/layout/components/BottomBar/panels/MaterialLibraryPanel.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Stack, Typography, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";

import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useMaterialPickerStore } from "@desktop/features/dsl/layout/store/materialPickerStore";
import { useSceneAssetsStore } from "@desktop/features/dsl/layout/store/sceneAssetsStore";
import { useSceneObjectRegistryStore } from "@desktop/features/dsl/layout/store/sceneObjectRegistryStore";

function getMatHintColor(m) {
  try {
    if (m?.material?.color && typeof m.material.color.getHexString === "function") {
      return `#${m.material.color.getHexString()}`;
    }
    // Object containing r,g,b
    if (m?.material?.color && m.material.color.r !== undefined) {
      const { r, g, b } = m.material.color;
      const toHex = (c) => Math.floor(c * 255).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  } catch (e) {}
  return "#777";
}

export default function MaterialLibraryPanel({ onClose }) {
  const commitPick = useMaterialPickerStore((s) => s.commitPick);

  const map = useSceneObjectRegistryStore((s) => s.map);
  const getUniqueMaterialsFromObjects = useSceneAssetsStore((s) => s.getUniqueMaterialsFromObjects);
  
  const materials = useMemo(() => {
    return getUniqueMaterialsFromObjects(Array.from(map.values()));
  }, [getUniqueMaterialsFromObjects, map]);

  const handlePick = useCallback((m) => {
    if (commitPick) commitPick(m);
  }, [commitPick]);

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Stack 
        direction="row" 
        spacing={2} 
        alignItems="center" 
        sx={{ 
          px: 2.5, 
          py: 1.5, 
          borderBottom: `1px solid ${alpha("#fff", 0.08)}`,
        }}
      >
        <Typography sx={{ fontWeight: 900, fontSize: 13.5, letterSpacing: 0.2, minWidth: 100 }}>
          Materials
        </Typography>

        <Box sx={{ flex: 1 }} />

        <FilterListRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.4), cursor: "pointer", transition: "color 0.2s", "&:hover": { color: alpha("#fff", 0.9) } }} />
        <CleaningServicesRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.4), cursor: "pointer", transition: "color 0.2s", "&:hover": { color: alpha("#fff", 0.9) }, mr: 1 }} />
        
        {onClose && (
          <IconButton size="small" onClick={onClose} sx={{ borderRadius: 1.5 }}>
            <ExpandMoreRoundedIcon />
          </IconButton>
        )}
      </Stack>

      {/* Main Content Grid */}
      <Box 
        sx={{ 
          flex: 1, 
          overflowY: "auto", 
          p: 2,
          "&::-webkit-scrollbar": { width: 8, height: 8 },
          "&::-webkit-scrollbar-thumb": { background: alpha("#fff", 0.08), borderRadius: 4 },
        }}
      >
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          
          {/* + Standard Button */}
          <Box 
            sx={{ 
              width: 80, 
              height: 72, 
              background: alpha("#fff", 0.04), 
              borderRadius: 1.5, 
              display: "flex", 
              border: `1px solid transparent`,
              cursor: "pointer",
              transition: "all 0.2sease",
              "&:hover": { borderColor: alpha("#fff", 0.15), background: alpha("#fff", 0.06) }
            }}
          >
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <AddRoundedIcon sx={{ fontSize: 22, color: alpha("#fff", 0.5) }} />
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: alpha("#fff", 0.5), mt: 0.2 }}>
                Standard
              </Typography>
            </Box>
            <Box sx={{ width: 1, background: alpha("#000", 0.3) }} />
            <Box sx={{ 
              width: 24, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              "&:hover": { background: alpha("#fff", 0.05) }
            }}>
              <MoreVertRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.3) }} />
            </Box>
          </Box>

          {/* Material Items */}
          {materials.map((m, idx) => {
             const matColor = getMatHintColor(m);
             return (
              <Box 
                key={m.id || idx} 
                onClick={() => handlePick(m)}
                sx={{ 
                  width: 72, 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "flex-start",
                  gap: 0.5,
                  cursor: "pointer",
                  "&:hover .thumb-box": { borderColor: alpha("#fff", 0.2), background: alpha("#fff", 0.06) }
                }}
              >
                {/* Thumbnail Box */}
                <Box 
                  className="thumb-box"
                  sx={{ 
                    width: 72, 
                    height: 72, 
                    borderRadius: 1.5,
                    background: alpha("#fff", 0.02),
                    border: `1px solid transparent`,
                    position: "relative",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                    transition: "all 0.15s ease"
                  }}
                >
                  {/* Top-Left Triangle Badge */}
                  <Box 
                    sx={{ 
                      position: "absolute", 
                      top: 0, left: 0,
                      width: 0, height: 0,
                      borderTop: `24px solid ${alpha("#000", 0.3)}`,
                      borderRight: "24px solid transparent",
                      zIndex: 2,
                      borderTopLeftRadius: "6px"
                    }}
                  >
                    <CheckRoundedIcon sx={{ position: "absolute", top: -23, left: 2, fontSize: 10, color: alpha("#fff", 0.5) }} />
                  </Box>

                  {/* Simulated CSS Sphere */}
                  <Box 
                    sx={{
                      width: 52, 
                      height: 52,
                      borderRadius: "50%",
                      background: `radial-gradient(circle at 35% 35%, #fff 0%, ${matColor} 45%, #111 85%)`,
                      boxShadow: "0 4px 6px rgba(0,0,0,0.4)"
                    }} 
                  />
                </Box>

                {/* Label */}
                <Typography 
                  noWrap 
                  sx={{ 
                    width: "100%", 
                    fontSize: 10.5, 
                    fontWeight: 500, 
                    color: alpha("#fff", 0.4), 
                    px: 0.5 
                  }}
                >
                  {m.name || "Material"}
                </Typography>
              </Box>
            );
          })}

        </Box>
      </Box>
    </Box>
  );
}
