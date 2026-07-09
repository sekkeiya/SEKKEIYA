// SectionClipPlanControl — ビューポート設定パネルの「断面 Clipping」操作 UI。
// 自動ラベルの「断面で高さを設定」のミニマップ UX を踏襲：平面図上のハンドルを
// ドラッグして断面位置を指定する直感操作。加えて俯瞰で「天井を抜く」高さ(Z=高さ)カットの
// スライダーを持つ。カメラは切り替えず、いまのビューのまま断面を更新する。
//   - 高さ(Z) : 水平カット（天井を抜いて中を見る）— editorMode.sectionClipHeight / sectionClipYEnabled
//   - 左右(X) : 縦の断面 — sectionClipX / sectionClipXEnabled
//   - 前後(Y) : 縦の断面 — sectionClipZ / sectionClipZEnabled
import React, { useRef, useState, useEffect } from "react";
import { Box, Stack, Typography, Slider, Chip, alpha } from "@mui/material";
import { useEditorModeStore } from "../store/useEditorModeStore";

const X_COLOR = "#ef9a9a"; // 左右(X) = 赤系（SectionClipManager の枠色と一致）
const Z_COLOR = "#90caf9"; // 前後(Z) = 青系
const Y_COLOR = "#a5d6a7"; // 高さ(Y) = 緑系

function Dot({ on, color, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        width: 11, height: 11, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
        bgcolor: on ? color : alpha("#fff", 0.2),
        border: `1px solid ${alpha(on ? color : "#fff", on ? 0.9 : 0.25)}`,
        transition: "background-color 0.15s",
        "&:hover": { opacity: 0.85 },
      }}
    />
  );
}

