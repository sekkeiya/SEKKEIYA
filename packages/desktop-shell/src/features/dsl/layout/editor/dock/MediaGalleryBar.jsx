// MediaGalleryBar.jsx
// ★メニューで「自動パース生成 / 自動動画生成」を選ぶと、画面下部に出る
// 「カメラアングル（Shot）」のギャラリー。自動マテリアル等と同じ操作感：
//   - ← / → で前後のカメラアングルを選択（選択中はふわっと拡大＋中央へスクロール）
//   - Enter / Space で生成（autoRender=静止画 / autoMovie=動画）
//   - カードクリックでも生成、先頭の「＋」で現在のカメラアングルを保存
// レンダリング実行ロジックと各種セットアップ/結果ダイアログは旧 MediaPanel から移設。
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Box, Stack, Typography, IconButton, CircularProgress, Tooltip,
  LinearProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import MovieCreationRoundedIcon from "@mui/icons-material/MovieCreationRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import { open } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { useShotStore, shotsOfSet, categoryFromAngleName } from "../../store/useShotStore";
import { useRenderHistoryStore } from "../../store/useRenderHistoryStore";
import { useVideoRenderStore } from "../../store/useVideoRenderStore";
import { useMediaSettingsStore } from "../../store/useMediaSettingsStore";
import { useMediaRenderStore } from "../../store/useMediaRenderStore";
import { useAutoActionStore } from "../../store/useAutoActionStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { makeHistoryThumbnail } from "../../services/imageThumbnail";
import { layoutSceneRef } from "../../services/layoutSceneRef";
import { captureLayoutPerspective } from "../../services/layoutPerspectiveCapture";
import { checkBlender, renderWithCycles, downloadBlender } from "../../services/layoutCyclesCapture";
import { generateAutoAngles, posesClose } from "../../services/autoCameraAngles";
import DslRenderUploadDialog from "./panels/DslRenderUploadDialog";

