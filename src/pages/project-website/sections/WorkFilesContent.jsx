import React, { useState } from "react";
import {
  Box, Typography, Button, CircularProgress, Chip, Paper,
  Tooltip, IconButton, Divider,
} from "@mui/material";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FileCopyRoundedIcon from "@mui/icons-material/FileCopyRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";

import { useDesignFiles } from "@sekkeiya/global-panel";
import { useAuth } from "@/features/auth/context/AuthContext";
import CommitModal from "./CommitModal";
import TemplateSelectionModal from "../components/TemplateSelectionModal";

/* ─── Group helpers (same labels as Desktop) ─────────────────── */
const GROUP_LABELS = {
  rhino:   "3Dモデル（RHINO）",
  blender: "3Dモデル（Blender）",
  "3dsp":  "プレゼンテーション（S.Slide）",
  "3dsl":  "レイアウト（S.Layout）",
  "3dsc":  "S.Create",
  other:   "その他",
};
const GROUP_NOTES = {
  "3dsp": "S.Slideで作業したファイルが自動的に登録されます",
  "3dsl": "S.Layoutで作業したファイルが自動的に登録されます",
};

function getGroupKey(file) {
  if (file.appScope) return file.appScope.toLowerCase();
  if (file.toolType === "rhino")   return "rhino";
  if (file.toolType === "blender") return "blender";
  return file.toolType || "other";
}

