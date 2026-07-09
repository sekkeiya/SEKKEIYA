// src/features/dsl/layout/editor/sidebars/RightSidebar/components/ContextPanels/BaseRoomPanel.jsx
// Base（躯体＝パラメトリックルーム）の Properties。床幅/奥行・壁高さ/厚みをスライダー＋数値で編集。
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, Slider, TextField, Stack, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import {
  useStructureLabelStore,
  STRUCTURE_LABEL_JP,
  STRUCTURE_COLOR,
} from "../../../../../store/useStructureLabelStore";

const SEMANTICS = ["floor", "outer_floor", "inner_wall", "outer_wall", "ceiling", "roof"];

/** ラベル種別ごとの表示/非表示トグル＋件数。Base 表示中の Properties に置く。 */
function LabelVisibilityControls() {
  const labels = useStructureLabelStore((s) => s.labels);
  const labelVisible = useStructureLabelStore((s) => s.labelVisible);
  const toggleLabelVisible = useStructureLabelStore((s) => s.toggleLabelVisible);
  const setAllLabelVisible = useStructureLabelStore((s) => s.setAllLabelVisible);
  const clearAll = useStructureLabelStore((s) => s.clearAll);

  const counts = SEMANTICS.reduce((acc, sem) => {
    acc[sem] = 0;
    return acc;
  }, {});
  for (const k of Object.keys(labels)) {
    const sem = labels[k]?.semantic;
    if (sem in counts) counts[sem]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Box sx={{ p: 1.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, textTransform: "uppercase", mb: 1 }}>
        面ラベルの表示
      </Typography>

      {total === 0 ? (
        <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
          まだラベルがありません。上部の「自動ラベル」で自動判定するか、面をクリックして床/内壁/外壁/天井/屋根を設定してください。
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {/* 一括表示/非表示 */}
          <Box sx={{ display: "flex", gap: 0.6, mb: 0.25 }}>
            <Box
              onClick={() => setAllLabelVisible(true)}
              sx={{
                flex: 1, textAlign: "center", px: 1, py: 0.45, borderRadius: 1, cursor: "pointer",
                fontSize: 11, fontWeight: 800, color: "#fff",
                background: alpha("#38bdf8", 0.16), border: `1px solid ${alpha("#38bdf8", 0.5)}`,
                userSelect: "none", "&:hover": { background: alpha("#38bdf8", 0.3) },
              }}
            >
              すべて表示
            </Box>
            <Box
              onClick={() => setAllLabelVisible(false)}
              sx={{
                flex: 1, textAlign: "center", px: 1, py: 0.45, borderRadius: 1, cursor: "pointer",
                fontSize: 11, fontWeight: 800, color: "#fff",
                background: alpha("#9aa0a6", 0.16), border: `1px solid ${alpha("#9aa0a6", 0.5)}`,
                userSelect: "none", "&:hover": { background: alpha("#9aa0a6", 0.3) },
              }}
            >
              すべて非表示
            </Box>
          </Box>
          {SEMANTICS.map((sem) => {
            const visible = labelVisible?.[sem] !== false;
            const color = STRUCTURE_COLOR[sem];
            return (
              <Box
                key={sem}
                onClick={() => toggleLabelVisible(sem)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1,
                  px: 1, py: 0.6, borderRadius: 1, cursor: "pointer",
                  opacity: visible ? 1 : 0.45,
                  background: alpha(color, visible ? 0.12 : 0.04),
                  border: `1px solid ${alpha(color, visible ? 0.5 : 0.2)}`,
                  "&:hover": { background: alpha(color, 0.2) },
                }}
              >
                <Box sx={{ width: 12, height: 12, borderRadius: "3px", background: color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#fff", flex: 1 }}>
                  {STRUCTURE_LABEL_JP[sem]}
                </Typography>
                <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{counts[sem]}</Typography>
                {visible
                  ? <VisibilityRoundedIcon sx={{ fontSize: 17, color: "rgba(255,255,255,0.8)" }} />
                  : <VisibilityOffRoundedIcon sx={{ fontSize: 17, color: "rgba(255,255,255,0.4)" }} />}
              </Box>
            );
          })}
        </Stack>
      )}

      {total > 0 && (
        <Box
          onClick={() => {
            if (window.confirm(`この躯体の全ラベル（${total}面）を解除します。よろしいですか？`)) clearAll();
          }}
          sx={{
            mt: 1.25, textAlign: "center", px: 1, py: 0.6, borderRadius: 1, cursor: "pointer",
            fontSize: 12, fontWeight: 800, color: "#fff",
            background: alpha("#ef5350", 0.16), border: `1px solid ${alpha("#ef5350", 0.5)}`,
            userSelect: "none", "&:hover": { background: alpha("#ef5350", 0.3) },
          }}
        >
          全ラベルを一括解除（{total}面）
        </Box>
      )}

      <Typography sx={{ mt: 1.5, fontSize: 10.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
        躯体の面（床・壁・天井）をクリックすると、ラベルとコリジョンを設定できます。Ctrl+A で全選択。
      </Typography>
    </Box>
  );
}

const FIELDS = [
  { key: "widthMm", label: "床: 幅 (W)", min: 1000, max: 30000, step: 100 },
  { key: "depthMm", label: "床: 奥行 (D)", min: 1000, max: 30000, step: 100 },
  { key: "heightMm", label: "壁: 高さ (H)", min: 1800, max: 6000, step: 50 },
  { key: "wallThicknessMm", label: "壁: 厚み", min: 20, max: 500, step: 10 },
];

const DEFAULTS = { widthMm: 10000, depthMm: 10000, heightMm: 3000, wallThicknessMm: 100 };

export default function BaseRoomPanel({ roomSpec, hasBaseGlb = false, onUpdateRoomSpec, onCreateDefaultRoom }) {
  // CADファイル等の読み込み済み3Dモデル Base：パラメトリック切替CTAは出さず、面ラベルの表示操作を出す。
  if (!roomSpec && hasBaseGlb) {
    return <LabelVisibilityControls />;
  }
  // 完全に未設定の Base：編集可能なデフォルトルーム作成 CTA（CADモデルが無い場合のみ）
  if (!roomSpec) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, mb: 2 }}>
          この躯体（Base）はまだ未設定です。編集可能なデフォルトルームを作成すると、床幅・奥行・壁高さをスライダーで調整できます。
        </Typography>
        <Button
          fullWidth
          variant="contained"
          startIcon={<MeetingRoomRoundedIcon sx={{ fontSize: 18 }} />}
          onClick={() => onCreateDefaultRoom?.()}
          sx={{ bgcolor: "#00BFFF", "&:hover": { bgcolor: "#009acc" }, textTransform: "none", fontWeight: 600 }}
        >
          編集可能なデフォルトルームを作成
        </Button>
      </Box>
    );
  }
  return <BaseRoomSliders roomSpec={roomSpec} onUpdateRoomSpec={onUpdateRoomSpec} />;
}

