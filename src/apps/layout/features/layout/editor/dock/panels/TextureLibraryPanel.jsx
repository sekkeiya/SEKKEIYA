// src/features/layout/components/BottomBar/panels/TextureLibraryPanel.jsx
import React, { useMemo, useState, useCallback } from "react";
import { Box, Stack, Typography, TextField, InputAdornment, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import { useMaterialPickerStore } from "@layout/features/layout/store/materialPickerStore";
import { useSceneAssetsStore } from "@layout/features/layout/store/sceneAssetsStore";
import { useSceneObjectRegistryStore } from "@layout/features/layout/store/sceneObjectRegistryStore";

export default function TextureLibraryPanel() {
  const commitPick = useMaterialPickerStore((s) => s.commitPick);

  // ✅ Fix: store には getUniqueTextureSetsFromObjects しか無い。
  //    registry の Object3D 群から抽出する（map の参照変化で再計算）
  const objectMap = useSceneObjectRegistryStore((s) => s.map);
  const getUniqueTextureSetsFromObjects = useSceneAssetsStore((s) => s.getUniqueTextureSetsFromObjects);
  const textures = useMemo(
    () => getUniqueTextureSetsFromObjects(Array.from(objectMap?.values?.() || []).filter(Boolean)),
    [getUniqueTextureSetsFromObjects, objectMap]
  );

  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return textures;
    return textures.filter((t) => String(t?.name || "").toLowerCase().includes(qq));
  }, [textures, q]);

  const handlePick = useCallback((t) => commitPick?.(t), [commitPick]);

  return (
    <Box sx={{ p: 1.25, pt: 1 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontWeight: 950, fontSize: 13 }}>Texture Library</Typography>
          <Box sx={{ flex: 1 }} />
          <Chip
            size="small"
            label={`${items.length}`}
            sx={{
              height: 20,
              fontSize: 11,
              background: alpha("#fff", 0.08),
              border: `1px solid ${alpha("#fff", 0.10)}`,
              color: alpha("#fff", 0.9),
            }}
          />
        </Stack>

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
              background: alpha("#000", 0.18),
              color: "#fff",
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
            background: alpha("#000", 0.14),
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
                    background: alpha("#000", 0.18),
                    "&:hover": { borderColor: alpha("#fff", 0.22) },
                  }}
                >
                  <Box sx={{ aspectRatio: "1 / 1", background: alpha("#000", 0.25) }}>
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
  );
}
