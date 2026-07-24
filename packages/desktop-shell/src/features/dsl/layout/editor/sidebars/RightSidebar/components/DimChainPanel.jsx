// DimChainPanel — 図面の寸法列（4辺 × 1〜3列）の構成を編集する。
//   辺ごとに列を足し、各列の「刻み元」を選ぶ。列は内側から外側の順に並ぶ。
//   構成はビュー（平面/天井/断面/立面）ごとに保存される。
import React, { useEffect } from "react";
import { Box, Typography, Stack, IconButton, Tooltip, Select, MenuItem, Chip, Divider, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import {
  useDimChainStore,
  CHAIN_SIDES,
  CHAIN_SIDE_LABEL,
  CHAIN_SOURCE_LABEL,
  MAX_COLUMNS_PER_SIDE,
} from "../../../../store/useDimChainStore";
import { useViewportUiStore } from "../../../../store/viewportUiStore";

const SOURCES = ["total", "grid", "wall", "level"];

export default function DimChainPanel() {
  const configs = useDimChainStore((s) => s.configs);
  const visible = useDimChainStore((s) => s.visible);
  const setVisible = useDimChainStore((s) => s.setVisible);
  const addColumn = useDimChainStore((s) => s.addColumn);
  const removeColumn = useDimChainStore((s) => s.removeColumn);
  const setColumnSource = useDimChainStore((s) => s.setColumnSource);
  const resetView = useDimChainStore((s) => s.resetView);
  const removedMarks = useDimChainStore((s) => s.removedMarks);
  const restoreMarksFor = useDimChainStore((s) => s.restoreMarksFor);
  const chainsFor = useDimChainStore((s) => s.chainsFor);
  // どのビューの構成を編集しているか（キャンバスが最後に描いたビュー）。
  const viewKey = useViewportUiStore((s) => s.activeDimViewKey);

  // Esc でこのパネルを閉じる（＝寸法列の選択解除）。
  //   パネルが開いている間だけマウントされるので、ここに置けば確実に効く。
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      useDimChainStore.getState().setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!viewKey) {
    return (
      <Box sx={{ p: 1.25 }}>
        <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>
          平面図・断面図・立面図を開くと、そのビューの寸法列を設定できます。
        </Typography>
      </Box>
    );
  }

  const chains = configs[viewKey] || chainsFor(viewKey);
  const kind = String(viewKey).split(":")[0];
  const kindLabel = { plan: "平面図", ceil: "天井伏図", sect: "断面図", facade: "立面図", elev: "展開図" }[kind] || "図面";

  const sideBlock = (side) => {
    const cols = chains[side] || [];
    // 階レベルは縦の列（左右）でのみ意味がある。
    const allowed = SOURCES.filter((s) => (s === "level" ? side === "left" || side === "right" : true));
    return (
      <Box key={side} sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" }}>
            {CHAIN_SIDE_LABEL[side]}辺
          </Typography>
          <Tooltip title={cols.length >= MAX_COLUMNS_PER_SIDE ? "1辺に置ける列は3つまでです" : "この辺に寸法列を足す"} arrow>
            <span>
              <IconButton
                size="small" disabled={cols.length >= MAX_COLUMNS_PER_SIDE}
                onClick={() => addColumn(viewKey, side, side === "left" || side === "right" ? "level" : "grid")}
                sx={{ width: 22, height: 22 }}
              >
                <AddRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {cols.length === 0 ? (
          <Typography sx={{ fontSize: 10, pl: 0.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)" }}>
            列なし
          </Typography>
        ) : (
          <Stack spacing={0.4}>
            {cols.map((c, i) => (
              <Stack key={c.id} direction="row" alignItems="center" spacing={0.5}>
                <Chip
                  size="small" label={i === 0 ? "内" : i === cols.length - 1 ? "外" : "中"}
                  sx={{
                    height: 18, minWidth: 26, fontSize: 9.5, fontWeight: 800,
                    background: alpha("#475569", 0.25), border: `1px solid ${alpha("#94a3b8", 0.3)}`,
                  }}
                />
                <Select
                  size="small" variant="standard" value={c.source}
                  onChange={(e) => setColumnSource(viewKey, side, c.id, e.target.value)}
                  sx={{ flex: 1, fontSize: 11.5, "& .MuiSelect-select": { py: 0.2 } }}
                >
                  {allowed.map((s) => (
                    <MenuItem key={s} value={s} sx={{ fontSize: 12 }}>{CHAIN_SOURCE_LABEL[s]}</MenuItem>
                  ))}
                </Select>
                <Tooltip title="この列を削除" arrow>
                  <IconButton size="small" onClick={() => removeColumn(viewKey, side, c.id)} sx={{ width: 22, height: 22 }}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14, color: alpha("#ef4444", 0.85) }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 80%, transparent)" }}>
          寸法列 — {kindLabel}
        </Typography>
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="このビューの構成を既定に戻す" arrow>
            <IconButton size="small" onClick={() => resetView(viewKey)} sx={{ width: 24, height: 24 }}>
              <RestartAltRoundedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={visible ? "図面で非表示にする" : "図面に表示する"} arrow>
            <IconButton size="small" onClick={() => setVisible(!visible)} sx={{ width: 24, height: 24 }}>
              {visible
                ? <VisibilityRoundedIcon sx={{ fontSize: 15 }} />
                : <VisibilityOffRoundedIcon sx={{ fontSize: 15, opacity: 0.5 }} />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Typography sx={{ fontSize: 10.5, lineHeight: 1.5, mb: 1.25, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
        辺ごとに寸法列を 3 つまで並べられます。上から順に図面の内側 → 外側です。製図では
        内側に細かい刻み（壁面・通り芯間）、外側に総寸法を置きます。
      </Typography>

      {/* × で消した区切りの復元（このビュー分だけ戻す）。辺リストの上に置いて常に見えるようにする。 */}
      {Object.keys(removedMarks || {}).some((k) => k.startsWith(`${viewKey}|`)) && (
        <Button
          fullWidth size="small" variant="outlined"
          onClick={() => restoreMarksFor(viewKey)}
          sx={{ mb: 1.25, fontSize: 11, fontWeight: 700, textTransform: "none" }}
        >
          消した区切りを戻す（{Object.keys(removedMarks).filter((k) => k.startsWith(`${viewKey}|`)).length}）
        </Button>
      )}

      {CHAIN_SIDES.map(sideBlock)}

      <Divider sx={{ my: 1, borderColor: alpha("#fff", 0.1) }} />
      <Typography sx={{ fontSize: 10, lineHeight: 1.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>
        「通り芯間」は通り芯パネルで作った芯を刻みに使います。「階レベル」は GL・各階 FL・CL で
        刻むので、断面図や立面図の左右の列で使います。構成はこのビューごとに保存されます。
      </Typography>
    </Box>
  );
}
