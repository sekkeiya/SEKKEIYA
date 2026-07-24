// WallPropertiesPanel — 平面図で壁を選択したときの Properties。
//   種別（内壁/外壁）・壁厚・高さ（既定＝外壁:階高 / 内壁:CL、個別指定も可）・長さ表示・削除。
//   壁は Base の spaceProgram.walls に保存されるので、変更は全 Plan/Option に効く。
import React from "react";
import { Box, Typography, Divider, Stack, IconButton, Tooltip, Button, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import {
  useWallStore,
  WALL_DEFAULT_THICKNESS,
  WALL_KIND_LABEL,
  OPENING_TYPE_LABEL,
  wallLength,
} from "../../../../store/useWallStore";
import { useBuildingSpecStore } from "../../../../store/useBuildingSpecStore";

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

function NumRow({ label, value, min, max, step = 10, unit = "mm", disabled = false, onChange, action }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
      <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)" }}>{label}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <input
          type="number" value={value} min={min} max={max} step={step} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: 64, fontSize: 12, textAlign: "right", padding: "3px 6px", borderRadius: 4,
            border: `1px solid ${alpha("#fff", 0.15)}`, background: alpha("#000", disabled ? 0.12 : 0.25),
            color: disabled ? "color-mix(in srgb, var(--brand-fg) 40%, transparent)" : "var(--brand-fg)",
            outline: "none",
          }}
        />
        <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>{unit}</Typography>
        {action}
      </Stack>
    </Stack>
  );
}

