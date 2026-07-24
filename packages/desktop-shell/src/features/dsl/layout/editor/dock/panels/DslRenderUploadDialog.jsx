/**
 * DslRenderUploadDialog
 *
 * 3DSL レンダリング結果を 3DSL（Firestore + Firebase Storage）に
 * アップロードするダイアログ。3DSS の UploadQueueItemCard と同じ
 * カードレイアウトを踏襲する。
 */
import React, { useState, useCallback, useMemo } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  Stack,
  Typography,
  IconButton,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Chip,
  LinearProgress,
  Switch,
  Tooltip,
  Select,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded";

import { writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

import { saveRenderToLayout } from "../../../api/layoutRendersApi";
import { DSI_CATEGORIES } from "../../../../../dsi/store/useDsiStore";
import { auth } from "../../../../../../lib/firebase/client";

// 結果カードからメディア種別を判定（パース静止画 / 動画）
function deriveMediaType(r) {
  if (r?.mediaType === "video" || r?.type === "video" || r?.kind === "movie") return "video";
  const fmt = String(r?.format ?? "").toLowerCase();
  if (["mp4", "mov", "webm", "m4v"].includes(fmt)) return "video";
  return "image";
}

// 自動カテゴリ（パース or 動画）
function autoCategory(mediaType) {
  return mediaType === "video" ? "動画" : "パース";
}

// 自動タグの種（メディア種別・画質・プロジェクト名）。ユーザーが後から編集可能。
function seedTags(r, mediaType, projectName) {
  const tags = [mediaType === "video" ? "動画" : "パース"];
  tags.push(r?.quality === "cycles" ? "Cycles" : "標準");
  if (projectName) tags.push(projectName);
  return [...new Set(tags.filter(Boolean))];
}

// ── 画質バッジ ────────────────────────────────────────────────────
function QualityBadge({ quality }) {
  const isCycles = quality === "cycles";
  return (
    <Chip
      label={isCycles ? "Cycles" : "標準"}
      size="small"
      sx={{
        height: 18,
        fontSize: 9,
        fontWeight: 700,
        background: isCycles
          ? alpha("#a78bfa", 0.22)
          : alpha("#6c87ff", 0.18),
        color: isCycles ? "light-dark(#2705a9, #c4b5fd)" : "light-dark(#0029ad, #9db4ff)",
        border: `1px solid ${isCycles ? alpha("#a78bfa", 0.35) : alpha("#6c87ff", 0.3)}`,
        "& .MuiChip-label": { px: 0.75 },
      }}
    />
  );
}

// ── メディア種別バッジ（パース静止画 / 動画）─────────────────────
function MediaTypeBadge({ mediaType }) {
  const isVideo = mediaType === "video";
  return (
    <Chip
      icon={isVideo
        ? <MovieRoundedIcon sx={{ fontSize: 12, color: "#fff !important" }} />
        : <ImageRoundedIcon sx={{ fontSize: 12, color: "#fff !important" }} />}
      label={isVideo ? "動画" : "パース"}
      size="small"
      sx={{
        height: 18,
        fontSize: 9,
        fontWeight: 800,
        background: isVideo ? alpha("#7e57c2", 0.25) : alpha("#ec407a", 0.22),
        color: isVideo ? "light-dark(#4400ad, #d1b3ff)" : "light-dark(#ad0044, #ffb3d1)",
        border: `1px solid ${isVideo ? alpha("#7e57c2", 0.4) : alpha("#ec407a", 0.4)}`,
        "& .MuiChip-label": { px: 0.6 },
      }}
    />
  );
}

// ── 1枚あたりのカード ─────────────────────────────────────────────
function RenderCard({ item, onUpdate, heroId, onSetHero, categories }) {
  const isHeroCandidate = heroId === item.id;
  const { status, progress } = item;
  const [tagInput, setTagInput] = React.useState("");

  const isDone = status === "done";
  const isError = status === "error";
  const isUploading = status === "uploading";
  const isDisabled = isUploading || isDone;

  const tags = Array.isArray(item.tags) ? item.tags : [];
  const addTag = (raw) => {
    const t = String(raw || "").trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    onUpdate(item.id, { tags: [...tags, t] });
    setTagInput("");
  };
  const removeTag = (t) => onUpdate(item.id, { tags: tags.filter((x) => x !== t) });

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: `1px solid ${
          isDone
            ? alpha("#34d399", 0.3)
            : isError
            ? alpha("#f87171", 0.3)
            : isHeroCandidate
            ? alpha("#00BFFF", 0.35)
            : alpha("#fff", 0.08)
        }`,
        background: isDone
          ? alpha("#34d399", 0.04)
          : isError
          ? alpha("#f87171", 0.04)
          : alpha("#fff", 0.02),
        transition: "border-color 0.2s",
        opacity: item.skip ? 0.4 : 1,
      }}
    >
      {/* サムネイル / 動画プレビュー（動画は保存前にここで再生確認できる） */}
      <Box
        sx={{
          flexShrink: 0,
          width: item.mediaType === "video" && item.media ? 248 : 140,
          aspectRatio: "16/9",
          borderRadius: 1.5,
          overflow: "hidden",
          background: "color-mix(in srgb, var(--brand-bg) 40%, transparent)",
          position: "relative",
        }}
      >
        {item.mediaType === "video" && item.media ? (
          <Box
            component="video"
            src={item.media}
            poster={item.thumbnail || undefined}
            controls
            playsInline
            preload="metadata"
            sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "var(--brand-bg)" }}
          />
        ) : item.thumbnail ? (
          <Box
            component="img"
            src={item.thumbnail}
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ImageRoundedIcon sx={{ opacity: 0.2, fontSize: 24 }} />
          </Box>
        )}

        {/* ステータスオーバーレイ */}
        {isUploading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "color-mix(in srgb, var(--brand-bg) 55%, transparent)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
            }}
          >
            <Typography sx={{ fontSize: 10, color: "light-dark(#0020ad, #6c87ff)", fontWeight: 700 }}>
              {Math.round(progress ?? 0)}%
            </Typography>
          </Box>
        )}
        {isDone && (
          <Box sx={{ position: "absolute", top: 5, right: 5 }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 18, color: "#34d399" }} />
          </Box>
        )}
        {isError && (
          <Box sx={{ position: "absolute", top: 5, right: 5 }}>
            <ErrorRoundedIcon sx={{ fontSize: 18, color: "light-dark(#a50808, #f87171)" }} />
          </Box>
        )}
      </Box>

      {/* 右カラム */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
        {/* Shot名 */}
        <Stack direction="row" alignItems="center" gap={1}>
          <TextField
            value={item.name}
            onChange={(e) => onUpdate(item.id, { name: e.target.value })}
            disabled={isDisabled}
            size="small"
            placeholder="Shot名"
            variant="outlined"
            sx={{
              flex: 1,
              "& .MuiOutlinedInput-root": {
                fontSize: 13,
                fontWeight: 700,
                height: 30,
                background: alpha("#fff", 0.04),
                "& fieldset": { borderColor: alpha("#fff", 0.12) },
                "&:hover fieldset": { borderColor: alpha("#fff", 0.25) },
                "&.Mui-focused fieldset": { borderColor: alpha("#6c87ff", 0.6) },
              },
              "& input": { color: "var(--brand-fg)", py: 0 },
            }}
          />
          <MediaTypeBadge mediaType={item.mediaType} />
          <QualityBadge quality={item.quality} />
        </Stack>

        {/* 解像度 */}
        <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)" }}>
          {item.width ?? 1920} × {item.height ?? 1080} px
        </Typography>

        {/* ── S.Image 用メタ情報（カテゴリ / タグ）─────────────── */}
        <Stack direction="row" alignItems="center" gap={1}>
          <Stack direction="row" alignItems="center" gap={0.4} sx={{ flexShrink: 0 }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 11, color: alpha("#ec407a", 0.8) }} />
            <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", fontWeight: 700 }}>カテゴリ</Typography>
          </Stack>
          <Select
            value={item.category ?? autoCategory(item.mediaType)}
            onChange={(e) => onUpdate(item.id, { category: e.target.value })}
            disabled={isDisabled}
            size="small"
            variant="outlined"
            sx={{
              minWidth: 120,
              fontSize: 12,
              color: "var(--brand-fg)",
              "& .MuiOutlinedInput-input": { py: 0.5 },
              "& fieldset": { borderColor: alpha("#fff", 0.12) },
              "&:hover fieldset": { borderColor: alpha("#fff", 0.25) },
              "& .MuiSvgIcon-root": { color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" },
            }}
          >
            {(categories ?? []).map((c) => (
              <MenuItem key={c} value={c} sx={{ fontSize: 12 }}>{c}</MenuItem>
            ))}
          </Select>
        </Stack>

        {/* タグ */}
        <Box>
          <Stack direction="row" alignItems="center" gap={0.4} sx={{ mb: 0.4 }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 11, color: alpha("#ec407a", 0.8) }} />
            <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", fontWeight: 700 }}>タグ（自動付与・編集可）</Typography>
          </Stack>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
            {tags.map((t) => (
              <Chip
                key={t}
                label={t}
                size="small"
                onDelete={isDisabled ? undefined : () => removeTag(t)}
                sx={{ height: 22, fontSize: 10, background: alpha("#ec407a", 0.15), color: "light-dark(#ad0044, #ffb3d1)", border: `1px solid ${alpha("#ec407a", 0.3)}` }}
              />
            ))}
            {!isDisabled && (
              <TextField
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                onBlur={() => addTag(tagInput)}
                size="small"
                placeholder="＋タグ"
                variant="standard"
                sx={{ width: 70, "& input": { fontSize: 10, color: "var(--brand-fg)", py: 0.25 }, "& .MuiInput-underline:before": { borderColor: alpha("#fff", 0.15) } }}
              />
            )}
          </Box>
        </Box>

        {/* オプション行 */}
        <Stack direction="row" alignItems="center" gap={1.5}>
          {/* サムネイルに設定 */}
          <Tooltip title="このレンダリング画像をレイアウトのカバー画像（サムネイル）に設定する" placement="top">
            <Stack
              direction="row"
              alignItems="center"
              gap={0.4}
              onClick={() => !isDisabled && onSetHero(item.id)}
              sx={{
                cursor: isDisabled ? "default" : "pointer",
                opacity: isDisabled ? 0.5 : 1,
                "&:hover": { opacity: isDisabled ? 0.5 : 0.85 },
              }}
            >
              <StarRoundedIcon
                sx={{
                  fontSize: 13,
                  color: isHeroCandidate ? "light-dark(#aa7c03, #fbbf24)" : "color-mix(in srgb, var(--brand-fg) 30%, transparent)",
                  transition: "color 0.15s",
                }}
              />
              <Typography
                sx={{
                  fontSize: 10,
                  color: isHeroCandidate ? "light-dark(#aa7c03, #fbbf24)" : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
                  transition: "color 0.15s",
                  fontWeight: isHeroCandidate ? 700 : 400,
                  userSelect: "none",
                }}
              >
                サムネイルに設定
              </Typography>
            </Stack>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          {/* スキップトグル */}
          <Tooltip title="このShotをアップロード対象から除外する" placement="top">
            <Stack direction="row" alignItems="center" gap={0.3}>
              <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", userSelect: "none" }}>
                対象
              </Typography>
              <Switch
                size="small"
                checked={!item.skip}
                onChange={(e) => onUpdate(item.id, { skip: !e.target.checked })}
                disabled={isDisabled}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": { color: "light-dark(#0020ad, #6c87ff)" },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: alpha("#6c87ff", 0.6),
                  },
                }}
              />
            </Stack>
          </Tooltip>
        </Stack>

        {/* プログレスバー */}
        {isUploading && (
          <LinearProgress
            variant="determinate"
            value={progress ?? 0}
            sx={{
              mt: 0.25,
              height: 3,
              borderRadius: 1,
              background: alpha("#fff", 0.08),
              "& .MuiLinearProgress-bar": { background: "#6c87ff", borderRadius: 1 },
            }}
          />
        )}

        {/* エラーメッセージ */}
        {isError && item.errorMsg && (
          <Typography sx={{ fontSize: 10, color: "light-dark(#a50808, #f87171)", lineHeight: 1.5 }}>
            {item.errorMsg}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ── data URL → Uint8Array ─────────────────────────────────────────
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

// ── メインダイアログ ──────────────────────────────────────────────
export default function DslRenderUploadDialog({
  results,            // [{ id, name, thumbnail, quality, width?, height? }]
  onClose,
  projectId,
  projectName,
  workspaceId,
  planId,
  onSaveToFolder,     // async (results) → void (レイアウトコンテキストなし時フォールバック)
}) {
  const hasLayoutContext = Boolean(projectId && workspaceId && planId);

  // 各カードの状態（名前・スキップ・ステータス・S.Image メタ）
  const [cards, setCards] = useState(() =>
    results.map((r) => {
      const mediaType = deriveMediaType(r);
      return {
        ...r,
        mediaType,
        category: r.category ?? autoCategory(mediaType),  // 自動: パース / 動画
        tags: Array.isArray(r.tags) ? r.tags : seedTags(r, mediaType, projectName),
        skip: false,
        status: "idle",   // idle | uploading | done | error
        progress: 0,
        errorMsg: null,
      };
    })
  );
  const [heroId, setHeroId] = useState(results[0]?.id ?? null);
  const [alsoSaveToLocal, setAlsoSaveToLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const updateCard = useCallback((id, updates) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const targets = useMemo(() => cards.filter((c) => !c.skip), [cards]);
  const doneCount = useMemo(() => cards.filter((c) => c.status === "done").length, [cards]);
  const errorCount = useMemo(() => cards.filter((c) => c.status === "error").length, [cards]);

  // ── PC\SEKKEIYA へのローカル保存 ─────────────────────────────────
  const saveToLocalSekkeiya = useCallback(async (activeCards, pid) => {
    try {
      // アカウント私物ルート（PC\SEKKEIYA\Accounts\<アカウント>）配下の Projects に保存する。
      // 未ログイン等で取得できない場合のみ旧来の SEKKEIYA 直下へフォールバック。
      let baseRoot;
      try {
        baseRoot = await invoke("get_account_dir");
      } catch {
        baseRoot = await invoke("get_ai_drive_path");
      }
      const safeProjName = projectName ? safeName(projectName) : null;
      const dir = safeProjName
        ? `${baseRoot}\\Projects\\${safeProjName}\\WorkFiles\\3DSL\\renders\\${pid ?? "unknown"}`
        : `${baseRoot}\\3DSL\\renders\\${pid ?? "unknown"}`;
      await mkdir(dir, { recursive: true });
      for (const card of activeCards) {
        // 動画は mp4 本体、静止画はサムネイル画像を保存する
        const payload = card.media ?? card.thumbnail;
        if (!payload) continue;
        const bytes = dataUrlToUint8Array(payload);
        const ext = card.media
          ? (card.format ?? "mp4")
          : (card.thumbnail.startsWith("data:image/jpeg") ? "jpg" : "png");
        await writeFile(`${dir}\\${safeName(card.name)}.${ext}`, bytes);
      }
    } catch (e) {
      console.warn("[DslRenderUploadDialog] PC\\SEKKEIYA 保存失敗:", e);
    }
  }, [projectName]);

  // ── 3DSLへ保存 ──────────────────────────────────────────────────
  const handleUploadTo3DSL = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !hasLayoutContext) return;

    setSaving(true);
    let anyDone = false;
    const activeCards = cards.filter((c) => !c.skip);

    for (const card of activeCards) {
      updateCard(card.id, { status: "uploading", progress: 0 });
      try {
        const isVideo = (card.mediaType ?? "image") === "video";
        // 動画は mp4 本体をアップロードし、サムネイル画像はポスターとして渡す
        const payload = card.media ?? card.thumbnail;
        await saveRenderToLayout(
          payload,
          { projectId, workspaceId, planId, createdBy: userId },
          {
            shotName: card.name,
            quality: card.quality ?? "standard",
            width: card.width ?? 1920,
            height: card.height ?? 1080,
            setAsHero: heroId === card.id,
            // S.Image 連携用メタ
            mediaType: card.mediaType ?? "image",
            category: card.category ?? autoCategory(card.mediaType),
            tags: Array.isArray(card.tags) ? card.tags : [],
            // 動画用
            durationSec: card.durationSec,
            posterDataUrl: isVideo ? card.thumbnail : undefined,
          }
        );
        updateCard(card.id, { status: "done", progress: 100 });
        anyDone = true;
      } catch (e) {
        console.error("[DslRenderUploadDialog] アップロード失敗:", e);
        updateCard(card.id, {
          status: "error",
          errorMsg: String(e?.message ?? e).slice(0, 120),
        });
      }
    }

    // PC\SEKKEIYA にも保存
    if (alsoSaveToLocal) {
      await saveToLocalSekkeiya(activeCards, planId);
    }

    setSaving(false);
    if (anyDone) setAllDone(true);
  }, [
    cards,
    heroId,
    alsoSaveToLocal,
    hasLayoutContext,
    projectId,
    workspaceId,
    planId,
    updateCard,
    saveToLocalSekkeiya,
  ]);

  const activeCount = targets.length;

  return (
    <Dialog
      open
      onClose={!saving ? onClose : undefined}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: "min(760px, 96vw)",
          maxHeight: "90vh",
          background: "var(--brand-bg)",
          border: `1px solid ${alpha("#fff", 0.1)}`,
          borderRadius: 3,
          color: "var(--brand-fg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {/* ── タイトルバー ────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: `1px solid ${alpha("#fff", 0.08)}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PhotoLibraryRoundedIcon sx={{ fontSize: 18, color: "#ec407a" }} />
          <Typography sx={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.2 }}>
            S.Imageに保存
          </Typography>
        </Box>
        <Typography sx={{ ml: 1.25, fontSize: 12, opacity: 0.45 }}>
          {results.length} Shot
        </Typography>
        <Box sx={{ flex: 1 }} />
        {allDone && (
          <Chip
            label="保存完了"
            size="small"
            icon={<CheckCircleRoundedIcon sx={{ fontSize: 13 }} />}
            sx={{
              mr: 1,
              background: alpha("#34d399", 0.18),
              color: "light-dark(#199564, #6ee7b7)",
              border: `1px solid ${alpha("#34d399", 0.3)}`,
              fontSize: 11,
              fontWeight: 700,
            }}
          />
        )}
        <IconButton
          size="small"
          onClick={onClose}
          disabled={saving}
          sx={{ borderRadius: 1.5, opacity: saving ? 0.3 : 1 }}
        >
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      {/* ── カードリスト ─────────────────────────────────────────── */}
      <DialogContent
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { background: alpha("#fff", 0.12), borderRadius: 2 },
        }}
      >
        {cards.map((card) => (
          <RenderCard
            key={card.id}
            item={card}
            onUpdate={updateCard}
            heroId={heroId}
            onSetHero={setHeroId}
            categories={DSI_CATEGORIES}
          />
        ))}
      </DialogContent>

      {/* ── フッター ─────────────────────────────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${alpha("#fff", 0.08)}`,
          px: 2.5,
          py: 1.75,
        }}
      >
        {/* PC\SEKKEIYA ローカル保存オプション */}
        <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={alsoSaveToLocal}
                onChange={(e) => setAlsoSaveToLocal(e.target.checked)}
                disabled={saving}
                sx={{
                  color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)",
                  "&.Mui-checked": { color: "light-dark(#0020ad, #6c87ff)" },
                  p: 0.5,
                }}
              />
            }
            label={
              <Stack direction="row" alignItems="center" gap={0.6}>
                <FolderRoundedIcon sx={{ fontSize: 13, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }} />
                <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 65%, transparent)" }}>
                  PC\SEKKEIYA にも保存 (ローカル)
                </Typography>
              </Stack>
            }
            sx={{ m: 0 }}
          />
        </Stack>

        {/* ステータスサマリー */}
        {saving && (
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
            <LinearProgress
              sx={{
                flex: 1,
                height: 3,
                borderRadius: 1,
                background: alpha("#fff", 0.08),
                "& .MuiLinearProgress-bar": { background: "#6c87ff" },
              }}
            />
            <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", flexShrink: 0 }}>
              {doneCount} / {activeCount}
            </Typography>
          </Stack>
        )}
        {!saving && errorCount > 0 && (
          <Typography sx={{ fontSize: 11, color: "light-dark(#a50808, #f87171)", mb: 1 }}>
            {errorCount} Shot のアップロードに失敗しました
          </Typography>
        )}

        {/* ボタン行 */}
        <Stack direction="row" justifyContent="flex-end" gap={1}>
          <Button
            onClick={onClose}
            disabled={saving}
            sx={{
              textTransform: "none",
              color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)",
              fontWeight: 700,
              fontSize: 13,
              "&:hover": { color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)", background: alpha("#fff", 0.06) },
            }}
          >
            {allDone ? "閉じる" : "キャンセル"}
          </Button>

          {hasLayoutContext && !allDone && (
            <Button
              variant="contained"
              onClick={handleUploadTo3DSL}
              disabled={saving || activeCount === 0}
              startIcon={
                saving ? null : <CloudUploadRoundedIcon sx={{ fontSize: 16 }} />
              }
              sx={{
                borderRadius: 1.5,
                textTransform: "none",
                fontWeight: 800,
                fontSize: 13,
                px: 2.5,
                boxShadow: "none",
                background: alpha("#00BFFF", 0.85),
                color: "#000e1a",
                "&:hover": { background: "#00BFFF", boxShadow: "none" },
                "&:disabled": { opacity: 0.35 },
              }}
            >
              {saving
                ? `保存中… ${doneCount} / ${activeCount}`
                : `S.Imageに保存 (${activeCount}枚)`}
            </Button>
          )}

          {/* レイアウトコンテキストなし時のフォールバック */}
          {!hasLayoutContext && (
            <Button
              variant="contained"
              onClick={() => onSaveToFolder?.(cards.filter((c) => !c.skip))}
              disabled={saving || activeCount === 0}
              sx={{
                borderRadius: 1.5,
                textTransform: "none",
                fontWeight: 800,
                fontSize: 13,
                px: 2.5,
                boxShadow: "none",
                background: alpha("#6c87ff", 0.85),
                "&:hover": { background: "#6c87ff", boxShadow: "none" },
                "&:disabled": { opacity: 0.35 },
              }}
            >
              フォルダに保存 ({activeCount}枚)
            </Button>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}
