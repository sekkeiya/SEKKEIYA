import React from "react";
import {
  Box, Typography, Chip, Button, Tabs, Tab,
  AvatarGroup, Avatar, Paper, CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";

import { useDesignFiles } from "@sekkeiya/global-panel";
import WorkFilesContent from "./WorkFilesContent";
import SchedulesTasksContent from "./SchedulesTasksContent";

const NAV_TABS = [
  { id: "landing",  label: "ホーム" },
  { id: "files",    label: "WorkFiles" },
  { id: "schedule", label: "Schedules & Tasks" },
];

const EXTRA_SECTIONS = ["models", "drawings", "renders", "movies", "articles", "slides", "create"];

export default function LandingSection({ project, projectId, activeTab = "landing" }) {
  const navigate = useNavigate();
  const { workFiles = [], loading: workFilesLoading, getDownloadUrl } = useDesignFiles(projectId, "rhino");

  if (!project) return null;

  const members = project.memberIds || (project.ownerId ? [project.ownerId] : []);
  const updatedAtStr = project?.updatedAt?.toDate?.()
    ? project.updatedAt.toDate().toLocaleDateString("ja-JP", {
        year: "numeric", month: "short", day: "numeric",
      })
    : "Recently";

  const navValue = NAV_TABS.some((t) => t.id === activeTab) ? activeTab : "landing";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* ── Sticky Tab Bar ── */}
      <Box sx={{
        px: { xs: 2, md: 3, lg: 4 },
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        bgcolor: "rgba(8,12,20,0.9)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>
        <Tabs
          value={navValue}
          onChange={(_e, val) => navigate(`/projects/${projectId}/${val}`)}
          variant="scrollable"
          scrollButtons="auto"
          textColor="inherit"
          indicatorColor="primary"
          sx={{
            minHeight: 40,
            "& .MuiTabs-indicator": {
              height: 3,
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
              bgcolor: "#00BFFF",
            },
          }}
        >
          {NAV_TABS.map((tab) => (
            <Tab
              key={tab.id}
              label={tab.label}
              value={tab.id}
              disableRipple
              sx={{
                minHeight: 40,
                textTransform: "none",
                fontWeight: navValue === tab.id ? 700 : 500,
                fontSize: 13,
                color: navValue === tab.id ? "#fff" : "rgba(255,255,255,0.6)",
                transition: "color 0.2s",
                "&:hover": { color: "#fff" },
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* ── Tab Content ── */}
      {activeTab === "landing" ? (
        <Box sx={{ flex: 1, overflowY: "auto" }}>

          {/* Compact Hero */}
          <Box sx={{
            px: { xs: 3, md: 5, lg: 8 },
            pt: { xs: 6, md: 10 },
            pb: { xs: 4, md: 6 },
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            bgcolor: "#080c14",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Background glow */}
            <Box sx={{
              position: "absolute", top: "-30%", right: "-5%", width: "45%", height: "160%",
              background: "radial-gradient(circle, rgba(0,191,255,0.12) 0%, transparent 65%)",
              filter: "blur(40px)", zIndex: 0,
            }} />
            <Box sx={{ position: "relative", zIndex: 1 }}>
              {/* Badges */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Chip
                  label={project.boardType === "teamBoards" ? "チームプロジェクト" : "プロジェクト"}
                  size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700, fontSize: 11 }}
                />
                <Chip
                  label="アクティブ"
                  size="small"
                  sx={{ bgcolor: "rgba(67,233,123,0.18)", color: "#43e97b", fontWeight: 700, fontSize: 11 }}
                />
              </Box>

              {/* Project name */}
              <Typography variant="h3" sx={{
                color: "#fff", fontWeight: 900, mb: 1.5,
                letterSpacing: "-0.5px",
                fontSize: { xs: "2rem", md: "2.8rem" },
                background: "linear-gradient(90deg, #ffffff 0%, #a1c4fd 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                {project.name}
              </Typography>

              {/* Visibility */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 4, color: "rgba(255,255,255,0.5)" }}>
                {project.visibility === "private"
                  ? <LockRoundedIcon sx={{ fontSize: 15 }} />
                  : <PublicRoundedIcon sx={{ fontSize: 15 }} />
                }
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Visibility: {project.visibility || "public"}
                </Typography>
              </Box>

              {/* Metadata row */}
              <Box sx={{
                display: "flex", alignItems: "center", flexWrap: "wrap", gap: 3,
                pt: 3, borderTop: "1px solid rgba(255,255,255,0.08)",
              }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AvatarGroup max={4} sx={{ "& .MuiAvatar-root": { width: 30, height: 30, fontSize: 12, border: "2px solid #080c14" } }}>
                    {members.map((id) => (
                      <Avatar key={id} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} />
                    ))}
                  </AvatarGroup>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                    メンバー: {members.length} 人
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "rgba(255,255,255,0.45)" }}>
                  <AccessTimeRoundedIcon sx={{ fontSize: 15 }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    更新日: {updatedAtStr}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  startIcon={<SettingsRoundedIcon sx={{ fontSize: 15 }} />}
                  onClick={() => navigate(`/dashboard/projects?projectId=${projectId}`)}
                  sx={{
                    color: "#fff",
                    bgcolor: "rgba(255,255,255,0.05)",
                    borderRadius: 2, textTransform: "none", fontWeight: 600,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  }}
                >
                  設定
                </Button>
              </Box>

              {/* WorkFiles Quick Start */}
              {workFilesLoading ? (
                <Box sx={{ mt: 5, display: "flex", gap: 2, alignItems: "center" }}>
                  <CircularProgress size={18} sx={{ color: "rgba(255,255,255,0.3)" }} />
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)" }}>
                    作業ハブを準備中...
                  </Typography>
                </Box>
              ) : workFiles.length > 0 ? (
                <Box sx={{ mt: 5 }}>
                  <Typography variant="subtitle2" sx={{ color: "rgba(255,255,255,0.55)", fontWeight: 700, mb: 1.5, letterSpacing: 0.8, fontSize: 12 }}>
                    作業を開始する（クリックで履歴を表示）
                  </Typography>
                  <QuickStartCarousel
                    workFiles={workFiles}
                    getDownloadUrl={getDownloadUrl}
                  />
                </Box>
              ) : null}
            </Box>
          </Box>

        </Box>

      ) : activeTab === "files" ? (
        <WorkFilesContent project={project} projectId={projectId} />

      ) : activeTab === "schedule" ? (
        <SchedulesTasksContent project={project} projectId={projectId} />

      ) : EXTRA_SECTIONS.includes(activeTab) ? (
        <ExtraTabPlaceholder activeTab={activeTab} projectId={projectId} navigate={navigate} />

      ) : null}
    </Box>
  );
}

/* ─── WorkFiles Quick-Start Carousel ───────────────────────── */
function QuickStartCarousel({ workFiles, getDownloadUrl }) {
  const [activeId, setActiveId] = React.useState(workFiles[0]?.id ?? null);
  const [downloading, setDownloading] = React.useState(null);

  const handleDownload = async (e, file) => {
    e.stopPropagation();
    if (!file.storagePath) return;
    try {
      setDownloading(file.id);
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
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Box sx={{
      display: "flex", gap: 1.5, overflowX: "auto", pb: 2,
      "&::-webkit-scrollbar": { height: 6 },
      "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.18)", borderRadius: 3 },
      "&::-webkit-scrollbar-track": { bgcolor: "rgba(0,0,0,0.1)", borderRadius: 3 },
    }}>
      {workFiles.map((file, idx) => {
        const isActive = file.id === activeId;
        const isFirst = idx === 0;
        const updatedStr = file.updatedAt
          ? new Date(file.updatedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" })
          : "";

        return (
          <Paper
            key={file.id}
            onClick={() => setActiveId(file.id)}
            sx={{
              minWidth: 300,
              flex: "0 0 auto",
              p: 2,
              bgcolor: isActive ? "rgba(0,191,255,0.13)" : "rgba(0,0,0,0.35)",
              backdropFilter: "blur(20px)",
              border: `1px solid ${isActive ? "rgba(0,191,255,0.55)" : "rgba(255,255,255,0.1)"}`,
              boxShadow: isActive ? "0 4px 20px rgba(0,191,255,0.18)" : "none",
              borderRadius: 3,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              transition: "all 0.2s",
              "&:hover": {
                transform: "translateY(-2px)",
                bgcolor: isActive ? "rgba(0,191,255,0.18)" : "rgba(255,255,255,0.04)",
                borderColor: isActive ? "rgba(0,191,255,0.8)" : "rgba(255,255,255,0.25)",
              },
            }}
          >
            {/* Name row */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflow: "hidden" }}>
                <Typography variant="subtitle2" sx={{
                  color: "#fff", fontWeight: 700,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {file.name}
                </Typography>
                {isFirst && (
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#00BFFF", boxShadow: "0 0 6px #00BFFF", flexShrink: 0 }} />
                )}
              </Box>
              <Chip
                size="small"
                icon={<ExpandMoreRoundedIcon sx={{ fontSize: "0.9rem", color: "inherit !important" }} />}
                label="履歴"
                sx={{
                  height: 20, fontSize: "0.62rem", fontWeight: 700,
                  bgcolor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  "& .MuiChip-icon": { ml: "4px" },
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)", color: "#fff" },
                }}
              />
            </Box>

            {/* Meta row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                更新: {updatedStr}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)", fontWeight: 700, fontSize: "0.6rem" }}>
                Cloud
              </Typography>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                sx={{
                  flex: 1, py: 0.7, borderRadius: 2,
                  borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)",
                  fontWeight: 700, fontSize: "0.75rem", textTransform: "none",
                  "&:hover": { borderColor: "rgba(255,255,255,0.5)", color: "#fff", bgcolor: "rgba(255,255,255,0.05)" },
                }}
              >
                プレビュー
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={!file.storagePath || downloading === file.id}
                startIcon={downloading === file.id ? <CircularProgress size={12} color="inherit" /> : <DownloadRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={(e) => handleDownload(e, file)}
                sx={{
                  flex: 1, py: 0.7, borderRadius: 2,
                  bgcolor: isActive ? "#00BFFF" : "rgba(255,255,255,0.1)",
                  color: isActive ? "#000" : "#fff",
                  fontWeight: 800, fontSize: "0.75rem", textTransform: "none",
                  boxShadow: isActive ? "0 4px 12px rgba(0,191,255,0.3)" : "none",
                  "&:hover": { bgcolor: isActive ? "#4facfe" : "rgba(255,255,255,0.2)" },
                  "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" },
                }}
              >
                {downloading === file.id ? "ダウンロード中..." : "最新版を開く"}
              </Button>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}

/* ─── Extra-section placeholder ────────────────────────────── */
function ExtraTabPlaceholder({ activeTab, projectId, navigate }) {
  const labels = {
    models: "S.Models", drawings: "S.Layout",
    slides: "S.Presentations", movies: "S.Presentations",
    renders: "Renders", articles: "Articles", create: "Create",
  };
  return (
    <Box sx={{ flex: 1, minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, px: 4 }}>
      <AutoAwesomeRoundedIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.15)", mb: 1 }} />
      <Typography variant="h5" sx={{ color: "#fff", fontWeight: 800, textAlign: "center" }}>
        {labels[activeTab] ?? activeTab}
      </Typography>
      <Typography sx={{ color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 480, lineHeight: 1.7 }}>
        このセクションのWebコンテンツは現在準備中です。
      </Typography>
      <Button
        variant="contained"
        onClick={() => {
          if (activeTab === "models")        navigate(`/app/share/dashboard?projectId=${projectId}`);
          else if (activeTab === "drawings") navigate(`/app/layout/dashboard?projectId=${projectId}`);
          else                               navigate(`/app/presents/dashboard?projectId=${projectId}`);
        }}
        sx={{ bgcolor: "#00BFFF", color: "#000", fontWeight: 700, px: 4, py: 1.5, borderRadius: 8, textTransform: "none", mt: 1, "&:hover": { opacity: 0.88 } }}
      >
        {labels[activeTab] ?? activeTab} を開く
      </Button>
    </Box>
  );
}
