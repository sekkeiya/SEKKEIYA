import React, { useState, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Fade,
  LinearProgress,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import MovieCreationRoundedIcon from "@mui/icons-material/MovieCreationRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";

import { open } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import { useShotStore } from "@desktop/features/dsl/layout/store/useShotStore";
import { useRenderHistoryStore } from "@desktop/features/dsl/layout/store/useRenderHistoryStore";
import { makeHistoryThumbnail } from "@desktop/features/dsl/layout/services/imageThumbnail";
import { layoutSceneRef } from "@desktop/features/dsl/layout/services/layoutSceneRef";
import { captureLayoutPerspective } from "@desktop/features/dsl/layout/services/layoutPerspectiveCapture";
import { checkBlender, renderWithCycles, downloadBlender } from "@desktop/features/dsl/layout/services/layoutCyclesCapture";
import { listen } from "@tauri-apps/api/event";
import { auth } from "@desktop/lib/firebase/client";
import DslRenderUploadDialog from "./DslRenderUploadDialog";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

// ─────────────────────────────────────────────────────────────────
// MediaPanel
// ─────────────────────────────────────────────────────────────────

export default function MediaPanel({ onClose, projectId, projectName, workspaceId, planId }) {
  const shots = useShotStore((s) => s.shots);
  const addShot = useShotStore((s) => s.addShot);
  const removeShot = useShotStore((s) => s.removeShot);
  const renameShot = useShotStore((s) => s.renameShot);
  const updateShot = useShotStore((s) => s.updateShot);
  const setActiveShotId = useShotStore((s) => s.setActiveShotId);

  const addHistoryEntry = useRenderHistoryStore((s) => s.addEntry);

  // ── ローカル状態 ──────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);
  const [addingShot, setAddingShot] = useState(false);
  const [recaptureId, setRecaptureId] = useState(null);
  const [renderProgress, setRenderProgress] = useState(null); // { done, total } | null
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  // レンダリング結果ダイアログ
  const [renderResults, setRenderResults] = useState(null); // [{id, name, thumbnail}] | null

  // エラー通知
  const [errorMsg, setErrorMsg] = useState(null);

  // Cycles レンダリング
  const [renderQuality, setRenderQuality]         = useState("standard"); // "standard" | "cycles"
  const [blenderInfo, setBlenderInfo]             = useState(null);       // { path, version } | null
  const [blenderSetupOpen, setBlenderSetupOpen]   = useState(false);
  const [blenderDownloading, setBlenderDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress]   = useState(null);       // { pct, phase } | null
  const [pendingTargets, setPendingTargets]        = useState([]);
  const [cyclesProgress, setCyclesProgress]       = useState(null);       // { current, total, pct } | null

  // ── Shot 選択トグル ───────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(shots.map((s) => s.id));
  }, [shots]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  // ── Shot 追加（現在のビューポートカメラ） ─────────────────────
  const handleAddShot = useCallback(async () => {
    if (addingShot) return;
    const cameraState = layoutSceneRef.getCameraState?.();
    if (!cameraState) {
      console.error("[MediaPanel] カメラ状態を取得できません");
      return;
    }
    setAddingShot(true);
    try {
      const thumbnail = await captureLayoutPerspective();
      const id = addShot(cameraState, thumbnail);
      setSelectedIds((prev) => [...prev, id]);
    } catch (e) {
      console.error("[MediaPanel] Shot追加失敗:", e);
    } finally {
      setAddingShot(false);
    }
  }, [addingShot, addShot]);

  // ── 現在のビューでカメラ再撮影（カードの小ボタン） ────────────
  const handleRecapture = useCallback(
    async (shot) => {
      if (recaptureId) return;
      const currentCamera = layoutSceneRef.getCameraState?.() ?? shot.camera;
      setRecaptureId(shot.id);
      setActiveShotId(shot.id);
      try {
        const thumbnail = await captureLayoutPerspective(currentCamera);
        if (thumbnail) updateShot(shot.id, { thumbnail, camera: currentCamera });
      } catch (e) {
        console.error("[MediaPanel] 再撮影失敗:", e);
      } finally {
        setRecaptureId(null);
      }
    },
    [recaptureId, setActiveShotId, updateShot]
  );

  // ── 静止画を生成（レンダリングのみ、保存はダイアログで選択） ──
  const handleRenderImages = useCallback(async () => {
    if (renderProgress) return;

    if (!layoutSceneRef.gl || !layoutSceneRef.scene) {
      setErrorMsg('3Dシーンが未初期化です。レイアウトビューを開き直してください。');
      return;
    }

    const targets = shots.filter((s) => selectedIds.includes(s.id));
    if (targets.length === 0) {
      setErrorMsg('Shotを選択してください（カードをクリックで選択）。');
      return;
    }

    // ── Cycles レンダリング ──
    if (renderQuality === "cycles") {
      let info = blenderInfo;
      if (!info) {
        try {
          info = await checkBlender();
          setBlenderInfo(info);
        } catch {
          setPendingTargets(targets);
          setBlenderSetupOpen(true);
          return;
        }
      }

      const unlistenFn    = await listen("cycles-progress", (ev) => {
        setCyclesProgress(ev.payload);
      });
      const unlistenLog = await listen("cycles-log", (ev) => {
        console.log("[Blender]", ev.payload);
      });

      setRenderProgress({ done: 0, total: targets.length });
      const results = [];

      try {
        for (let i = 0; i < targets.length; i++) {
          const shot = targets[i];
          setCyclesProgress(null);
          try {
            const thumbnail = await renderWithCycles(shot.camera, info.path, 128);
            if (thumbnail) {
              results.push({ id: shot.id, name: shot.name, thumbnail, quality: "cycles", width: 1920, height: 1080 });
              try {
                const histThumb = await makeHistoryThumbnail(thumbnail);
                addHistoryEntry({ shotId: shot.id, shotName: shot.name, thumbnail: histThumb, quality: "cycles" });
              } catch (e) {
                console.warn("[MediaPanel] 履歴サムネイル生成失敗:", e);
              }
            }
          } catch (e) {
            console.error(`[MediaPanel] Cycles失敗: ${shot.name}`, e);
            setErrorMsg(`${shot.name} のCyclesレンダリングに失敗しました\n${String(e?.message ?? e)}`);
          }
          setRenderProgress({ done: i + 1, total: targets.length });
        }
      } finally {
        unlistenFn();
        unlistenLog();
        setCyclesProgress(null);
        setRenderProgress(null);
      }

      if (results.length > 0) setRenderResults(results);
      return;
    }

    // ── 標準 Three.js レンダリング ──
    setRenderProgress({ done: 0, total: targets.length });
    const results = [];

    for (let i = 0; i < targets.length; i++) {
      const shot = targets[i];
      try {
        const thumbnail = await captureLayoutPerspective(shot.camera);
        if (thumbnail) {
          results.push({ id: shot.id, name: shot.name, thumbnail, quality: "standard", width: 1920, height: 1080 });
          try {
            const histThumb = await makeHistoryThumbnail(thumbnail);
            addHistoryEntry({ shotId: shot.id, shotName: shot.name, thumbnail: histThumb, quality: "standard" });
          } catch (e) {
            console.warn("[MediaPanel] 履歴サムネイル生成失敗:", e);
          }
        }
      } catch (e) {
        console.error(`[MediaPanel] Shot ${shot.name} のレンダリング失敗:`, e);
      }
      setRenderProgress({ done: i + 1, total: targets.length });
    }

    setRenderProgress(null);
    if (results.length > 0) {
      setRenderResults(results);
    } else {
      setErrorMsg('レンダリングに失敗しました。F12のコンソールを確認してください。');
    }
  }, [renderProgress, shots, selectedIds, updateShot, renderQuality, blenderInfo, setPendingTargets]);

  // ── Blender ダウンロード ─────────────────────────────────────
  const handleDownloadBlender = useCallback(async () => {
    const unlistenFn = await listen("blender-download-progress", (ev) => {
      setDownloadProgress(ev.payload);
    });

    setBlenderDownloading(true);
    try {
      const path = await downloadBlender();
      const newInfo = { path, version: "Blender (bundled)" };
      setBlenderInfo(newInfo);
      setBlenderSetupOpen(false);

      // ダウンロード完了後、保留中のターゲットでそのままレンダリングを開始
      if (pendingTargets.length === 0) return;

      const unlistenProgress = await listen("cycles-progress", (ev) => {
        setCyclesProgress(ev.payload);
      });
      setRenderProgress({ done: 0, total: pendingTargets.length });
      const results = [];
      try {
        for (let i = 0; i < pendingTargets.length; i++) {
          const shot = pendingTargets[i];
          setCyclesProgress(null);
          try {
            const thumbnail = await renderWithCycles(shot.camera, newInfo.path, 128);
            if (thumbnail) {
              updateShot(shot.id, { thumbnail });
              results.push({ id: shot.id, name: shot.name, thumbnail, quality: "cycles", width: 1920, height: 1080 });
            }
          } catch (e) {
            console.error(`[MediaPanel] Cycles失敗: ${shot.name}`, e);
            setErrorMsg(`${shot.name} のCyclesレンダリングに失敗しました\n${String(e?.message ?? e)}`);
          }
          setRenderProgress({ done: i + 1, total: pendingTargets.length });
        }
      } finally {
        unlistenProgress();
        setCyclesProgress(null);
        setRenderProgress(null);
      }
      if (results.length > 0) setRenderResults(results);
    } catch (e) {
      setErrorMsg(`Blender のダウンロードに失敗しました: ${e}`);
    } finally {
      unlistenFn();
      setBlenderDownloading(false);
      setDownloadProgress(null);
      setPendingTargets([]);
    }
  }, [pendingTargets, updateShot]);

  // ── フォルダ保存（レイアウトコンテキストなし時のフォールバック） ──
  const handleSaveToFolder = useCallback(async (results) => {
    const folderPath = await open({
      directory: true,
      multiple: false,
      title: "保存先フォルダを選択",
    });
    if (!folderPath) return;
    for (const { name, thumbnail } of results) {
      const bytes = dataUrlToUint8Array(thumbnail);
      await writeFile(`${folderPath}/${safeName(name)}.jpg`, bytes);
    }
  }, []);

  // ── Shot 名編集 ───────────────────────────────────────────────
  const startEditing = useCallback((shot) => {
    setEditingId(shot.id);
    setEditingName(shot.name);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId && editingName.trim()) renameShot(editingId, editingName.trim());
    setEditingId(null);
    setEditingName("");
  }, [editingId, editingName, renameShot]);

  const isRendering = !!renderProgress;
  const selectedCount = selectedIds.filter((id) => shots.some((s) => s.id === id)).length;

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* ── Header ───────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${alpha("#fff", 0.08)}`, flexShrink: 0, gap: 0.75 }}
      >
        <Typography sx={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>Media</Typography>
        {shots.length > 0 && (
          <Typography sx={{ fontSize: 11, opacity: 0.45 }}>
            {selectedCount > 0 ? `${selectedCount} / ${shots.length} 選択` : `${shots.length} Shot`}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {shots.length > 0 && selectedCount < shots.length && (
          <Tooltip title="すべて選択">
            <Typography
              onClick={selectAll}
              sx={{ fontSize: 11, color: alpha("#6c87ff", 0.9), cursor: "pointer", "&:hover": { color: "#6c87ff" } }}
            >
              全選択
            </Typography>
          </Tooltip>
        )}
        {selectedCount > 0 && (
          <Tooltip title="選択解除">
            <Typography
              onClick={clearSelection}
              sx={{ fontSize: 11, opacity: 0.5, cursor: "pointer", "&:hover": { opacity: 0.8 } }}
            >
              解除
            </Typography>
          </Tooltip>
        )}
        <Tooltip title="現在のカメラアングルをShotとして保存">
          <span>
            <IconButton
              size="small"
              onClick={handleAddShot}
              disabled={addingShot}
              sx={{
                borderRadius: 1.5,
                background: alpha("#6c87ff", 0.15),
                "&:hover": { background: alpha("#6c87ff", 0.28) },
                "&:disabled": { opacity: 0.4 },
              }}
            >
              {addingShot ? (
                <CircularProgress size={14} sx={{ color: "#6c87ff" }} />
              ) : (
                <AddRoundedIcon sx={{ fontSize: 15 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={onClose} sx={{ borderRadius: 1.5 }}>
          <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      {/* ── Shot グリッド ─────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 1.5 }}>
        {shots.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 1,
              opacity: 0.4,
              userSelect: "none",
            }}
          >
            <CameraAltRoundedIcon sx={{ fontSize: 36 }} />
            <Typography sx={{ fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
              ＋ で現在のカメラアングルを保存
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 1.25 }}>
            {shots.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                isSelected={selectedIds.includes(shot.id)}
                isRecapturing={recaptureId === shot.id}
                isEditing={editingId === shot.id}
                editingName={editingName}
                onEditingNameChange={setEditingName}
                onToggleSelect={() => toggleSelect(shot.id)}
                onRecapture={() => handleRecapture(shot)}
                onDelete={() => {
                  removeShot(shot.id);
                  setSelectedIds((prev) => prev.filter((x) => x !== shot.id));
                }}
                onStartEdit={() => startEditing(shot)}
                onCommitEdit={commitEdit}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ── アクションバー ────────────────────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${alpha("#fff", 0.08)}`,
          px: 2,
          pt: 1.25,
          pb: 1.5,
          background: alpha("#000", 0.18),
        }}
      >
        {/* 品質セレクター */}
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
          <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.4), flexShrink: 0 }}>
            品質
          </Typography>
          <ToggleButtonGroup
            value={renderQuality}
            exclusive
            onChange={(_, v) => v && setRenderQuality(v)}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                py: 0.2,
                px: 1,
                fontSize: 10,
                textTransform: "none",
                fontWeight: 600,
                border: `1px solid ${alpha("#fff", 0.12)}`,
                color: alpha("#fff", 0.45),
                lineHeight: 1.8,
                "&.Mui-selected": {
                  color: "#fff",
                  background: alpha("#6c87ff", 0.28),
                  borderColor: alpha("#6c87ff", 0.5),
                },
              },
            }}
          >
            <ToggleButton value="standard">標準</ToggleButton>
            <ToggleButton value="cycles">Cycles</ToggleButton>
          </ToggleButtonGroup>
          {blenderInfo && renderQuality === "cycles" && (
            <Typography sx={{ fontSize: 9, color: alpha("#fff", 0.3), ml: 0.5 }}>
              {blenderInfo.version.split(" ").slice(0, 2).join(" ")}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip
            title={selectedCount === 0 ? "Shotを選択してください" : `${selectedCount} Shot をレンダリング`}
            placement="top"
          >
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={
                  isRendering ? (
                    <CircularProgress size={13} sx={{ color: "inherit" }} />
                  ) : (
                    <PhotoCameraRoundedIcon sx={{ fontSize: 15 }} />
                  )
                }
                disabled={selectedCount === 0 || isRendering}
                onClick={handleRenderImages}
                sx={{
                  borderRadius: 1.5,
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: 12,
                  boxShadow: "none",
                  background: alpha("#6c87ff", 0.85),
                  "&:hover": { background: "#6c87ff", boxShadow: "none" },
                  "&:disabled": { opacity: 0.35 },
                }}
              >
                静止画を生成
                {selectedCount > 0 && (
                  <Box
                    component="span"
                    sx={{
                      ml: 0.75,
                      background: alpha("#fff", 0.22),
                      borderRadius: "10px",
                      px: 0.75,
                      py: 0.1,
                      fontSize: 10,
                    }}
                  >
                    {selectedCount}
                  </Box>
                )}
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="動画生成 — 近日対応予定" placement="top">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<MovieCreationRoundedIcon sx={{ fontSize: 15 }} />}
                disabled
                sx={{
                  borderRadius: 1.5,
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: 12,
                  borderColor: alpha("#fff", 0.15),
                  color: alpha("#fff", 0.4),
                  "&:disabled": { borderColor: alpha("#fff", 0.1), color: alpha("#fff", 0.3) },
                }}
              >
                動画を生成
              </Button>
            </span>
          </Tooltip>
        </Stack>

        {/* 進捗バー */}
        {renderProgress && (
          <Box sx={{ mt: 1.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontSize: 11, opacity: 0.65 }}>
                {renderProgress.done < renderProgress.total
                  ? `レンダリング中… ${renderProgress.done} / ${renderProgress.total}`
                  : "完了"}
              </Typography>
              <Typography sx={{ fontSize: 11, opacity: 0.45 }}>
                {Math.round((renderProgress.done / renderProgress.total) * 100)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(renderProgress.done / renderProgress.total) * 100}
              sx={{
                borderRadius: 1,
                height: 4,
                background: alpha("#fff", 0.1),
                "& .MuiLinearProgress-bar": { background: "#6c87ff", borderRadius: 1 },
              }}
            />
            {/* Cycles サンプル進捗 */}
            {cyclesProgress && (
              <Box sx={{ mt: 0.75 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
                  <Typography sx={{ fontSize: 10, opacity: 0.5 }}>
                    Cycles Sample {cyclesProgress.current} / {cyclesProgress.total}
                  </Typography>
                  <Typography sx={{ fontSize: 10, opacity: 0.4 }}>
                    {cyclesProgress.pct}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={cyclesProgress.pct}
                  sx={{
                    borderRadius: 1,
                    height: 2,
                    background: alpha("#fff", 0.08),
                    "& .MuiLinearProgress-bar": { background: alpha("#a78bfa", 0.8), borderRadius: 1 },
                  }}
                />
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── 生成結果ダイアログ (3DSLアップロード) ───────────────── */}
      {renderResults && (
        <DslRenderUploadDialog
          results={renderResults}
          onClose={() => setRenderResults(null)}
          projectId={projectId}
          projectName={projectName}
          workspaceId={workspaceId}
          planId={planId}
          onSaveToFolder={handleSaveToFolder}
        />
      )}

      {/* ── Blender セットアップダイアログ ───────────────────── */}
      <Dialog
        open={blenderSetupOpen}
        onClose={() => !blenderDownloading && setBlenderSetupOpen(false)}
        PaperProps={{
          sx: { background: "#1a1a2e", color: "#fff", borderRadius: 2, minWidth: 360 },
        }}
      >
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700, pb: 1 }}>
          {blenderDownloading ? "Blender をダウンロード中…" : "Cycles レンダリングの準備"}
        </DialogTitle>
        <DialogContent>
          {!blenderDownloading ? (
            <Typography sx={{ fontSize: 12, opacity: 0.7, lineHeight: 1.8 }}>
              Cycles レンダリングには Blender が必要です。
              <br />
              アプリが自動でダウンロード・設定します（約 300 MB）。
              <br />
              一度だけの処理で、次回以降は即座に使えます。
            </Typography>
          ) : (
            <Box sx={{ mt: 0.5 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Typography sx={{ fontSize: 11, opacity: 0.65 }}>
                  {downloadProgress?.phase === "extracting"
                    ? "展開中…"
                    : downloadProgress?.phase === "done"
                    ? "完了"
                    : `ダウンロード中… ${downloadProgress?.pct ?? 0}%`}
                </Typography>
                {downloadProgress?.phase === "downloading" && downloadProgress?.total > 0 && (
                  <Typography sx={{ fontSize: 11, opacity: 0.4 }}>
                    {Math.round(downloadProgress.downloaded / 1024 / 1024)} /{" "}
                    {Math.round(downloadProgress.total / 1024 / 1024)} MB
                  </Typography>
                )}
              </Stack>
              <LinearProgress
                variant={
                  downloadProgress?.phase === "extracting" &&
                  (downloadProgress?.pct ?? 0) === 0
                    ? "indeterminate"
                    : "determinate"
                }
                value={downloadProgress?.pct ?? 0}
                sx={{
                  borderRadius: 1,
                  height: 5,
                  background: alpha("#fff", 0.1),
                  "& .MuiLinearProgress-bar": {
                    background: "#6c87ff",
                    borderRadius: 1,
                  },
                }}
              />
              <Typography sx={{ fontSize: 10, opacity: 0.35, mt: 0.75 }}>
                {downloadProgress?.phase === "extracting"
                  ? "展開に数十秒かかることがあります"
                  : "キャンセルするとダウンロードが中断されます"}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          {!blenderDownloading && (
            <>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setBlenderSetupOpen(false);
                  setRenderQuality("standard");
                  setPendingTargets([]);
                }}
                sx={{
                  textTransform: "none",
                  fontSize: 12,
                  borderColor: alpha("#fff", 0.2),
                  color: alpha("#fff", 0.6),
                }}
              >
                標準品質で続ける
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleDownloadBlender}
                sx={{
                  textTransform: "none",
                  fontSize: 12,
                  background: alpha("#6c87ff", 0.85),
                  boxShadow: "none",
                  "&:hover": { background: "#6c87ff", boxShadow: "none" },
                }}
              >
                ダウンロードして始める
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ── エラー通知 ────────────────────────────────────────── */}
      <Snackbar
        open={!!errorMsg}
        autoHideDuration={null}
        onClose={() => setErrorMsg(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setErrorMsg(null)}
          severity="error"
          variant="filled"
          sx={{
            fontSize: 12,
            maxWidth: 640,
            maxHeight: 400,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "monospace",
            userSelect: "text",
          }}
        >
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}


// ─────────────────────────────────────────────────────────────────
// ShotCard
// ─────────────────────────────────────────────────────────────────

function ShotCard({
  shot,
  isSelected,
  isRecapturing,
  isEditing,
  editingName,
  onEditingNameChange,
  onToggleSelect,
  onRecapture,
  onDelete,
  onStartEdit,
  onCommitEdit,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggleSelect}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        border: `1.5px solid ${isSelected ? alpha("#6c87ff", 0.8) : alpha("#fff", 0.08)}`,
        background: isSelected ? alpha("#6c87ff", 0.07) : alpha("#fff", 0.03),
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        boxShadow: isSelected ? `0 0 0 1px ${alpha("#6c87ff", 0.3)}` : "none",
        "&:hover": { border: `1.5px solid ${alpha("#fff", isSelected ? 0.6 : 0.22)}` },
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ position: "relative", aspectRatio: "16/9", background: alpha("#000", 0.4) }}>
        {shot.thumbnail ? (
          <Box
            component="img"
            src={shot.thumbnail}
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ImageRoundedIcon sx={{ opacity: 0.18, fontSize: 26 }} />
          </Box>
        )}

        {/* 選択チェックマーク */}
        <Fade in={isSelected}>
          <Box
            sx={{
              position: "absolute",
              top: 5,
              left: 5,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#6c87ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 11, color: "#fff" }} />
          </Box>
        </Fade>

        {/* 再撮影中スピナー */}
        {isRecapturing && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: alpha("#000", 0.5),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={20} sx={{ color: "#6c87ff" }} />
          </Box>
        )}

        {/* ホバーアクション（右上: 再撮影 + 削除） */}
        <Fade in={hovered && !isRecapturing}>
          <Stack
            direction="row"
            spacing={0.25}
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              background: alpha("#000", 0.65),
              borderRadius: 1.5,
              px: 0.4,
              py: 0.2,
              backdropFilter: "blur(6px)",
              pointerEvents: "all",
            }}
          >
            <Tooltip title="現在のビューでShotを更新" placement="top">
              <IconButton
                size="small"
                onClick={onRecapture}
                sx={{ p: 0.4, color: alpha("#fff", 0.8), "&:hover": { color: "#fff" } }}
              >
                <CameraAltRoundedIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="削除" placement="top">
              <IconButton
                size="small"
                onClick={onDelete}
                sx={{ p: 0.4, color: alpha("#fff", 0.5), "&:hover": { color: "#ff7070" } }}
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Fade>
      </Box>

      {/* Shot 名 */}
      <Box sx={{ px: 1, py: 0.65 }}>
        {isEditing ? (
          <Stack direction="row" alignItems="center" spacing={0.5} onClick={(e) => e.stopPropagation()}>
            <Box
              component="input"
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") onCommitEdit(); }}
              autoFocus
              sx={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "white",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "inherit",
                borderBottom: `1px solid ${alpha("#6c87ff", 0.7)}`,
                pb: "1px",
              }}
            />
            <IconButton size="small" onClick={onCommitEdit} sx={{ p: 0.25 }}>
              <CheckRoundedIcon sx={{ fontSize: 11, color: "#6c87ff" }} />
            </IconButton>
          </Stack>
        ) : (
          <Stack direction="row" alignItems="center">
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: alpha("#fff", 0.85),
              }}
            >
              {shot.name}
            </Typography>
            <Fade in={hovered}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
                sx={{ p: 0.2, opacity: 0.45, "&:hover": { opacity: 1 } }}
              >
                <EditRoundedIcon sx={{ fontSize: 10 }} />
              </IconButton>
            </Fade>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