export default function WorkFilesContent({ project, projectId }) {
  const { currentUser } = useAuth();
  const { workFiles, loading, commitNewWorkFile, commitNewVersion, getDownloadUrl } =
    useDesignFiles(projectId, "rhino");

  const [selectedFileId, setSelectedFileId] = useState(null);
  const [uploadModalOpen, setUploadModalOpen]   = useState(false);
  const [activeWorkFileId, setActiveWorkFileId] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedAppType, setSelectedAppType]   = useState("rhino");
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [uploadProgress, setUploadProgress]     = useState(0);

  const selectedFile = workFiles?.find(f => f.id === selectedFileId) ?? null;

  /* ── grouped map ── */
  const groupedFiles = React.useMemo(() => {
    const map = {};
    (workFiles || []).forEach(f => {
      const key = getGroupKey(f);
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [workFiles]);

  /* ── commit / download handlers ── */
  const handleCommit = async (commitData) => {
    try {
      setIsSubmitting(true);
      setUploadProgress(0);
      const createdBy = currentUser?.displayName || currentUser?.email || "Unknown";
      if (activeWorkFileId) {
        await commitNewVersion(
          { workFileId: activeWorkFileId, file: commitData.file, comment: commitData.note || commitData.displayName, createdBy, userId: currentUser?.uid },
          (p) => setUploadProgress(p)
        );
      } else {
        await commitNewWorkFile(
          { file: commitData.file, name: commitData.displayName || commitData.file.name, createdBy, userId: currentUser?.uid },
          (p) => setUploadProgress(p)
        );
      }
      setUploadModalOpen(false);
      setActiveWorkFileId(null);
    } catch (err) {
      console.error("Failed to commit:", err);
      alert("アップロードに失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (file) => {
    if (!file.storagePath) { alert("ストレージパスが見つかりません。"); return; }
    try {
      const url = await getDownloadUrl(file.storagePath);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name || `${file.id}.3dm`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
      alert("ダウンロードに失敗しました。");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3, lg: 4 }, display: "flex", flexDirection: "column", boxSizing: "border-box", maxWidth: 1600, mx: "auto", width: "100%", flex: 1 }}>

      {/* ── Header ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid rgba(255,255,255,0.1)", pb: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#fff", fontWeight: 800, mb: 0.75 }}>
            プロジェクトファイル
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", maxWidth: 520 }}>
            Rhino・S.Layout・S.Slide など、すべてのアプリの作業ファイルをまとめて管理します。
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexShrink: 0, ml: 2 }}>
          <Tooltip title="外部ファイルをインポート">
            <IconButton
              onClick={() => { setActiveWorkFileId(null); setUploadModalOpen(true); }}
              sx={{
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 2,
                "&:hover": { color: "#00BFFF", borderColor: "rgba(0,191,255,0.5)", bgcolor: "rgba(0,191,255,0.05)" },
              }}
            >
              <FolderOpenRoundedIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeRoundedIcon />}
            onClick={() => { setSelectedAppType("rhino"); setTemplateModalOpen(true); }}
            sx={{ bgcolor: "#fa709a", color: "#fff", fontWeight: 700, textTransform: "none", borderRadius: 2, "&:hover": { bgcolor: "#ff90b2" } }}
          >
            Rhinoテンプレートから新規作成
          </Button>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineRoundedIcon />}
            onClick={() => { setActiveWorkFileId(null); setUploadModalOpen(true); }}
            sx={{ bgcolor: "#00BFFF", color: "#000", fontWeight: 800, textTransform: "none", borderRadius: 2, "&:hover": { bgcolor: "#4facfe" } }}
          >
            外部ファイルをインポート
          </Button>
        </Box>
      </Box>

      {/* ── Main area: card grid + side panel ── */}
      <Box sx={{ display: "flex", flex: 1, gap: 2, minHeight: 0, position: "relative" }}>

        {/* Card grid */}
        <Box sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
              <CircularProgress sx={{ color: "#00BFFF" }} />
            </Box>
          ) : !workFiles || workFiles.length === 0 ? (
            <EmptyState
              onTemplate={() => { setSelectedAppType("rhino"); setTemplateModalOpen(true); }}
              onUpload={() => { setActiveWorkFileId(null); setUploadModalOpen(true); }}
            />
          ) : (
            Object.entries(groupedFiles).map(([groupKey, groupList]) => (
              <Box key={groupKey} sx={{ mb: 4 }}>
                {/* Group header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {GROUP_LABELS[groupKey] ?? groupKey.toUpperCase()}
                  </Typography>
                  {GROUP_NOTES[groupKey] && (
                    <Typography sx={{ fontSize: "0.63rem", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>
                      — {GROUP_NOTES[groupKey]}
                    </Typography>
                  )}
                  <Divider sx={{ flex: 1, borderColor: "rgba(255,255,255,0.07)" }} />
                  <Typography sx={{ fontSize: "0.63rem", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>
                    {groupList.length}件
                  </Typography>
                </Box>

                {/* Cards */}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  {groupList.map(file => (
                    <FileCard
                      key={file.id}
                      file={file}
                      isSelected={selectedFileId === file.id}
                      onSelect={() => setSelectedFileId(file.id)}
                      onDownload={() => handleDownload(file)}
                      onUploadVersion={() => { setActiveWorkFileId(file.id); setUploadModalOpen(true); }}
                    />
                  ))}
                </Box>
              </Box>
            ))
          )}
        </Box>

        {/* Side detail panel */}
        {selectedFile && (
          <SidePanel
            file={selectedFile}
            onClose={() => setSelectedFileId(null)}
            onDownload={() => handleDownload(selectedFile)}
            onUploadVersion={() => { setActiveWorkFileId(selectedFile.id); setUploadModalOpen(true); }}
          />
        )}
      </Box>

      {/* Modals */}
      <CommitModal
        open={uploadModalOpen}
        onClose={() => { setUploadModalOpen(false); setActiveWorkFileId(null); }}
        onCommit={handleCommit}
        isSubmitting={isSubmitting}
        progress={uploadProgress}
        appType="rhino"
        mode={activeWorkFileId ? "newVersion" : "newFile"}
      />
      <TemplateSelectionModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        appType={selectedAppType}
      />
    </Box>
  );
}

