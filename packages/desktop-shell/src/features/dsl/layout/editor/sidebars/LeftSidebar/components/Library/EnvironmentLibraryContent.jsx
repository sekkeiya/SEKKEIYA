// Twinmotion 風 Vegetation/Landscape プリセット選択 UI。
// LightingLibraryContent.jsx と同じパターン（プレビュー付きカードのグリッド）。
import React, { useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import { useEnvironmentStore } from "../../../../../store/useEnvironmentStore";

// ─── CSS-rendered preset preview thumbnails ──────────────────────────────────

function NonePreview() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(to bottom, #0a0d18 0%, #0a0d18 50%, #11151f 50%, #11151f 100%)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography sx={{ fontSize: 11, opacity: 0.45, letterSpacing: 0.5 }}>
        No backdrop
      </Typography>
    </Box>
  );
}

function FlatPreview() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(to bottom, #9fc7ee 0%, #c9deef 60%, #e6efd5 60%, #4f7a3a 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* horizon highlight */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "60%",
          height: 2,
          background:
            "linear-gradient(to right, transparent 0%, rgb(var(--brand-fg-rgb) / 0.6) 50%, transparent 100%)",
        }}
      />
      {/* sun */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          right: 14,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 36%, #fff5c8, #ffd368)",
          boxShadow: "0 0 10px rgba(255,220,140,0.6)",
        }}
      />
      {/* a few grass blades */}
      {[18, 42, 64, 86].map((leftPct, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            bottom: 4,
            left: `${leftPct}%`,
            width: 1.5,
            height: 6 + (i % 2) * 3,
            background: "linear-gradient(to top, #2e5424, transparent)",
            transform: "rotate(-2deg)",
          }}
        />
      ))}
    </Box>
  );
}

// ─── Preset definitions ──────────────────────────────────────────────────────

const PRESETS = [
  {
    id: "none",
    label: "None",
    Preview: NonePreview,
    accentColor: "#7a8595",
  },
  {
    id: "flat",
    label: "Flat",
    Preview: FlatPreview,
    accentColor: "#9bc88a",
  },
];

// ─── Card ────────────────────────────────────────────────────────────────────

function PresetCard({ id, label, Preview, accentColor, selected, onSelect }) {
  return (
    <Box
      onClick={() => onSelect(id)}
      sx={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 1.5,
        overflow: "hidden",
        background: alpha("#fff", 0.03),
        border: `1px solid ${
          selected ? `color-mix(in srgb, ${accentColor} 85%, transparent)` : alpha("#fff", 0.08)
        }`,
        cursor: "pointer",
        userSelect: "none",
        transition: "all 0.16s ease",
        position: "relative",
        "&:hover": {
          border: `1px solid ${`color-mix(in srgb, ${accentColor} 70%, transparent)`}`,
          boxShadow: `0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px ${alpha(
            accentColor,
            0.25
          )}`,
        },
        "&:active": { transform: "scale(0.97)" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          paddingBottom: "80%",
          flexShrink: 0,
        }}
      >
        <Box sx={{ position: "absolute", inset: 0 }}>
          <Preview />
        </Box>
        {selected && (
          <Box
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: `color-mix(in srgb, ${accentColor} 90%, transparent)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 14, color: "#0a0d18" }} />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          px: 1,
          py: 0.6,
          background: "color-mix(in srgb, var(--brand-bg) 25%, transparent)",
          borderTop: `1px solid ${alpha("#fff", 0.05)}`,
        }}
      >
        <Typography
          sx={{
            fontSize: 11.5,
            fontWeight: selected ? 700 : 500,
            opacity: selected ? 1 : 0.88,
            textAlign: "center",
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function EnvironmentLibraryContent() {
  const landscape = useEnvironmentStore((s) => s.landscape);
  const setLandscape = useEnvironmentStore((s) => s.setLandscape);

  const handleSelect = useCallback(
    (id) => {
      setLandscape(id);
    },
    [setLandscape]
  );

  return (
    <Box sx={{ p: 1 }}>
      <Typography
        sx={{
          fontSize: 10.5,
          opacity: 0.38,
          mb: 1,
          mx: 0.5,
          letterSpacing: 0.7,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Landscapes
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 0.75,
        }}
      >
        {PRESETS.map((p) => (
          <PresetCard
            key={p.id}
            {...p}
            selected={landscape === p.id}
            onSelect={handleSelect}
          />
        ))}
      </Box>
    </Box>
  );
}
