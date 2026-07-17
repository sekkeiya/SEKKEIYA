// SectionPropertiesPanel — 断面図表示中の Properties 専用パネル。
//   - 断面ライン（A-A' / B-B'…）の切替・改名・削除・追加
//   - 断面位置（左右X / 前後Z のミニマップ指定 = SectionClipPlanControl）
//   - 階（フロア）/ 階高 / 天井高（CL）/ GL（FloorLevelsSettings）
import React, { useEffect } from "react";
import { Box, Typography, Divider, Stack, IconButton, Tooltip, TextField, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import Rotate90DegreesCcwRoundedIcon from "@mui/icons-material/Rotate90DegreesCcwRounded";
import SectionClipPlanControl from "../../../../canvas/SectionClipPlanControl.jsx";
import FloorLevelsSettings from "./FloorLevelsSettings.jsx";
import { useSectionLinesStore } from "../../../../store/useSectionLinesStore";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import { useViewportUiStore, VIEWPORT_IDS } from "../../../../store/viewportUiStore";
import { useElevationMarkerStore } from "../../../../store/useElevationMarkerStore";

// 矢印スタイルのプリセット（store の arrowStyle と対応。プレビューは右向きの小さな SVG）。
const ARROW_STYLE_OPTIONS = [
  {
    key: "filled", label: "塗り",
    preview: (
      <svg width="30" height="14" viewBox="0 0 30 14">
        <line x1="2" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M28 7 L18 2.8 L18 11.2 Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "open", label: "白抜き",
    preview: (
      <svg width="30" height="14" viewBox="0 0 30 14">
        <line x1="2" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M28 7 L18 2.8 L18 11.2 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    key: "chevron", label: "山形",
    preview: (
      <svg width="30" height="14" viewBox="0 0 30 14">
        <line x1="2" y1="7" x2="28" y2="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M28 7 L20 2.8 M28 7 L20 11.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    key: "half", label: "片翼",
    preview: (
      <svg width="30" height="14" viewBox="0 0 30 14">
        <line x1="2" y1="7" x2="28" y2="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M28 7 L20 2.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
];

function SubHeader({ children, action }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 80%, transparent)" }}>
        {children}
      </Typography>
      {action}
    </Stack>
  );
}

export default function SectionPropertiesPanel() {
  const lines = useSectionLinesStore((s) => s.lines);
  const activeLineId = useSectionLinesStore((s) => s.activeLineId);
  const setActiveLine = useSectionLinesStore((s) => s.setActiveLine);
  const removeLine = useSectionLinesStore((s) => s.removeLine);
  const renameLine = useSectionLinesStore((s) => s.renameLine);
  const addLine = useSectionLinesStore((s) => s.addLine);
  const updateActive = useSectionLinesStore((s) => s.updateActive);
  const updateLine = useSectionLinesStore((s) => s.updateLine);
  const arrowStyle = useSectionLinesStore((s) => s.arrowStyle);
  const setArrowStyle = useSectionLinesStore((s) => s.setArrowStyle);

  // 断面クリップ（ミニマップ）の live 値。ドラッグで動かしたら active な断面ラインへ反映する。
  const scX = useEditorModeStore((s) => s.sectionClipX);
  const scZ = useEditorModeStore((s) => s.sectionClipZ);
  const scXOn = useEditorModeStore((s) => s.sectionClipXEnabled);
  const scZOn = useEditorModeStore((s) => s.sectionClipZEnabled);
  useEffect(() => {
    if (!activeLineId) return;
    const axis = scXOn ? "x" : scZOn ? "z" : null;
    if (!axis) return;
    updateActive({ axis, pos: axis === "x" ? scX : scZ });
  }, [activeLineId, scX, scZ, scXOn, scZOn, updateActive]);

  const applyLine = (line) => {
    setActiveLine(line.id);
    // 断面を開いたら展開図ビューのハイライトを解除（同じクリップ機構を共有するため）
    useElevationMarkerStore.getState().setViewActive(false);
    const em = useEditorModeStore.getState();
    em.setIsSectionClipEnabled(true);
    em.setSectionClipYEnabled(false);
    em.setSectionClipXEnabled(line.axis === "x");
    em.setSectionClipZEnabled(line.axis === "z");
    if (line.axis === "x") em.setSectionClipX(line.pos); else em.setSectionClipZ(line.pos);
    em.setSectionViewFlip?.(!!line.flip);
    // 断面ビュー表示中なら、軸に合わせて正面/側面ビューポートも切替えて再フレーミング
    const vp = useViewportUiStore.getState();
    const id = vp.activeViewportId;
    if (id === VIEWPORT_IDS.FRONT || id === VIEWPORT_IDS.RIGHT) {
      vp.setActiveViewportId(line.axis === "x" ? VIEWPORT_IDS.RIGHT : VIEWPORT_IDS.FRONT);
      setTimeout(() => vp.requestFrameAll?.(), 140);
    }
  };

  // 向き反転（矢印＝見る側を逆に）
  const flipLine = (line) => {
    const next = { ...line, flip: !line.flip };
    updateLine(line.id, { flip: next.flip });
    applyLine(next);
  };

  // 90°回転（前後Z ⇄ 左右X。位置は現在のミニマップ値を引き継ぐ）
  const rotateLine = (line) => {
    const axis = line.axis === "x" ? "z" : "x";
    const pos = axis === "x" ? (scX || 0) : (scZ || 0);
    const next = { ...line, axis, pos };
    updateLine(line.id, { axis, pos });
    applyLine(next);
  };

  return (
    <Box sx={{ p: 1.5, height: "100%", overflowY: "auto" }}>
      <Stack spacing={1.5}>
        {/* 断面ライン一覧（A-A' / B-B'…） */}
        <Box>
          <SubHeader
            action={
              <Tooltip title="現在の位置に断面ラインを追加">
                <IconButton size="small" onClick={() => applyLine(addLine("z", scZ || 0))} sx={{ color: "light-dark(#0aa5c2, #22d3ee)" }}>
                  <AddRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            }
          >
            断面ライン
          </SubHeader>
          {lines.length === 0 ? (
            <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>
              「＋」で断面ライン（A-A'）を追加してください。
            </Typography>
          ) : (
            <Stack spacing={0.4}>
              {lines.map((line) => {
                const on = line.id === activeLineId;
                return (
                  <Stack key={line.id} direction="row" alignItems="center" spacing={0.5}
                    sx={{ px: 0.75, py: 0.4, borderRadius: 1,
                      bgcolor: on ? "rgba(56,189,248,0.16)" : alpha("#fff", 0.04),
                      border: `1px solid ${on ? "rgba(56,189,248,0.45)" : alpha("#fff", 0.06)}` }}>
                    <Box onClick={() => applyLine(line)} sx={{ cursor: "pointer", flexShrink: 0 }}>
                      <Chip size="small" label={line.axis === "x" ? "横" : "前"} sx={{ height: 18, fontSize: 9.5, fontWeight: 700 }} />
                    </Box>
                    <TextField
                      variant="standard" value={line.name}
                      onChange={(e) => renameLine(line.id, e.target.value)}
                      onFocus={() => applyLine(line)}
                      InputProps={{ disableUnderline: true, sx: { fontSize: 12, fontWeight: 700, color: "var(--brand-fg)" } }}
                      sx={{ flex: 1 }}
                    />
                    <Tooltip title="向きを反転（見る側を逆に）">
                      <IconButton size="small" onClick={() => flipLine(line)}
                        sx={{ color: line.flip ? "light-dark(#0aa5c2, #22d3ee)" : "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>
                        <SwapHorizRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="90°回転（前後 ⇄ 左右）">
                      <IconButton size="small" onClick={() => rotateLine(line)}
                        sx={{ color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", "&:hover": { color: "var(--brand-fg)" } }}>
                        <Rotate90DegreesCcwRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="この断面ラインを削除">
                      <IconButton size="small" onClick={() => removeLine(line.id)} sx={{ color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", "&:hover": { color: "#ff6b6b" } }}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        {/* 矢印スタイル（全断面線で共通のドキュメント設定） */}
        <Box>
          <SubHeader>矢印スタイル</SubHeader>
          <Stack direction="row" spacing={0.5}>
            {ARROW_STYLE_OPTIONS.map((opt) => {
              const on = arrowStyle === opt.key;
              return (
                <Tooltip key={opt.key} title={opt.label} arrow>
                  <Box
                    onClick={() => setArrowStyle(opt.key)}
                    sx={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      py: 0.6, borderRadius: 1, cursor: "pointer",
                      color: on ? "light-dark(#0aa5c2, #22d3ee)" : "color-mix(in srgb, var(--brand-fg) 55%, transparent)",
                      bgcolor: on ? "rgba(56,189,248,0.14)" : alpha("#fff", 0.04),
                      border: `1px solid ${on ? "rgba(56,189,248,0.45)" : alpha("#fff", 0.06)}`,
                      "&:hover": { bgcolor: on ? "rgba(56,189,248,0.2)" : alpha("#fff", 0.08) },
                    }}
                  >
                    {opt.preview}
                  </Box>
                </Tooltip>
              );
            })}
          </Stack>
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        {/* 断面位置（ミニマップで X/Z 位置・向きを指定 → active な断面ラインへ反映） */}
        <Box>
          <SubHeader>断面位置（平面で指定）</SubHeader>
          <SectionClipPlanControl />
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        {/* 階・レベル設定（2FL/CL/GL のワンクリック作成・数値編集） */}
        <FloorLevelsSettings showGl />

        <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.5 }}>
          ビュー上では FL/GL 線をドラッグ（50mm 刻み・各レベルへスナップ）、CL は上下端をドラッグして伸縮できます。
        </Typography>
      </Stack>
    </Box>
  );
}
