import React, { useState, useEffect, useRef } from "react";
import { Box, Container, Typography, Stack, Grid, Card, CardContent, Button, Menu, MenuItem, Divider, Chip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import WindowIcon from "@mui/icons-material/Window";
import AppleIcon from "@mui/icons-material/Apple";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import DownloadIcon from "@mui/icons-material/Download";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import StorageIcon from "@mui/icons-material/Storage";
import SyncIcon from "@mui/icons-material/Sync";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import SpeedIcon from "@mui/icons-material/Speed";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import WeekendOutlinedIcon from "@mui/icons-material/WeekendOutlined";
import TableBarOutlinedIcon from "@mui/icons-material/TableBarOutlined";
import ChairOutlinedIcon from "@mui/icons-material/ChairOutlined";
import DeckOutlinedIcon from "@mui/icons-material/DeckOutlined";
import LocalFloristOutlinedIcon from "@mui/icons-material/LocalFloristOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { BRAND } from "@/shared/ui/theme";
import BackgroundTypography from "./BackgroundTypography";
import { SEO } from "@/shared/components/seo/SEO";
import { SchemaTypes } from "@/shared/components/seo/SchemaTypes";
import PublicModelGallery from "@/pages/gallery/PublicModelGallery";
import DonationSection from "@/components/donation/DonationSection";
import { useAuth } from "@/features/auth/context/AuthContext";
import { usePwaInstall } from "@/shared/pwa/PwaInstallProvider";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/shared/config/firebase";
import CircularProgress from "@mui/material/CircularProgress";

const RELEASES = [
  {
    version: "0.1.10",
    label: "β 0.1.10",
    tag: "Latest",
    date: "2026-07-03",
    note: "S.Blog: 新ホーム＝建築メディアの記事フィード。読みながらAIと議論→記事生成",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.10_x64-setup.exe?alt=media",
    os: "Windows",
  },
  {
    version: "0.1.9",
    label: "β 0.1.9",
    tag: null,
    date: "2026-07-03",
    note: "S.Blog: おすすめ建築・インテリアメディアから題材選び・S.Library保存",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.9_x64-setup.exe?alt=media",
    os: "Windows",
  },
  {
    version: "0.1.8",
    label: "β 0.1.8",
    tag: null,
    date: "2026-07-02",
    note: "S.Blog: ✨デザイン一括適用＋🎨スタイル設定・公開記事をsekkeiya.comにも掲載",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.8_x64-setup.exe?alt=media",
    os: "Windows",
  },
  {
    version: "0.1.7",
    label: "β 0.1.7",
    tag: null,
    date: "2026-07-02",
    note: "S.Blog: Web記事を題材にAIと議論して書く・テーマAI提案・図解/AI画像挿入",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.7_x64-setup.exe?alt=media",
    os: "Windows",
  },
  {
    version: "0.1.6",
    label: "β 0.1.6",
    tag: null,
    date: "2026-07-02",
    note: "S.Blog「AIと議論して書く」追加・AI記者の取材通知・安定性改善",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.6_x64-setup.exe?alt=media",
    os: "Windows",
  },
  {
    version: "0.1.3",
    label: "β 0.1.3",
    tag: null,
    date: "2025-06-01",
    note: "安定性とパフォーマンス改善",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.3_x64-setup.exe?alt=media&token=b6ec4056-f76e-4c67-8b37-37b3967a71f8",
    os: "Windows",
  },
  {
    version: "0.1.2",
    label: "β 0.1.2",
    tag: null,
    date: "2025-05-31",
    note: "機能追加・不具合修正",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.2_x64-setup.exe?alt=media&token=34e5b0d0-f50a-4786-8ca9-24d36b81d787",
    os: "Windows",
  },
  {
    version: "0.1.1",
    label: "β 0.1.1",
    tag: null,
    date: "2025-05-30",
    note: "AI Drive 安定化・S.Models 連携改善",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.1_x64-setup.exe?alt=media&token=7f46f7c3-a4a5-44a6-a7c1-1fda825d341f",
    os: "Windows",
  },
  {
    version: "0.1.0",
    label: "β 0.1.0",
    tag: null,
    date: "2025-05-23",
    note: "初回ベータリリース",
    url: "https://firebasestorage.googleapis.com/v0/b/shapeshare3d.firebasestorage.app/o/installers%2FSEKKEIYA%20Desktop_0.1.0_x64-setup.exe?alt=media&token=2a509734-47a0-4bc9-b809-61571a750114",
    os: "Windows",
  },
];

// macOS 版（GitHub Releases で公開・未署名 Intel x64 ビルド）
const MAC_RELEASES = [
  {
    version: "0.1.3",
    label: "β 0.1.3",
    tag: "Latest",
    date: "2025-06-01",
    note: "Intel Mac 向け・未署名ビルド",
    url: "https://github.com/sekkeiya/sekkeiya-desktop-releases/releases/download/v0.1.3/SEKKEIYA-Desktop_0.1.3_x64.dmg",
    os: "macOS",
    arch: "Intel x64",
  },
];

const DOWNLOAD_URLS = {
  windows: RELEASES[0].url,
  mac: MAC_RELEASES[0].url,
};
const VERSION = "0.1.10 Beta";

const PURPLE       = "#7C3AED";
const PURPLE_SOFT  = "rgba(124,58,237,0.12)";
const PURPLE_GLOW  = "rgba(124,58,237,0.22)";
const GRAD_PRIMARY = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";
const GRAD_TEXT    = "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)";

// ── Helper components ──────────────────────────────────────────────────────────

const FadeInSlide = ({ children, delay = 0, direction = "up" }) => {
  const init = { up: { opacity: 0, y: 40 }, down: { opacity: 0, y: -40 }, left: { opacity: 0, x: 40 }, right: { opacity: 0, x: -40 } };
  return (
    <motion.div initial={init[direction]} whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
};

const SectionBadge = ({ text }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mb: 3,
    px: 2, py: 0.6, borderRadius: "100px",
    border: "1px solid rgba(124,58,237,0.35)", bgcolor: PURPLE_SOFT }}>
    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: PURPLE, flexShrink: 0 }} />
    <Typography sx={{ color: "#A78BFA", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "monospace" }}>
      {text}
    </Typography>
  </Box>
);

const GradText = ({ children }) => (
  <Box component="span" sx={{ background: GRAD_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
    {children}
  </Box>
);

// ── CyclingText ────────────────────────────────────────────────────────────────
const CYCLE_PHRASES = [
  "AIが設計プロセスを組み立てる",
  "設計者は、考えることに専念する",
  "可能性の全域を、ひとりの設計者に",
  "操作から対話へ。ツールからOSへ。",
];

const CyclingText = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % CYCLE_PHRASES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box sx={{ height: 32, overflow: "hidden", position: "relative" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: "absolute", width: "100%" }}
        >
          <Typography sx={{
            fontSize: { xs: "0.9rem", md: "1rem" },
            fontWeight: 600,
            color: "#A78BFA",
            letterSpacing: "0.01em",
            fontFamily: "monospace",
          }}>
            — {CYCLE_PHRASES[index]}
          </Typography>
        </motion.div>
      </AnimatePresence>
    </Box>
  );
};

// ── AnimatedCounter ────────────────────────────────────────────────────────────
const AnimatedCounter = ({ target, duration = 1800, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  );
};

// ── FlowDiagram ────────────────────────────────────────────────────────────────
const FLOW_STEPS = [
  { label: "Rhino",           sub: "躯体モデリング",        color: "#7C3AED" },
  { label: "S.Layout",        sub: "家具配置・空間検討",     color: "#2563EB" },
  { label: "AI レンダリング", sub: "空間の可視化",           color: "#0EA5E9" },
  { label: "S.Diagram",       sub: "設計根拠を図解",         color: "#10B981" },
  { label: "S.Presentations", sub: "プレゼン完成",           color: "#22C55E" },
];