function BaseRoomSliders({ roomSpec, onUpdateRoomSpec }) {
  // ローカル即時反映 → コミットは debounce で Firestore へ
  const [local, setLocal] = useState({ ...DEFAULTS, ...(roomSpec || {}) });
  const debounceRef = useRef(null);

  // 外部（別クライアント等）からの更新を取り込む（ドラッグ中でなければ）
  const draggingRef = useRef(false);
  useEffect(() => {
    if (draggingRef.current) return;
    setLocal({ ...DEFAULTS, ...(roomSpec || {}) });
  }, [roomSpec?.widthMm, roomSpec?.depthMm, roomSpec?.heightMm, roomSpec?.wallThicknessMm]);

  const commit = useCallback((patch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateRoomSpec?.(patch);
    }, 180);
  }, [onUpdateRoomSpec]);

  const setValue = useCallback((key, raw, opts = {}) => {
    const field = FIELDS.find((f) => f.key === key);
    let v = Number(raw);
    if (!Number.isFinite(v)) return;
    v = Math.max(field.min, Math.min(field.max, Math.round(v)));
    setLocal((prev) => ({ ...prev, [key]: v }));
    if (!opts.deferCommit) commit({ [key]: v });
  }, [commit]);

  return (
    <Box sx={{ p: 1.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, textTransform: "uppercase", mb: 1.5 }}>
        部屋の寸法
      </Typography>

      <Stack spacing={2}>
        {FIELDS.map((f) => (
          <Box key={f.key}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{f.label}</Typography>
              <TextField
                value={local[f.key]}
                onChange={(e) => setValue(f.key, e.target.value)}
                type="number"
                size="small"
                inputProps={{ min: f.min, max: f.max, step: f.step, style: { textAlign: "right", padding: "2px 6px", width: 64 } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "#fff", fontSize: 12,
                    "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&.Mui-focused fieldset": { borderColor: "#00BFFF" },
                  },
                }}
              />
            </Box>
            <Slider
              value={typeof local[f.key] === "number" ? local[f.key] : f.min}
              min={f.min}
              max={f.max}
              step={f.step}
              onChange={(_, v) => { draggingRef.current = true; setValue(f.key, v, { deferCommit: true }); }}
              onChangeCommitted={(_, v) => { draggingRef.current = false; commit({ [f.key]: Number(v) }); }}
              size="small"
              sx={{
                color: "#00BFFF",
                "& .MuiSlider-thumb": { width: 14, height: 14 },
                "& .MuiSlider-rail": { color: "rgba(255,255,255,0.15)" },
              }}
            />
            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "right" }}>
              {(local[f.key] / 1000).toFixed(f.key === "wallThicknessMm" ? 2 : 1)} m
            </Typography>
          </Box>
        ))}
      </Stack>

      <Typography sx={{ mt: 2, fontSize: 10.5, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
        この躯体（Base）の寸法は、この Base 配下のすべてのプランで共有されます。
      </Typography>
    </Box>
  );
}
