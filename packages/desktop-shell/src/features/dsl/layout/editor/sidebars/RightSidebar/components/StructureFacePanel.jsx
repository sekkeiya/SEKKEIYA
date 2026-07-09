// StructureFacePanel — 右サイドバー Properties に表示する「面ラベル / コリジョン」設定。
// 躯体の床/壁/天井の面をクリックで選ぶと表示される。複数選択(Shift)に一括適用。

import React from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  useStructureLabelStore,
  STRUCTURE_LABEL_JP,
  STRUCTURE_COLOR,
} from "../../../../store/useStructureLabelStore";
import { useSceneObjectRegistryStore } from "../../../../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import { coplanarFacesOf } from "../../../../canvas/tools/structure/enumerateStructureFaces";

const SEMANTICS = ["floor", "outer_floor", "inner_wall", "outer_wall", "ceiling", "roof"];

function Btn({ label, color, onClick, disabled, active, full }) {
  return (
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        flex: full ? 1 : "0 0 auto",
        textAlign: "center",
        px: 1.1, py: 0.6, borderRadius: 1, fontSize: 12, fontWeight: 800,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        color: "var(--brand-fg)",
        background: alpha(color, active ? 0.5 : 0.16),
        border: `1px solid ${alpha(color, active ? 0.95 : 0.45)}`,
        boxShadow: active ? `0 0 0 1px ${`color-mix(in srgb, ${color} 60%, transparent)`}` : "none",
        userSelect: "none",
        "&:hover": disabled ? {} : { background: alpha(color, active ? 0.6 : 0.3) },
      }}
    >
      {label}
    </Box>
  );
}

export default function StructureFacePanel() {
  const selection = useStructureLabelStore((s) => s.selection);
  const labels = useStructureLabelStore((s) => s.labels);
  const applyToSelection = useStructureLabelStore((s) => s.applyToSelection);
  const clearSelection = useStructureLabelStore((s) => s.clearSelection);
  const removeSelectedLabels = useStructureLabelStore((s) => s.removeSelectedLabels);
  const mergeSelection = useStructureLabelStore((s) => s.mergeSelection);
  const selectMany = useStructureLabelStore((s) => s.selectMany);
  const clearAll = useStructureLabelStore((s) => s.clearAll);

  // 同一平面の面をまとめて選択：ラベルの有無に依らずジオメトリから連結面を全列挙し、
  // 選択中の面と同一平面（法線一致＋オフセット一致）のものを選択に加える。
  const selectCoplanar = () => {
    const sel = useStructureLabelStore.getState().selection;
    const selFaces = Object.values(sel);
    if (!selFaces.length) return;
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    if (!colliders.length) return;
    const upm = (useEditorModeStore.getState().sceneMaxY || 0) > 100 ? 1000 : 1;
    const matched = coplanarFacesOf(colliders, selFaces.map((f) => f.surface), upm);
    // 現在の選択と統合（キー重複は selectMany 内で1つにまとまる）
    selectMany([...selFaces, ...matched]);
  };

  const selKeys = Object.keys(selection);
  const selCount = selKeys.length;
  const hasSel = selCount > 0;
  const labelCount = Object.keys(labels).length;

  const onClearAll = () => {
    if (labelCount > 0 && !window.confirm(`この躯体の全ラベル（${labelCount}面）を解除します。よろしいですか？`)) return;
    clearAll();
  };

  const allHaveSemantic = (sem) => hasSel && selKeys.every((k) => labels[k]?.semantic === sem);
  const allHaveCollision = (v) => hasSel && selKeys.every((k) => labels[k] && labels[k].collision === v);

  // 同じラベルを再度押したら解除、違うラベルなら付け替え
  const onSemantic = (sem) => {
    if (allHaveSemantic(sem)) removeSelectedLabels();
    else applyToSelection({ semantic: sem });
  };

  if (!hasSel) {
    return (
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
        <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }}>
          躯体の面（床・壁・天井）をクリックすると、ここで役割ラベルとコリジョンを設定できます。Shift+クリックで複数選択、Ctrl+A で全選択。
        </Typography>
        {labelCount > 0 && (
          <Btn full label={`全ラベル解除（${labelCount}面）`} color="#ef5350" onClick={onClearAll} />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }}>
        選択中の面: {selCount}
      </Typography>

      <Box>
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", mb: 0.5 }}>役割ラベル</Typography>
        <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
          {SEMANTICS.map((sem) => (
            <Btn
              key={sem}
              label={STRUCTURE_LABEL_JP[sem]}
              color={STRUCTURE_COLOR[sem]}
              active={allHaveSemantic(sem)}
              onClick={() => onSemantic(sem)}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", mb: 0.5 }}>コリジョン（ウォークスルーの当たり判定）</Typography>
        <Box sx={{ display: "flex", gap: 0.6 }}>
          <Btn full label="ON" color="#3b82f6" active={allHaveCollision(true)} onClick={() => applyToSelection({ collision: true })} />
          <Btn full label="OFF" color="#9aa0a6" active={allHaveCollision(false)} onClick={() => applyToSelection({ collision: false })} />
        </Box>
      </Box>

      <Btn full label="同一平面の面をまとめて選択" color="#38bdf8" onClick={selectCoplanar} />

      {selCount >= 2 && (
        <Btn full label={`選択した${selCount}面を1面に結合`} color="#a78bfa" onClick={mergeSelection} />
      )}

      <Box sx={{ display: "flex", gap: 0.6, mt: 0.5 }}>
        <Btn full label="ラベル削除" color="#ef5350" onClick={removeSelectedLabels} />
        <Btn full label="選択解除" color="#64748b" onClick={clearSelection} />
      </Box>
      {labelCount > 0 && (
        <Btn full label={`全ラベル解除（${labelCount}面）`} color="#ef5350" onClick={onClearAll} />
      )}

      <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", lineHeight: 1.5 }}>
        床/壁ラベル＋コリジョンONで、ウォークスルーの当たり判定が付き、自動マテリアルの精度も上がります。
      </Typography>
    </Box>
  );
}
