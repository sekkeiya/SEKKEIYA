import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  TextField,
  Slider,
  Typography,
  Stack,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  Chip,
} from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";

import { useUnderlayStore } from "../../../../store/useUnderlayStore";
import { useWorkspaceStructureStore } from "../../../../store/useWorkspaceStructureStore";
import { deleteUnderlayFile } from "../../../../services/underlayImportService";

/** 小見出し付きステップ枠。 */
function Step({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Chip label={no} size="small" color="primary" sx={{ height: 20, fontWeight: 700 }} />
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <Stack spacing={1.25}>{children}</Stack>
    </Box>
  );
}

/**
 * UnderlayPanel — 下絵（PDF/画像）の調整。
 * 取り込みはヘッダーの「インポート → 下絵」から行う。ここでは
 *   ① 基準線を引いて実寸に合わせる → ② 位置・回転・不透明度を整える
 * を行う。
 */
export default function UnderlayPanel() {
  const imageUrl = useUnderlayStore((s) => s.imageUrl);
  const sourceName = useUnderlayStore((s) => s.sourceName);
  const visible = useUnderlayStore((s) => s.visible);
  const widthMm = useUnderlayStore((s) => s.widthMm);
  const rotationDeg = useUnderlayStore((s) => s.rotationDeg);
  const opacity = useUnderlayStore((s) => s.opacity);
  const drawMode = useUnderlayStore((s) => s.drawMode);
  const linePoints = useUnderlayStore((s) => s.linePoints);
  const owner = useUnderlayStore((s) => s.owner);

  // Plan を見ているのに下絵が Base のもの＝継承中。調整すると全 Plan に効くので警告する。
  const onPlan = useWorkspaceStructureStore((s) => !!s.selectedPlanId && !s.selectedOptionId);
  const inheritedFromBase = onPlan && owner === "base";

  const setVisible = useUnderlayStore((s) => s.setVisible);
  const setWidthMm = useUnderlayStore((s) => s.setWidthMm);
  const setRotationDeg = useUnderlayStore((s) => s.setRotationDeg);
  const setOpacity = useUnderlayStore((s) => s.setOpacity);
  const setDrawMode = useUnderlayStore((s) => s.setDrawMode);
  const clearLine = useUnderlayStore((s) => s.clearLine);
  const clear = useUnderlayStore((s) => s.clear);

  const [lineLengthInput, setLineLengthInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // 幅の入力欄はローカルに持ち、確定（blur / Enter）でストアへ。
  // 毎キーストロークで整形すると "12." のような途中入力が壊れるため。
  const [widthInput, setWidthInput] = useState("");
  const [widthFocused, setWidthFocused] = useState(false);
  useEffect(() => {
    // 校正などで外から幅が変わったら、編集中でない限り表示を追従させる。
    if (!widthFocused) setWidthInput((widthMm / 1000).toFixed(3));
  }, [widthMm, widthFocused]);

  const commitWidth = useCallback(() => {
    const v = parseFloat(widthInput);
    if (v > 0) setWidthMm(v * 1000);
    else setWidthInput((widthMm / 1000).toFixed(3)); // 不正入力は元に戻す
    setWidthFocused(false);
  }, [widthInput, widthMm, setWidthMm]);

  // パネルを閉じたら作図モードを残さない。
  useEffect(() => {
    return () => {
      useUnderlayStore.getState().setDrawMode("none");
    };
  }, []);

  /** 引いた基準線が今の縮尺で何 m に相当するか。 */
  const lineMeasuredM = useMemo(() => {
    if (linePoints.length < 2) return null;
    const [a, b] = linePoints;
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / 1000;
  }, [linePoints]);

  const handleCalibrate = useCallback(() => {
    if (linePoints.length < 2) {
      setError("基準線を2点で引いてください。");
      return;
    }
    const D = parseFloat(lineLengthInput);
    if (!(D > 0)) {
      setError("基準線の実寸（m）を入力してください。");
      return;
    }
    const [a, b] = linePoints;
    const Lmm = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (Lmm <= 0) return;
    // 今の線が Lmm、これを D m にしたい → 画像全体を同じ比率で拡縮する。
    const factor = (D * 1000) / Lmm;
    setWidthMm(widthMm * factor);
    clearLine();
    setDrawMode("none");
    setError(null);
    setStatus(`基準線を ${D} m に合わせて縮尺を確定しました。`);
  }, [linePoints, lineLengthInput, widthMm, setWidthMm, clearLine, setDrawMode]);

  const handleClear = useCallback(async () => {
    const message =
      owner === "plan"
        ? "この Plan の下絵を外します。Base に下絵があれば、そちらが再び表示されます。よろしいですか？"
        : onPlan
          ? "Base の下絵を外します。全ての Plan から消えます。よろしいですか？"
          : "下絵を外します。よろしいですか？";
    if (!window.confirm(message)) return;
    // 参照を切る前に Storage のパスを控えて、実ファイルも消す（孤児を残さない）。
    const path = useUnderlayStore.getState().storagePath;
    clear();
    setStatus(null);
    setError(null);
    await deleteUnderlayFile(path);
  }, [clear, owner, onPlan]);

  if (!imageUrl) {
    return (
      <Box sx={{ p: 1.25 }}>
        <Alert severity="info" sx={{ fontSize: 12.5 }}>
          下絵がありません。ヘッダーの「インポート → 下絵（PDF・画像）」から取り込んでください。
          {onPlan
            ? "この Plan で取り込むと、この Plan だけの下絵になります。"
            : "Base で取り込むと、全ての Plan に表示されます。"}
        </Alert>
      </Box>
    );
  }

  const widthM = widthMm / 1000;

  return (
    <Box sx={{ height: "100%", overflowY: "auto", p: 1.25 }}>
      <Stack spacing={2}>
        {/* 現在の下絵 */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            component="img"
            src={imageUrl}
            alt="下絵"
            sx={{
              width: 44,
              height: 44,
              objectFit: "cover",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.default",
            }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap title={sourceName}>
              {sourceName || "下絵"}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Chip
                label={owner === "plan" ? "この Plan 専用" : "Base（全 Plan 共通）"}
                size="small"
                variant="outlined"
                color={owner === "plan" ? "primary" : "default"}
                sx={{ height: 18, fontSize: 10.5 }}
              />
              <Typography variant="caption" color="text.secondary">
                幅 {widthM.toFixed(2)} m
              </Typography>
            </Stack>
          </Box>
          <Tooltip title={visible ? "下絵を隠す" : "下絵を表示"}>
            <IconButton size="small" onClick={() => setVisible(!visible)}>
              {visible ? <VisibilityRoundedIcon /> : <VisibilityOffRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="下絵を外す">
            <IconButton size="small" onClick={handleClear}>
              <DeleteOutlineRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {inheritedFromBase && (
          <Alert severity="info" sx={{ fontSize: 12 }}>
            この下絵は Base（躯体）のものです。ここでの調整・削除は<b>全ての Plan に反映されます</b>。
            この Plan だけ差し替えるには「インポート → 下絵」から取り込み直してください。
          </Alert>
        )}

        <Divider />

        {/* ① 縮尺合わせ */}
        <Step no={1} title="実寸に合わせる">
          <Typography variant="caption" color="text.secondary">
            図面上で長さの分かっている箇所（通り芯など）を2点クリックし、その実寸を入れると
            下絵全体の縮尺が決まります。
          </Typography>
          <Button
            size="small"
            variant={drawMode === "line" ? "contained" : "outlined"}
            startIcon={<StraightenRoundedIcon />}
            onClick={() => {
              setError(null);
              setStatus(null);
              if (drawMode === "line") {
                setDrawMode("none");
              } else {
                clearLine();
                setDrawMode("line");
              }
            }}
          >
            {drawMode === "line" ? "基準線を引いています（Enter で終了）" : "基準線を引く"}
          </Button>
          {lineMeasuredM != null && (
            <Typography variant="caption" color="text.secondary">
              引いた線の現在の長さ：{lineMeasuredM.toFixed(3)} m
            </Typography>
          )}
          <Stack direction="row" spacing={1}>
            <TextField
              label="この線の実寸（m）"
              value={lineLengthInput}
              onChange={(e) => setLineLengthInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCalibrate();
              }}
              size="small"
              fullWidth
              inputProps={{ inputMode: "decimal" }}
            />
            <Button size="small" variant="contained" onClick={handleCalibrate}>
              合わせる
            </Button>
          </Stack>
          <TextField
            label="下絵の幅（m）"
            value={widthInput}
            onChange={(e) => setWidthInput(e.target.value)}
            onFocus={() => setWidthFocused(true)}
            onBlur={commitWidth}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitWidth();
            }}
            size="small"
            helperText="基準線が引けないときは幅を直接入れて合わせられます"
            inputProps={{ inputMode: "decimal" }}
          />
        </Step>

        <Divider />

        {/* ② 位置・見え方 */}
        <Step no={2} title="位置と見え方を整える">
          <Typography variant="caption" color="text.secondary">
            ビューポートで右ドラッグすると下絵を平行移動できます。
          </Typography>

          <Box>
            <Typography variant="caption">回転：{rotationDeg}°</Typography>
            <Slider
              value={rotationDeg}
              min={-180}
              max={180}
              step={1}
              size="small"
              onChange={(_, v) => setRotationDeg(v as number)}
            />
          </Box>

          <Box>
            <Typography variant="caption">不透明度：{Math.round(opacity * 100)}%</Typography>
            <Slider
              value={opacity}
              min={0.05}
              max={1}
              step={0.05}
              size="small"
              onChange={(_, v) => setOpacity(v as number)}
            />
          </Box>
        </Step>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ fontSize: 12.5 }}>
            {error}
          </Alert>
        )}
        {status && (
          <Alert severity="success" onClose={() => setStatus(null)} sx={{ fontSize: 12.5 }}>
            {status}
          </Alert>
        )}
      </Stack>
    </Box>
  );
}