const FlowDiagram = () => {
  const [activeStep, setActiveStep] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-100px" });

  useEffect(() => {
    if (!inView) return;
    const timer = setInterval(() => {
      setActiveStep(prev => (prev + 1) % FLOW_STEPS.length);
    }, 1600);
    return () => clearInterval(timer);
  }, [inView]);

  return (
    <Box ref={ref} sx={{ width: "100%", py: { xs: 3, md: 4 } }}>
      {/* Desktop: horizontal */}
      <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", justifyContent: "center", gap: 0 }}>
        {FLOW_STEPS.map((step, i) => (
          <React.Fragment key={i}>
            <motion.div
              animate={{
                scale: activeStep === i ? 1.08 : 1,
              }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Box sx={{
                position: "relative",
                px: 3.5, py: 2.5, borderRadius: 3, minWidth: 150, textAlign: "center",
                border: `1px solid ${activeStep === i ? step.color : "rgba(255,255,255,0.08)"}`,
                bgcolor: activeStep === i ? `${step.color}18` : "rgba(255,255,255,0.02)",
                boxShadow: activeStep === i ? `0 0 32px ${step.color}44` : "none",
                transition: "all 0.4s ease",
              }}>
                {activeStep === i && (
                  <Box sx={{ position: "absolute", top: 8, right: 10,
                    width: 7, height: 7, borderRadius: "50%", bgcolor: step.color,
                    boxShadow: `0 0 8px ${step.color}` }} />
                )}
                <Typography sx={{
                  fontWeight: 900, fontSize: "1.1rem", letterSpacing: "-0.02em",
                  color: activeStep === i ? "#fff" : "rgba(255,255,255,0.4)",
                  transition: "color 0.4s",
                }}>
                  {step.label}
                </Typography>
                <Typography sx={{
                  fontSize: "0.72rem", mt: 0.5, fontFamily: "monospace",
                  color: activeStep === i ? step.color : "rgba(255,255,255,0.22)",
                  transition: "color 0.4s",
                }}>
                  {step.sub}
                </Typography>
              </Box>
            </motion.div>

            {i < FLOW_STEPS.length - 1 && (
              <Box sx={{ display: "flex", alignItems: "center", mx: 1 }}>
                <motion.div
                  animate={{
                    opacity: activeStep > i ? 1 : 0.18,
                    x: activeStep > i ? [0, 4, 0] : 0,
                  }}
                  transition={{ duration: 0.8, repeat: activeStep > i ? Infinity : 0 }}
                >
                  <ArrowForwardIcon sx={{
                    fontSize: 20,
                    color: activeStep > i ? FLOW_STEPS[i].color : "rgba(255,255,255,0.15)",
                  }} />
                </motion.div>
              </Box>
            )}
          </React.Fragment>
        ))}
      </Box>

      {/* Mobile: vertical */}
      <Stack spacing={0} sx={{ display: { xs: "flex", md: "none" }, alignItems: "center" }}>
        {FLOW_STEPS.map((step, i) => (
          <React.Fragment key={i}>
            <Box sx={{
              width: "100%", px: 3, py: 2, borderRadius: 2.5, textAlign: "left",
              border: `1px solid ${activeStep === i ? step.color : "rgba(255,255,255,0.08)"}`,
              bgcolor: activeStep === i ? `${step.color}18` : "rgba(255,255,255,0.02)",
              boxShadow: activeStep === i ? `0 0 24px ${step.color}33` : "none",
              transition: "all 0.4s ease",
              display: "flex", alignItems: "center", gap: 2,
            }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: activeStep === i ? step.color : "rgba(255,255,255,0.15)", flexShrink: 0,
                boxShadow: activeStep === i ? `0 0 8px ${step.color}` : "none", transition: "all 0.4s" }} />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: activeStep === i ? "#fff" : "rgba(255,255,255,0.4)", transition: "color 0.4s" }}>
                  {step.label}
                </Typography>
                <Typography sx={{ fontSize: "0.72rem", color: activeStep === i ? step.color : "rgba(255,255,255,0.2)", fontFamily: "monospace", transition: "color 0.4s" }}>
                  {step.sub}
                </Typography>
              </Box>
            </Box>
            {i < FLOW_STEPS.length - 1 && (
              <Box sx={{ width: 1, height: 20, bgcolor: "rgba(255,255,255,0.08)", my: 0.5 }} />
            )}
          </React.Fragment>
        ))}
      </Stack>
    </Box>
  );
};

// ── AppWindowMockup ────────────────────────────────────────────────────────────

const APP_FILES = [
  { name: "exterior.jpg",  img: "/images/demo_assets/exterior.png" },
  { name: "interior.jpg",  img: "/images/demo_assets/interior.png" },
  { name: "model_01.3dm",  img: null, ext: "3DM" },
  { name: "plan_A.dwg",    img: null, ext: "DWG" },
  { name: "render_v3.exr", img: null, ext: "EXR" },
  { name: "section.pdf",   img: null, ext: "PDF" },
];

