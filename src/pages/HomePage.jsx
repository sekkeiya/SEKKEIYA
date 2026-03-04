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
import { signOut } from "firebase/auth";
import { auth } from "@/shared/config/firebase";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";

import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import SlideshowRoundedIcon from "@mui/icons-material/SlideshowRounded";

import SearchBar from "@/features/search/components/SearchBar";

const BRAND = {
  bg: "#0b0f16",
  panel: "rgba(255,255,255,0.07)",
  panel2: "rgba(255,255,255,0.09)",
  line: "rgba(255,255,255,0.12)",
  line2: "rgba(255,255,255,0.18)",
  text: "rgba(255,255,255,0.92)",
  sub: "rgba(255,255,255,0.68)",
  sub2: "rgba(255,255,255,0.52)",
  glow: "rgba(255,255,255,0.14)",
};

function normalizeOrigin(origin) {
  if (!origin) return "";
  return String(origin).replace(/\/+$/, "");
}

function isAbsoluteUrl(s) {
  return /^https?:\/\//i.test(String(s || ""));
}

export default function HomePage() {
  const [q, setQ] = useState("");

  const navigate = useNavigate();

  const { user } = useAuth();

  // ✅ xs では左サイドバーをボトムバーに切替
  const isMobile = useMediaQuery("(max-width:600px)");



  const loginUrl = "https://sekkeiya.com/login?return_to=%2Fdashboard";
  const signupUrl = "https://sekkeiya.com/signup?return_to=%2Fdashboard";

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
        icon: <CloudRoundedIcon />,
        href: "/app/share/",
        badge: "開発中",
      },
      {
        key: "3dsl",
        label: "3D Shape Layout",
        sub: "レイアウト / 配置",
        icon: <ViewInArRoundedIcon />,
        href: "/app/layout/",
        badge: "開発中",
      },
      {
        key: "3dsp",
        label: "3D Shape Presents",
        sub: "プレゼン / 資料作成",
        icon: <SlideshowRoundedIcon />,
        href: "/app/presents/",
        badge: "開発予定",
      },
    ],
    []
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

      // ✅ /app/... は別SPA（proxy or Hosting）なのでフル遷移が安全
      if (tool.href.startsWith("/app/")) {
        window.location.assign(tool.href);
        return;
      }

      // ✅ それ以外は通常の SPA 遷移
      navigate(tool.href);
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

  const onLogout = useCallback(async () => {
    try {
      await signOut(auth);
      window.location.assign("/");
    } catch (e) {
      console.error("[HomePage] signOut failed:", e);
      window.location.assign("/");
    }
  }, []);

  // ✅ モバイル時は下にボトムバーが来るので padding を確保
  const mobileBottomSafe = isMobile ? 84 : 0;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: BRAND.bg,
        color: BRAND.text,
        display: "flex",
        backgroundImage:
          "radial-gradient(60% 50% at 50% 35%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.00) 55%)",
        pb: `${mobileBottomSafe}px`,
      }}
    >
      {/* ===== Left Sidebar (Desktop) / Bottom Bar (Mobile) ===== */}
      {isMobile ? <BottomBar /> : <LeftSidebar />}

      {/* ===== Main ===== */}
      <Box sx={{ flex: 1, position: "relative" }}>
        {/* Right top buttons */}
        <Box
          sx={{
            position: "absolute",
            top: { xs: 10, sm: 16 },
            right: { xs: 10, sm: 16 },
            display: "flex",
            gap: 1,
            zIndex: 20,
          }}
        >
          {user ? (
            <>
              <Button
                variant="outlined"
                size="small"
                onClick={() => openTool({ href: tools.find((t) => t.key === "3dss")?.href })}
                sx={{
                  color: BRAND.text,
                  borderColor: BRAND.line,
                  bgcolor: "rgba(255,255,255,0.04)",
                  borderRadius: 999,
                  px: { xs: 1.4, sm: 2 },
                  minWidth: 0,
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.08)",
                    borderColor: BRAND.line,
                  },
                }}
              >
                ダッシュボード
              </Button>

              <Button
                variant="contained"
                size="small"
                onClick={onLogout}
                sx={{
                  color: "#0b0f16",
                  bgcolor: "rgba(255,255,255,0.88)",
                  borderRadius: 999,
                  px: { xs: 1.4, sm: 2 },
                  minWidth: 0,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.95)" },
                }}
              >
                ログアウト
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                size="small"
                onClick={() => window.location.assign(loginUrl)}
                sx={{
                  color: BRAND.text,
                  borderColor: BRAND.line,
                  bgcolor: "rgba(255,255,255,0.04)",
                  borderRadius: 999,
                  px: { xs: 1.4, sm: 2 },
                  minWidth: 0,
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.08)",
                    borderColor: BRAND.line,
                  },
                }}
              >
                サインイン
              </Button>

              <Button
                variant="contained"
                size="small"
                onClick={() => window.location.assign(signupUrl)}
                sx={{
                  color: "#0b0f16",
                  bgcolor: "rgba(255,255,255,0.88)",
                  borderRadius: 999,
                  px: { xs: 1.4, sm: 2 },
                  minWidth: 0,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.95)" },
                }}
              >
                サインアップ
              </Button>
            </>
          )}
        </Box>

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
                レイアウト、3D、パース、動画、資料、見積もり。
                <br />
                設計に必要なすべてを内包し、会話するだけで最適解を導くAI設計ワークスペース。
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
      </Box>
    </Box>
  );

  // ===== Desktop Left Sidebar =====
  function LeftSidebar() {
    return (
      <Box
        sx={{
          width: 72,
          borderRight: `1px solid ${BRAND.line}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          py: 1.75,
          gap: 1,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            bgcolor: BRAND.panel2,
            border: `1px solid ${BRAND.line}`,
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            letterSpacing: 0.3,
            fontSize: 14,
          }}
        >
          S
        </Box>

        <Tooltip title="New" placement="right">
          <IconButton
            sx={{
              mt: 0.25,
              width: 42,
              height: 42,
              bgcolor: BRAND.panel,
              border: `1px solid ${BRAND.line}`,
              "&:hover": { bgcolor: "rgba(255,255,255,0.11)" },
            }}
          >
            <AddRoundedIcon sx={{ color: BRAND.text }} />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: "60%", opacity: 0.25, my: 0.5 }} />

        <NavIcon icon={<HomeRoundedIcon />} label="ホーム" active />
        <NavIcon icon={<HubRoundedIcon />} label="ハブ" />
        <NavIcon icon={<FolderRoundedIcon />} label="AIドライブ" />

        <Box sx={{ flex: 1 }} />

        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            bgcolor: "rgba(0, 180, 255, 0.18)",
            border: `1px solid rgba(0, 180, 255, 0.32)`,
            mb: 1,
          }}
        />
      </Box>
    );
  }

  // ===== Mobile Bottom Bar =====
  function BottomBar() {
    return (
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 72,
          borderTop: `1px solid ${BRAND.line}`,
          bgcolor: "rgba(11,15,22,0.72)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 10,
          px: 1,
        }}
      >
        <BottomIcon icon={<HomeRoundedIcon />} label="ホーム" active />
        <BottomIcon icon={<HubRoundedIcon />} label="ハブ" />
        <BottomIcon icon={<FolderRoundedIcon />} label="AIドライブ" />

        <Tooltip title="New" placement="top">
          <IconButton
            sx={{
              width: 44,
              height: 44,
              bgcolor: BRAND.panel,
              border: `1px solid ${BRAND.line}`,
              "&:hover": { bgcolor: "rgba(255,255,255,0.11)" },
            }}
          >
            <AddRoundedIcon sx={{ color: BRAND.text }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  function BottomIcon({ icon, label, active = false }) {
    return (
      <Tooltip title={label} placement="top">
        <IconButton
          sx={{
            width: 44,
            height: 44,
            color: "rgba(255,255,255,0.85)",
            bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
            border: `1px solid ${
              active ? "rgba(255,255,255,0.16)" : "transparent"
            }`,
            "&:hover": {
              bgcolor: "rgba(255,255,255,0.06)",
              borderColor: "rgba(255,255,255,0.10)",
            },
          }}
        >
          {React.cloneElement(icon, {
            sx: { color: "rgba(255,255,255,0.88)" },
          })}
        </IconButton>
      </Tooltip>
    );
  }
}

function NavIcon({ icon, label, active = false }) {
  return (
    <Tooltip title={label} placement="right">
      <IconButton
        sx={{
          width: 42,
          height: 42,
          color: "rgba(255,255,255,0.85)",
          bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
          border: `1px solid ${
            active ? "rgba(255,255,255,0.16)" : "transparent"
          }`,
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.10)",
          },
        }}
      >
        {React.cloneElement(icon, {
          sx: { color: "rgba(255,255,255,0.86)" },
        })}
      </IconButton>
    </Tooltip>
  );
}

function ToolCircle({ tool, onOpen }) {
  const disabled = !tool?.href;

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") onOpen?.();
  };

  return (
    <Tooltip title={disabled ? "開発予定です" : "開く"} placement="bottom" arrow>
      <Box
        sx={{
          width: { xs: 132, sm: 150 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.8,
          userSelect: "none",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <ButtonBase
          onClick={disabled ? undefined : onOpen}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          focusRipple
          sx={{
            width: "100%",
            borderRadius: 2,
            outline: "none",
            "&:focus-visible .toolCircleBtn": {
              boxShadow: "0 0 0 3px rgba(255,255,255,0.18)",
            },
          }}
        >
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.8,
              cursor: disabled ? "not-allowed" : "pointer",
              py: 0.5,
            }}
          >
            <Box
              className="toolCircleBtn"
              sx={{
                mt: { xs: 2.2, sm: 3 },
                width: 54,
                height: 54,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                transition:
                  "transform 140ms ease, background 140ms ease, box-shadow 140ms ease",
                ...(disabled
                  ? {}
                  : {
                      "&:hover": {
                        transform: "translateY(-2px)",
                        bgcolor: "rgba(255,255,255,0.11)",
                      },
                      "&:active": {
                        transform: "translateY(0px) scale(0.98)",
                      },
                    }),
              }}
            >
              {React.cloneElement(tool.icon, {
                sx: { color: "rgba(255,255,255,0.9)" },
              })}
            </Box>

            <Typography
              variant="caption"
              sx={{
                fontWeight: 850,
                textAlign: "center",
                lineHeight: 1.15,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: 28,
              }}
            >
              {tool.label}
            </Typography>

            <Typography
              variant="caption"
              sx={{
                opacity: 0.65,
                mt: -1.5,
                textAlign: "center",
                lineHeight: 1.15,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: 28,
              }}
            >
              {tool.sub}
            </Typography>

            <Chip
              size="small"
              label={tool.badge}
              variant="outlined"
              sx={{
                height: 20,
                fontSize: 11,
                px: 0.25,
                mt: -1.15,
                color: "rgba(255,255,255,0.78)",
                borderColor: "rgba(255,255,255,0.18)",
                bgcolor: "rgba(255,255,255,0.03)",
              }}
            />
          </Box>
        </ButtonBase>
      </Box>
    </Tooltip>
  );
}