export default function WallPropertiesPanel() {
  const walls = useWallStore((s) => s.walls);
  const selectedWallId = useWallStore((s) => s.selectedWallId);
  const selectedWallIds = useWallStore((s) => s.selectedWallIds);
  const updateWall = useWallStore((s) => s.updateWall);
  const removeWall = useWallStore((s) => s.removeWall);
  const addOpening = useWallStore((s) => s.addOpening);
  const updateOpening = useWallStore((s) => s.updateOpening);
  const removeOpening = useWallStore((s) => s.removeOpening);
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const floorsList = useBuildingSpecStore((s) => s.floors);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);

  const wall = walls.find((w) => w.id === selectedWallId);
  if (!wall) return null;

  // ── 複数選択中は一括操作 UI（種別一括変更・一括削除）を表示 ──
  if (selectedWallIds.length > 1) {
    return (
      <Box sx={{ p: 1.5, height: "100%", overflowY: "auto" }}>
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: "var(--brand-fg)" }}>
            {selectedWallIds.length} 本の壁を選択中
          </Typography>
          <Box>
            <SubHeader>種別を一括変更</SubHeader>
            <Stack direction="row" spacing={0.5}>
              {["exterior", "interior"].map((kd) => {
                const color = kd === "exterior" ? "#0ea5e9" : "#22c55e";
                return (
                  <Chip
                    key={kd}
                    size="small"
                    clickable
                    onClick={() => useWallStore.getState().setWallsKind(selectedWallIds, kd)}
                    label={WALL_KIND_LABEL[kd]}
                    sx={{
                      flex: 1, height: 26, fontSize: 11.5, fontWeight: 800, borderRadius: 1,
                      background: alpha(color, 0.18),
                      border: `1px solid ${alpha(color, 0.45)}`,
                      color: "var(--brand-fg)",
                      "&:hover": { background: alpha(color, 0.3) },
                    }}
                  />
                );
              })}
            </Stack>
          </Box>
          <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />
          <Button
            size="small"
            startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => useWallStore.getState().removeWalls(selectedWallIds)}
            sx={{
              textTransform: "none", fontWeight: 700, fontSize: 12, borderRadius: 1,
              color: "#ff6b6b",
              border: `1px solid ${alpha("#ff6b6b", 0.35)}`,
              "&:hover": { background: alpha("#ff6b6b", 0.12), borderColor: alpha("#ff6b6b", 0.6) },
            }}
          >
            選択した壁をすべて削除（Delete）
          </Button>
          <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.5 }}>
            Ctrl / Shift + クリックで選択に追加・除外できます。厚みや開口部の編集は単体選択で行ってください。
          </Typography>
        </Stack>
      </Box>
    );
  }

  const defaultHeight = wall.kind === "exterior" ? floorHeightMm : ceilingHeightMm;
  const usingDefaultHeight = wall.heightMm == null;
  const len = wallLength(wall);

  // 種別変更。壁厚が「元の種別の既定値」のままなら、新しい種別の既定へ追従させる。
  const changeKind = (kind) => {
    if (kind === wall.kind) return;
    const patch = { kind };
    if (wall.thicknessMm === WALL_DEFAULT_THICKNESS[wall.kind]) {
      patch.thicknessMm = WALL_DEFAULT_THICKNESS[kind];
    }
    updateWall(wall.id, patch);
  };

  return (
    <Box sx={{ p: 1.5, height: "100%", overflowY: "auto" }}>
      <Stack spacing={1.5}>
        {/* 種別 */}
        <Box>
          <SubHeader>種別</SubHeader>
          <Stack direction="row" spacing={0.5}>
            {["exterior", "interior"].map((k) => {
              const on = wall.kind === k;
              const color = k === "exterior" ? "#0ea5e9" : "#22c55e";
              return (
                <Chip
                  key={k}
                  size="small"
                  clickable
                  onClick={() => changeKind(k)}
                  label={WALL_KIND_LABEL[k]}
                  sx={{
                    flex: 1, height: 26, fontSize: 11.5, fontWeight: 800, borderRadius: 1,
                    background: alpha(color, on ? 0.4 : 0.1),
                    border: `1px solid ${alpha(color, on ? 0.9 : 0.3)}`,
                    color: on ? "#fff" : "color-mix(in srgb, var(--brand-fg) 60%, transparent)",
                    "&:hover": { background: alpha(color, on ? 0.48 : 0.2) },
                  }}
                />
              );
            })}
          </Stack>
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        {/* 寸法 */}
        <Box>
          <SubHeader>寸法</SubHeader>
          <NumRow
            label="壁厚"
            value={wall.thicknessMm}
            min={20}
            max={1000}
            step={10}
            onChange={(v) => updateWall(wall.id, { thicknessMm: Math.max(20, Math.min(1000, Math.round(v) || 20)) })}
          />
          <NumRow
            label={usingDefaultHeight ? `高さ（既定=${wall.kind === "exterior" ? "階高" : "CL"}）` : "高さ"}
            value={usingDefaultHeight ? defaultHeight : wall.heightMm}
            min={200}
            max={20000}
            step={50}
            disabled={usingDefaultHeight}
            onChange={(v) => updateWall(wall.id, { heightMm: Math.max(200, Math.min(20000, Math.round(v) || 200)) })}
            action={
              <Tooltip title={usingDefaultHeight ? "個別の高さを指定する" : "既定（外壁=階高 / 内壁=CL）に戻す"}>
                <IconButton
                  size="small"
                  onClick={() => updateWall(wall.id, { heightMm: usingDefaultHeight ? defaultHeight : null })}
                  sx={{
                    color: usingDefaultHeight
                      ? "color-mix(in srgb, var(--brand-fg) 45%, transparent)"
                      : "light-dark(#0aa5c2, #22d3ee)",
                    "&:hover": { color: "var(--brand-fg)" },
                  }}
                >
                  <RestartAltRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            }
          />
          {/* どの階の壁か。変えるとその階の FL に建て直される（平面図の表示階も切替わる）。 */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)" }}>階</Typography>
            <select
              value={wall.floorIndex || 0}
              onChange={(e) => updateWall(wall.id, { floorIndex: Number(e.target.value) || 0 })}
              style={{
                width: 96, fontSize: 12, padding: "3px 6px", borderRadius: 4,
                border: `1px solid ${alpha("#fff", 0.15)}`, background: alpha("#000", 0.25),
                color: "var(--brand-fg)", outline: "none",
              }}
            >
              {(floorsList || []).map((f, i) => (
                <option key={i} value={i}>{f.name || `${i + 1}FL`}</option>
              ))}
            </select>
          </Stack>
          {/* FL からの上下オフセット。浮き壁・下がり壁に使う（断面ビューで縦ドラッグしても変わる）。 */}
          <NumRow
            label="上下オフセット"
            value={wall.offsetYMm || 0}
            min={-20000}
            max={20000}
            step={10}
            onChange={(v) => updateWall(wall.id, { offsetYMm: Math.round(v) || 0 })}
          />
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)" }}>長さ</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "var(--brand-fg)" }}>
              {(len / 1000).toFixed(3)} m
            </Typography>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        {/* 開口部（ドア／窓） */}
        <Box>
          <SubHeader
            action={
              <Stack direction="row" spacing={0.25}>
                {["door", "window"].map((t) => (
                  <Tooltip key={t} title={`${OPENING_TYPE_LABEL[t]}を追加（壁の中央に作成 → 位置を調整）`}>
                    <Button
                      size="small"
                      startIcon={<AddRoundedIcon sx={{ fontSize: 13, mr: -0.5 }} />}
                      onClick={() => addOpening(wall.id, t)}
                      sx={{
                        minWidth: 0, px: 0.9, py: 0.1, fontSize: 10.5, fontWeight: 800,
                        textTransform: "none", borderRadius: 1,
                        color: "light-dark(#0aa5c2, #22d3ee)",
                        border: `1px solid ${alpha("#22d3ee", 0.3)}`,
                        "&:hover": { background: alpha("#22d3ee", 0.12) },
                      }}
                    >
                      {OPENING_TYPE_LABEL[t]}
                    </Button>
                  </Tooltip>
                ))}
              </Stack>
            }
          >
            開口部
          </SubHeader>
          {(wall.openings || []).length === 0 ? (
            <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>
              「＋ドア／＋窓」で開口部を追加できます。
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {(wall.openings || []).map((o) => {
                const half = o.widthMm / 2;
                const clampOffset = (v) => Math.max(half + 25, Math.min(len - half - 25, Math.round(v) || 0));
                return (
                  <Box
                    key={o.id}
                    sx={{ px: 1, py: 0.75, borderRadius: 1, bgcolor: alpha("#fff", 0.04), border: `1px solid ${alpha("#fff", 0.08)}` }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Chip
                        size="small"
                        label={OPENING_TYPE_LABEL[o.type]}
                        sx={{
                          height: 18, fontSize: 9.5, fontWeight: 800, borderRadius: 0.75,
                          background: alpha(o.type === "door" ? "#f59e0b" : "#38bdf8", 0.2),
                          border: `1px solid ${alpha(o.type === "door" ? "#f59e0b" : "#38bdf8", 0.45)}`,
                          color: "var(--brand-fg)",
                        }}
                      />
                      <Tooltip title="この開口部を削除">
                        <IconButton
                          size="small"
                          onClick={() => removeOpening(wall.id, o.id)}
                          sx={{ color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", "&:hover": { color: "#ff6b6b" } }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <NumRow label="位置（始点→中心）" value={o.offsetMm} min={0} max={Math.round(len)} step={50}
                      onChange={(v) => updateOpening(wall.id, o.id, { offsetMm: clampOffset(v) })} />
                    <NumRow label="幅" value={o.widthMm} min={100} max={Math.round(len - 50)} step={50}
                      onChange={(v) => updateOpening(wall.id, o.id, { widthMm: Math.max(100, Math.min(len - 50, Math.round(v) || 100)) })} />
                    <NumRow label="高さ" value={o.heightMm} min={100} max={6000} step={50}
                      onChange={(v) => updateOpening(wall.id, o.id, { heightMm: Math.max(100, Math.min(6000, Math.round(v) || 100)) })} />
                    <NumRow label="下端（床から）" value={o.sillMm} min={0} max={3000} step={50}
                      onChange={(v) => updateOpening(wall.id, o.id, { sillMm: Math.max(0, Math.min(3000, Math.round(v) || 0)) })} />
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        <Button
          size="small"
          startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => removeWall(wall.id)}
          sx={{
            textTransform: "none", fontWeight: 700, fontSize: 12, borderRadius: 1,
            color: "#ff6b6b",
            border: `1px solid ${alpha("#ff6b6b", 0.35)}`,
            "&:hover": { background: alpha("#ff6b6b", 0.12), borderColor: alpha("#ff6b6b", 0.6) },
          }}
        >
          この壁を削除（Delete）
        </Button>

        <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.5 }}>
          壁を選択すると中心に移動ギズモが表示され、壁全体を動かせます（複数選択時は重心に
          表示されまとめて移動）。平面図では壁本体をドラッグしても移動できます。
          端点はドラッグで移動（ドラッグ中は右クリック / Esc で取消）。端点をクリックで選択すると
          ギズモが端点に移り、X / Z 軸に沿って正確に動かせます。
          移動中に <b>Shift</b> を押すとスナップ（端点吸着・直交・50mmグリッド）が効きます。
          連結している他の壁の端点も1つの頂点として一緒に動きます。
          Ctrl / Shift + クリックで壁を複数選択できます。壁を選択中に<b>空き領域から左ドラッグ</b>で頂点を
          範囲選択すると、その重心にギズモが出て、選んだ頂点をまとめて動かせます。余白をクリックすると選択を解除します。
          壁は Base に保存され、変更は全 Plan / Option に反映。
          角は隣り合う壁と自動で留め（マイター）処理されます。
        </Typography>
      </Stack>
    </Box>
  );
}
