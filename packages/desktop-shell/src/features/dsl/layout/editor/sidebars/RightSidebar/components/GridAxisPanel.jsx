// GridAxisPanel — 通り芯（構造グリッド）の管理。
//   - 壁芯から自動生成（描いた壁の芯をそのまま通りにする）
//   - ＋X通り / ＋Y通り で1本追加（追加後は平面でドラッグして位置決め）
//   - 一覧: 符号の改名・位置(mm)の直接入力・削除
//   通り芯は寸法列の「刻み元」になる基準線で、Base に保存＝全 Plan/Option 共通。
import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, Stack, IconButton, Tooltip, TextField, Chip, Divider, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { useGridAxisStore } from "../../../../store/useGridAxisStore";
import { useWallStore } from "../../../../store/useWallStore";
import { extractGridAxesAll } from "../../../../utils/extractGridAxes";

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

const AXIS_LABEL = { x: "X通り（縦）", z: "Y通り（横）" };

export default function GridAxisPanel() {
  const axes = useGridAxisStore((s) => s.axes);
  const selectedId = useGridAxisStore((s) => s.selectedId);
  const visible = useGridAxisStore((s) => s.visible);
  const setSelectedId = useGridAxisStore((s) => s.setSelectedId);
  const setVisible = useGridAxisStore((s) => s.setVisible);
  const addAxis = useGridAxisStore((s) => s.addAxis);
  const updateAxis = useGridAxisStore((s) => s.updateAxis);
  const removeAxis = useGridAxisStore((s) => s.removeAxis);
  const replaceAxes = useGridAxisStore((s) => s.replaceAxes);
  const walls = useWallStore((s) => s.walls);

  // Esc でこのパネルを閉じる（＝通り芯の選択解除）。
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const st = useGridAxisStore.getState();
      st.setSelectedId(null);
      st.setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 主要構造とみなす壁の最小長さ。短い間仕切りまで通り芯にしないためのしきい値。
  const [minLenMm, setMinLenMm] = useState(1800);
  // 描いた壁の芯＋インポート躯体(GLB)の壁面から拾える通りの本数（結果を予告する）。
  //   GLB 側は毎回ジオメトリを走査するので、しきい値か壁の変更時だけ数え直す。
  const candidates = useMemo(
    () => extractGridAxesAll(walls || [], minLenMm),
    [walls, minLenMm],
  );

  const grouped = useMemo(() => ({
    x: axes.filter((a) => a.axis === "x").sort((a, b) => a.pos - b.pos),
    z: axes.filter((a) => a.axis === "z").sort((a, b) => a.pos - b.pos),
  }), [axes]);

  const generate = () => {
    if (!candidates.length) return;
    if (axes.length && !window.confirm(`既存の通り芯 ${axes.length} 本を、躯体から拾った ${candidates.length} 本で置き換えます。よろしいですか？`)) return;
    replaceAxes(candidates);
  };

  const row = (a) => (
    <Stack
      key={a.id} direction="row" alignItems="center" spacing={0.75}
      onClick={() => setSelectedId(a.id)}
      sx={{
        px: 0.75, py: 0.4, borderRadius: 1, cursor: "pointer",
        background: a.id === selectedId ? alpha("#0369a1", 0.18) : "transparent",
        border: `1px solid ${a.id === selectedId ? alpha("#0369a1", 0.5) : "transparent"}`,
        "&:hover": { background: alpha("#0369a1", a.id === selectedId ? 0.22 : 0.08) },
      }}
    >
      <TextField
        value={a.name} variant="standard" size="small"
        onChange={(e) => updateAxis(a.id, { name: e.target.value, renamed: true })}
        onClick={(e) => e.stopPropagation()}
        inputProps={{ style: { fontSize: 11.5, fontWeight: 800, textAlign: "center", padding: "2px 0" } }}
        sx={{ width: 46 }}
      />
      <TextField
        value={Math.round(a.pos)} type="number" variant="standard" size="small"
        onChange={(e) => updateAxis(a.id, { pos: Math.round(Number(e.target.value) || 0) })}
        onClick={(e) => e.stopPropagation()}
        inputProps={{ step: 50, style: { fontSize: 11.5, textAlign: "right", padding: "2px 0" } }}
        sx={{ flex: 1 }}
      />
      <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>mm</Typography>
      <Tooltip title="この通り芯を削除" arrow>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeAxis(a.id); }} sx={{ width: 22, height: 22 }}>
          <DeleteOutlineRoundedIcon sx={{ fontSize: 14, color: alpha("#ef4444", 0.85) }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <Box sx={{ p: 1.25 }}>
      <SubHeader
        action={
          <Tooltip title={visible ? "図面で非表示にする" : "図面に表示する"} arrow>
            <IconButton size="small" onClick={() => setVisible(!visible)} sx={{ width: 24, height: 24 }}>
              {visible
                ? <VisibilityRoundedIcon sx={{ fontSize: 15 }} />
                : <VisibilityOffRoundedIcon sx={{ fontSize: 15, opacity: 0.5 }} />}
            </IconButton>
          </Tooltip>
        }
      >
        通り芯
      </SubHeader>

      <Typography sx={{ fontSize: 10.5, lineHeight: 1.5, mb: 1, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
        寸法の基準になる線です。平面図では線のドラッグ／選択中のギズモで位置を決め、端部の●で線の長さを伸縮、記号のダブルクリックで符号を変えられます。断面・立面にも自動で出ます。
      </Typography>

      <Button
        fullWidth size="small" variant="outlined" startIcon={<AutoFixHighRoundedIcon sx={{ fontSize: 15 }} />}
        disabled={!candidates.length}
        onClick={generate}
        sx={{ mb: 0.75, fontSize: 11.5, fontWeight: 800, textTransform: "none" }}
      >
        {candidates.length ? `躯体から生成（${candidates.length} 本）` : "躯体から生成（対象の壁がありません）"}
      </Button>
      {/* 描いた壁の芯に加えて、インポートした躯体(GLB)の壁面からも芯を推定する。
          しきい値より短い壁は拾わない＝すべての壁に通りを作らない。 */}
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.25 }}>
        <Typography sx={{ fontSize: 10.5, whiteSpace: "nowrap", color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
          対象にする壁の長さ
        </Typography>
        {[1200, 1800, 2700, 3600].map((v) => (
          <Chip
            key={v} size="small" clickable label={`${v / 1000}m~`}
            onClick={() => setMinLenMm(v)}
            sx={{
              height: 20, fontSize: 10, fontWeight: 800, borderRadius: 1,
              background: minLenMm === v ? alpha("#0369a1", 0.42) : alpha("#0369a1", 0.1),
              border: `1px solid ${alpha("#0369a1", minLenMm === v ? 0.85 : 0.3)}`,
              color: minLenMm === v ? "#fff" : "color-mix(in srgb, var(--brand-fg) 75%, transparent)",
            }}
          />
        ))}
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ mb: 1.25 }}>
        {(["x", "z"]).map((dir) => (
          <Chip
            key={dir} size="small" clickable
            icon={<AddRoundedIcon sx={{ fontSize: 14, ml: "4px !important" }} />}
            label={AXIS_LABEL[dir]}
            onClick={() => addAxis(dir)}
            sx={{
              flex: 1, height: 26, fontSize: 11, fontWeight: 800, borderRadius: 1,
              background: alpha("#0369a1", 0.14),
              border: `1px solid ${alpha("#0369a1", 0.4)}`,
              "&:hover": { background: alpha("#0369a1", 0.26) },
            }}
          />
        ))}
      </Stack>

      {axes.length === 0 ? (
        <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", py: 1, textAlign: "center" }}>
          通り芯がまだありません
        </Typography>
      ) : (
        (["x", "z"]).map((dir) => (
          grouped[dir].length ? (
            <Box key={dir} sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.4, color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }}>
                {AXIS_LABEL[dir]}
              </Typography>
              <Stack spacing={0.25}>{grouped[dir].map(row)}</Stack>
            </Box>
          ) : null
        ))
      )}

      <Divider sx={{ my: 1, borderColor: alpha("#fff", 0.1) }} />
      <Typography sx={{ fontSize: 10, lineHeight: 1.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>
        符号は位置順に自動採番されます（X1…／Y1…）。名前を打ち替えた通りだけは、その名前のまま残ります。
      </Typography>
    </Box>
  );
}
