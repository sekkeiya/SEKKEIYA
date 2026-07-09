// src/features/layout/components/BottomBar/panels/TextureLibraryPanel.jsx
import React, { useMemo, useState, useCallback } from "react";
import { Box, Stack, Typography, TextField, InputAdornment, Chip, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useMaterialPickerStore } from "../../../store/materialPickerStore";
import { useSceneAssetsStore } from "../../../store/sceneAssetsStore";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";

export default function TextureLibraryPanel({ onClose }) {
  const commitPick = useMaterialPickerStore((s) => s.commitPick);

  const map = useSceneObjectRegistryStore((s) => s.map);
  const getUniqueTextureSetsFromObjects = useSceneAssetsStore((s) => s.getUniqueTextureSetsFromObjects);
  
  const textures = useMemo(() => {
    return getUniqueTextureSetsFromObjects(Array.from(map.values()));
  }, [getUniqueTextureSetsFromObjects, map]);

  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return textures;
    return textures.filter((t) => String(t?.name || "").toLowerCase().includes(qq));
  }, [textures, q]);

  const handlePick = useCallback((t) => commitPick?.(t), [commitPick]);

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
          Texture Library
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Chip
          size="small"
          label={`${items.length}`}
          sx={{
            height: 20,
            fontSize: 11,
            background: alpha("#fff", 0.08),
            border: `1px solid ${alpha("#fff", 0.10)}`,
            color: "color-mix(in srgb, var(--brand-fg) 90%, transparent)",
            mr: 1
          }}
        />

        {onClose && (
          <IconButton size="small" onClick={onClose} sx={{ borderRadius: 1.5 }}>
            <ExpandMoreRoundedIcon />
          </IconButton>
        )}
      </Stack>

      {/* Body */}
      <Box sx={{ p: 1.25, pt: 1, flex: 1, overflowY: "auto" }}>
        <Stack spacing={1}>
          <TextField
            size="small"
            placeholder="Search textures..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ opacity: 0.7 }} fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 999,
                background: "color-mix(in srgb, var(--brand-bg) 18%, transparent)",
                color: "var(--brand-fg)",
                "& fieldset": { borderColor: alpha("#fff", 0.12) },
                "&:hover fieldset": { borderColor: alpha("#fff", 0.18) },
              },
            }}
          />

        <Box
          sx={{
            mt: 0.5,
            borderRadius: 2,
            border: `1px solid ${alpha("#fff", 0.10)}`,
            background: "color-mix(in srgb, var(--brand-bg) 14%, transparent)",
            p: 1,
          }}
        >
          {items.length === 0 ? (
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>No textures</Typography>
              <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.35, lineHeight: 1.6 }}>
                View内の配置モデルに map がありません（または未登録）。<br />
                まずは FurnitureItem が registerObject できているか確認してください。
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 1 }}>
              {items.map((t) => (
                <Box
                  key={t.id}
                  onClick={() => handlePick(t)}
                  sx={{
                    borderRadius: 1.5,
                    overflow: "hidden",
                    border: `1px solid ${alpha("#fff", 0.12)}`,
                    cursor: "pointer",
                    background: "color-mix(in srgb, var(--brand-bg) 18%, transparent)",
                    "&:hover": { borderColor: alpha("#fff", 0.22) },
                  }}
                >
                  <Box sx={{ aspectRatio: "1 / 1", background: "color-mix(in srgb, var(--brand-bg) 25%, transparent)" }}>
                    {t.thumbUrl ? (
                      <img
                        src={t.thumbUrl}
                        alt={t?.name || "tex"}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
                        <Typography sx={{ fontSize: 11, opacity: 0.55 }}>—</Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ p: 0.6 }}>
                    <Typography sx={{ fontSize: 11.2, fontWeight: 900 }} noWrap>
                      {t.name || "Texture"}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, opacity: 0.65 }} noWrap>
                      {t.normalUrl ? "N" : "-"} / {t.aoUrl ? "AO" : "-"}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Typography sx={{ fontSize: 11, opacity: 0.65 }}>Picker mode: replacePreviewTexture</Typography>
      </Stack>
      </Box>
    </Box>
  );
}
