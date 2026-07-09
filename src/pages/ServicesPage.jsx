import React, { useState, useEffect } from "react";
import { Box, Container, Typography, Grid, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BRAND } from "@/shared/ui/theme";
import { SEO } from "@/shared/components/seo/SEO";
import { SchemaTypes } from "@/shared/components/seo/SchemaTypes";
import { SEOCONFIG } from "@/config/seoConfig";

const PURPLE       = "#7C3AED";
const PURPLE_SOFT  = "rgba(124,58,237,0.12)";
const PURPLE_GLOW  = "rgba(124,58,237,0.22)";
const GRAD_PRIMARY = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";
const GRAD_TEXT    = "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)";

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
    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: PURPLE }} />
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

const FeatureList = ({ items }) => (
  <Box sx={{ mt: 4 }}>
    {items.map((item, i) => (
      <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: PURPLE, mt: 0.9, flexShrink: 0 }} />
        <Typography sx={{ color: BRAND.sub, lineHeight: 1.7, fontSize: "0.97rem" }}>{item}</Typography>
      </Box>
    ))}
  </Box>
);

const SceneBox = ({ children }) => (
  <Box sx={{ width: "100%", height: { xs: 300, md: 420 }, borderRadius: 3, overflow: "hidden",
    border: "1px solid rgba(124,58,237,0.2)", bgcolor: "rgba(0,0,0,0.5)",
    boxShadow: `0 0 60px ${PURPLE_SOFT}` }}>
    {children}
  </Box>
);

/* ── Section A visual: AI Drive file sync mockup ── */
const FILES = [
  { name: "exterior.png", type: "IMG", img: "/images/demo_assets/exterior.png" },
  { name: "interior.png", type: "IMG", img: "/images/demo_assets/interior.png" },
  { name: "model_v3.3dm", type: "3DM", img: null },
  { name: "section.dwg",  type: "DWG", img: null },
  { name: "lighting.exr", type: "EXR", img: null },
  { name: "specs.pdf",    type: "PDF", img: null },
];

const TYPE_COLOR = { IMG: "#A78BFA", "3DM": "#60A5FA", DWG: "#34D399", EXR: "#F59E0B", PDF: "#F472B6" };