/* ─── FileCard (thumbnail grid card, matching Desktop) ───────── */
function FileCard({ file, isSelected, onSelect, onDownload, onUploadVersion }) {
  const dateStr = file.updatedAt
    ? new Date(file.updatedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
    : "";

  return (
    <Box
      onClick={onSelect}
      sx={{
        width: 192,
        borderRadius: 2.5,
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        border: isSelected ? "1.5px solid rgba(0,191,255,0.7)" : "1px solid rgba(255,255,255,0.08)",
        bgcolor: isSelected ? "rgba(0,191,255,0.06)" : "rgba(255,255,255,0.02)",
        transition: "border 0.15s, box-shadow 0.15s, background 0.15s",
        "&:hover": {
          border: "1.5px solid rgba(0,191,255,0.5)",
          bgcolor: "rgba(0,191,255,0.04)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
          "& .card-hover-actions": { opacity: 1 },
        },
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ aspectRatio: "16/9", bgcolor: "#0a0d17", position: "relative", overflow: "hidden" }}>
        {file.thumbnailUrl ? (
          <Box component="img" src={file.thumbnailUrl} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.18 }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 36 }} />
          </Box>
        )}

        {/* Status badge */}
        <Box sx={{
          position: "absolute", top: 6, right: 6,
          px: 0.75, py: 0.2, borderRadius: 1,
          bgcolor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.2)",
        }}>
          <Typography sx={{ fontSize: "0.58rem", fontWeight: 800, color: "rgba(255,255,255,0.45)", lineHeight: 1.2 }}>
            クラウドのみ
          </Typography>
        </Box>

        {/* Hover actions */}
        <Box
          className="card-hover-actions"
          sx={{
            position: "absolute", inset: 0,
            bgcolor: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
            opacity: 0, transition: "opacity 0.18s",
          }}
        >
          <Tooltip title="ダウンロード">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              sx={{ bgcolor: "rgba(0,191,255,0.2)", color: "#00BFFF", border: "1px solid rgba(0,191,255,0.5)", "&:hover": { bgcolor: "rgba(0,191,255,0.4)" } }}
            >
              <DownloadRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="新バージョンをアップロード">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onUploadVersion(); }}
              sx={{ bgcolor: "rgba(255,152,0,0.2)", color: "#ff9800", border: "1px solid rgba(255,152,0,0.5)", "&:hover": { bgcolor: "rgba(255,152,0,0.4)" } }}
            >
              <UploadFileRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Info */}
      <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5 }}>
        <Tooltip title={file.name} placement="top" enterDelay={600}>
          <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.82rem", color: isSelected ? "#fff" : "rgba(255,255,255,0.85)", lineHeight: 1.3, mb: 0.75 }}>
            {file.name}
          </Typography>
        </Tooltip>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Chip
            size="small"
            label={`v${file.latestVersionNumber || 1}`}
            sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
          />
          <Typography sx={{ fontSize: "0.63rem", color: "rgba(255,255,255,0.3)" }}>
            {dateStr}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/* ─── Side detail panel ───────────────────────────────────────── */