export default function SectionClipPlanControl() {
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);

  // 高さ(Z=高さ / Three.js Y)
  const sectionClipHeight = useEditorModeStore((s) => s.sectionClipHeight);
  const setSectionClipHeight = useEditorModeStore((s) => s.setSectionClipHeight);
  const yEnabled = useEditorModeStore((s) => s.sectionClipYEnabled);
  const setYEnabled = useEditorModeStore((s) => s.setSectionClipYEnabled);

  // 左右(X) / 前後(Z)
  const sectionClipX = useEditorModeStore((s) => s.sectionClipX);
  const sectionClipZ = useEditorModeStore((s) => s.sectionClipZ);
  const setSectionClipX = useEditorModeStore((s) => s.setSectionClipX);
  const setSectionClipZ = useEditorModeStore((s) => s.setSectionClipZ);
  const xEnabled = useEditorModeStore((s) => s.sectionClipXEnabled);
  const zEnabled = useEditorModeStore((s) => s.sectionClipZEnabled);
  const setXEnabled = useEditorModeStore((s) => s.setSectionClipXEnabled);
  const setZEnabled = useEditorModeStore((s) => s.setSectionClipZEnabled);

  // スケール（mm / m）
  const isMm = (sceneMaxY || 0) > 100;
  const yMax = Math.max(3, Math.ceil(sceneMaxY));
  const yStep = isMm ? (yMax > 1000 ? 10 : 1) : 0.1;
  const toMmH = (v) => (isMm ? Math.round(v) : Math.round(v * 1000));
  const fromMmH = (v) => (isMm ? v : v / 1000);

  // 平面ミニマップ（SectionMiniMap の座標系を踏襲）
  const svgRef = useRef(null);
  const dragAxisRef = useRef(null);
  const [dragAxis, setDragAxis] = useState(null);
  const W = 200, H = 132, pad = 16;
  const half = Math.max(sceneExtentXZ || 0, 1);
  const clampW = (w) => Math.max(-half, Math.min(half, w));
  const wToX = (w) => pad + ((w + half) / (2 * half)) * (W - 2 * pad);
  const wToY = (w) => pad + ((w + half) / (2 * half)) * (H - 2 * pad);
  const xToW = (sx) => ((sx - pad) / (W - 2 * pad)) * 2 * half - half;
  const yToW = (sy) => ((sy - pad) / (H - 2 * pad)) * 2 * half - half;
  const toM = (w) => (isMm ? w : w * 1000) / 1000;

  useEffect(() => {
    if (!dragAxis) return;
    const onMove = (e) => {
      const a = dragAxisRef.current; if (!a) return;
      const el = svgRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      if (a === "x") {
        const sx = ((e.clientX - rect.left) / rect.width) * W;
        setSectionClipX(clampW(xToW(sx)));
      } else {
        const sy = ((e.clientY - rect.top) / rect.height) * H;
        setSectionClipZ(clampW(yToW(sy)));
      }
    };
    const onUp = () => { dragAxisRef.current = null; setDragAxis(null); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragAxis, half]);

  const startDrag = (a) => (e) => {
    e.stopPropagation(); e.preventDefault();
    dragAxisRef.current = a; setDragAxis(a);
    // ドラッグした断面は自動 ON（掴んだら効く）
    if (a === "x" && !xEnabled) setXEnabled(true);
    if (a === "z" && !zEnabled) setZEnabled(true);
    const el = svgRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (a === "x") setSectionClipX(clampW(xToW(((e.clientX - rect.left) / rect.width) * W)));
      else setSectionClipZ(clampW(yToW(((e.clientY - rect.top) / rect.height) * H)));
    }
  };

  const lineX = wToX(clampW(sectionClipX));
  const lineY = wToY(clampW(sectionClipZ));

  return (
    <Box>
      {/* 高さ（天井を抜く） */}
      <Stack direction="row" alignItems="center" spacing={0.85} sx={{ mb: 0.5 }}>
        <Dot on={yEnabled} color={Y_COLOR} onClick={() => setYEnabled(!yEnabled)} />
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: yEnabled ? Y_COLOR : alpha("#fff", 0.4), width: 92, flexShrink: 0 }}>
          高さ（天井を抜く）
        </Typography>
        <Slider
          size="small" min={0} max={toMmH(yMax)} step={isMm ? yStep : 1}
          value={toMmH(sectionClipHeight)} disabled={!yEnabled}
          onChange={(_, v) => setSectionClipHeight(fromMmH(Array.isArray(v) ? v[0] : v))}
          sx={{ color: Y_COLOR, "& .MuiSlider-thumb": { width: 11, height: 11 }, "& .MuiSlider-rail": { opacity: 0.25 } }}
        />
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#fff", minWidth: 44, textAlign: "right" }}>
          {toMmH(sectionClipHeight)}mm
        </Typography>
      </Stack>

      {/* 平面で位置を指定（X=左右 / Z=前後 のハンドルをドラッグ） */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5, mt: 1 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: alpha("#fff", 0.45), letterSpacing: 0.3 }}>
          平面で位置を指定
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Chip
            label="左右 X" size="small" onClick={() => setXEnabled(!xEnabled)}
            sx={{ height: 20, fontSize: 10, fontWeight: 800, borderRadius: 1, cursor: "pointer",
              background: alpha(X_COLOR, xEnabled ? 0.28 : 0.06), border: `1px solid ${alpha(X_COLOR, xEnabled ? 0.85 : 0.22)}`,
              color: xEnabled ? "#fff" : alpha("#fff", 0.55) }}
          />
          <Chip
            label="前後 Z" size="small" onClick={() => setZEnabled(!zEnabled)}
            sx={{ height: 20, fontSize: 10, fontWeight: 800, borderRadius: 1, cursor: "pointer",
              background: alpha(Z_COLOR, zEnabled ? 0.28 : 0.06), border: `1px solid ${alpha(Z_COLOR, zEnabled ? 0.85 : 0.22)}`,
              color: zEnabled ? "#fff" : alpha("#fff", 0.55) }}
          />
        </Stack>
      </Stack>

      <Box
        component="svg" ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        sx={{ width: "100%", maxWidth: 248, mx: "auto", height: "auto", display: "block", borderRadius: 1, background: alpha("#fff", 0.03),
          border: `1px solid ${alpha("#fff", 0.1)}`, touchAction: "none", userSelect: "none",
          cursor: dragAxis ? (dragAxis === "x" ? "ew-resize" : "ns-resize") : "default" }}
      >
        {/* 建物フットプリント（概形） */}
        <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill={alpha("#fff", 0.05)} stroke={alpha("#fff", 0.25)} strokeWidth={1} />
        <text x={W / 2} y={H - 4} fill={alpha("#fff", 0.4)} fontSize="8" textAnchor="middle">X →（左右）</text>
        <text x={4} y={H / 2} fill={alpha("#fff", 0.4)} fontSize="8" textAnchor="middle" transform={`rotate(-90 4 ${H / 2})`}>Z →（前後）</text>

        {/* 縦線 = X断面（左右） */}
        <line x1={lineX} y1={pad} x2={lineX} y2={H - pad} stroke="transparent" strokeWidth={14} style={{ cursor: "ew-resize" }} onPointerDown={startDrag("x")} />
        <line x1={lineX} y1={pad} x2={lineX} y2={H - pad} stroke={X_COLOR} strokeWidth={xEnabled ? 2.4 : 1.2}
          strokeDasharray={xEnabled ? "none" : "3 3"} opacity={xEnabled ? 1 : 0.5} pointerEvents="none" />
        <circle cx={lineX} cy={H / 2} r={xEnabled ? 5.5 : 4} fill={X_COLOR} stroke="#0b1020" strokeWidth={1} style={{ cursor: "ew-resize" }} onPointerDown={startDrag("x")} />

        {/* 横線 = Z断面（前後） */}
        <line x1={pad} y1={lineY} x2={W - pad} y2={lineY} stroke="transparent" strokeWidth={14} style={{ cursor: "ns-resize" }} onPointerDown={startDrag("z")} />
        <line x1={pad} y1={lineY} x2={W - pad} y2={lineY} stroke={Z_COLOR} strokeWidth={zEnabled ? 2.4 : 1.2}
          strokeDasharray={zEnabled ? "none" : "3 3"} opacity={zEnabled ? 1 : 0.5} pointerEvents="none" />
        <circle cx={W / 2} cy={lineY} r={zEnabled ? 5.5 : 4} fill={Z_COLOR} stroke="#0b1020" strokeWidth={1} style={{ cursor: "ns-resize" }} onPointerDown={startDrag("z")} />
      </Box>

      <Typography sx={{ fontSize: 9, opacity: 0.5, mt: 0.5, lineHeight: 1.6 }}>
        ハンドルをドラッグで位置指定（自動ON）／チップで各断面の ON/OFF。
        <br />
        <span style={{ color: X_COLOR }}>左右 {toM(clampW(sectionClipX)) >= 0 ? "+" : ""}{toM(clampW(sectionClipX)).toFixed(2)}m</span>
        {" ｜ "}
        <span style={{ color: Z_COLOR }}>前後 {toM(clampW(sectionClipZ)) >= 0 ? "+" : ""}{toM(clampW(sectionClipZ)).toFixed(2)}m</span>
      </Typography>
    </Box>
  );
}