function SyncVisual() {
  const [progress, setProgress] = useState(38);
  useEffect(() => {
    const t = setInterval(() => setProgress(p => p >= 100 ? 0 : p + 0.6), 80);
    return () => clearInterval(t);
  }, []);

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", bgcolor: "#0a0a0a" }}>
      {/* Title bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.2, bgcolor: "#111", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FF5F57" }} />
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FFBD2E" }} />
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#28C840" }} />
        <Typography sx={{ color: BRAND.sub2, fontSize: "0.7rem", fontFamily: "monospace", ml: 2 }}>
          SEKKEIYA AI Drive
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <Box sx={{ width: 150, borderRight: "1px solid rgba(255,255,255,0.06)", p: 1.5, flexShrink: 0, display: { xs: "none", sm: "block" } }}>
          {["Shared", "Recent", "Projects"].map(label => (
            <Box key={label} sx={{ px: 1.5, py: 0.8, borderRadius: 1.5, mb: 0.5 }}>
              <Typography sx={{ color: BRAND.sub2, fontSize: "0.72rem", fontWeight: 600 }}>{label}</Typography>
            </Box>
          ))}
          <Box sx={{ px: 1.5, py: 0.8, borderRadius: 1.5, bgcolor: PURPLE_SOFT, border: `1px solid rgba(124,58,237,0.3)`, mt: 0.5 }}>
            <Typography sx={{ color: "#A78BFA", fontSize: "0.72rem", fontWeight: 700 }}>AI Drive</Typography>
          </Box>
        </Box>

        {/* Main grid */}
        <Box sx={{ flexGrow: 1, p: 2, overflow: "hidden" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.2 }}>
            {FILES.map((file) => (
              <Box key={file.name} sx={{ borderRadius: 1.5, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)",
                bgcolor: "rgba(255,255,255,0.025)", transition: "border-color 0.2s",
                "&:hover": { borderColor: "rgba(124,58,237,0.35)" } }}>
                <Box sx={{ height: 56, bgcolor: "rgba(0,0,0,0.4)", position: "relative", overflow: "hidden" }}>
                  {file.img
                    ? <Box component="img" src={file.img} sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
                    : <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Typography sx={{ color: TYPE_COLOR[file.type] || "#fff", fontSize: "0.65rem", fontWeight: 900, fontFamily: "monospace", opacity: 0.5 }}>
                          {file.type}
                        </Typography>
                      </Box>
                  }
                </Box>
                <Box sx={{ px: 1, py: 0.6 }}>
                  <Typography sx={{ color: BRAND.sub, fontSize: "0.6rem", fontFamily: "monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Sync status footer */}
      <Box sx={{ px: 2.5, py: 1.2, borderTop: "1px solid rgba(255,255,255,0.06)", bgcolor: "#0d0d0d",
        display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ flexGrow: 1, height: 3, bgcolor: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ width: `${progress}%`, height: "100%", background: GRAD_PRIMARY, borderRadius: 2, transition: "width 0.08s linear" }} />
        </Box>
        <Typography sx={{ color: "#A78BFA", fontSize: "0.62rem", fontFamily: "monospace", flexShrink: 0 }}>
          AI SYNC {Math.round(progress)}%
        </Typography>
      </Box>
    </Box>
  );
}

/* ── Section B visual: Floor plan layout canvas ── */
function LayoutCanvas() {
  const [selected, setSelected] = useState(null);
  const zones = [
    { id: "A", label: "エントランス", x: "8%", y: "12%", w: "28%", h: "22%" },
    { id: "B", label: "ラウンジ",     x: "40%", y: "8%",  w: "52%", h: "35%" },
    { id: "C", label: "会議室 1",    x: "8%", y: "38%", w: "28%", h: "26%" },
    { id: "D", label: "オープン",    x: "40%", y: "47%", w: "52%", h: "30%" },
    { id: "E", label: "会議室 2",   x: "8%", y: "68%", w: "28%", h: "24%" },
    { id: "F", label: "サービス",    x: "40%", y: "81%", w: "52%", h: "14%" },
  ];

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", bgcolor: "#0a0a0a" }}>
      {/* Browser chrome */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.2, bgcolor: "#111", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FF5F57" }} />
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FFBD2E" }} />
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#28C840" }} />
        <Box sx={{ flexGrow: 1, mx: 2, bgcolor: "rgba(255,255,255,0.05)", borderRadius: "100px", px: 2, py: 0.3 }}>
          <Typography sx={{ color: BRAND.sub2, fontSize: "0.65rem", fontFamily: "monospace" }}>
            app.sekkeiya.com/layout
          </Typography>
        </Box>
      </Box>

      {/* Canvas area */}
      <Box sx={{ flexGrow: 1, position: "relative", overflow: "hidden", m: 2 }}>
        {/* Background: floor plan image */}
        <Box component="img" src="/images/demo_assets/floorplan.png"
          onError={(e) => { e.target.style.display = "none"; }}
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.18 }} />

        {/* Grid overlay */}
        <Box sx={{ position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px" }} />

        {/* Zone overlays */}
        {zones.map(zone => (
          <Box key={zone.id} onClick={() => setSelected(selected === zone.id ? null : zone.id)}
            sx={{ position: "absolute", left: zone.x, top: zone.y, width: zone.w, height: zone.h,
              borderRadius: 1, cursor: "pointer", transition: "all 0.2s",
              border: selected === zone.id ? `1.5px solid ${PURPLE}` : "1px solid rgba(124,58,237,0.25)",
              bgcolor: selected === zone.id ? PURPLE_SOFT : "rgba(124,58,237,0.04)",
              "&:hover": { borderColor: "rgba(124,58,237,0.55)", bgcolor: "rgba(124,58,237,0.08)" }
            }}>
            <Typography sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              color: selected === zone.id ? "#A78BFA" : BRAND.sub2,
              fontSize: "0.58rem", fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
              {zone.label}
            </Typography>
          </Box>
        ))}

        {/* Collaborator cursors */}
        <Box sx={{ position: "absolute", right: "22%", top: "30%", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.3 }}>
          <Box sx={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: `10px solid ${PURPLE}` }} />
          <Box sx={{ bgcolor: PURPLE, borderRadius: "100px", px: 1, py: 0.2 }}>
            <Typography sx={{ color: "#fff", fontSize: "0.55rem", fontWeight: 700 }}>Yuki</Typography>
          </Box>
        </Box>
        <Box sx={{ position: "absolute", left: "52%", bottom: "28%", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.3 }}>
          <Box sx={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "10px solid #2563EB" }} />
          <Box sx={{ bgcolor: "#2563EB", borderRadius: "100px", px: 1, py: 0.2 }}>
            <Typography sx={{ color: "#fff", fontSize: "0.55rem", fontWeight: 700 }}>Kento</Typography>
          </Box>
        </Box>
      </Box>

      {/* Toolbar */}
      <Box sx={{ px: 2, py: 1, borderTop: "1px solid rgba(255,255,255,0.06)", bgcolor: "#0d0d0d",
        display: "flex", alignItems: "center", gap: 1.5 }}>
        {["Select", "Move", "Zone", "Measure"].map(tool => (
          <Box key={tool} sx={{ px: 1.5, py: 0.4, borderRadius: 1, bgcolor: tool === "Zone" ? PURPLE_SOFT : "transparent",
            border: `1px solid ${tool === "Zone" ? "rgba(124,58,237,0.4)" : "transparent"}` }}>
            <Typography sx={{ color: tool === "Zone" ? "#A78BFA" : BRAND.sub2, fontSize: "0.62rem", fontWeight: 700 }}>{tool}</Typography>
          </Box>
        ))}
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#28C840", animation: "pulse 2s infinite",
            "@keyframes pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.4 } } }} />
          <Typography sx={{ color: BRAND.sub2, fontSize: "0.6rem", fontFamily: "monospace" }}>2 collaborators</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/* ── Section C visual: Presentation viewer ── */
const SLIDES = [
  { label: "エントランス", img: "/images/demo_assets/exterior.png" },
  { label: "ラウンジ",    img: "/images/demo_assets/interior.png" },
  { label: "会議室",     img: "/images/demo_assets/interior.png" },
];

function PresentationViewer() {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setDir(1);
      setSlide(s => (s + 1) % SLIDES.length);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const go = (idx) => {
    setDir(idx > slide ? 1 : -1);
    setSlide(idx);
  };

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", bgcolor: "#080808" }}>
      {/* Presenter top bar */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.2,
        bgcolor: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#28C840" }} />
          <Typography sx={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em" }}>
            PRESENTING LIVE
          </Typography>
        </Box>
        <Typography sx={{ color: BRAND.sub2, fontSize: "0.65rem", fontFamily: "monospace" }}>
          青山カフェ設計提案 v3
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Box sx={{ px: 1.5, py: 0.3, borderRadius: "100px", bgcolor: PURPLE_SOFT, border: "1px solid rgba(124,58,237,0.35)" }}>
            <Typography sx={{ color: "#A78BFA", fontSize: "0.6rem", fontWeight: 700 }}>3 viewers</Typography>
          </Box>
        </Box>
      </Box>

      {/* Slide area */}
      <Box sx={{ flexGrow: 1, position: "relative", overflow: "hidden" }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={slide} custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "absolute", inset: 0 }}>
            <Box component="img" src={SLIDES[slide].img} alt={SLIDES[slide].label}
              sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }} />
            <Box sx={{ position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)" }} />
            <Box sx={{ position: "absolute", bottom: 20, left: 20 }}>
              <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.02em" }}>
                {SLIDES[slide].label}
              </Typography>
            </Box>
          </motion.div>
        </AnimatePresence>

        {/* Slide counter */}
        <Box sx={{ position: "absolute", top: 12, right: 14, bgcolor: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
          borderRadius: "100px", px: 1.5, py: 0.4 }}>
          <Typography sx={{ color: BRAND.sub, fontSize: "0.62rem", fontFamily: "monospace" }}>
            {slide + 1} / {SLIDES.length}
          </Typography>
        </Box>
      </Box>

      {/* Navigation thumbnails */}
      <Box sx={{ display: "flex", gap: 1, p: 1.5, bgcolor: "#0d0d0d", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {SLIDES.map((s, i) => (
          <Box key={i} onClick={() => go(i)} sx={{ flex: 1, height: 42, borderRadius: 1, overflow: "hidden", cursor: "pointer",
            border: `1.5px solid ${i === slide ? PURPLE : "rgba(255,255,255,0.07)"}`,
            transition: "border-color 0.2s", position: "relative" }}>
            <Box component="img" src={s.img} alt={s.label}
              sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: i === slide ? 1 : 0.45 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ── Desktop版の全アプリ（成熟度: 正式版 / Beta の2段階）──
   正は LandingPage.jsx の PRODUCTS / AI_SUITE。ここはサービス紹介用にカテゴリ分けして再掲。 */
const APP_CATEGORIES = [
  {
    key: "設計・モデリング",
    badge: "Design & Modeling",
    lead: "3Dモデルの管理から造作家具・図面・環境ダイアグラムまで、設計の土台をつくる。",
    apps: [
      { name: "S.Models",   desc: "3Dモデルの管理・共有・高品質プレビュー",   status: "正式版" },
      { name: "S.Create",   desc: "造作家具をブラウザで設計・編集",           status: "Beta" },
      { name: "S.Diagram",  desc: "日照・配置・敷地・環境ダイアグラムを図解", status: "Beta" },
      { name: "S.Drawing",  desc: "図面・設計図書をクラウドで一元管理",       status: "Beta" },
    ],
  },
  {
    key: "ビジュアライゼーション",
    badge: "Visualization",
    lead: "家具の自動レイアウトからPBR素材・動画書き出しまで、空間を魅せる。",
    apps: [
      { name: "S.Layout",   desc: "空間レイアウト・家具配置・AI自動最適化", status: "正式版" },
      { name: "S.Image",    desc: "画像・テクスチャ素材を整理",             status: "正式版" },
      { name: "S.Material", desc: "PBR素材の作成・管理・共有",             status: "正式版" },
      { name: "S.Movie",    desc: "動画シーケンス編集・書き出し",           status: "正式版" },
    ],
  },
  {
    key: "提案・ナレッジ",
    badge: "Proposal & Knowledge",
    lead: "歩ける3Dプレゼンやポートフォリオ、AI検索ライブラリで提案と学習を支える。",
    apps: [
      { name: "S.Presentations", desc: "歩き回れる3Dプレゼンデッキ構築",       status: "正式版" },
      { name: "S.Library",       desc: "製品資料・知識ライブラリ（AI検索）",   status: "正式版" },
      { name: "S.Portfolio",     desc: "PDFポートフォリオの管理・公開",        status: "Beta" },
      { name: "S.Quest",         desc: "建築・インテリアの学習コース",         status: "Beta" },
    ],
  },
];

const AI_SUITE = [
  { name: "AI Chat",      desc: "会話で設計プロセス全体を動かすパートナー", status: "正式版" },
  { name: "AI Drive",     desc: "AIが索引・整理するファイルドライブ",       status: "正式版" },
  { name: "AI 3D Create", desc: "画像から3Dモデルを自動生成",               status: "正式版" },
  { name: "AI Render",    desc: "AIフォトリアルレンダリング",               status: "Beta" },
  { name: "Teams",        desc: "チームでのリアルタイム共同設計",           status: "正式版" },
];

const FAQS = [
  { q: "SEKKEIYAはどんなソフトですか？", a: "SEKKEIYAは、AIとの対話で建築・インテリア設計を進める「AI空間設計OS」です。家具の自動レイアウト、3Dモデルの管理・共有、PBR素材作成、歩ける3Dプレゼン、AIレンダリングなど、設計に必要な12のアプリとAIスイートを1つに統合しています。" },
  { q: "ブラウザだけで使えますか？", a: "はい。主要機能はWebブラウザのWeb版で動作し、登録なしですぐに試せます。加えて、より高度な機能を備えたWindows / macOS版のデスクトップアプリも提供しています。" },
  { q: "Rhinoなど既存の設計ツールと連携できますか？", a: "S.ModelsとAI Driveを通じて、Rhinoや各種DCCツールの3Dモデル（glb等）を取り込み・共有できます。既存のワークフローを置き換えずに、データを統合できます。" },
  { q: "料金はかかりますか？", a: "登録なしのゲスト利用と無料プランから始められます。チーム機能や高度なAI機能を含むプランの詳細は料金ページをご覧ください。" },
  { q: "正式版とBetaの違いは何ですか？", a: "正式版は安定して日常利用できる機能、Betaは実用可能ながら改善を続けている機能を指します。各アプリのステータスは本ページの一覧に表示しています。" },
];

const STATUS_STYLE = {
  "正式版": { fg: "#34D399", bg: "rgba(16,185,129,0.14)", bd: "rgba(16,185,129,0.4)" },
  Beta:     { fg: "#A78BFA", bg: "rgba(124,58,237,0.14)", bd: "rgba(124,58,237,0.4)" },
};

const StatusChip = ({ status }) => {
  const c = STATUS_STYLE[status] || STATUS_STYLE.Beta;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25,
      borderRadius: "100px", bgcolor: c.bg, border: `1px solid ${c.bd}`, flexShrink: 0 }}>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: c.fg }} />
      <Typography component="span" sx={{ fontSize: "0.6rem", fontWeight: 700, color: c.fg, letterSpacing: "0.04em" }}>
        {status}
      </Typography>
    </Box>
  );
};

const AppCard = ({ app }) => (
  <Box sx={{ height: "100%", p: 2.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)", transition: "all 0.2s",
    "&:hover": { borderColor: "rgba(124,58,237,0.4)", bgcolor: "rgba(124,58,237,0.05)" } }}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
      <Typography component="h3" sx={{ color: "#fff", fontWeight: 800, fontSize: "1.02rem", letterSpacing: "-0.01em" }}>
        {app.name}
      </Typography>
      <StatusChip status={app.status} />
    </Box>
    <Typography sx={{ color: BRAND.sub, fontSize: "0.86rem", lineHeight: 1.6 }}>{app.desc}</Typography>
  </Box>
);

const FaqItem = ({ q, a }) => (
  <Box sx={{ py: 3, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
    <Typography component="h3" sx={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem", mb: 1.2, letterSpacing: "-0.01em" }}>
      {q}
    </Typography>
    <Typography sx={{ color: BRAND.sub, lineHeight: 1.8, fontSize: "0.95rem" }}>{a}</Typography>
  </Box>
);

export default function ServicesPage() {
  const navigate = useNavigate();

  // 構造化データ用の全アプリ平坦リスト
  const allApps = [...APP_CATEGORIES.flatMap((c) => c.apps), ...AI_SUITE];

  return (
    <>
      <SEO title={SEOCONFIG.pages.services.title} description={SEOCONFIG.pages.services.description} path={SEOCONFIG.pages.services.path}>
        <script type="application/ld+json">{JSON.stringify(SchemaTypes.getSoftwareApplication())}</script>
        <script type="application/ld+json">{JSON.stringify(SchemaTypes.getBreadcrumbList([
          { name: "ホーム", url: "https://sekkeiya.com/" },
          { name: "機能一覧", url: "https://sekkeiya.com/services" },
        ]))}</script>
        <script type="application/ld+json">{JSON.stringify(SchemaTypes.getItemList("SEKKEIYA アプリ・AI機能", allApps))}</script>
        <script type="application/ld+json">{JSON.stringify(SchemaTypes.getFAQPage(FAQS))}</script>
      </SEO>
      <Box sx={{ minHeight: "100vh", bgcolor: "#000", color: BRAND.text, overflowX: "hidden" }}>

        {/* Header */}
        <Box sx={{ pt: { xs: 20, md: 26 }, pb: 12, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120%", height: "70%",
            background: "radial-gradient(ellipse at 50% -5%, rgba(124,58,237,0.16) 0%, transparent 60%)", pointerEvents: "none" }} />
          <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
            <FadeInSlide>
              <SectionBadge text="Services" />
              <Typography variant="h1" component="h1" sx={{ fontWeight: 900, fontSize: { xs: "2.4rem", md: "4.2rem" }, mb: 3, lineHeight: 1.12, letterSpacing: "-0.05em", color: "#fff" }}>
                建築設計の全工程を、<br /><GradText>ひとつのAIに。</GradText>
              </Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: "1.1rem", lineHeight: 1.85, maxWidth: 640, mx: "auto" }}>
                家具の自動レイアウト、3Dモデルの管理・共有、PBR素材作成、歩ける3Dプレゼン、AIレンダリング——
                建築・インテリア設計に必要な<strong style={{ color: "#fff" }}>12のアプリとAIスイート</strong>を、
                SEKKEIYAという1つのOSに統合しました。
              </Typography>
              <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
                <StatusChip status="正式版" /><Typography sx={{ color: BRAND.sub2, fontSize: "0.8rem" }}>正式版 11機能</Typography>
                <Box sx={{ mx: 1 }} />
                <StatusChip status="Beta" /><Typography sx={{ color: BRAND.sub2, fontSize: "0.8rem" }}>Beta 6機能</Typography>
              </Box>
            </FadeInSlide>
          </Container>
        </Box>

        {/* Section A — 設計する */}
        <Box sx={{ py: 18, bgcolor: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Container maxWidth="lg">
            <Grid container spacing={8} alignItems="center">
              <Grid item xs={12} md={6}>
                <FadeInSlide direction="right">
                  <SectionBadge text="設計する" />
                  <Typography variant="h3" component="h2" sx={{ fontWeight: 900, fontSize: { xs: "2rem", md: "2.8rem" }, mb: 3, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff" }}>
                    S.<GradText>Models / Drive</GradText>
                  </Typography>
                  <Typography sx={{ color: BRAND.sub, lineHeight: 1.9, fontSize: "1rem", maxWidth: 460 }}>
                    設計データをチームと瞬時に共有し、AIが同期・整理する。ローカルとクラウドの境界を消す設計ドライブ。
                  </Typography>
                  <FeatureList items={["3Dモデルのプレビューと共有", "AIドライブによる自動同期", "Rhino / DCC との連携"]} />
                </FadeInSlide>
              </Grid>
              <Grid item xs={12} md={6}>
                <FadeInSlide direction="left">
                  <SceneBox><SyncVisual /></SceneBox>
                </FadeInSlide>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Section B — 配置する */}
        <Box sx={{ py: 18 }}>
          <Container maxWidth="lg">
            <Grid container spacing={8} alignItems="center">
              <Grid item xs={12} md={6} sx={{ order: { xs: 2, md: 1 } }}>
                <FadeInSlide direction="right">
                  <SceneBox><LayoutCanvas /></SceneBox>
                </FadeInSlide>
              </Grid>
              <Grid item xs={12} md={6} sx={{ order: { xs: 1, md: 2 } }}>
                <FadeInSlide direction="left">
                  <SectionBadge text="配置する" />
                  <Typography variant="h3" component="h2" sx={{ fontWeight: 900, fontSize: { xs: "2rem", md: "2.8rem" }, mb: 3, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff" }}>
                    S.<GradText>Layout</GradText>
                  </Typography>
                  <Typography sx={{ color: BRAND.sub, lineHeight: 1.9, fontSize: "1rem", maxWidth: 460 }}>
                    ブラウザだけで完結する空間配置ツール。リアルタイムコラボレーションで、チームが同じ空間を同時に動かす。
                  </Typography>
                  <FeatureList items={["ブラウザ完結のドラッグ＆ドロップ配置", "リアルタイムコラボ", "レイアウト → 提案への1クリック変換"]} />
                </FadeInSlide>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Section C — 提案する */}
        <Box sx={{ py: 18, bgcolor: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Container maxWidth="lg">
            <Grid container spacing={8} alignItems="center">
              <Grid item xs={12} md={6}>
                <FadeInSlide direction="right">
                  <SectionBadge text="提案する" />
                  <Typography variant="h3" component="h2" sx={{ fontWeight: 900, fontSize: { xs: "2rem", md: "2.8rem" }, mb: 3, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff" }}>
                    S.<GradText>Presentations</GradText>
                  </Typography>
                  <Typography sx={{ color: BRAND.sub, lineHeight: 1.9, fontSize: "1rem", maxWidth: 460 }}>
                    設計案を「歩き回れる空間」として提案。クライアントはブラウザだけで没入型のプレゼンを体験できる。
                  </Typography>
                  <FeatureList items={["歩き回れる3Dプレゼン生成", "クライアントとの非同期フィードバック", "ブランドカスタマイズ対応"]} />
                </FadeInSlide>
              </Grid>
              <Grid item xs={12} md={6}>
                <FadeInSlide direction="left">
                  <SceneBox><PresentationViewer /></SceneBox>
                </FadeInSlide>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ── Full app inventory ── */}
        <Box sx={{ py: 18, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Container maxWidth="lg">
            <FadeInSlide>
              <Box sx={{ textAlign: "center", mb: 8 }}>
                <SectionBadge text="All Apps" />
                <Typography variant="h3" component="h2" sx={{ fontWeight: 900, fontSize: { xs: "1.9rem", md: "2.8rem" }, mb: 2.5, letterSpacing: "-0.04em", color: "#fff" }}>
                  ひとつのOSに、<GradText>12のアプリ。</GradText>
                </Typography>
                <Typography sx={{ color: BRAND.sub, fontSize: "1rem", lineHeight: 1.85, maxWidth: 620, mx: "auto" }}>
                  設計・モデリングからビジュアライゼーション、提案・ナレッジまで。
                  すべてのアプリがデータを共有し、AIスイートが全工程を横断します。
                </Typography>
              </Box>
            </FadeInSlide>

            {APP_CATEGORIES.map((cat) => (
              <Box key={cat.key} sx={{ mb: 7 }}>
                <FadeInSlide direction="up">
                  <Box sx={{ mb: 3 }}>
                    <Typography component="h3" sx={{ color: "#fff", fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
                      {cat.key}
                      <Box component="span" sx={{ color: BRAND.sub2, fontSize: "0.78rem", fontWeight: 600, ml: 1.5, fontFamily: "monospace" }}>
                        {cat.badge}
                      </Box>
                    </Typography>
                    <Typography sx={{ color: BRAND.sub, fontSize: "0.92rem", mt: 0.8, maxWidth: 720 }}>{cat.lead}</Typography>
                  </Box>
                  <Grid container spacing={2.5}>
                    {cat.apps.map((app) => (
                      <Grid item xs={12} sm={6} md={3} key={app.name}>
                        <AppCard app={app} />
                      </Grid>
                    ))}
                  </Grid>
                </FadeInSlide>
              </Box>
            ))}

            {/* AI Suite */}
            <FadeInSlide direction="up">
              <Box sx={{ mt: 4, p: { xs: 3, md: 5 }, borderRadius: 4,
                background: "linear-gradient(135deg, rgba(124,58,237,0.1), rgba(37,99,235,0.06))",
                border: "1px solid rgba(124,58,237,0.25)" }}>
                <Typography component="h3" sx={{ color: "#fff", fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.02em", mb: 0.8 }}>
                  AIスイート
                  <Box component="span" sx={{ color: BRAND.sub2, fontSize: "0.78rem", fontWeight: 600, ml: 1.5, fontFamily: "monospace" }}>
                    AI Suite
                  </Box>
                </Typography>
                <Typography sx={{ color: BRAND.sub, fontSize: "0.92rem", mb: 3, maxWidth: 720 }}>
                  OSに常駐し、全アプリを横断するAI機能群。会話で設計を動かし、ファイルを索引し、3D生成からレンダリングまでを担います。
                </Typography>
                <Grid container spacing={2.5}>
                  {AI_SUITE.map((app) => (
                    <Grid item xs={12} sm={6} md={4} key={app.name}>
                      <AppCard app={app} />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </FadeInSlide>
          </Container>
        </Box>

        {/* ── FAQ (FAQPage 構造化データと対) ── */}
        <Box sx={{ py: 16, bgcolor: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Container maxWidth="md">
            <FadeInSlide>
              <Box sx={{ textAlign: "center", mb: 5 }}>
                <SectionBadge text="FAQ" />
                <Typography variant="h3" component="h2" sx={{ fontWeight: 900, fontSize: { xs: "1.8rem", md: "2.5rem" }, letterSpacing: "-0.04em", color: "#fff" }}>
                  よくある質問
                </Typography>
              </Box>
              <Box>
                {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
              </Box>
            </FadeInSlide>
          </Container>
        </Box>

        {/* Bottom CTA */}
        <Box sx={{ py: 20, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "70%", height: "60%",
            background: `radial-gradient(ellipse at 50% 100%, ${PURPLE_GLOW} 0%, transparent 65%)`, pointerEvents: "none" }} />
          <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
            <FadeInSlide direction="up">
              <Typography variant="h3" component="h2" sx={{ fontWeight: 900, color: "#fff", mb: 3, letterSpacing: "-0.04em", fontSize: { xs: "1.8rem", md: "2.5rem" } }}>
                すべての機能を<GradText>体験する</GradText>
              </Typography>
              <Typography sx={{ color: BRAND.sub, mb: 6, lineHeight: 1.8 }}>
                登録なしで今すぐ、SEKKEIYAのすべての機能をブラウザで試せます。
              </Typography>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ display: "inline-block" }}>
                <Button variant="contained" size="large" onClick={() => navigate("/demo")}
                  sx={{ background: GRAD_PRIMARY, color: "#fff", fontWeight: 800, px: 6, py: 2, borderRadius: "100px", textTransform: "none", fontSize: "1.05rem",
                    "&:hover": { background: "linear-gradient(135deg, #6D28D9, #1D4ED8)", boxShadow: `0 0 32px ${PURPLE_GLOW}` } }}>
                  無料で試す
                </Button>
              </motion.div>

              {/* 内部リンク（回遊性 & SEO） */}
              <Box sx={{ mt: 5, display: "flex", gap: { xs: 2, sm: 3 }, justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { label: "作例ギャラリーを見る", path: "/gallery" },
                  { label: "料金プラン", path: "/pricing" },
                  { label: "活用記事を読む", path: "/articles" },
                  { label: "SEKKEIYAのビジョン", path: "/vision" },
                ].map((l) => (
                  <Typography key={l.path} component="a"
                    onClick={(e) => { e.preventDefault(); navigate(l.path); }}
                    href={l.path}
                    sx={{ color: "#A78BFA", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", textDecoration: "none",
                      borderBottom: "1px solid transparent", transition: "border-color 0.2s",
                      "&:hover": { borderBottomColor: "#A78BFA" } }}>
                    {l.label} →
                  </Typography>
                ))}
              </Box>
            </FadeInSlide>
          </Container>
        </Box>

      </Box>
    </>
  );
}
