import React, { useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { useLightingStore } from "@desktop/features/dsl/layout/store/useLightingStore";
import { useUiPropertiesSelectionStore } from "@desktop/features/dsl/layout/store/uiPropertiesSelectionStore";
import { useUiRightSidebarStore } from "@desktop/features/dsl/layout/store/uiRightSidebarStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

// ─── CSS-rendered light preview thumbnails ───────────────────────────────────

function DirectionalPreview() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        background: "#0e1422",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pb: 1.5,
      }}
    >
      {/* Parallel beams */}
      {[-28, -14, 0, 14, 28].map((x) => (
        <Box
          key={x}
          sx={{
            position: "absolute",
            top: 0,
            left: `calc(50% + ${x}px)`,
            width: 2,
            height: "60%",
            background: "linear-gradient(to bottom, rgba(255,220,120,0.6) 0%, rgba(255,220,120,0) 100%)",
            transform: "skewX(-8deg)",
          }}
        />
      ))}
      {/* Ground glow */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "35%",
          background: "radial-gradient(ellipse at 50% 100%, rgba(255,210,100,0.22) 0%, transparent 70%)",
        }}
      />
      {/* Small sphere */}
      <Box
        sx={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 36%, #e8c86a, #8a6020)",
          boxShadow: "0 0 10px rgba(255,200,80,0.5), 0 4px 8px rgba(0,0,0,0.5)",
          position: "relative",
          zIndex: 1,
        }}
      />
    </Box>
  );
}

function SpotPreview() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        background: "#0a0e18",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pb: 1.5,
      }}
    >
      {/* Source glow at top center */}
      <Box
        sx={{
          position: "absolute",
          top: 6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 0 10px 4px rgba(160,210,255,0.6)",
        }}
      />
      {/* Cone beam */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "40px solid transparent",
          borderRight: "40px solid transparent",
          borderTop: "none",
          // Use clip-path instead for a trapezoid beam
          clipPath: "none",
          zIndex: 0,
        }}
      />
      {/* Cone gradient beam using box */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 84,
          height: "68%",
          background:
            "linear-gradient(to bottom, rgba(140,210,255,0.45) 0%, rgba(140,210,255,0.08) 100%)",
          clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
        }}
      />
      {/* Ground illumination circle */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0, right: 0,
          height: "28%",
          background: "radial-gradient(ellipse at 50% 100%, rgba(120,200,255,0.25) 0%, transparent 65%)",
        }}
      />
      {/* Small sphere */}
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 36%, #d0eeff, #3a6a88)",
          boxShadow: "0 0 8px rgba(120,200,255,0.5), 0 3px 6px rgba(0,0,0,0.5)",
          position: "relative",
          zIndex: 1,
        }}
      />
    </Box>
  );
}

function NeonPreview() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        background: "#0a0a16",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pb: 1.5,
      }}
    >
      {/* Linear strip */}
      <Box
        sx={{
          position: "absolute",
          top: 18,
          left: "50%",
          transform: "translateX(-50%)",
          width: "78%",
          height: 4,
          background: "linear-gradient(to right, #ff80c0, #ffd0e8, #ff80c0)",
          borderRadius: 2,
          boxShadow:
            "0 0 14px 4px rgba(255,128,200,0.55), 0 0 24px 8px rgba(255,128,200,0.25)",
        }}
      />
      {/* Downward soft glow */}
      <Box
        sx={{
          position: "absolute",
          top: 22,
          left: "50%",
          transform: "translateX(-50%)",
          width: "92%",
          height: "62%",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,150,200,0.32) 0%, transparent 72%)",
        }}
      />
      {/* Ground glow strip */}
      <Box
        sx={{
          position: "absolute",
          bottom: 8,
          left: "8%",
          right: "8%",
          height: "12%",
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255,140,200,0.35) 0%, transparent 80%)",
          borderRadius: "50%",
        }}
      />
      {/* Small sphere */}
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 36%, #ffd0e8, #883060)",
          boxShadow: "0 0 8px rgba(255,128,200,0.4), 0 3px 6px rgba(0,0,0,0.5)",
          position: "relative",
          zIndex: 1,
        }}
      />
    </Box>
  );
}