const AppWindowMockup = () => (
  <Box sx={{ width: "100%", height: "100%", bgcolor: "#0d0d0d", display: "flex", flexDirection: "column", fontFamily: "monospace", borderRadius: "inherit" }}>
    {/* Title bar */}
    <Box sx={{ height: 38, bgcolor: "#141414", display: "flex", alignItems: "center", px: 2, gap: 1.5,
      borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FF5F57" }} />
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FEBC2E" }} />
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#28C840" }} />
      <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: "0.68rem", ml: 2, letterSpacing: "0.04em" }}>
        エクスプローラー — SEKKEIYA (AI Drive)
      </Typography>
    </Box>

    <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Sidebar */}
      <Box sx={{ width: 148, bgcolor: "#0a0a0a", borderRight: "1px solid rgba(255,255,255,0.05)", p: 1.5, flexShrink: 0 }}>
        {[
          { label: "📁  クイックアクセス", indent: false },
          { label: "💎  SEKKEIYA",         indent: false, active: true },
          { label: "Projects",             indent: true },
          { label: "Models",               indent: true, sub: true },
          { label: "Renders",              indent: true, sub: true },
          { label: "🖥  PC",               indent: false },
          { label: "OneDrive",             indent: false },
        ].map((item, i) => (
          <Box key={i} sx={{
            py: 0.65, px: item.indent ? 2 : 1, borderRadius: 1, mb: 0.2,
            bgcolor: item.active ? PURPLE_SOFT : "transparent",
            color: item.active ? "#A78BFA" : item.sub ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.35)",
            fontSize: item.sub ? "0.64rem" : "0.7rem",
            display: "flex", alignItems: "center", gap: 0.8,
          }}>
            {item.active && <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: PURPLE, flexShrink: 0 }} />}
            {item.label}
          </Box>
        ))}
      </Box>

      {/* Main area */}
      <Box sx={{ flex: 1, p: 1.5, display: "flex", flexDirection: "column", gap: 1.5, overflow: "hidden" }}>
        {/* Path bar */}
        <Box sx={{ height: 26, bgcolor: "rgba(255,255,255,0.04)", borderRadius: 1, border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", px: 1.5, flexShrink: 0 }}>
          <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>
            SEKKEIYA (AI Drive) › Projects › 青山カフェ
          </Typography>
        </Box>

        {/* File grid */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, flex: 1 }}>
          {APP_FILES.map((file, i) => (
            <Box key={i} sx={{ borderRadius: 1.5, overflow: "hidden",
              border: `1px solid ${i < 2 ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)"}`,
              bgcolor: "rgba(255,255,255,0.02)", cursor: "default" }}>
              {file.img ? (
                <Box component="img" src={file.img}
                  sx={{ width: "100%", height: 56, objectFit: "cover", display: "block" }} />
              ) : (
                <Box sx={{ height: 56, background: `linear-gradient(135deg, ${PURPLE_SOFT}, rgba(37,99,235,0.06))`,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>{file.ext}</Typography>
                </Box>
              )}
              <Typography sx={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.28)", p: "3px 5px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* AI Drive status bar */}
        <Box sx={{ p: 1.2, bgcolor: PURPLE_SOFT, borderRadius: 1.5, border: "1px solid rgba(124,58,237,0.25)", flexShrink: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
            <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.8, repeat: Infinity }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: PURPLE }} />
            </motion.div>
            <Typography sx={{ fontSize: "0.65rem", color: "#A78BFA" }}>AI Drive — 同期中 · 6 files indexed</Typography>
          </Box>
          <Box sx={{ height: 2, borderRadius: 2, bgcolor: "rgba(124,58,237,0.15)", overflow: "hidden" }}>
            <motion.div animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ height: "100%", width: "50%", background: GRAD_PRIMARY, borderRadius: 2 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  </Box>
);

// ── DialogueMockup ─────────────────────────────────────────────────────────────

const DIALOGUE = [
  { role: "user", text: "カフェラウンジのレイアウトを提案して" },
  { role: "ai",   text: "過去の「青山カフェ」プロジェクトを参照します。南面採光を活かしたソファ配置はいかがでしょうか？", img: true },
  { role: "user", text: "南の壁を取り除いてみて" },
  { role: "ai",   text: "南壁を撤去しました。開口部から自然光が入り、空間が広がります。植栽の追加も検討しますか？" },
  { role: "user", text: "いいね、植栽を追加して" },
  { role: "ai",   text: "壁面グリーンと床置きポットを配置しました。温かみのある空間になりましたね。" },
];

const DialogueMockup = () => {
  const [shownCount, setShownCount] = useState(0);

  useEffect(() => {
    const delay = shownCount === 0 ? 800 : shownCount >= DIALOGUE.length ? 3000 : 2000;
    const timer = setTimeout(() => {
      setShownCount(prev => (prev >= DIALOGUE.length ? 0 : prev + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [shownCount]);

  const visible  = DIALOGUE.slice(0, shownCount);
  const nextIsAi = shownCount < DIALOGUE.length && DIALOGUE[shownCount]?.role === "ai";

  return (
    <Box sx={{ width: "100%", height: "100%", bgcolor: "#0d0d0d", display: "flex", flexDirection: "column", borderRadius: "inherit", overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ height: 50, bgcolor: "#141414", display: "flex", alignItems: "center", px: 2.5, gap: 1.5,
        borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "50%", background: GRAD_PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Typography sx={{ fontSize: "0.58rem", fontWeight: 900, color: "#fff" }}>AI</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>SEKKEIYA AI</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#28C840" }} />
            <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)" }}>オンライン · 思考パートナー</Typography>
          </Box>
        </Box>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, p: 2, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1.8,
        "&::-webkit-scrollbar": { display: "none" } }}>
        <AnimatePresence>
          {visible.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}>
              <Box sx={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 1 }}>
                {msg.role === "ai" && (
                  <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: GRAD_PRIMARY, flexShrink: 0, mt: 0.4,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography sx={{ fontSize: "0.48rem", fontWeight: 900, color: "#fff" }}>AI</Typography>
                  </Box>
                )}
                <Box sx={{ maxWidth: "78%" }}>
                  {msg.img && (
                    <Box component="img" src="/images/demo_assets/interior.png"
                      sx={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 1.5, mb: 0.8, display: "block",
                        border: "1px solid rgba(255,255,255,0.08)" }} />
                  )}
                  <Box sx={{
                    px: 1.8, py: 1.1,
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    bgcolor:  msg.role === "user" ? PURPLE_SOFT : "rgba(255,255,255,0.06)",
                    border: `1px solid ${msg.role === "user" ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.07)"}`,
                  }}>
                    <Typography sx={{ fontSize: "0.76rem", lineHeight: 1.65,
                      color: msg.role === "user" ? "#A78BFA" : "rgba(255,255,255,0.85)" }}>
                      {msg.text}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </motion.div>
          ))}

          {shownCount > 0 && shownCount < DIALOGUE.length && nextIsAi && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: GRAD_PRIMARY, flexShrink: 0, mt: 0.4,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ fontSize: "0.48rem", fontWeight: 900, color: "#fff" }}>AI</Typography>
                </Box>
                <Box sx={{ px: 1.8, py: 1.1, borderRadius: "14px 14px 14px 4px", bgcolor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 0.6, alignItems: "center" }}>
                  {[0, 1, 2].map(j => (
                    <motion.div key={j} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.55, repeat: Infinity, delay: j * 0.14 }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.35)" }} />
                    </motion.div>
                  ))}
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Input bar */}
      <Box sx={{ px: 2, py: 1.4, bgcolor: "#141414", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 1.5, alignItems: "center", flexShrink: 0 }}>
        <Box sx={{ flex: 1, px: 1.8, py: 0.8, borderRadius: "100px", border: "1px solid rgba(255,255,255,0.07)", bgcolor: "rgba(255,255,255,0.03)" }}>
          <Typography sx={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.18)" }}>
            設計についてなんでも聞いてください...
          </Typography>
        </Box>
        <Box sx={{ width: 26, height: 26, borderRadius: "50%", background: GRAD_PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Typography sx={{ fontSize: "0.65rem", color: "#fff" }}>↑</Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ── WorkflowDemo ──────────────────────────────────────────────────────────────
// 4フェーズ自動再生: AI対話 → 空間レイアウト → AIレンダリング → 提案資料

const WFLOW_PHASES = [
  { key: "chat",    label: "AI 対話",        badge: "01", color: "#7C3AED" },
  { key: "layout",  label: "空間レイアウト",  badge: "02", color: "#2563EB" },
  { key: "render",  label: "AI レンダリング", badge: "03", color: "#0EA5E9" },
  { key: "present", label: "提案資料完成",    badge: "04", color: "#10B981" },
];
const PHASE_MS = 4800;

const ChatPhase = () => {
  const msgs = [
    { role: "user", text: "カフェラウンジのレイアウトを提案して" },
    { role: "ai",   text: "了解です。過去プロジェクトを参照し南面採光プランを提案します。", img: true },
    { role: "user", text: "南の壁を取り除いてみて" },
    { role: "ai",   text: "壁を撤去しました。開放的な空間になりました。" },
    { role: "user", text: "席数はどのくらい確保できる？" },
    { role: "ai",   text: "現プランで32席です。回遊動線を保ったまま最大40席まで拡張できます。" },
    { role: "user", text: "いいね、この方向で進めよう" },
    { role: "ai",   text: "承知しました。続いて家具の選定に進みます。" },
  ];
  const [shown, setShown] = useState(0);
  const scrollRef = useRef(null);
  useEffect(() => {
    if (shown >= msgs.length) return;
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 240 : 600);
    return () => clearTimeout(t);
  }, [shown]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown]);
  const nextIsAi = shown < msgs.length && msgs[shown]?.role === "ai";
  return (
    <Box ref={scrollRef} sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.4, overflowY: "auto", height: "100%",
      "&::-webkit-scrollbar": { display: "none" }, msOverflowStyle: "none", scrollbarWidth: "none" }}>
      <AnimatePresence initial={false}>
        {msgs.slice(0, shown).map((msg, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}>
            <Box sx={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 1 }}>
              {msg.role === "ai" && (
                <Box sx={{ position: "relative", flexShrink: 0, mt: 0.3 }}>
                  <Box sx={{ position: "absolute", inset: -3, borderRadius: "50%",
                    background: GRAD_PRIMARY, filter: "blur(7px)", opacity: 0.55 }} />
                  <Box sx={{ position: "relative", width: 24, height: 24, borderRadius: "50%", background: GRAD_PRIMARY,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4)" }}>
                    <Typography sx={{ fontSize: "0.46rem", fontWeight: 900, color: "#fff", letterSpacing: "0.04em" }}>AI</Typography>
                  </Box>
                </Box>
              )}
              <Box sx={{ maxWidth: "78%" }}>
                {msg.img && (
                  <Box sx={{ position: "relative", mb: 0.7, borderRadius: "14px", overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
                    <Box component="img" src="/images/demo_assets/interior.png"
                      sx={{ width: "100%", height: 82, objectFit: "cover", display: "block" }} />
                    <Box sx={{ position: "absolute", inset: 0,
                      background: "linear-gradient(to top, rgba(124,58,237,0.25), transparent 60%)" }} />
                    <Box sx={{ position: "absolute", bottom: 5, left: 7, px: 0.9, py: 0.2, borderRadius: "6px",
                      bgcolor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <Typography sx={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>南面採光プラン v1</Typography>
                    </Box>
                  </Box>
                )}
                <Box sx={{ px: 1.6, py: 1,
                  borderRadius: msg.role === "user" ? "16px 16px 5px 16px" : "16px 16px 16px 5px",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(37,99,235,0.16))"
                    : "rgba(255,255,255,0.055)",
                  border: `1px solid ${msg.role === "user" ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.09)"}`,
                  backdropFilter: "blur(8px)",
                  boxShadow: msg.role === "user" ? "0 4px 18px rgba(124,58,237,0.18)" : "0 4px 14px rgba(0,0,0,0.25)" }}>
                  <Typography sx={{ fontSize: "0.74rem", lineHeight: 1.65,
                    color: msg.role === "user" ? "#C4B5FD" : "rgba(255,255,255,0.9)" }}>
                    {msg.text}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </motion.div>
        ))}
        {shown > 0 && shown < msgs.length && nextIsAi && (
          <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: GRAD_PRIMARY, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ fontSize: "0.46rem", fontWeight: 900, color: "#fff" }}>AI</Typography>
              </Box>
              <Box sx={{ px: 1.6, py: 1, borderRadius: "16px 16px 16px 5px", bgcolor: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.09)", display: "flex", gap: 0.6, alignItems: "center" }}>
                {[0, 1, 2].map(j => (
                  <motion.div key={j} animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: j * 0.16 }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#A78BFA" }} />
                  </motion.div>
                ))}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

/* ── Phase 02 — 3DSS 家具ライブラリから使用する家具を選定 ── */
const CATALOG = [
  { Icon: WeekendOutlinedIcon,      name: "2人掛けソファ",     meta: "1400×800",  c: "#8B5CF6", pick: true },
  { Icon: TableBarOutlinedIcon,     name: "ラウンジテーブル",   meta: "Ø900",      c: "#3B82F6", pick: true },
  { Icon: ChairOutlinedIcon,        name: "ダイニングチェア",   meta: "450×500",   c: "#A78BFA", pick: true },
  { Icon: DeckOutlinedIcon,         name: "カウンター什器",     meta: "2400×600",  c: "#06B6D4", pick: false },
  { Icon: LocalFloristOutlinedIcon, name: "観葉植物 L",        meta: "H1600",     c: "#10B981", pick: true },
  { Icon: LightbulbOutlinedIcon,    name: "ペンダント照明",     meta: "Ø350",      c: "#F59E0B", pick: false },
];

const LayoutPhase = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const t = setInterval(() => setStep(s => s + 1), 620);
    return () => clearInterval(t);
  }, []);

  // assign a selection order to the items that get picked
  let pidx = 0;
  const cards = CATALOG.map(c => ({ ...c, pickOrder: c.pick ? pidx++ : null }));
  const totalPicks = CATALOG.filter(c => c.pick).length;
  const selectedCount = Math.min(step, totalPicks);

  return (
    <Box sx={{ position: "relative", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
      background: "radial-gradient(120% 80% at 50% 0%, #181330 0%, #0a0816 55%, #050409 100%)" }}>
      {/* library header */}
      <Box sx={{ px: 2, pt: 1.8, pb: 1.2, display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Box sx={{ width: 22, height: 22, borderRadius: "7px", background: GRAD_PRIMARY,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ViewInArIcon sx={{ fontSize: 14, color: "#fff" }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            S.Models — 家具ライブラリ
          </Typography>
          <Typography sx={{ fontSize: "0.56rem", color: "rgba(255,255,255,0.45)" }}>
            プロジェクトに使用する家具を選定
          </Typography>
        </Box>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.2, py: 0.45, borderRadius: "100px",
          bgcolor: "rgba(124,58,237,0.16)", border: "1px solid rgba(124,58,237,0.4)", flexShrink: 0 }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 12, color: "#A78BFA" }} />
          <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#C4B5FD", whiteSpace: "nowrap" }}>
            選定 {selectedCount} 点
          </Typography>
        </Box>
      </Box>

      {/* catalog grid */}
      <Box sx={{ flex: 1, px: 2, pb: 2, display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 1.1, alignContent: "center" }}>
        {cards.map((c, i) => {
          const selected = c.pick && step > c.pickOrder;
          const Icon = c.Icon;
          return (
            <motion.div key={i}
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.07 }}>
              <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 1, p: 1.1, borderRadius: "13px",
                background: selected
                  ? `linear-gradient(135deg, ${c.c}26, ${c.c}0d)`
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${selected ? c.c : "rgba(255,255,255,0.08)"}`,
                boxShadow: selected ? `0 0 18px ${c.c}55, inset 0 0 12px ${c.c}1a` : "none",
                transition: "background 0.45s ease, border-color 0.45s ease, box-shadow 0.45s ease" }}>
                {/* thumbnail */}
                <Box sx={{ width: 38, height: 38, borderRadius: "10px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  bgcolor: `${c.c}22`, color: c.c,
                  border: `1px solid ${c.c}40` }}>
                  <Icon sx={{ fontSize: 22 }} />
                </Box>
                {/* meta */}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: "#fff",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.name}
                  </Typography>
                  <Typography sx={{ fontSize: "0.54rem", color: "rgba(255,255,255,0.42)" }}>
                    {c.meta} mm
                  </Typography>
                </Box>
                {/* selected check */}
                <AnimatePresence>
                  {selected && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      style={{ position: "absolute", top: -7, right: -7 }}>
                      <Box sx={{ width: 19, height: 19, borderRadius: "50%", bgcolor: "#0a0816",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CheckCircleRoundedIcon sx={{ fontSize: 19, color: c.c }} />
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            </motion.div>
          );
        })}
      </Box>

      {/* status pill */}
      <Box sx={{ position: "absolute", bottom: "4.5%", left: "50%", transform: "translateX(-50%)",
        display: "inline-flex", alignItems: "center", gap: 1, px: 1.6, py: 0.6, borderRadius: "100px",
        bgcolor: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%",
          bgcolor: selectedCount >= totalPicks ? "#10B981" : "#A78BFA",
          boxShadow: selectedCount >= totalPicks ? "0 0 8px #10B981" : "0 0 8px #A78BFA" }} />
        <Typography sx={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.78)", fontWeight: 600, whiteSpace: "nowrap" }}>
          {selectedCount >= totalPicks ? "家具選定が完了しました" : "ライブラリから家具を選定中..."}
        </Typography>
      </Box>
    </Box>
  );
};

const RenderPhase = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setProgress(p => Math.min(p + 2.2, 100)), 55);
    return () => clearInterval(t);
  }, []);
  const done = progress >= 99;
  return (
    <Box sx={{ flex: 1, position: "relative", overflow: "hidden", bgcolor: "#050409" }}>
      <Box component="img" src="/images/demo_assets/interior.png"
        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
          filter: done ? "brightness(1) saturate(1.05) blur(0px)" : `brightness(${0.32 + progress * 0.0068}) saturate(${0.4 + progress * 0.006}) blur(${Math.max(0, 14 - progress * 0.15)}px)`,
          transform: done ? "scale(1)" : "scale(1.04)",
          transition: done ? "filter 1s ease, transform 1.2s ease" : "filter 0.05s linear" }} />
      {/* scanning light sweep while rendering */}
      {!done && (
        <motion.div
          animate={{ left: ["-30%", "130%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", top: 0, bottom: 0, width: "26%",
            background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)",
            mixBlendMode: "screen", pointerEvents: "none" }} />
      )}
      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        justifyContent: "flex-end", p: 2, background: done ? "none" : "linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 58%)" }}>
        {!done ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Box sx={{ width: 13, height: 13, borderRadius: "50%",
                  border: "2px solid #A78BFA", borderTopColor: "transparent" }} />
              </motion.div>
              <Typography sx={{ fontSize: "0.74rem", color: "#fff", fontWeight: 700 }}>
                AI レンダリング <Box component="span" sx={{ color: "#A78BFA" }}>{Math.floor(progress)}%</Box>
              </Typography>
            </Box>
            <Box sx={{ height: 4, bgcolor: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${progress}%`, background: GRAD_PRIMARY, borderRadius: 2,
                boxShadow: "0 0 10px rgba(124,58,237,0.7)", transition: "width 0.055s linear" }} />
            </Box>
          </Box>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 1.8, py: 0.7, borderRadius: "100px",
              bgcolor: "rgba(16,185,129,0.22)", border: "1px solid rgba(16,185,129,0.5)", backdropFilter: "blur(10px)",
              boxShadow: "0 6px 20px rgba(16,185,129,0.25)" }}>
              <Typography sx={{ fontSize: "0.74rem", color: "#34D399", fontWeight: 700 }}>✓ フォトリアル レンダリング完成</Typography>
            </Box>
          </motion.div>
        )}
      </Box>
    </Box>
  );
};

