// AngleSettings.jsx
// 右サイドバー：下部ギャラリーで選択中（フォーカス中）のアングルの個別設定。
//   - 名前
//   - レンズ（焦点距離）スライダー … カメラ fov を更新＋ビューポートへ即反映＋サムネ再撮影
import React, { useState, useEffect, useCallback } from "react";
import { Box, Stack, Typography, Slider } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";

import { useShotStore } from "../../../../../store/useShotStore";
import { layoutSceneRef } from "../../../../../services/layoutSceneRef";
import { captureLayoutPerspective } from "../../../../../services/layoutPerspectiveCapture";

const SectionLabel = ({ children }) => (
  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: alpha("#fff", 0.45), letterSpacing: 0.4, mb: 0.6 }}>
    {children}
  </Typography>
);

// 垂直fov ↔ 35mm判換算の焦点距離（センサー高24mm）
const fovToMm = (fov) => Math.round(12 / Math.tan((fov / 2) * (Math.PI / 180)));
const mmToFov = (mm) => 2 * Math.atan(12 / mm) * (180 / Math.PI);

export default function AngleSettings({ shotId, accent = "#6c87ff" }) {
  const shot = useShotStore((s) => s.shots.find((x) => x.id === shotId));
  const updateShot = useShotStore((s) => s.updateShot);
  const updateThumbnail = useShotStore((s) => s.updateThumbnail);

  const [name, setName] = useState(shot?.name ?? "");
  const [mm, setMm] = useState(shot ? fovToMm(shot.camera.fov) : 28);

  // フォーカス対象が変わったら値を同期
  useEffect(() => {
    if (shot) { setName(shot.name); setMm(fovToMm(shot.camera.fov)); }
  }, [shotId]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitName = useCallback(() => {
    if (shot && name.trim() && name.trim() !== shot.name) updateShot(shot.id, { name: name.trim() });
  }, [shot, name, updateShot]);

  // レンズ変更：fov を更新しビューポートに即反映（プレビュー）
  const handleLens = useCallback((nextMm) => {
    setMm(nextMm);
    if (!shot) return;
    const fov = Math.round(mmToFov(nextMm));
    const camera = { ...shot.camera, fov };
    updateShot(shot.id, { camera });
    layoutSceneRef.setCameraPose?.(camera);
  }, [shot, updateShot]);

  // 確定時にサムネを撮り直す
  const handleLensCommitted = useCallback(async (nextMm) => {
    if (!shot) return;
    const fov = Math.round(mmToFov(nextMm));
    const camera = { ...shot.camera, fov };
    try {
      const thumb = await captureLayoutPerspective(camera, { forceShadows: false });
      if (thumb) updateThumbnail(shot.id, thumb);
    } catch {}
  }, [shot, updateThumbnail]);

  if (!shot) return null;

  return (
    <Box sx={{ mb: 1.5, p: 1, borderRadius: 1.5, border: `1px solid ${alpha(accent, 0.4)}`, background: alpha(accent, 0.06) }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
        <CameraAltRoundedIcon sx={{ fontSize: 14, color: accent }} />
        <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#fff" }}>選択中アングルの設定</Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Box sx={{ width: 64, height: 38, borderRadius: 1, overflow: "hidden", flexShrink: 0, background: alpha("#fff", 0.06), display: "flex", alignItems: "center", justifyContent: "center" }}>
          {shot.thumbnail ? <img src={shot.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <SectionLabel>名前</SectionLabel>
          <Box component="input" value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            sx={{ width: "100%", background: alpha("#fff", 0.06), border: `1px solid ${alpha("#fff", 0.12)}`, borderRadius: 1, outline: "none",
              color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit", px: 0.75, py: 0.4,
              "&:focus": { borderColor: accent } }}
          />
        </Box>
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.25 }}>
        <SectionLabel>レンズ（焦点距離）</SectionLabel>
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: accent }}>{mm}mm</Typography>
      </Stack>
      <Box sx={{ px: 0.5 }}>
        <Slider
          value={mm}
          min={14}
          max={70}
          step={1}
          onChange={(_, v) => handleLens(Number(v))}
          onChangeCommitted={(_, v) => handleLensCommitted(Number(v))}
          marks={[{ value: 14, label: "広角" }, { value: 35, label: "標準" }, { value: 70, label: "望遠" }]}
          sx={{ color: accent, "& .MuiSlider-markLabel": { fontSize: 9, color: alpha("#fff", 0.4) }, "& .MuiSlider-thumb": { width: 12, height: 12 }, "& .MuiSlider-rail": { opacity: 0.2 } }}
        />
      </Box>
    </Box>
  );
}