function SidePanel({ file, onClose, onDownload, onUploadVersion }) {
  const dateStr = file.updatedAt ? new Date(file.updatedAt).toLocaleString("ja-JP") : "—";

  return (
    <Paper sx={{
      width: 320, flexShrink: 0,
      bgcolor: "rgba(255,255,255,0.01)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 3, p: 2.5,
      display: "flex", flexDirection: "column",
      overflowY: "auto",
    }}>
      {/* Panel header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: "#00BFFF", fontWeight: 800, letterSpacing: 1, fontSize: "0.6rem", lineHeight: 1 }}>
            ファイル詳細
          </Typography>
          <Typography sx={{ color: "#fff", fontWeight: 800, wordBreak: "break-all", mt: 0.25, fontSize: "0.95rem", lineHeight: 1.35 }}>
            {file.name}
          </Typography>
        </Box>
        <Tooltip title="パネルを閉じる">
          <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.3)", ml: 0.5, "&:hover": { color: "#fff" } }}>
            <ChevronRightIcon sx={{ fontSize: "1rem" }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Thumbnail preview */}
      <Box sx={{ aspectRatio: "16/9", bgcolor: "rgba(0,0,0,0.4)", borderRadius: 2, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden", mb: 1.5 }}>
        {file.thumbnailUrl ? (
          <Box component="img" src={file.thumbnailUrl} sx={{ width: "100%", height: "100%", objectFit: "contain", bgcolor: "#0b0f19" }} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.18)" }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 36, mb: 1, opacity: 0.5 }} />
            <Typography variant="caption" sx={{ textAlign: "center", px: 3, lineHeight: 1.6, color: "rgba(255,255,255,0.25)" }}>
              サムネイルは次回アップロード時に更新されます
            </Typography>
          </Box>
        )}
      </Box>

      {/* Status chips */}
      <Box sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.02)", borderRadius: 2, border: "1px solid rgba(255,255,255,0.05)", mb: 1.5 }}>
        <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.3)", display: "block", mb: 1, fontWeight: 800, letterSpacing: 1, fontSize: "0.58rem" }}>
          STATUS
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          <Chip size="small" label={`最新: v${file.latestVersionNumber || 1}`} sx={{ bgcolor: "rgba(0,191,255,0.1)", color: "#00BFFF", fontWeight: 700 }} />
          <Chip size="small" label={file.toolType || "rhino"} sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }} />
          <Chip size="small" label="クラウドのみ" sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.12)" }} />
        </Box>
      </Box>

      {/* Metadata */}
      <Box sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.02)", borderRadius: 2, border: "1px solid rgba(255,255,255,0.05)", mb: 1.5 }}>
        <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.3)", display: "block", mb: 1, fontWeight: 800, letterSpacing: 1, fontSize: "0.58rem" }}>
          METADATA
        </Typography>
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block", mb: 0.25 }}>最終更新日</Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 500, fontSize: "0.8rem" }}>{dateStr}</Typography>
        </Box>
        {file.updatedBy && (
          <Box>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block", mb: 0.25 }}>更新者</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 500, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file.updatedBy}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 1.5 }} />

      {/* Actions */}
      <Typography sx={{ color: "rgba(255,255,255,0.5)", mb: 1, fontWeight: 700, fontSize: "0.7rem", letterSpacing: 0.5, textTransform: "uppercase" }}>
        アクション
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Button
          fullWidth variant="contained"
          startIcon={<DownloadRoundedIcon />}
          onClick={onDownload}
          sx={{ bgcolor: "#00BFFF", color: "#000", fontWeight: 800, fontSize: "0.82rem", textTransform: "none", borderRadius: 2 }}
        >
          クラウドからダウンロード
        </Button>
        <Button
          fullWidth variant="outlined"
          startIcon={<UploadFileRoundedIcon />}
          onClick={onUploadVersion}
          sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: "0.78rem", textTransform: "none", borderRadius: 2, "&:hover": { borderColor: "#00BFFF", bgcolor: "rgba(0,191,255,0.08)" } }}
        >
          新バージョンをアップロード
        </Button>
        <Button
          fullWidth variant="outlined"
          startIcon={<HistoryRoundedIcon />}
          disabled
          sx={{ color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.1)", fontSize: "0.78rem", textTransform: "none", borderRadius: 2, "&.Mui-disabled": { borderColor: "rgba(255,255,255,0.08)" } }}
        >
          バージョン履歴（準備中）
        </Button>
      </Box>
    </Paper>
  );
}

/* ─── Empty state ─────────────────────────────────────────────── */
function EmptyState({ onTemplate, onUpload }) {
  return (
    <Box sx={{ py: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <AutoAwesomeRoundedIcon sx={{ fontSize: 56, color: "rgba(255,255,255,0.12)", mb: 3 }} />
      <Typography variant="h5" sx={{ color: "#fff", fontWeight: 800, mb: 1 }}>
        Work Files はまだありません
      </Typography>
      <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.5)", mb: 5, maxWidth: 440 }}>
        テンプレートから新規作成するか、既存のファイルをインポートしてください。
      </Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
        <Button
          variant="contained"
          startIcon={<AutoAwesomeRoundedIcon />}
          onClick={onTemplate}
          sx={{ bgcolor: "#fa709a", color: "#fff", fontWeight: 800, fontSize: "1rem", px: 4, py: 1.5, borderRadius: 8, textTransform: "none", "&:hover": { bgcolor: "#ff90b2" } }}
        >
          Rhinoテンプレートから新規作成
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadFileRoundedIcon />}
          onClick={onUpload}
          sx={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.2)", fontWeight: 700, fontSize: "1rem", px: 4, py: 1.5, borderRadius: 8, textTransform: "none", "&:hover": { color: "#fff", borderColor: "rgba(255,255,255,0.5)" } }}
        >
          既存のファイルをアップロード
        </Button>
      </Box>
    </Box>
  );
}