/* ── Phase 04 — 提案資料がページ毎に生成され下へスクロールしていく ── */
const SlidePage = ({ children, n }) => (
  <motion.div
    initial={{ opacity: 0, y: 26, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 240, damping: 26 }}>
    <Box sx={{ position: "relative", borderRadius: "12px", overflow: "hidden",
      bgcolor: "#15131f", border: "1px solid rgba(255,255,255,0.09)",
      boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}>
      <Box sx={{ position: "absolute", top: 8, right: 10, px: 0.9, py: 0.15, borderRadius: "5px",
        bgcolor: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <Typography sx={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>{n}</Typography>
      </Box>
      {children}
    </Box>
  </motion.div>
);

const PRESENT_BULLETS = ["南面採光を最大化した開放的レイアウト", "植栽による自然素材のアクセント", "カウンター動線の最適化"];
const PRESENT_FURNITURE = [
  { Icon: WeekendOutlinedIcon, name: "2人掛けソファ ×3", c: "#8B5CF6" },
  { Icon: TableBarOutlinedIcon, name: "ラウンジテーブル ×4", c: "#3B82F6" },
  { Icon: ChairOutlinedIcon, name: "ダイニングチェア ×12", c: "#A78BFA" },
  { Icon: LocalFloristOutlinedIcon, name: "観葉植物 L ×2", c: "#10B981" },
];

const PresentPhase = () => {
  const [step, setStep] = useState(0);
  const scrollRef = useRef(null);
  const TOTAL = 5;
  useEffect(() => {
    setStep(0);
    const t = setInterval(() => setStep(s => Math.min(s + 1, TOTAL + 1)), 760);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [step]);
  const done = step > TOTAL;

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", bgcolor: "#0a0814", overflow: "hidden" }}>
      {/* toolbar */}
      <Box sx={{ height: 34, bgcolor: "rgba(15,13,24,0.8)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", px: 2, gap: 1, flexShrink: 0, zIndex: 2 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: GRAD_PRIMARY }} />
        <Typography sx={{ fontSize: "0.6rem", color: "#A78BFA", fontWeight: 700, letterSpacing: "0.12em" }}>
          S.Presentations — SEKKEIYA PRESENTS
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.1, py: 0.3, borderRadius: "100px",
          bgcolor: done ? "rgba(16,185,129,0.16)" : "rgba(124,58,237,0.15)",
          border: `1px solid ${done ? "rgba(16,185,129,0.4)" : "rgba(124,58,237,0.35)"}` }}>
          {!done && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid #A78BFA", borderTopColor: "transparent" }} />
            </motion.div>
          )}
          <Typography sx={{ fontSize: "0.56rem", color: done ? "#34D399" : "#C4B5FD", fontWeight: 700, whiteSpace: "nowrap" }}>
            {done ? "全 6 ページ完成" : `生成中 ${Math.min(step, TOTAL)} / ${TOTAL}`}
          </Typography>
        </Box>
      </Box>

      {/* scrolling document */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.5,
        "&::-webkit-scrollbar": { display: "none" }, msOverflowStyle: "none", scrollbarWidth: "none" }}>

        {/* cover */}
        {step >= 1 && (
          <SlidePage n="01">
            <Box sx={{ p: 2 }}>
              <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: "#A78BFA", letterSpacing: "0.16em", mb: 0.8 }}>
                DESIGN PROPOSAL / 2026
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                青山カフェラウンジ
              </Typography>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: BRAND.sub, mt: 0.3 }}>
                改装デザイン提案書
              </Typography>
              <Box sx={{ mt: 1.2, width: 56, height: 3, borderRadius: 2, background: GRAD_PRIMARY }} />
            </Box>
          </SlidePage>
        )}

        {/* hero image */}
        {step >= 2 && (
          <SlidePage n="02">
            <Box sx={{ position: "relative" }}>
              <Box component="img" src="/images/demo_assets/interior.png"
                sx={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
              <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,8,20,0.85), transparent 55%)" }} />
              <Typography sx={{ position: "absolute", bottom: 8, left: 12, fontSize: "0.66rem", fontWeight: 700, color: "#fff" }}>
                南面採光を活かした完成イメージ
              </Typography>
            </Box>
          </SlidePage>
        )}

        {/* concept bullets */}
        {step >= 3 && (
          <SlidePage n="03">
            <Box sx={{ p: 2 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: "#fff", mb: 1 }}>設計コンセプト</Typography>
              <Stack spacing={0.9}>
                {PRESENT_BULLETS.map((b, i) => (
                  <Box key={i} sx={{ display: "flex", gap: 0.8, alignItems: "flex-start" }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: "50%", background: GRAD_PRIMARY, flexShrink: 0, mt: "5px" }} />
                    <Typography sx={{ fontSize: "0.66rem", color: BRAND.sub, lineHeight: 1.5 }}>{b}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </SlidePage>
        )}

        {/* furniture list */}
        {step >= 4 && (
          <SlidePage n="04">
            <Box sx={{ p: 2 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: "#fff", mb: 1 }}>家具構成（S.Models 選定）</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.9 }}>
                {PRESENT_FURNITURE.map((f, i) => {
                  const Icon = f.Icon;
                  return (
                    <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.8, p: 0.8, borderRadius: "9px",
                      bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <Box sx={{ width: 24, height: 24, borderRadius: "7px", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${f.c}22`, color: f.c }}>
                        <Icon sx={{ fontSize: 15 }} />
                      </Box>
                      <Typography sx={{ fontSize: "0.58rem", fontWeight: 600, color: "rgba(255,255,255,0.82)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </SlidePage>
        )}

        {/* closing / metrics */}
        {step >= 5 && (
          <SlidePage n="05">
            <Box sx={{ p: 2, display: "flex", gap: 1.5 }}>
              {[{ k: "席数", v: "40" }, { k: "面積", v: "106㎡" }, { k: "工期", v: "6週" }].map((m, i) => (
                <Box key={i} sx={{ flex: 1, textAlign: "center", py: 1, borderRadius: "10px",
                  bgcolor: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 900,
                    background: GRAD_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
                    {m.v}
                  </Typography>
                  <Typography sx={{ fontSize: "0.54rem", color: "rgba(255,255,255,0.5)", mt: 0.4 }}>{m.k}</Typography>
                </Box>
              ))}
            </Box>
          </SlidePage>
        )}

        {/* export complete */}
        {done && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8, px: 1.6, py: 0.6, borderRadius: "100px",
              bgcolor: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.45)",
              boxShadow: "0 6px 20px rgba(16,185,129,0.22)" }}>
              <CheckCircleRoundedIcon sx={{ fontSize: 14, color: "#34D399" }} />
              <Typography sx={{ fontSize: "0.66rem", color: "#34D399", fontWeight: 700 }}>PDF エクスポート完了</Typography>
            </Box>
          </motion.div>
        )}
      </Box>
    </Box>
  );
};

const WorkflowDemo = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase(p => (p + 1) % WFLOW_PHASES.length), PHASE_MS);
    return () => clearInterval(t);
  }, []);
  const cur = WFLOW_PHASES[phase];
  return (
    <Box style={{ backgroundColor: "#0a0814" }} sx={{ position: "relative", width: "100%", height: "100%", bgcolor: "#0a0814", display: "flex",
      flexDirection: "column", overflow: "hidden", borderRadius: "inherit" }}>
      {/* ── Ambient glow that breathes & shifts with the active phase ── */}
      <motion.div
        key={`glow-${phase}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: PHASE_MS / 1000, ease: "easeInOut" }}
        style={{ position: "absolute", inset: "-30%", zIndex: 0, pointerEvents: "none",
          background: `radial-gradient(60% 50% at 70% 18%, ${cur.color}55 0%, transparent 60%)`,
          filter: "blur(40px)" }} />

      {/* Title bar */}
      <Box sx={{ position: "relative", zIndex: 2, height: 46, bgcolor: "rgba(15,13,24,0.72)", backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", px: 2, gap: 2,
        borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <Box sx={{ display: "flex", gap: 0.7, flexShrink: 0 }}>
          {["#FF5F57","#FEBC2E","#28C840"].map(c => (
            <Box key={c} sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: c }} />
          ))}
        </Box>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6 }}>
          {WFLOW_PHASES.map((w, i) => (
            <React.Fragment key={i}>
              <Box sx={{ position: "relative", width: 21, height: 21, borderRadius: "50%",
                background: i <= phase ? cur.color : "rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: i === phase ? `0 0 12px ${cur.color}` : "none",
                transition: "background 0.5s ease, box-shadow 0.5s ease" }}>
                <Typography sx={{ fontSize: "0.5rem", fontWeight: 900,
                  color: i <= phase ? "#fff" : "rgba(255,255,255,0.25)" }}>
                  {w.badge}
                </Typography>
              </Box>
              {i < WFLOW_PHASES.length - 1 && (
                <Box sx={{ width: 22, height: 2, borderRadius: 1, overflow: "hidden", bgcolor: "rgba(255,255,255,0.08)" }}>
                  <Box sx={{ height: "100%", width: i < phase ? "100%" : "0%",
                    bgcolor: cur.color, transition: "width 0.5s ease" }} />
                </Box>
              )}
            </React.Fragment>
          ))}
        </Box>
        <AnimatePresence mode="wait">
          <motion.div key={phase} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
            <Typography sx={{ fontSize: "0.66rem", color: cur.color, fontWeight: 800,
              letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
              {cur.label}
            </Typography>
          </motion.div>
        </AnimatePresence>
      </Box>
      {/* Phase content */}
      <Box sx={{ position: "relative", zIndex: 1, flex: 1, overflow: "hidden" }}>
        <AnimatePresence mode="wait">
          <motion.div key={phase}
            initial={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
            {phase === 0 && <ChatPhase />}
            {phase === 1 && <LayoutPhase />}
            {phase === 2 && <RenderPhase />}
            {phase === 3 && <PresentPhase />}
          </motion.div>
        </AnimatePresence>
      </Box>
      {/* Progress bar */}
      <Box sx={{ position: "relative", zIndex: 2, height: 3, bgcolor: "rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <motion.div key={phase} initial={{ width: "0%" }} animate={{ width: "100%" }}
          transition={{ duration: PHASE_MS / 1000, ease: "linear" }}
          style={{ height: "100%", background: cur.color, boxShadow: `0 0 10px ${cur.color}` }} />
      </Box>
    </Box>
  );
};

// ── DownloadDialog ─────────────────────────────────────────────────────────────
// open, onClose, onDownload(release), onWebApp の4 props を受け取る
// Windows / macOS / iPhone・iPad を3列で表示する美しいモーダル

const gradBtnStatic = {
  background: GRAD_PRIMARY, color: "#fff",
  "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #1D4ED8 100%)", boxShadow: `0 0 32px ${PURPLE_GLOW}` },
};

const PLATFORMS = [
  {
    key: "windows", name: "Windows", sub: "Windows 10 / 11", arch: "x64",
    icon: <WindowIcon sx={{ fontSize: 26, color: "#fff" }} />,
    accent: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
    releases: RELEASES,
    warn: "「WindowsによってPCが保護されました」と出たら「詳細情報」→「実行」",
  },
  {
    key: "macos", name: "macOS", sub: "Intel Mac", arch: "Intel x64",
    icon: <AppleIcon sx={{ fontSize: 26, color: "#fff" }} />,
    accent: "linear-gradient(135deg, #6B7280 0%, #374151 100%)",
    releases: MAC_RELEASES,
    warn: "未署名: .app を右クリック →「開く」。Apple Silicon 版は準備中",
  },
  {
    key: "ios", name: "iPhone / iPad", sub: "iOS / iPadOS",
    icon: <PhoneIphoneIcon sx={{ fontSize: 26, color: "#fff" }} />,
    accent: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
    comingSoon: true,
  },
];

const colV = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

const PlatformColumn = ({ platform, onDownload, onWebApp }) => {
  const [showAll, setShowAll] = React.useState(false);
  const releases = platform.releases || [];
  const latest = releases[0];
  const older = releases.slice(1);

  return (
    <Box component={motion.div} variants={colV}
      sx={{ flex: 1, minWidth: 0, p: { xs: 2.5, md: 3 }, display: "flex", flexDirection: "column", alignItems: "center",
        bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 3,
        transition: "border-color 0.25s, box-shadow 0.25s",
        "&:hover": { borderColor: "rgba(124,58,237,0.4)", boxShadow: `0 0 40px ${PURPLE_SOFT}` } }}>

      {/* Badge */}
      <Box sx={{ width: 54, height: 54, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: platform.accent, boxShadow: "0 6px 24px rgba(0,0,0,0.45)", mb: 1.5 }}>
        {platform.icon}
      </Box>
      <Typography sx={{ fontWeight: 800, color: "#fff", fontSize: "1.05rem" }}>{platform.name}</Typography>
      <Typography sx={{ fontSize: "0.72rem", color: BRAND.sub2, fontFamily: "monospace", mb: 2 }}>{platform.sub}</Typography>

      {platform.comingSoon ? (
        <>
          <Chip label="App Store 準備中" size="small"
            sx={{ fontSize: "0.66rem", height: 22, mb: 2, bgcolor: "rgba(255,255,255,0.05)", color: BRAND.sub2, border: "1px solid rgba(255,255,255,0.12)" }} />
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ width: "100%" }}>
            <Button fullWidth variant="outlined" onClick={onWebApp} endIcon={<OpenInNewIcon />}
              sx={{ borderColor: "rgba(124,58,237,0.5)", color: "#A78BFA", fontWeight: 700, borderRadius: "100px",
                textTransform: "none", py: 1.3, "&:hover": { borderColor: "rgba(124,58,237,0.9)", bgcolor: "rgba(124,58,237,0.08)" } }}>
              ブラウザで使う
            </Button>
          </motion.div>
          <Typography sx={{ fontSize: "0.68rem", color: BRAND.sub2, mt: "auto", pt: 2, textAlign: "center", lineHeight: 1.7 }}>
            iPhone / iPad はブラウザ版に対応（ホーム画面に追加でアプリの様に使えます）。ネイティブアプリは準備中です。
          </Typography>
        </>
      ) : (
        <>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ width: "100%" }}>
            <Button fullWidth variant="contained" onClick={() => onDownload(latest)} startIcon={<DownloadIcon />}
              sx={{ ...gradBtnStatic, fontWeight: 800, borderRadius: "100px", textTransform: "none", py: 1.3, fontSize: "0.95rem" }}>
              ダウンロード
            </Button>
          </motion.div>
          <Typography sx={{ fontSize: "0.72rem", color: BRAND.sub2, fontFamily: "monospace", mt: 1.2 }}>
            最新 {latest.label} · {platform.arch}
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: BRAND.sub, mt: 0.6, textAlign: "center", lineHeight: 1.6 }}>
            {latest.note}
          </Typography>

          {older.length > 0 && (
            <Box sx={{ width: "100%", mt: 2 }}>
              <Button fullWidth onClick={() => setShowAll((v) => !v)}
                endIcon={<KeyboardArrowDownIcon sx={{ transform: showAll ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />}
                sx={{ color: BRAND.sub2, fontSize: "0.72rem", textTransform: "none", justifyContent: "space-between", px: 1 }}>
                過去のバージョン ({older.length})
              </Button>
              <AnimatePresence initial={false}>
                {showAll && (
                  <Box component={motion.div} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} sx={{ overflow: "hidden" }}>
                    {older.map((rel) => (
                      <Box key={rel.version} onClick={() => onDownload(rel)}
                        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 1.5, py: 1,
                          borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", borderRadius: 1,
                          "&:hover": { bgcolor: PURPLE_SOFT } }}>
                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#fff" }}>{rel.label}</Typography>
                        <Typography sx={{ fontSize: "0.66rem", color: BRAND.sub2, fontFamily: "monospace" }}>{rel.date}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </AnimatePresence>
            </Box>
          )}
          <Typography sx={{ fontSize: "0.66rem", color: BRAND.sub2, mt: "auto", pt: 2, textAlign: "center", lineHeight: 1.6 }}>
            ⚠️ {platform.warn}
          </Typography>
        </>
      )}
    </Box>
  );
};

const DownloadDialog = ({ open, onClose, onDownload, onWebApp }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <Box component={motion.div} key="dl-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          onClick={onClose}
          sx={{ position: "fixed", inset: 0, zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", p: 2 }}>

          <Box component={motion.div} key="dl-panel"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 26, stiffness: 280, staggerChildren: 0.08, delayChildren: 0.06 } }}
            exit={{ opacity: 0, scale: 0.96, y: 14, transition: { duration: 0.18 } }}
            onClick={(e) => e.stopPropagation()}
            sx={{ position: "relative", width: "100%", maxWidth: 940, maxHeight: "90vh", overflowY: "auto",
              bgcolor: "#0b0b0d", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 4,
              boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.15)", p: { xs: 3, md: 4 } }}>

            {/* Close */}
            <Box onClick={onClose} sx={{ position: "absolute", top: 16, right: 16, cursor: "pointer", color: BRAND.sub2,
              width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.08)" }, zIndex: 2 }}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </Box>

            {/* Header */}
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#A78BFA", letterSpacing: "0.14em",
                textTransform: "uppercase", fontFamily: "monospace", mb: 1 }}>
                Download
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", fontSize: { xs: "1.5rem", md: "1.9rem" } }}>
                SEKKEIYA を始める
              </Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: "0.9rem", mt: 1 }}>
                お使いのプラットフォームを選んでください
              </Typography>
            </Box>

            {/* 3 columns */}
            <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "stretch" }}>
              {PLATFORMS.map((p) => (
                <PlatformColumn key={p.key} platform={p} onDownload={onDownload} onWebApp={onWebApp} />
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </AnimatePresence>
  );
};

const PRODUCTS = [
  // ── 正式版 ──
  { id: "3dsl",  title: "S.Layout",        desc: "空間レイアウト・家具配置・自動最適化",   status: "正式版", color: "#ffb74d" },
  { id: "3dss",  title: "S.Models",        desc: "3Dモデルの管理・共有・高品質プレビュー", status: "正式版", color: "#ff5252" },
  { id: "3dsp",  title: "S.Presentations", desc: "歩き回れる3Dプレゼンデッキ構築",         status: "正式版", color: "#ba68c8" },
  { id: "3dsi",  title: "S.Image",         desc: "画像・テクスチャ素材を整理",             status: "正式版", color: "#ec407a" },
  { id: "3dsmt", title: "S.Material",      desc: "PBR素材の作成・管理・共有",             status: "正式版", color: "#26c6da" },
  { id: "3dsm",  title: "S.Movie",         desc: "動画シーケンス編集・書き出し",           status: "正式版", color: "#C98A4B" },
  { id: "3dsk",  title: "S.Library",       desc: "製品資料・知識ライブラリ（AI検索）",     status: "正式版", color: "#26a69a" },
  // ── Beta ──
  { id: "3dsc",  title: "S.Create",        desc: "造作家具をブラウザで設計・編集",         status: "Beta",  color: "#ffa726" },
  { id: "3dsd",  title: "S.Diagram",       desc: "日照・配置・敷地・環境を図解",           status: "Beta",  color: "#aed581" },
  { id: "3dsr",  title: "S.Drawing",       desc: "図面・設計図書をクラウド管理",           status: "Beta",  color: "#4db6ac" },
  { id: "3dsf",  title: "S.Portfolio",     desc: "PDFポートフォリオの管理・公開",          status: "Beta",  color: "#7e57c2" },
  { id: "3dsq",  title: "S.Quest",         desc: "建築・インテリアの学習コース",           status: "Beta",  color: "#5c6bc0" },
];

// AI スイート（OS に常駐するAI機能群）
const AI_SUITE = [
  { name: "AI Chat",      desc: "会話で設計を動かすパートナー",   status: "正式版" },
  { name: "AI Drive",     desc: "AI索引付きファイルドライブ",     status: "正式版" },
  { name: "AI 3D Create", desc: "画像からAIで3Dモデル生成",       status: "正式版" },
  { name: "AI Render",    desc: "AIフォトリアルレンダリング",     status: "Beta" },
  { name: "Teams",        desc: "チームでの共同設計",             status: "正式版" },
];

// ステータス別の配色（正式版 / Beta の2段階）
const STATUS_COLOR = {
  "正式版": { fg: "#34D399", bg: "rgba(16,185,129,0.14)", bd: "rgba(16,185,129,0.4)" },
  Beta:     { fg: "#A78BFA", bg: "rgba(124,58,237,0.14)", bd: "rgba(124,58,237,0.4)" },
};
const StatusChip = ({ status }) => {
  const c = STATUS_COLOR[status] || STATUS_COLOR.Beta;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5,
      px: 1, py: 0.25, borderRadius: "100px", bgcolor: c.bg, border: `1px solid ${c.bd}` }}>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: c.fg }} />
      <Typography component="span" sx={{ fontSize: "0.62rem", fontWeight: 700, color: c.fg, letterSpacing: "0.04em" }}>
        {status}
      </Typography>
    </Box>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate  = useNavigate();
  const { user, isAnonymous }  = useAuth();
  const { requestGoToApp } = usePwaInstall();
  // ダウンロードダイアログ（Windows / macOS / iOS の3列）
  const [dlOpen, setDlOpen] = React.useState(false);
  const [os, setOs] = React.useState("Unknown");
  const [guestLoading, setGuestLoading] = React.useState(false);

  const handleGuestStart = React.useCallback(async () => {
    setGuestLoading(true);
    try {
      await signInAnonymously(auth);
      navigate("/workspace");
    } catch (e) {
      console.error("[GuestStart]", e);
      setGuestLoading(false);
    }
  }, [navigate]);

  React.useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes("win")) setOs("Windows");
    else if (ua.includes("mac")) setOs("Mac");
  }, []);

  const handleDownload = (release) => {
    if (release?.url) window.open(release.url, "_blank");
    else document.getElementById("download-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleWebApp = () => {
    setDlOpen(false);
    navigate(user ? "/dashboard" : "/demo");
  };

  const gradBtn = {
    background: GRAD_PRIMARY, color: "#fff", fontWeight: 800, borderRadius: "100px", textTransform: "none",
    "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #1D4ED8 100%)", boxShadow: `0 0 32px ${PURPLE_GLOW}` },
  };

  return (
    <>
      <SEO title="SEKKEIYA — 設計は、対話になる。" description="AIが設計プロセスを組み立て、設計者は考えることに専念する。分断されたツール群を統合するAI駆動の次世代建築OS。" path="/">
        <script type="application/ld+json">{JSON.stringify([SchemaTypes.getOrganization(), SchemaTypes.getWebSite(), SchemaTypes.getSoftwareApplication()])}</script>
      </SEO>

      <Box style={{ backgroundColor: "#000", color: "#fff" }} sx={{ pb: 10, bgcolor: "#000", color: BRAND.text, overflowX: "hidden", position: "relative" }}>
        <BackgroundTypography />

        {/* ── 01 / HERO ─────────────────────────────────────────────────────── */}
        <Box sx={{ pt: { xs: 10, md: 10 }, pb: 0, position: "relative", overflow: "hidden", minHeight: "100vh" }}>
          {/* Dot grid */}
          <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "36px 36px" }} />
          {/* Purple glow */}
          <Box sx={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%",
            background: "radial-gradient(ellipse at 0% 30%, rgba(124,58,237,0.18) 0%, transparent 60%)",
            pointerEvents: "none", zIndex: 0 }} />

          <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
            {/* Flexbox row — Grid v2 の xs/md props 警告を回避 */}
            <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "flex-start", gap: { xs: 4, md: 6 } }}>

              {/* ── Left: headline + CTA ── */}
              <Box sx={{ flexShrink: 0, width: { xs: "100%", md: "42%" }, pt: { xs: 2, md: 8 }, pb: { xs: 4, md: 10 } }}>
                <FadeInSlide direction="up">
                  <SectionBadge text="次世代建築 OS" />
                  <Typography variant="h1" sx={{
                    fontWeight: 900, mt: 2,
                    fontSize: { xs: "2.8rem", sm: "3.6rem", md: "4.2rem", lg: "5rem" },
                    lineHeight: 1.05, letterSpacing: "-0.04em", color: "#fff",
                  }}>
                    設計は、<br /><GradText>対話になる。</GradText>
                  </Typography>
                </FadeInSlide>

                <FadeInSlide direction="up" delay={0.12}>
                  <Box sx={{ mt: 2.5, mb: 1 }}>
                    <CyclingText />
                  </Box>
                </FadeInSlide>

                <FadeInSlide direction="up" delay={0.2}>
                  <Typography sx={{ fontSize: "1rem", color: BRAND.sub, lineHeight: 1.9, mt: 3, maxWidth: 400 }}>
                    AIがプロセス全体を組み立て、設計者は<br />
                    本質的な思考に集中できる環境。<br />
                    それが SEKKEIYA の目指す世界です。
                  </Typography>
                </FadeInSlide>

                <FadeInSlide direction="up" delay={0.3}>
                  <Stack spacing={1.5} sx={{ mt: 4 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        {user && !isAnonymous ? (
                          // ログイン済み（本登録ユーザー）
                          <Button variant="contained" size="large"
                            onClick={requestGoToApp}
                            endIcon={<ArrowForwardIcon />}
                            sx={{ ...gradBtn, fontSize: "0.95rem", px: 3.5, py: 1.4 }}>
                            ワークスペースへ
                          </Button>
                        ) : user && isAnonymous ? (
                          // ゲストとして入室済み
                          <Button variant="contained" size="large"
                            onClick={() => navigate("/workspace")}
                            endIcon={<ArrowForwardIcon />}
                            sx={{ ...gradBtn, fontSize: "0.95rem", px: 3.5, py: 1.4 }}>
                            ワークスペースへ
                          </Button>
                        ) : (
                          // 未ログイン → 匿名でそのまま試せる
                          <Button variant="contained" size="large"
                            onClick={handleGuestStart}
                            disabled={guestLoading}
                            endIcon={guestLoading ? null : <ArrowForwardIcon />}
                            sx={{ ...gradBtn, fontSize: "0.95rem", px: 3.5, py: 1.4, minWidth: 220 }}>
                            {guestLoading
                              ? <CircularProgress size={20} sx={{ color: "#fff" }} />
                              : "登録なしで今すぐ試す"}
                          </Button>
                        )}
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        {user && !isAnonymous ? (
                          <Button variant="outlined" size="large"
                            onClick={() => setDlOpen(true)}
                            startIcon={<DownloadIcon />}
                            sx={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700,
                              fontSize: "0.95rem", px: 3, py: 1.4, borderRadius: "100px", textTransform: "none",
                              "&:hover": { borderColor: "rgba(124,58,237,0.5)", bgcolor: "rgba(124,58,237,0.06)" } }}>
                            Download
                          </Button>
                        ) : (
                          <Button variant="outlined" size="large"
                            onClick={() => setDlOpen(true)}
                            startIcon={<DownloadIcon />}
                            sx={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700,
                              fontSize: "0.95rem", px: 3, py: 1.4, borderRadius: "100px", textTransform: "none",
                              "&:hover": { borderColor: "rgba(124,58,237,0.5)", bgcolor: "rgba(124,58,237,0.06)" } }}>
                            ダウンロード
                          </Button>
                        )}
                      </motion.div>
                    </Stack>
                    <Typography sx={{ color: BRAND.sub2, fontSize: "0.75rem" }}>
                      {user && !isAnonymous
                        ? "Windows / macOS 版 Desktop もDL可能。"
                        : "登録不要・30秒でワークスペースが開きます。Windows / macOS 版のDLも可能。"}
                    </Typography>
                  </Stack>
                </FadeInSlide>
              </Box>

              {/* ── Right: workflow demo ── */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                  position: "relative", height: "calc(100vh - 100px)", maxHeight: 860 }}
              >
                <Box style={{ backgroundColor: "#0d0d0d" }} sx={{
                  flex: 1, borderRadius: "16px", overflow: "hidden",
                  border: "1px solid rgba(124,58,237,0.32)",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 60px rgba(124,58,237,0.14)",
                  display: { xs: "none", md: "flex" }, flexDirection: "column",
                }}>
                  <WorkflowDemo />
                </Box>
                {/* Bottom page fade */}
                <Box sx={{ display: { xs: "none", md: "block" },
                  position: "absolute", bottom: 0, left: 0, right: 0, height: 160,
                  background: "linear-gradient(to top, #000 0%, transparent 100%)",
                  pointerEvents: "none", zIndex: 10 }} />
              </motion.div>

              {/* Mobile */}
              <Box style={{ backgroundColor: "#0d0d0d" }} sx={{ display: { xs: "block", md: "none" }, width: "100%", height: 420,
                borderRadius: 3, overflow: "hidden",
                border: "1px solid rgba(124,58,237,0.3)" }}>
                <WorkflowDemo />
              </Box>
            </Box>
          </Container>
        </Box>

        {/* ── 01b / LIVE GALLERY ───────────────────────────────────────────── */}
        <Box sx={{ py: 10, position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 60%)" }} />
          <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
            <FadeInSlide direction="up">
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 5, flexWrap: "wrap", gap: 2 }}>
                <Box>
                  <SectionBadge text="Live Gallery" />
                  <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: "1.8rem", md: "2.4rem" },
                    lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff", mt: 1 }}>
                    みんなの<GradText>成果物。</GradText>
                  </Typography>
                </Box>
                <Button variant="outlined" endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate("/gallery")}
                  sx={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700,
                    textTransform: "none", borderRadius: "100px", px: 3, py: 1,
                    "&:hover": { borderColor: "rgba(124,58,237,0.6)", bgcolor: "rgba(124,58,237,0.08)" } }}>
                  すべての成果物を見る
                </Button>
              </Box>
            </FadeInSlide>
            <Box sx={{ position: "relative" }}>
              <PublicModelGallery limit={12} columns={4} hideFilter />
              <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
                background: "linear-gradient(to top, #000 0%, transparent 100%)", pointerEvents: "none" }} />
            </Box>
          </Container>
        </Box>

        {/* ── 02 / WHAT YOU CAN DO（何ができるか・1画面） ─────────────────── */}
        <Box sx={{ py: { xs: 12, md: 18 }, position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 700, height: 460, background: `radial-gradient(ellipse, ${PURPLE_GLOW} 0%, transparent 70%)`, pointerEvents: "none" }} />
          <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
            <FadeInSlide direction="up">
              <Box sx={{ textAlign: "center", mb: { xs: 6, md: 9 } }}>
                <SectionBadge text="What you can do" />
                <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: "2rem", md: "3rem" }, lineHeight: 1.25, letterSpacing: "-0.04em", color: "#fff" }}>
                  操作を覚える前に、<GradText>もう動かせる。</GradText>
                </Typography>
              </Box>
            </FadeInSlide>

            {/* 3つの価値 */}
            <Grid container spacing={3} sx={{ mb: { xs: 6, md: 9 } }}>
              {[
                { icon: "🗣", title: "対話で、設計する",        desc: "操作を覚える必要はない。AIに話しかけるだけで空間が動く。" },
                { icon: "⚡", title: "提案まで、一気通貫",      desc: "レイアウト → 可視化 → 提案資料まで、ひとつの流れで完成。" },
                { icon: "🧩", title: "12のアプリが、ひとつに",  desc: "必要な道具がすべて同じ環境で連携する、次世代の建築 OS。" },
              ].map((v, i) => (
                <Grid item xs={12} md={4} key={i}>
                  <FadeInSlide direction="up" delay={i * 0.08}>
                    <Box sx={{ height: "100%", bgcolor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, p: 4 }}>
                      <Typography sx={{ fontSize: "2rem", mb: 1.5, lineHeight: 1 }}>{v.icon}</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: "#fff", mb: 1, letterSpacing: "-0.02em" }}>{v.title}</Typography>
                      <Typography sx={{ color: BRAND.sub, fontSize: "0.9rem", lineHeight: 1.8 }}>{v.desc}</Typography>
                    </Box>
                  </FadeInSlide>
                </Grid>
              ))}
            </Grid>

            {/* 12アプリ — 小さなチップの帯 */}
            <FadeInSlide direction="up" delay={0.1}>
              <Typography sx={{ textAlign: "center", color: BRAND.sub2, fontSize: "0.78rem", fontWeight: 700,
                letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "monospace", mb: 2.5 }}>
                12 apps in one OS
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.2 }}>
                {PRODUCTS.map((p) => (
                  <Box key={p.id} onClick={() => navigate("/demo")}
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, px: 1.6, py: 0.8,
                      borderRadius: "100px", border: "1px solid rgba(255,255,255,0.1)", bgcolor: "rgba(255,255,255,0.02)",
                      cursor: "pointer", transition: "all 0.2s",
                      "&:hover": { borderColor: `${p.color}66`, bgcolor: `${p.color}14` } }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>{p.title}</Typography>
                    {p.status === "Beta" && (
                      <Typography component="span" sx={{ fontSize: "0.62rem", fontWeight: 800, color: "#A78BFA" }}>β</Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </FadeInSlide>
          </Container>
        </Box>






        {/* ── 03b / SUPPORT（寄付・応援コメント） ─────────────────────────── */}
        <DonationSection />

        {/* ── 04 / FINAL CTA（まずは触ってもらう） ─────────────────────────── */}
        <Box id="download-section" sx={{ py: { xs: 16, md: 24 }, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "80%", height: "60%",
            background: `radial-gradient(ellipse at 50% 100%, ${PURPLE_GLOW} 0%, transparent 65%)`, pointerEvents: "none" }} />
          <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
            <FadeInSlide direction="up">
              <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: "2.4rem", md: "4rem" }, mb: 3,
                letterSpacing: "-0.05em",
                background: "linear-gradient(180deg, #fff 40%, rgba(255,255,255,0.45) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                まずは、触ってみる。
              </Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: "1.05rem", mb: 6, lineHeight: 1.9 }}>
                登録不要・30秒。ブラウザでそのままワークスペースが開きます。
              </Typography>
              <Stack spacing={2.5} alignItems="center">
                <motion.div
                  animate={{ boxShadow: [`0 0 0px ${PURPLE_GLOW}`, `0 0 50px ${PURPLE_GLOW}`, `0 0 0px ${PURPLE_GLOW}`] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  style={{ borderRadius: "100px" }}>
                  <Button variant="contained" size="large"
                    onClick={user ? () => navigate("/workspace") : handleGuestStart}
                    disabled={guestLoading}
                    endIcon={guestLoading ? null : <ArrowForwardIcon />}
                    sx={{ ...gradBtn, fontSize: "1.1rem", px: 6, py: 2, minWidth: 280 }}>
                    {guestLoading
                      ? <CircularProgress size={22} sx={{ color: "#fff" }} />
                      : user ? "ワークスペースへ" : "登録なしで今すぐ試す"}
                  </Button>
                </motion.div>

                <Button variant="text" onClick={() => setDlOpen(true)} startIcon={<DownloadIcon />}
                  sx={{ color: BRAND.sub, fontWeight: 600, textTransform: "none", fontSize: "0.9rem",
                    "&:hover": { color: "#fff", bgcolor: "transparent" } }}>
                  Windows / macOS 版をダウンロード
                </Button>
              </Stack>
            </FadeInSlide>
          </Container>
        </Box>

      </Box>

      <DownloadDialog open={dlOpen} onClose={() => setDlOpen(false)} onDownload={handleDownload} onWebApp={handleWebApp} />
    </>
  );
}