import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function safeName(name) { return name.replace(/[\\/:*?"<>|]/g, "_"); }

export default function MediaGalleryBar({ projectId, projectName, workspaceId, planId }) {
  const selectedAuto    = useAutoActionStore((s) => s.selectedAuto);
  const setSelectedAuto = useAutoActionStore((s) => s.setSelectedAuto);
  const editorMode      = useEditorModeStore((s) => s.editorMode);
  const mode = selectedAuto === "autoRender" ? "image" : selectedAuto === "autoMovie" ? "movie" : null;
  const shotKind = mode === "movie" ? "movie" : "still"; // パース=still / 動画=movie で別管理

  const allShots    = useShotStore((s) => s.shots);
  const addShot     = useShotStore((s) => s.addShot);
  const removeShot  = useShotStore((s) => s.removeShot);
  const updateShot  = useShotStore((s) => s.updateShot);
  const setActiveShotId = useShotStore((s) => s.setActiveShotId);

  const addHistoryEntry = useRenderHistoryStore((s) => s.addEntry);

  const startVideoRender = useVideoRenderStore((s) => s.startVideoRender);
  const videoStatus      = useVideoRenderStore((s) => s.status);
  const videoFrame       = useVideoRenderStore((s) => s.frame);
  const videoTotalFrames = useVideoRenderStore((s) => s.totalFrames);
  const videoSample      = useVideoRenderStore((s) => s.sample);
  const videoSampleTotal = useVideoRenderStore((s) => s.sampleTotal);
  const videoResult      = useVideoRenderStore((s) => s.result);
  const clearVideoResult = useVideoRenderStore((s) => s.clearResult);
  const cancelVideoRender = useVideoRenderStore((s) => s.cancelVideoRender);
  const videoRendering   = videoStatus === "rendering";

  const stillQuality = useMediaSettingsStore((s) => s.stillQuality);
  const videoMode    = useMediaSettingsStore((s) => s.videoMode);
  const videoDuration = useMediaSettingsStore((s) => s.videoDuration);

  // 複数選択（右サイドバーの「生成」で一括レンダリング）。useMediaSettingsStore で共有。
  const selectedShotIds = useMediaSettingsStore((s) => s.selectedShotIds);
  const setSelectedShotIds = useMediaSettingsStore((s) => s.setSelectedShotIds);
  const toggleSelect = useCallback((id) => {
    setSelectedShotIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, [setSelectedShotIds]);

  // 現在のモード（パース/動画）× アクティブなアングルセットのアングルだけを表示・操作する
  const activeSetId = useShotStore((s) => s.activeSetId);
  const sets = useShotStore((s) => s.sets);
  const activeSetName = sets.find((g) => g.id === activeSetId)?.name ?? "未分類";
  const shots = shotsOfSet(allShots, sets, activeSetId ?? null, shotKind);

  // ── ローカル状態 ──
  // focus: 0 = 「現在のアングル」（ライブ視点）/ 1.. = 保存済み Shot
  const [focus, setFocus] = useState(0);
  const focusRef = useRef(0); focusRef.current = focus;
  const originalPoseRef = useRef(null);           // 「現在のアングル」に戻すための退避視点
  const [addingShot, setAddingShot] = useState(false);
  const [recaptureId, setRecaptureId] = useState(null);
  const [renderProgress, setRenderProgress] = useState(null);
  const [renderResults, setRenderResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [blenderInfo, setBlenderInfo] = useState(null);
  const [blenderSetupOpen, setBlenderSetupOpen] = useState(false);
  const [blenderDownloading, setBlenderDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [pendingShot, setPendingShot] = useState(null);
  const [cyclesProgress, setCyclesProgress] = useState(null);

  const [ffmpegInfo, setFfmpegInfo] = useState(null);
  const [ffmpegSetupOpen, setFfmpegSetupOpen] = useState(false);
  const [ffmpegDownloading, setFfmpegDownloading] = useState(false);
  const [ffmpegDownloadProgress, setFfmpegDownloadProgress] = useState(null);

  // 種別が変わったら：現在のライブ視点を退避して先頭へ。離脱時に視点を復帰。
  useEffect(() => {
    if (!mode) return;
    const pose = layoutSceneRef.getCameraState?.();
    if (pose) originalPoseRef.current = pose;
    setFocus(0);
    return () => {
      if (originalPoseRef.current) layoutSceneRef.setCameraPose?.(originalPoseRef.current);
    };
  }, [mode]);

  // モード/アングルセットを切り替えたら選択（複数選択）をクリア
  useEffect(() => { setSelectedShotIds([]); }, [mode, activeSetId, setSelectedShotIds]);

  // アングルセットを切り替えたら選択位置を先頭へ
  useEffect(() => { setFocus(0); }, [activeSetId]);

  // ←→ で選択中のアングルをビューポートに表示し、右サイドバーの個別設定対象にする
  // （0=現在 / 1=自動生成 は退避視点へ戻し、個別設定なし）
  useEffect(() => {
    if (!mode) return;
    if (focus <= 1) {
      if (originalPoseRef.current) layoutSceneRef.setCameraPose?.(originalPoseRef.current);
      setActiveShotId(null);
    } else {
      const shot = shots[focus - 2];
      if (shot?.camera) layoutSceneRef.setCameraPose?.(shot.camera);
      setActiveShotId(shot?.id ?? null);
    }
    // shots は依存に入れない（Shot追加/削除で意図せず視点が動かないように）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, mode]);

  const isRendering = !!renderProgress || videoRendering;

  // ── 現在のカメラをShotとして保存 ──
  const handleAddShot = useCallback(async () => {
    if (addingShot) return;
    const cameraState = layoutSceneRef.getCameraState?.();
    if (!cameraState) { setErrorMsg("カメラ状態を取得できません"); return; }
    setAddingShot(true);
    try {
      const thumbnail = await captureLayoutPerspective(undefined, { forceShadows: false });
      addShot(cameraState, thumbnail, shotKind); // 現在のモード（パース/動画）のアングルとして保存
    } catch (e) {
      console.error("[MediaGalleryBar] Shot追加失敗:", e);
    } finally {
      setAddingShot(false);
    }
  }, [addingShot, addShot, shotKind]);

  // ── 自動アングル設定（プロ構図を一括生成して Shot 追加） ──
  const [autoAnglesBusy, setAutoAnglesBusy] = useState(false);
  const handleAutoAngles = useCallback(async () => {
    if (autoAnglesBusy) return;
    const pool = generateAutoAngles(shotKind);
    if (!pool.length) {
      setErrorMsg("躯体（部屋）が見つかりません。アングルを自動生成できませんでした。");
      return;
    }
    // 既存（同モード × 同セット）と重複しないアングルだけを対象に、1回あたり最大5カット追加
    const st = useShotStore.getState();
    const existing = shotsOfSet(st.shots, st.sets, st.activeSetId ?? null, shotKind);
    const fresh = pool.filter((a) => !existing.some((sh) => posesClose(a.camera, sh.camera)));
    if (!fresh.length) {
      setErrorMsg("追加できる新しいアングルがありません（既に生成済みです）。");
      return;
    }
    // 生成数は設定 count に依存（pool は既に count 件）。安全上限 10。
    const batch = fresh.slice(0, 10);
    setAutoAnglesBusy(true);
    const addedIds = [];
    try {
      for (const a of batch) {
        let thumb = null;
        try { thumb = await captureLayoutPerspective(a.camera, { forceShadows: false }); } catch {}
        // 名前＋構図名から推定したカテゴリを自動付与（後で整理ダイアログで修正可）。
        // 動画モードは前後考慮で割り当てたカメラの動き(motion)も保存。
        const id = addShot(a.camera, thumb, shotKind, {
          name: a.name,
          category: categoryFromAngleName(a.name),
          movieMotion: shotKind === "movie" ? a.motion : undefined,
        });
        addedIds.push(id);
      }
      // 動画モードは生成したアングルを全選択しておく → そのまま「生成」で
      // 前後を繋いだ1本のプロモーション動画になる。
      if (shotKind === "movie" && addedIds.length) {
        useMediaSettingsStore.getState().setSelectedShotIds(addedIds);
      }
    } finally {
      setAutoAnglesBusy(false);
    }
  }, [autoAnglesBusy, shotKind, addShot]);

  // ── 現在のビューで再撮影 ──
  const handleRecapture = useCallback(async (shot) => {
    if (recaptureId) return;
    const currentCamera = layoutSceneRef.getCameraState?.() ?? shot.camera;
    setRecaptureId(shot.id);
    setActiveShotId(shot.id);
    try {
      const thumbnail = await captureLayoutPerspective(currentCamera, { forceShadows: false });
      if (thumbnail) updateShot(shot.id, { thumbnail, camera: currentCamera });
    } catch (e) {
      console.error("[MediaGalleryBar] 再撮影失敗:", e);
    } finally {
      setRecaptureId(null);
    }
  }, [recaptureId, setActiveShotId, updateShot]);

  // ── 静止画を生成（1 Shot） ──
  const renderStill = useCallback(async (shot) => {
    if (renderProgress || !shot) return;
    if (!layoutSceneRef.gl || !layoutSceneRef.scene) {
      setErrorMsg("3Dシーンが未初期化です。レイアウトビューを開き直してください。"); return;
    }
    setActiveShotId(shot.id);

    if (stillQuality === "cycles") {
      let info = blenderInfo;
      if (!info) {
        try { info = await checkBlender(); setBlenderInfo(info); }
        catch { setPendingShot(shot); setBlenderSetupOpen(true); return; }
      }
      const unlistenFn = await listen("cycles-progress", (ev) => setCyclesProgress(ev.payload));
      const unlistenLog = await listen("cycles-log", (ev) => console.log("[Blender]", ev.payload));
      setRenderProgress({ done: 0, total: 1 });
      const results = [];
      try {
        setCyclesProgress(null);
        const thumbnail = await renderWithCycles(shot.camera, info.path, 128);
        if (thumbnail) {
          results.push({ id: shot.id, name: shot.name, thumbnail, quality: "cycles", width: 1920, height: 1080 });
          try {
            const histThumb = await makeHistoryThumbnail(thumbnail);
            addHistoryEntry({ shotId: shot.id, shotName: shot.name, thumbnail: histThumb, quality: "cycles" });
          } catch {}
        }
      } catch (e) {
        setErrorMsg(`${shot.name} のCyclesレンダリングに失敗しました\n${String(e?.message ?? e)}`);
      } finally {
        unlistenFn(); unlistenLog(); setCyclesProgress(null); setRenderProgress(null);
      }
      if (results.length) setRenderResults(results);
      return;
    }

    // 標準（Three.js）＝ビューポートで見えているビューをそのまま書き出す
    setRenderProgress({ done: 0, total: 1 });
    const results = [];
    try {
      const thumbnail = await captureLayoutPerspective(shot.camera, { forceShadows: false });
      if (thumbnail) {
        results.push({ id: shot.id, name: shot.name, thumbnail, quality: "standard", width: 1920, height: 1080 });
        try {
          const histThumb = await makeHistoryThumbnail(thumbnail);
          addHistoryEntry({ shotId: shot.id, shotName: shot.name, thumbnail: histThumb, quality: "standard" });
        } catch {}
      }
    } catch (e) {
      console.error("[MediaGalleryBar] 静止画失敗:", e);
    } finally {
      setRenderProgress(null);
    }
    if (results.length) setRenderResults(results);
    else setErrorMsg("レンダリングに失敗しました。F12のコンソールを確認してください。");
  }, [renderProgress, stillQuality, blenderInfo, addHistoryEntry, setActiveShotId]);

  // ── 動画を生成（選択 Shot を起点に） ──
  // keepSelection=true のときは現在の選択（複数可）でパスを組む（右サイドバーの「生成」用）。
  const renderVideoFromShot = useCallback(async (shot, opts) => {
    if (renderProgress || videoRendering || !shot) return;
    if (!layoutSceneRef.gl || !layoutSceneRef.scene) {
      setErrorMsg("3Dシーンが未初期化です。レイアウトビューを開き直してください。"); return;
    }
    // この Shot を選択状態にしてからパスを組む（カメラパスは選択 Shot を使う）
    const ms = useMediaSettingsStore.getState();
    if (!opts?.keepSelection) ms.setSelectedShotIds([shot.id]);
    if (ms.previewPlaying) ms.stopPreview();
    const built = ms.buildSelectedPath();
    if (!built.ok) { setErrorMsg(built.error); return; }
    const { targets, cameraPath } = built.value;

    const common = {
      cameraPath,
      // シーケンス（per-アングル モーション）の場合は総尺を使う。単一プリセット時は従来の長さ。
      durationSec: cameraPath?.durationSec ?? videoDuration,
      resultName: targets[0].name,
      posterCamera: targets[0].camera,
      posterFallback: targets[0].thumbnail ?? null,
      historyShotId: targets[0].id,
      historyShotName: targets[0].name,
    };

    if (videoMode === "fast" || videoMode === "quality") {
      let info = ffmpegInfo;
      if (!info) {
        try { info = await invoke("check_ffmpeg", { ffmpegPath: null }); setFfmpegInfo(info); }
        catch { setFfmpegSetupOpen(true); return; }
      }
      startVideoRender({ engine: "threejs", ffmpegPath: info.path, threejsQuality: videoMode === "quality" ? 2 : 1, ...common });
      return;
    }
    // Cycles
    let info = blenderInfo;
    if (!info) {
      try { info = await checkBlender(); setBlenderInfo(info); }
      catch { setPendingShot(shot); setBlenderSetupOpen(true); return; }
    }
    startVideoRender({ engine: "cycles", blenderPath: info.path, samples: 64, ...common });
  }, [renderProgress, videoRendering, videoDuration, videoMode, ffmpegInfo, blenderInfo, startVideoRender]);

  const runShot = useCallback((shot) => {
    if (mode === "movie") renderVideoFromShot(shot);
    else renderStill(shot);
  }, [mode, renderStill, renderVideoFromShot]);

  // ── 静止画を一括生成（複数アングル） ──
  const renderStillBatch = useCallback(async (targetShots) => {
    if (renderProgress || !targetShots?.length) return;
    if (!layoutSceneRef.gl || !layoutSceneRef.scene) {
      setErrorMsg("3Dシーンが未初期化です。レイアウトビューを開き直してください。"); return;
    }
    const setRendering = useMediaRenderStore.getState().setRendering;

    // Cycles はまず Blender を確認（未導入ならセットアップへ）
    let blenderPath = null;
    if (stillQuality === "cycles") {
      let info = blenderInfo;
      if (!info) {
        try { info = await checkBlender(); setBlenderInfo(info); }
        catch { setPendingShot(targetShots[0]); setBlenderSetupOpen(true); return; }
      }
      blenderPath = info?.path ?? null;
    }

    setRendering(true);
    setRenderProgress({ done: 0, total: targetShots.length });
    const results = [];
    let unlistenFn = null;
    if (blenderPath) unlistenFn = await listen("cycles-progress", (ev) => setCyclesProgress(ev.payload));
    try {
      for (let i = 0; i < targetShots.length; i++) {
        const shot = targetShots[i];
        try {
          let full = null;
          if (blenderPath) { setCyclesProgress(null); full = await renderWithCycles(shot.camera, blenderPath, 128); }
          else full = await captureLayoutPerspective(shot.camera, { forceShadows: false });
          if (full) {
            results.push({ id: shot.id, name: shot.name, thumbnail: full, quality: blenderPath ? "cycles" : "standard", width: 1920, height: 1080 });
            try {
              const histThumb = await makeHistoryThumbnail(full);
              addHistoryEntry({ shotId: shot.id, shotName: shot.name, thumbnail: histThumb, quality: blenderPath ? "cycles" : "standard" });
            } catch {}
          }
        } catch (e) {
          console.error("[MediaGalleryBar] バッチ静止画失敗:", e);
        }
        setRenderProgress({ done: i + 1, total: targetShots.length });
      }
    } finally {
      if (unlistenFn) unlistenFn();
      setCyclesProgress(null);
      setRenderProgress(null);
      setRendering(false);
    }
    if (results.length) setRenderResults(results);
    else setErrorMsg("レンダリングに失敗しました。F12のコンソールを確認してください。");
  }, [renderProgress, stillQuality, blenderInfo, addHistoryEntry]);

  // ── 「生成」ボタンからの一括レンダリング（選択中アングル。無ければフォーカス中） ──
  const renderSelected = useCallback(() => {
    const ids = useMediaSettingsStore.getState().selectedShotIds || [];
    let targetShots = shots.filter((s) => ids.includes(s.id));
    if (!targetShots.length) {
      const f = focusRef.current;
      if (f >= 2 && shots[f - 2]) targetShots = [shots[f - 2]];
    }
    if (!targetShots.length) { setErrorMsg("アングルを選択してください。"); return; }
    if (mode === "movie") {
      // 動画は選択 Shot 群でカメラパスを作って生成（複数選択でフライスルー）
      useMediaSettingsStore.getState().setSelectedShotIds(targetShots.map((s) => s.id));
      renderVideoFromShot(targetShots[0], { keepSelection: true });
    } else {
      renderStillBatch(targetShots);
    }
  }, [shots, mode, renderVideoFromShot, renderStillBatch]);

  // 右サイドバーの「生成」ボタン（useMediaRenderStore.requestRender）を監視
  const renderTick = useMediaRenderStore((s) => s.renderTick);
  const renderTickRef = useRef(0);
  useEffect(() => {
    if (renderTick !== renderTickRef.current) {
      renderTickRef.current = renderTick;
      if (mode) renderSelected();
    }
  }, [renderTick, mode, renderSelected]);

  // ── ffmpeg / blender ダウンロード ──
  const handleDownloadFfmpeg = useCallback(async () => {
    const unlisten = await listen("ffmpeg-download-progress", (ev) => setFfmpegDownloadProgress(ev.payload));
    setFfmpegDownloading(true);
    try {
      const path = await invoke("download_ffmpeg");
      setFfmpegInfo({ path, version: "FFmpeg (bundled)" });
      setFfmpegSetupOpen(false);
    } catch (e) {
      setErrorMsg(`FFmpeg のダウンロードに失敗しました: ${e}`);
    } finally {
      unlisten(); setFfmpegDownloading(false); setFfmpegDownloadProgress(null);
    }
  }, []);

  const handleDownloadBlender = useCallback(async () => {
    const unlistenFn = await listen("blender-download-progress", (ev) => setDownloadProgress(ev.payload));
    setBlenderDownloading(true);
    try {
      const path = await downloadBlender();
      const newInfo = { path, version: "Blender (bundled)" };
      setBlenderInfo(newInfo);
      setBlenderSetupOpen(false);
      const shot = pendingShot;
      setPendingShot(null);
      if (shot) {
        // ダウンロード後そのままレンダリング
        if (mode === "movie") renderVideoFromShot(shot);
        else renderStill(shot);
      }
    } catch (e) {
      setErrorMsg(`Blender のダウンロードに失敗しました: ${e}`);
    } finally {
      unlistenFn(); setBlenderDownloading(false); setDownloadProgress(null);
    }
  }, [pendingShot, mode, renderStill, renderVideoFromShot]);

  const handleSaveToFolder = useCallback(async (results) => {
    const folderPath = await open({ directory: true, multiple: false, title: "保存先フォルダを選択" });
    if (!folderPath) return;
    for (const { name, thumbnail } of results) {
      const bytes = dataUrlToUint8Array(thumbnail);
      await writeFile(`${folderPath}/${safeName(name)}.jpg`, bytes);
    }
  }, []);

  // ── キーボード ──
  // ← → で選択（0=現在のアングル / 1=自動アングル生成 / 2..=Shot）。Enter/Space は
  //   0 → 現在のアングルを追加 / 1 → 自動アングル生成 / 2.. → そのアングルで生成。Delete で Shot 削除。
  useEffect(() => {
    if (!mode) return;
    const onKey = (e) => {
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      const st = useShotStore.getState();
      const list = shotsOfSet(st.shots, st.sets, st.activeSetId ?? null, shotKind);
      const n = list.length + 2; // 0=現在 / 1=自動生成 / 2..=Shot 群
      if (e.key === "ArrowRight") {
        e.preventDefault(); e.stopPropagation();
        setFocus((f) => (Math.min(f, n - 1) + 1) % n);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault(); e.stopPropagation();
        setFocus((f) => (Math.min(f, n - 1) - 1 + n) % n);
      } else if (e.key === "Enter") {
        e.preventDefault(); e.stopPropagation();
        const f = Math.min(Math.max(0, focusRef.current), n - 1);
        if (f === 0) { handleAddShot(); return; }
        if (f === 1) { handleAutoAngles(); return; }
        // Shot 上で Enter → 選択中アングルを一括生成（未選択ならフォーカス中を生成）
        renderSelected();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault(); e.stopPropagation();
        const f = Math.min(Math.max(0, focusRef.current), n - 1);
        if (f === 0) { handleAddShot(); return; }
        if (f === 1) { handleAutoAngles(); return; }
        // Shot 上で Space → 選択トグル（複数選択）
        const shot = list[f - 2];
        if (shot) toggleSelect(shot.id);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // 選択中（focus 2.. = Shot）のアングルを削除。0=現在 / 1=自動生成 は対象外。
        const f = Math.min(Math.max(0, focusRef.current), n - 1);
        if (f < 2) return;
        const shot = list[f - 2];
        if (!shot) return;
        e.preventDefault(); e.stopPropagation();
        removeShot(shot.id);
        // 削除後はフォーカスを範囲内に収める（残り Shot 数 = list.length-1）
        setFocus((cur) => Math.min(cur, list.length));
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [mode, shotKind, renderSelected, toggleSelect, handleAddShot, handleAutoAngles, removeShot]);

  // 選択中カードを中央へスクロール
  const activeRef = useRef(null);
  const clampedFocus = Math.min(Math.max(0, focus), shots.length + 1);
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [clampedFocus, mode]);

  // ── パネルを閉じたらプレビューを止める ──
  useEffect(() => () => { useMediaSettingsStore.getState().stopPreview(); }, []);

  if (!mode || editorMode === "walkthrough") return null;

  const accent = mode === "movie" ? "#a78bfa" : "#6c87ff";
  const title = mode === "movie" ? "自動動画生成" : "自動パース生成";

  // 進捗バー
  const panelProgress = videoRendering
    ? { label: `レンダリング中… フレーム ${videoFrame || 0} / ${videoTotalFrames}`,
        pct: videoTotalFrames > 0 ? Math.round(((Math.max(0, (videoFrame || 0) - 1) + (videoSampleTotal ? videoSample / videoSampleTotal : 0)) / videoTotalFrames) * 100) : 0 }
    : renderProgress
    ? { label: renderProgress.done < renderProgress.total ? "レンダリング中…" : "完了",
        pct: Math.round((renderProgress.done / renderProgress.total) * 100) }
    : null;

  const handleClose = () => { setSelectedAuto(null); };

  return (
    <>
      <div
        data-auto-keep="1"
        style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 80,
          maxWidth: "92%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
          padding: "10px 16px", borderRadius: 16,
          background: "rgba(8,11,20,0.9)", border: `1px solid ${alpha(accent, 0.5)}`,
          boxShadow: "0 12px 34px rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
          pointerEvents: "auto",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ color: accent }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>
            {title}（{activeSetName}）：カメラアングルを選ぶ
          </Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>
            {clampedFocus === 0
              ? "← → で移動 ・ Enter で現在のアングルを追加"
              : clampedFocus === 1
              ? "← → で移動 ・ Enter で自動アングル生成"
              : "← → で移動 ・ クリック / Space で選択 ・ Enter で生成"}
          </Typography>
          {panelProgress && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <CircularProgress size={11} sx={{ color: accent }} />
              <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" }}>{panelProgress.label}（{panelProgress.pct}%）</Typography>
              {videoRendering && (
                <IconButton size="small" onClick={cancelVideoRender} sx={{ p: 0.2, color: "light-dark(rgba(165,8,8,0.8), rgba(248,113,113,0.8))" }}>
                  <StopCircleRoundedIcon sx={{ fontSize: 13 }} />
                </IconButton>
              )}
            </Stack>
          )}
          <Box sx={{ flex: 1 }} />
          {clampedFocus >= 2 && (
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", whiteSpace: "nowrap" }}>
              Delete で削除
            </Typography>
          )}
          <Typography onClick={handleClose} title="閉じる" sx={{ cursor: "pointer", color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", fontSize: 14, fontWeight: 700, "&:hover": { color: "var(--brand-fg)" } }}>✕</Typography>
        </Stack>

        {panelProgress && (
          <LinearProgress variant="determinate" value={panelProgress.pct}
            sx={{ width: "100%", borderRadius: 1, height: 3, background: alpha("#fff", 0.08), "& .MuiLinearProgress-bar": { background: accent } }} />
        )}

        <div style={{ display: "flex", gap: 10, overflowX: "auto", maxWidth: "100%", padding: "6px 4px 4px", alignItems: "center" }}>
          {/* index 0：現在のアングル（←→で選んで Enter/Space で追加） */}
          {(() => {
            const active = clampedFocus === 0;
            return (
              <div
                ref={active ? activeRef : null}
                onMouseEnter={() => setFocus(0)}
                onClick={handleAddShot}
                title="現在のカメラアングルを保存（Enter / Space）"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 96, flexShrink: 0, cursor: "pointer" }}
              >
                <div style={{
                  width: 96, height: 56, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  background: alpha(accent, active ? 0.2 : 0.1),
                  border: active ? `2px solid ${accent}` : `1px dashed ${alpha(accent, 0.6)}`,
                  boxShadow: active ? `0 6px 18px ${alpha(accent, 0.45)}, 0 0 0 3px ${alpha(accent, 0.3)}` : "none",
                  transform: active ? "scale(1.08)" : "scale(1)",
                  transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s",
                  color: accent,
                }}>
                  {addingShot ? <CircularProgress size={18} sx={{ color: accent }} /> : <AddRoundedIcon sx={{ fontSize: 22 }} />}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: active ? 800 : 600, color: active ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.6)" }}>現在のアングル</div>
              </div>
            );
          })()}

          {/* 自動アングル生成（focus 1：←→で選んで Enter/Space でプロ構図を一括生成） */}
          {(() => {
            const active = clampedFocus === 1;
            return (
              <div
                ref={active ? activeRef : null}
                onMouseEnter={() => setFocus(1)}
                onClick={handleAutoAngles}
                title="プロ構図のカメラアングルを自動生成して追加（Enter / Space）"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 96, flexShrink: 0, cursor: autoAnglesBusy ? "default" : "pointer" }}
              >
                <div style={{
                  width: 96, height: 56, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  background: alpha(accent, active ? 0.24 : 0.16),
                  border: active ? `2px solid ${accent}` : `1px dashed ${alpha(accent, 0.6)}`,
                  boxShadow: active ? `0 6px 18px ${alpha(accent, 0.45)}, 0 0 0 3px ${alpha(accent, 0.3)}` : "none",
                  transform: active ? "scale(1.08)" : "scale(1)",
                  transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s",
                  color: accent, opacity: autoAnglesBusy ? 0.6 : 1,
                }}>
                  {autoAnglesBusy ? <CircularProgress size={18} sx={{ color: accent }} /> : <AutoAwesomeRoundedIcon sx={{ fontSize: 22 }} />}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: active ? 800 : 600, color: active ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.6)", whiteSpace: "nowrap" }}>自動アングル生成</div>
              </div>
            );
          })()}

          {shots.length === 0 ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, opacity: 0.5 }}>
              <ImageRoundedIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontSize: 11 }}>「現在のアングル」を Enter / Space で保存してください</Typography>
            </Stack>
          ) : shots.map((shot, i) => {
            const active = clampedFocus === i + 2;
            const isSelected = selectedShotIds.includes(shot.id);
            return (
              <div
                key={shot.id}
                ref={active ? activeRef : null}
                onMouseEnter={() => setFocus(i + 2)}
                onClick={(e) => { e.stopPropagation(); setFocus(i + 2); setActiveShotId(shot.id); toggleSelect(shot.id); }}
                title={`${shot.name}（クリック / Space で選択、生成ボタンでレンダリング）`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 96, flexShrink: 0, cursor: "pointer", position: "relative" }}
              >
                <div style={{
                  width: 96, height: 56, borderRadius: 12, overflow: "hidden", position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgb(var(--brand-fg-rgb) / 0.06)",
                  border: active ? `2px solid ${accent}` : isSelected ? `2px solid ${alpha(accent, 0.85)}` : "1px solid rgb(var(--brand-fg-rgb) / 0.18)",
                  boxShadow: active ? `0 6px 18px ${alpha(accent, 0.45)}, 0 0 0 3px ${alpha(accent, 0.3)}` : "none",
                  transform: active ? "scale(1.08)" : "scale(1)",
                  transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
                }}>
                  {shot.thumbnail
                    ? <img src={shot.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <ImageRoundedIcon sx={{ opacity: 0.25, fontSize: 24 }} />}
                  {recaptureId === shot.id && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CircularProgress size={18} sx={{ color: accent }} />
                    </div>
                  )}
                  {/* 選択チェック */}
                  <div style={{
                    position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isSelected ? accent : "color-mix(in srgb, var(--brand-bg) 50%, transparent)",
                    border: `1px solid ${isSelected ? accent : "rgb(var(--brand-fg-rgb) / 0.5)"}`,
                  }}>
                    {isSelected && <CheckRoundedIcon sx={{ fontSize: 11, color: "var(--brand-fg)" }} />}
                  </div>
                  {/* 削除 */}
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); removeShot(shot.id); }}
                    sx={{ position: "absolute", top: 2, right: 2, p: 0.2, background: "color-mix(in srgb, var(--brand-bg) 55%, transparent)", color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", "&:hover": { color: "light-dark(#ad0000, #ff7070)", background: "color-mix(in srgb, var(--brand-bg) 70%, transparent)" } }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </div>
                <div style={{ fontSize: 10.5, fontWeight: active ? 800 : 600, color: active ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.65)", maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {shot.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 生成結果ダイアログ（3DSLアップロード） ── */}
      {(renderResults || videoResult) && (
        <DslRenderUploadDialog
          results={renderResults ?? [videoResult]}
          onClose={() => { setRenderResults(null); clearVideoResult(); }}
          projectId={projectId}
          projectName={projectName}
          workspaceId={workspaceId}
          planId={planId}
          onSaveToFolder={handleSaveToFolder}
        />
      )}

      {/* ── FFmpeg セットアップ ── */}
      <Dialog open={ffmpegSetupOpen} onClose={() => !ffmpegDownloading && setFfmpegSetupOpen(false)}
        PaperProps={{ sx: { background: "var(--brand-surface2)", color: "var(--brand-fg)", borderRadius: 2, minWidth: 360 } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700, pb: 1 }}>
          {ffmpegDownloading ? "FFmpeg をダウンロード中…" : "動画エンコードの準備"}
        </DialogTitle>
        <DialogContent>
          {!ffmpegDownloading ? (
            <Typography sx={{ fontSize: 12, opacity: 0.7, lineHeight: 1.8 }}>
              動画（mp4）の書き出しには FFmpeg が必要です。アプリが自動でダウンロード・設定します（約 60 MB）。
            </Typography>
          ) : (
            <Box sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: 11, opacity: 0.65, mb: 0.75 }}>
                {ffmpegDownloadProgress?.phase === "extracting" ? "展開中…" : `ダウンロード中… ${ffmpegDownloadProgress?.pct ?? 0}%`}
              </Typography>
              <LinearProgress variant="determinate" value={ffmpegDownloadProgress?.pct ?? 0}
                sx={{ borderRadius: 1, height: 5, background: alpha("#fff", 0.1), "& .MuiLinearProgress-bar": { background: "#c4b5fd" } }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          {!ffmpegDownloading && (
            <>
              <Button size="small" variant="outlined" onClick={() => setFfmpegSetupOpen(false)}
                sx={{ textTransform: "none", fontSize: 12, borderColor: alpha("#fff", 0.2), color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }}>キャンセル</Button>
              <Button size="small" variant="contained" onClick={handleDownloadFfmpeg}
                sx={{ textTransform: "none", fontSize: 12, fontWeight: 700, background: "#a78bfa", "&:hover": { background: "#8b5cf6" } }}>ダウンロード</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Blender セットアップ ── */}
      <Dialog open={blenderSetupOpen} onClose={() => !blenderDownloading && setBlenderSetupOpen(false)}
        PaperProps={{ sx: { background: "var(--brand-surface2)", color: "var(--brand-fg)", borderRadius: 2, minWidth: 360 } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700, pb: 1 }}>
          {blenderDownloading ? "Blender をダウンロード中…" : "Cycles レンダリングの準備"}
        </DialogTitle>
        <DialogContent>
          {!blenderDownloading ? (
            <Typography sx={{ fontSize: 12, opacity: 0.7, lineHeight: 1.8 }}>
              Cycles レンダリングには Blender が必要です。アプリが自動でダウンロード・設定します（約 300 MB）。
            </Typography>
          ) : (
            <Box sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: 11, opacity: 0.65, mb: 0.75 }}>
                {downloadProgress?.phase === "extracting" ? "展開中…" : `ダウンロード中… ${downloadProgress?.pct ?? 0}%`}
              </Typography>
              <LinearProgress variant="determinate" value={downloadProgress?.pct ?? 0}
                sx={{ borderRadius: 1, height: 5, background: alpha("#fff", 0.1), "& .MuiLinearProgress-bar": { background: "#6c87ff" } }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          {!blenderDownloading && (
            <>
              <Button size="small" variant="outlined" onClick={() => { setBlenderSetupOpen(false); setPendingShot(null); }}
                sx={{ textTransform: "none", fontSize: 12, borderColor: alpha("#fff", 0.2), color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }}>キャンセル</Button>
              <Button size="small" variant="contained" onClick={handleDownloadBlender}
                sx={{ textTransform: "none", fontSize: 12, background: alpha("#6c87ff", 0.85), boxShadow: "none", "&:hover": { background: "#6c87ff" } }}>ダウンロードして始める</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ── エラー ── */}
      <Snackbar open={!!errorMsg} autoHideDuration={null} onClose={() => setErrorMsg(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={() => setErrorMsg(null)} severity="error" variant="filled"
          sx={{ fontSize: 12, maxWidth: 640, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace" }}>
          {errorMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
