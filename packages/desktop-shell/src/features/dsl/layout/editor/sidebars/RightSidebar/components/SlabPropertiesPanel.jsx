// SlabPropertiesPanel — 平面図で床（スラブ）を選択したときの Properties。
//   スラブ厚・面積（読み取り）・頂点数の表示と削除。床は Base の spaceProgram.slabs に
//   保存されるので、変更は全 Plan/Option に効く。
import React from "react";
import { Box, Typography, Divider, Stack, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ViewColumnRoundedIcon from "@mui/icons-material/ViewColumnRounded";
import { useSlabStore, slabAreaMm2 } from "../../../../store/useSlabStore";
import { useWallStore, makeWall, WALL_MIN_LENGTH } from "../../../../store/useWallStore";

function SubHeader({ children }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 700, mb: 0.75, color: "color-mix(in srgb, var(--brand-fg) 80%, transparent)" }}>
      {children}
    </Typography>
  );
}

function Row({ label, children }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
      <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)" }}>{label}</Typography>
      {children}
    </Stack>
  );
}

export default function SlabPropertiesPanel() {
  const slabs = useSlabStore((s) => s.slabs);
  const selectedSlabId = useSlabStore((s) => s.selectedSlabId);
  const updateSlab = useSlabStore((s) => s.updateSlab);
  const removeSlab = useSlabStore((s) => s.removeSlab);
  const selectedEdgeIndices = useSlabStore((s) => s.selectedEdgeIndices);
  const clearEdgeSelection = useSlabStore((s) => s.clearEdgeSelection);

  const slab = slabs.find((x) => x.id === selectedSlabId);
  if (!slab) return null;

  const areaM2 = slabAreaMm2(slab.points) / 1_000_000;

  /** 選択した辺に沿って壁を一括作成（既存と同一端点の壁はスキップ）。 */
  const createWallsFromEdges = (kind) => {
    const n = slab.points.length;
    const walls = selectedEdgeIndices
      .map((i) => {
        const a = slab.points[i];
        const b = slab.points[(i + 1) % n];
        if (!a || !b || Math.hypot(b.x - a.x, b.z - a.z) < WALL_MIN_LENGTH) return null;
        return makeWall(kind, a, b);
      })
      .filter(Boolean);
    if (walls.length) useWallStore.getState().addWalls(walls);
    clearEdgeSelection();
  };

  return (
    <Box sx={{ p: 1.5, height: "100%", overflowY: "auto" }}>
      <Stack spacing={1.5}>
        <Box>
          <SubHeader>寸法</SubHeader>
          <Row label="スラブ厚">
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <input
                type="number" value={slab.thicknessMm} min={30} max={1000} step={10}
                onChange={(e) => updateSlab(slab.id, {
                  thicknessMm: Math.max(30, Math.min(1000, Math.round(Number(e.target.value)) || 30)),
                })}
                style={{
                  width: 64, fontSize: 12, textAlign: "right", padding: "3px 6px", borderRadius: 4,
                  border: `1px solid ${alpha("#fff", 0.15)}`, background: alpha("#000", 0.25),
                  color: "var(--brand-fg)", outline: "none",
                }}
              />
              <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>mm</Typography>
            </Stack>
          </Row>
          <Row label="面積">
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "var(--brand-fg)" }}>
              {areaM2.toFixed(2)} ㎡
            </Typography>
          </Row>
          <Row label="頂点数">
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" }}>
              {slab.points.length}
            </Typography>
          </Row>
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        {/* 選択した辺 → 壁の一括作成 */}
        <Box>
          <SubHeader>壁を作成（選択した辺）</SubHeader>
          <Typography sx={{ fontSize: 10.5, mb: 0.75, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
            平面図で床の辺をクリックすると選択（水色でハイライト・複数可）。
            選択中: <b>{selectedEdgeIndices.length}</b> 辺
          </Typography>
          <Stack direction="row" spacing={0.5}>
            {[
              { kind: "exterior", label: "外壁を作成", color: "#0ea5e9" },
              { kind: "interior", label: "内壁を作成", color: "#22c55e" },
            ].map(({ kind, label, color }) => (
              <Button
                key={kind}
                size="small"
                disabled={selectedEdgeIndices.length === 0}
                startIcon={<ViewColumnRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => createWallsFromEdges(kind)}
                sx={{
                  flex: 1, textTransform: "none", fontWeight: 800, fontSize: 11.5, borderRadius: 1,
                  color: selectedEdgeIndices.length ? "#fff" : undefined,
                  background: alpha(color, selectedEdgeIndices.length ? 0.42 : 0.08),
                  border: `1px solid ${alpha(color, selectedEdgeIndices.length ? 0.85 : 0.25)}`,
                  "&:hover": { background: alpha(color, 0.55) },
                  "&.Mui-disabled": { color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)" },
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        <Button
          size="small"
          startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => removeSlab(slab.id)}
          sx={{
            textTransform: "none", fontWeight: 700, fontSize: 12, borderRadius: 1,
            color: "#ff6b6b",
            border: `1px solid ${alpha("#ff6b6b", 0.35)}`,
            "&:hover": { background: alpha("#ff6b6b", 0.12), borderColor: alpha("#ff6b6b", 0.6) },
          }}
        >
          この床を削除（Delete）
        </Button>

        <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.5 }}>
          平面図で床をクリックすると選択できます。面をドラッグで全体移動、辺をドラッグで
          その辺を伸縮。頂点はドラッグで移動（ドラッグ中は右クリック / Esc で取消）。クリックで
          選択すると移動ギズモが表示され、X / Z 軸に沿って正確に動かせます。
          移動中に <b>Shift</b> を押すとスナップ（頂点吸着・直交・
          整列・50mmグリッド）が効きます。辺の中点の「＋」で頂点を追加（辺を折る）。
          頂点をクリックして選択（白く強調）した状態で Delete を押すとその頂点だけを削除します
          （3頂点までは残します）。頂点を選択していない状態の Delete は床ごと削除です。
          上面はアクティブ階の床レベル(FL)に揃い、厚みは下向きに付きます。
          Base に保存されるため、変更は同じ Base の全 Plan / Option に反映されます。
        </Typography>
      </Stack>
    </Box>
  );
}
