// src/pages/HomePage.jsx
import React, { useMemo, useState, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Stack,
  Tooltip,
  Button,
  Chip,
  Divider,
  IconButton,
  ButtonBase,
  useMediaQuery,
} from "@mui/material";

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";

import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import SlideshowRoundedIcon from "@mui/icons-material/SlideshowRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import FolderSharedRoundedIcon from "@mui/icons-material/FolderSharedRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";

import sharePng from "@/assets/icons/share.png";
import layoutPng from "@/assets/icons/layout.png";
import presentsPng from "@/assets/icons/presents.png";
import questPng from "@/assets/icons/quest.png";

import SearchBar from "@/features/search/components/SearchBar";
import { BRAND } from "../shared/ui/theme";
import ToolCircle from "../shared/ui/ToolCircle";
import LeftSidebar from "../shared/layout/LeftSidebar";
import BottomBar from "../shared/layout/BottomBar";
import TopRightMenu from "../shared/layout/TopRightMenu";
import DrivePage from "@/features/drive/DrivePage";

function normalizeOrigin(origin) {
  if (!origin) return "";
  return String(origin).replace(/\/+$/, "");
}

function isAbsoluteUrl(s) {
  return /^https?:\/\//i.test(String(s || ""));
}

const ProjectView = ({ project, onClose }) => {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", animation: "fadeIn 0.3s ease-in-out", "@keyframes fadeIn": { from: { opacity: 0 }, to: { opacity: 1 } } }}>
      <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel }}>
        <IconButton onClick={onClose} sx={{ mr: 2 }}>
          <ArrowBackRoundedIcon sx={{ color: "rgba(255,255,255,0.8)" }} />
        </IconButton>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1, color: "rgba(255,255,255,0.9)" }}>
          {project.name}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: "hidden" }}>
        <DrivePage projectId={project.id} />
      </Box>
    </Box>
  );
};

