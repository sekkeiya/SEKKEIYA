import React from "react";
import { Box, Slider, Typography, InputBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEditorModeStore } from "../store/useEditorModeStore";

// ─────────────────────────────────────────────────────────────
// Single axis row: dot toggle + horizontal slider + numeric input
// ─────────────────────────────────────────────────────────────
function AxisRow({ label, value, min, max, step, enabled, color, onToggle, onChange }) {
  const [inputVal, setInputVal] = React.useState("");

  React.useEffect(() => {
    setInputVal(String(Math.round(value)));
  }, [value]);

  const handleSubmit = () => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) {
      onChange(Math.min(Math.max(parsed, min), max));
    } else {
      setInputVal(String(Math.round(value)));
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
      {/* Toggle dot */}
      <Box
        onClick={() => onToggle(!enabled)}
        sx={{
          width: 9, height: 9, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
          bgcolor: enabled ? color : alpha("#fff", 0.2),
          transition: "background-color 0.15s",
          "&:hover": { opacity: 0.8 },
        }}
      />
      {/* Axis label */}
      <Typography sx={{
        color: enabled ? color : alpha("#fff", 0.3),
        fontSize: 9, fontWeight: 700, minWidth: 42, flexShrink: 0,
      }}>
        {label}
      </Typography>
      {/* Slider */}
      <Slider
        size="small"
        min={min} max={max} step={step}
        value={value}
        disabled={!enabled}
        onChange={(_, v) => onChange(v)}
        sx={{
          flex: 1,
          color: enabled ? color : alpha("#fff", 0.15),
          height: 2,
          py: "6px",
          "& .MuiSlider-thumb": {
            width: 11, height: 11,
            "&:hover, &.Mui-active": { boxShadow: `0 0 0 8px ${color}28` },
          },
          "& .MuiSlider-rail": { opacity: 0.2 },
        }}
      />
      {/* Numeric input */}
      <InputBase
        value={inputVal}
        disabled={!enabled}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        endAdornment={
          <Typography sx={{ color: alpha("#fff", 0.4), fontSize: 8, ml: 0.25, flexShrink: 0 }}>mm</Typography>
        }
        sx={{
          width: 58, flexShrink: 0,
          color: enabled ? "#fff" : alpha("#fff", 0.3),
          fontSize: 10, fontWeight: 700,
          "& input": {
            textAlign: "right",
            padding: "2px 3px",
            background: alpha("#fff", 0.07),
            borderRadius: "3px",
            width: "40px",
          },
        }}
      />
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────
// Main SectionClipSlider — 3-axis panel
// ─────────────────────────────────────────────────────────────
export default function SectionClipSlider({ fullWidth = false } = {}) {
  const isSectionClipEnabled  = useEditorModeStore((s) => s.isSectionClipEnabled);

  // Y (height)
  const sectionClipYEnabled   = useEditorModeStore((s) => s.sectionClipYEnabled);
  const setSectionClipYEnabled = useEditorModeStore((s) => s.setSectionClipYEnabled);
  const sectionClipHeight     = useEditorModeStore((s) => s.sectionClipHeight);
  const setSectionClipHeight  = useEditorModeStore((s) => s.setSectionClipHeight);
  const sceneMaxY             = useEditorModeStore((s) => s.sceneMaxY);

  // X
  const sectionClipXEnabled   = useEditorModeStore((s) => s.sectionClipXEnabled);
  const setSectionClipXEnabled = useEditorModeStore((s) => s.setSectionClipXEnabled);
  const sectionClipX          = useEditorModeStore((s) => s.sectionClipX);
  const setSectionClipX       = useEditorModeStore((s) => s.setSectionClipX);

  // Z
  const sectionClipZEnabled   = useEditorModeStore((s) => s.sectionClipZEnabled);
  const setSectionClipZEnabled = useEditorModeStore((s) => s.setSectionClipZEnabled);
  const sectionClipZ          = useEditorModeStore((s) => s.sectionClipZ);
  const setSectionClipZ       = useEditorModeStore((s) => s.setSectionClipZ);

  // Scene extent
  const sceneExtentXZ         = useEditorModeStore((s) => s.sceneExtentXZ);

  // Scale detection (mm vs m)
  const isMmScale = Math.max(3, Math.ceil(sceneMaxY)) > 100;
  const yMax      = Math.max(3, Math.ceil(sceneMaxY));
  const yStep     = yMax > 1000 ? 10 : yMax > 100 ? 1 : 0.1;

  // For X/Z, use ±sceneExtentXZ range
  const xzMax  = Math.max(3, Math.ceil(sceneExtentXZ));
  const xzMin  = -xzMax;
  const xzStep = isMmScale ? (xzMax > 1000 ? 10 : 1) : 0.1;

  // Convert Three.js units → display mm
  const toMm = (v) => isMmScale ? Math.round(v) : Math.round(v * 1000);
  const fromMm = (v) => isMmScale ? v : v / 1000;

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : 280,
        borderRadius: 1.5,
        border: `1px solid ${alpha("#fff", 0.12)}`,
        bgcolor: alpha("#050810", 0.92),
        backdropFilter: "blur(12px)",
        px: 1.5, py: 1.25,
        pointerEvents: "auto",
      }}
    >
      {/* Header */}
      <Typography sx={{
        color: alpha("#fff", 0.35), fontSize: 9, fontWeight: 700,
        letterSpacing: 0.8, textTransform: "uppercase", mb: 1,
      }}>
        断面 Clipping
      </Typography>

      {/* Y — height */}
      <AxisRow
        label="Z (高さ)"
        value={toMm(sectionClipHeight)}
        min={0}
        max={toMm(yMax)}
        step={isMmScale ? yStep : 1}
        enabled={sectionClipYEnabled}
        color="#a5d6a7"
        onToggle={setSectionClipYEnabled}
        onChange={(v) => setSectionClipHeight(fromMm(v))}
      />

      {/* X — left/right */}
      <AxisRow
        label="X (左右)"
        value={toMm(sectionClipX)}
        min={toMm(xzMin)}
        max={toMm(xzMax)}
        step={isMmScale ? xzStep : 1}
        enabled={sectionClipXEnabled}
        color="#ef9a9a"
        onToggle={setSectionClipXEnabled}
        onChange={(v) => setSectionClipX(fromMm(v))}
      />

      {/* Z — front/back */}
      <AxisRow
        label="Y (前後)"
        value={toMm(sectionClipZ)}
        min={toMm(xzMin)}
        max={toMm(xzMax)}
        step={isMmScale ? xzStep : 1}
        enabled={sectionClipZEnabled}
        color="#90caf9"
        onToggle={setSectionClipZEnabled}
        onChange={(v) => setSectionClipZ(fromMm(v))}
      />

      <Typography sx={{ color: alpha("#fff", 0.2), fontSize: 8, mt: 0.5 }}>
        ● をクリックで軸ごとにON/OFF
      </Typography>
    </Box>
  );
}
