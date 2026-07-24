// FloorLevelsSettings — 階（フロア）設定の共通 UI。
//   - 階高（全 FL を等間隔で駆動）/ 天井高（CL）/ GL の数値入力
//   - 各階の一覧（1FL=基準は削除不可）と「＋」でのワンクリック追加（2FL, 3FL…）
// ビューポート設定パネルと断面専用 Properties の両方から使う。
import React from "react";
import { Box, Typography, Stack, IconButton, Tooltip, Slider } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { useBuildingSpecStore, floorHeightOf, ceilingHeightOf } from "../../../../store/useBuildingSpecStore";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import {
  useLevelLinesStore,
  DIM_ARROW_SCALE_MIN,
  DIM_ARROW_SCALE_MAX,
  DIM_ARROW_SCALE_DEFAULT,
} from "../../../../store/useLevelLinesStore";

function NumRow({ label, value, min, max, step, unit = "mm", onChange }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
      <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)" }}>{label}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: 64, fontSize: 12, textAlign: "right", padding: "3px 6px", borderRadius: 4,
            border: `1px solid ${alpha("#fff", 0.15)}`, background: alpha("#000", 0.25), color: "var(--brand-fg)", outline: "none" }}
        />
        <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>{unit}</Typography>
      </Stack>
    </Stack>
  );
}

export default function FloorLevelsSettings({ showGl = false }) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  const floors = useBuildingSpecStore((s) => s.floors);
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const setFloorHeightMm = useBuildingSpecStore((s) => s.setFloorHeightMm);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);
  const setCeilingHeightMm = useBuildingSpecStore((s) => s.setCeilingHeightMm);
  const glMm = useBuildingSpecStore((s) => s.glMm);
  const setGlMm = useBuildingSpecStore((s) => s.setGlMm);
  const addFloor = useBuildingSpecStore((s) => s.addFloor);
  const removeFloor = useBuildingSpecStore((s) => s.removeFloor);
  const setFloorHeightAt = useBuildingSpecStore((s) => s.setFloorHeightAt);
  const setCeilingHeightAt = useBuildingSpecStore((s) => s.setCeilingHeightAt);
  const spec = useBuildingSpecStore();
  // 平面図で他階の壁・床を薄く重ねる（トレース用）
  const showOtherFloorsGhost = useEditorModeStore((s) => s.showOtherFloorsGhost);
  const setShowOtherFloorsGhost = useEditorModeStore((s) => s.setShowOtherFloorsGhost);
  // CL / 階高 の寸法線の矢印（端部）サイズ
  const dimArrowScale = useLevelLinesStore((s) => s.dimArrowScale);
  const setDimArrowScale = useLevelLinesStore((s) => s.setDimArrowScale);

  return (
    <Box>
      {/* 見出し行（＋で直上に1階追加） */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 80%, transparent)" }}>
          階（フロア）
        </Typography>
        <Tooltip title="直上に1階追加（2FL, 3FL…）">
          <IconButton size="small" onClick={() => addFloor()} sx={{ color: accent }}>
            <AddRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ここは「既定値」。個別に設定していない階がこの値に従う。 */}
      <NumRow label="階高（既定）" value={floorHeightMm} min={2000} max={8000} step={50} onChange={setFloorHeightMm} />
      <NumRow label="天井高 CL（既定）" value={ceilingHeightMm} min={1800} max={6000} step={50} onChange={setCeilingHeightMm} />
      {showGl && <NumRow label="GL（FL±0 基準）" value={glMm} min={-5000} max={5000} step={50} onChange={setGlMm} />}

      {/* CL / 階高 の寸法線の矢印（端部）サイズ */}
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
        <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)", flexShrink: 0 }}>
          寸法の矢印サイズ
        </Typography>
        <Slider
          size="small"
          min={DIM_ARROW_SCALE_MIN}
          max={DIM_ARROW_SCALE_MAX}
          step={0.1}
          value={dimArrowScale}
          onChange={(_, v) => setDimArrowScale(Array.isArray(v) ? v[0] : v)}
          sx={{ color: accent, "& .MuiSlider-thumb": { width: 11, height: 11 }, "& .MuiSlider-rail": { opacity: 0.25 } }}
        />
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "var(--brand-fg)", minWidth: 30, textAlign: "right" }}>
          {dimArrowScale.toFixed(1)}×
        </Typography>
        <Tooltip title="既定サイズに戻す">
          <IconButton
            size="small"
            onClick={() => setDimArrowScale(DIM_ARROW_SCALE_DEFAULT)}
            sx={{ color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", "&:hover": { color: "var(--brand-fg)" } }}
          >
            <RestartAltRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* 各階の一覧（1FL=基準は削除不可） */}
      <Stack spacing={0.4}>
        {(floors || []).map((f, i) => (
          <Stack key={i} direction="row" alignItems="center" justifyContent="space-between"
            sx={{ px: 1, py: 0.4, borderRadius: 1, bgcolor: alpha("#fff", 0.04), border: `1px solid ${alpha("#fff", 0.06)}` }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-fg)" }}>
              {i === 0 ? "FL±0 (1FL)" : (f.name || `${i + 1}FL`)}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
                {i === 0 ? "±0" : `+${((f.flMm || 0) / 1000).toFixed(2)}m`}
              </Typography>
              {/* 階ごとの階高 / CL（未設定なら上の既定値に従う）。ここを変えても他の階は動かない。 */}
              <Tooltip title={`${f.name || `${i + 1}FL`} の階高`} arrow>
                <input
                  type="number" value={floorHeightOf(spec, i)} min={2000} max={8000} step={50}
                  onChange={(e) => setFloorHeightAt(i, Number(e.target.value))}
                  style={{ width: 56, fontSize: 11, textAlign: "right", padding: "2px 4px", borderRadius: 3,
                    border: `1px solid ${alpha("#fff", 0.15)}`, background: alpha("#000", 0.25), color: "var(--brand-fg)", outline: "none" }}
                />
              </Tooltip>
              <Tooltip title={`${f.name || `${i + 1}FL`} の天井高（CL）`} arrow>
                <input
                  type="number" value={ceilingHeightOf(spec, i)} min={1800} max={6000} step={50}
                  onChange={(e) => setCeilingHeightAt(i, Number(e.target.value))}
                  style={{ width: 56, fontSize: 11, textAlign: "right", padding: "2px 4px", borderRadius: 3,
                    border: `1px solid ${alpha("#fff", 0.15)}`, background: alpha("#000", 0.25), color: "var(--brand-fg)", outline: "none" }}
                />
              </Tooltip>
              {i > 0 && (
                <Tooltip title="この階を削除">
                  <IconButton size="small" onClick={() => removeFloor(i)} sx={{ color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", "&:hover": { color: "#ff6b6b" } }}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        ))}
      </Stack>
      {/* 平面図で他階の壁・床を薄く重ねる（下の階をなぞって描くため）。 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
        <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)" }}>
          他階を薄く表示
        </Typography>
        <input
          type="checkbox" checked={!!showOtherFloorsGhost}
          onChange={(e) => setShowOtherFloorsGhost(e.target.checked)}
          style={{ accentColor: accent, width: 15, height: 15 }}
        />
      </Stack>
      <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.5, mt: 0.75 }}>
        「＋」で 2FL 以降を追加。各行の2つの数値は左＝その階の階高／右＝その階の CL で、階ごとに変えられます。
        断面ビューでは各 FL/GL 線のドラッグ、CL/階高の寸法ラベルのダブルクリックでも調整できます。
      </Typography>
    </Box>
  );
}