function RectAreaPreview() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        background: "#0a0c16",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pb: 1.5,
      }}
    >
      {/* Panel */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          width: "72%",
          height: 10,
          background: "linear-gradient(to bottom, #ffffff, #c8d8f8)",
          borderRadius: 0.5,
          boxShadow: "0 0 18px 6px rgba(180,200,255,0.45), 0 2px 4px rgba(0,0,0,0.3)",
        }}
      />
      {/* Soft downward glow from panel */}
      <Box
        sx={{
          position: "absolute",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          height: "70%",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(180,190,255,0.35) 0%, transparent 72%)",
        }}
      />
      {/* Ground glow */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: "30%",
          background: "radial-gradient(ellipse at 50% 100%, rgba(160,180,255,0.2) 0%, transparent 70%)",
        }}
      />
      {/* Small sphere */}
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 36%, #dde4ff, #4050a0)",
          boxShadow: "0 0 8px rgba(160,180,255,0.4), 0 3px 6px rgba(0,0,0,0.5)",
          position: "relative",
          zIndex: 1,
        }}
      />
    </Box>
  );
}

// ─── Light type definitions ───────────────────────────────────────────────────

const LIGHT_TYPES = [
  {
    type: "directional",
    label: "Directional",
    Preview: DirectionalPreview,
    accentColor: "#ffd580",
  },
  {
    type: "spot",
    label: "Spot light",
    Preview: SpotPreview,
    accentColor: "#80d4ff",
  },
  {
    type: "rect",
    label: "Area light",
    Preview: RectAreaPreview,
    accentColor: "#b4a0ff",
  },
  {
    type: "neon",
    label: "Neon light",
    Preview: NeonPreview,
    accentColor: "#ff80c0",
  },
];

// ─── Card component ───────────────────────────────────────────────────────────

function LightCard({ type, label, Preview, accentColor, onAdd }) {
  return (
    <Box
      onClick={() => onAdd(type)}
      sx={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 1.5,
        overflow: "hidden",
        background: alpha("#fff", 0.03),
        border: `1px solid ${alpha("#fff", 0.08)}`,
        cursor: "pointer",
        userSelect: "none",
        transition: "all 0.16s ease",
        "&:hover": {
          border: `1px solid ${alpha(accentColor, 0.55)}`,
          boxShadow: `0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px ${alpha(accentColor, 0.2)}`,
          "& .light-preview-overlay": {
            opacity: 1,
          },
        },
        "&:active": {
          transform: "scale(0.97)",
        },
      }}
    >
      {/* Preview thumbnail */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          paddingBottom: "80%", // 5:4 aspect ratio
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
          }}
        >
          <Preview />
        </Box>
        {/* Hover overlay */}
        <Box
          className="light-preview-overlay"
          sx={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 50%, ${alpha(accentColor, 0.12)}, transparent 70%)`,
            opacity: 0,
            transition: "opacity 0.16s",
          }}
        />
      </Box>

      {/* Label */}
      <Box
        sx={{
          px: 1,
          py: 0.6,
          background: alpha("#000", 0.25),
          borderTop: `1px solid ${alpha("#fff", 0.05)}`,
        }}
      >
        <Typography
          sx={{
            fontSize: 11.5,
            fontWeight: 500,
            opacity: 0.88,
            textAlign: "center",
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LightingLibraryContent() {
  const addLight = useLightingStore((s) => s.addLight);
  const updateLight = useLightingStore((s) => s.updateLight);
  const selectLight = useUiPropertiesSelectionStore((s) => s.selectLight);
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);

  const handleAdd = useCallback(
    (type) => {
      const newId = addLight(type);

      if (type === "spot") {
        // シーンの天井高（sceneMaxY）を取得してスポットライトを天井に配置する。
        // BaseGlb.jsx が GLB ロード後に setSceneMaxY() を呼ぶため、
        // シーンが読み込まれた状態であれば実際の天井高が返る。
        // 未ロード時のデフォルト値 10 は高すぎるため 2.7m にフォールバック。
        const rawMaxY = useEditorModeStore.getState().sceneMaxY;
        const ceilingY = rawMaxY > 0 && rawMaxY !== 10 ? rawMaxY : 2.7;

        updateLight(newId, {
          // X・Z はシーン中央（原点）、Y は天井高
          position: [0, ceilingY, 0],
          // ターゲットを真下（同じ X・Z、Y = 0）に設定 → 真下照射
          targetPosition: [0, 0, 0],
        });
      }

      selectLight(newId);
      setRightPanel("properties", true);
    },
    [addLight, updateLight, selectLight, setRightPanel]
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
        Click to add to scene
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 0.75,
        }}
      >
        {LIGHT_TYPES.map((lt) => (
          <LightCard key={lt.type} {...lt} onAdd={handleAdd} />
        ))}
      </Box>
    </Box>
  );
}