export default function HomePage() {
  const [q, setQ] = useState("");
  const [activeView, setActiveView] = useState("home");
  const [selectedProject, setSelectedProject] = useState(null);

  const handleSelectTab = useCallback((tab) => {
    setActiveView(tab);
    if (tab !== "project") setSelectedProject(null);
  }, []);

  const handleSelectProject = useCallback((project) => {
    setSelectedProject(project);
    setActiveView("project");
  }, []);

  const navigate = useNavigate();

  const { user } = useAuth();

  // ✅ xs では左サイドバーをボトムバーに切替
  const isMobile = useMediaQuery("(max-width:600px)");

  // ✅ ローカルは別ポート運用（5174/5175）、本番は /app/... 運用
  const isDev = import.meta.env.DEV;
  const ORIGIN_3DSS = normalizeOrigin(import.meta.env.VITE_3DSS_ORIGIN);
  const ORIGIN_3DSL = normalizeOrigin(import.meta.env.VITE_3DSL_ORIGIN);
  const ORIGIN_3DSP = normalizeOrigin(import.meta.env.VITE_3DSP_ORIGIN);

  // ✅ ローカルでも本番と同じパスで統一する（Auth統一のため）
  // - 5173 でアクセスし、Vite proxy が 5174/5175 に流す
  const tools = useMemo(
    () => [
      {
        key: "3dss",
        label: "3D Shape Share",
        sub: "クラウドストレージ",
        icon: <img src={sharePng} alt="3DSS" style={{ width: 48, height: 48, borderRadius: "50%" }} />,
        href: user ? "/app/share/dashboard" : "/app/share/",
        badge: "開発中",
      },
      {
        key: "3dsl",
        label: "3D Shape Layout",
        sub: "レイアウト / 配置",
        icon: <img src={layoutPng} alt="3DSL" style={{ width: 48, height: 48, borderRadius: "50%" }} />,
        href: user ? "/app/layout/dashboard" : "/app/layout/",
        badge: "開発中",
      },
      {
        key: "3dsp",
        label: "3D Shape Presents",
        sub: "プレゼン / 資料作成",
        icon: <img src={presentsPng} alt="3DSP" style={{ width: 48, height: 48, borderRadius: "50%" }} />,
        href: "/app/presents/", // Presentsはまだダッシュボードがない想定
        badge: "開発予定",
      },
      {
        key: "3dsq",
        label: "3D Shape Quest",
        sub: "探求 / クエスト",
        icon: <img src={questPng} alt="3DSQ" style={{ width: 48, height: 48, borderRadius: "50%" }} />,
        href: "/app/quest/", // Quest用のダッシュボード等は今後実装
        badge: "開発予定",
      },
    ],
    [user]
  );

  // ✅ ここを true にすると「ツールはログイン必須」運用に切替できる
  const requireAuthForTools = false;

  const openTool = useCallback(
    (tool) => {
      if (!tool?.href) return;

      // ✅ ログイン必須運用の場合：未ログインならログインへ
      if (requireAuthForTools && !user) {
        window.location.assign(
          `/login?return_to=${encodeURIComponent(tool.href)}`
        );
        return;
      }

      // ✅ 常に別タブで開く
      window.open(tool.href, "_blank");
    },
    [navigate, user, requireAuthForTools]
  );

  const submit = useCallback(
    (e) => {
      e.preventDefault();
      const query = q.trim();
      if (!query) return;
      console.log("[SEKKEIYA] query:", query);
    },
    [q]
  );

  // ✅ モバイル時は下にボトムバーが来るので padding を確保
  const mobileBottomSafe = isMobile ? 84 : 0;

  return (
    <Box
      sx={{
        height: "100vh",
        overflow: "hidden",
        bgcolor: BRAND.bg,
        color: BRAND.text,
        display: "flex",
        backgroundImage:
          "radial-gradient(60% 50% at 50% 35%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.00) 55%)",
      }}
    >
      {/* ===== Left Sidebar (Desktop) / Bottom Bar (Mobile) ===== */}
      {isMobile ? <BottomBar /> : <LeftSidebar onSelectProject={handleSelectProject} activeTab={activeView} onSelectTab={handleSelectTab} />}

      {/* ===== Main ===== */}
      <Box sx={{ flex: 1, position: "relative", overflowY: "auto", pb: `${mobileBottomSafe}px` }}>
        {/* Right top buttons & Dialog */}
        <TopRightMenu 
          user={user} 
          onDashboardClick={() => openTool({ href: tools.find((t) => t.key === "3dss")?.href })} 
        />

        {activeView === "project" && selectedProject ? (
          <ProjectView project={selectedProject} onClose={() => handleSelectTab("home")} />
        ) : activeView === "drive" ? (
          <Box sx={{ height: "100%", display: "flex", flexDirection: "column", animation: "fadeIn 0.3s ease-in-out" }}>
            <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: "rgba(255,255,255,0.9)", ml: 2, letterSpacing: 0.5 }}>AIドライブ（全プロジェクト）</Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: "hidden" }}>
              <DrivePage />
            </Box>
          </Box>
        ) : (
          <Container
          maxWidth="md"
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pt: { xs: 10, sm: 0 },
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 860,
              transform: { xs: "translateY(-18px)", sm: "translateY(-42px)" },
              px: { xs: 1, sm: 0 },
            }}
          >
            <Stack spacing={{ xs: 1.8, sm: 2.25 }} alignItems="center">
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 850,
                  letterSpacing: 0.2,
                  textAlign: "center",
                  fontSize: { xs: 30, sm: 40 },
                  lineHeight: 1.05,
                }}
              >
                SEKKEIYA
              </Typography>

              <Typography
                sx={{
                  opacity: 0.75,
                  textAlign: "center",
                  lineHeight: 1.7,
                  fontSize: { xs: 13, sm: 14.5 },
                }}
              >
                3Dモデル管理、レイアウト、パース、動画、プレゼン、見積もり
                <br />
                設計に必要なすべてを内包し、会話するだけで成長し最適解を導くAI設計ワークスペース
              </Typography>

              {/* Input */}
              <SearchBar q={q} setQ={setQ} onSubmit={submit} brand={BRAND} />

              {/* Tools */}
              <Stack
                direction="row"
                spacing={{ xs: 2.2, sm: 3.25 }}
                sx={{
                  pt: { xs: 1.2, sm: 1.75 },
                  flexWrap: "wrap",
                  justifyContent: "center",
                  rowGap: { xs: 2, sm: 2.25 },
                }}
              >
                {tools.map((t) => (
                  <ToolCircle key={t.key} tool={t} onOpen={() => openTool(t)} />
                ))}
              </Stack>
            </Stack>
          </Box>
        </Container>
        )}
      </Box>
    </Box>
  );
}

