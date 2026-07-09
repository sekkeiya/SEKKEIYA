import React from "react";
import { Box, Container, Typography, Stack, Button, Grid, Chip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { motion } from "framer-motion";
import { BRAND } from "@/shared/ui/theme";
import { SEO } from "@/shared/components/seo/SEO";
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

const StaggerLines = ({ lines, delay = 0 }) => {
  const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: delay } } };
  const child = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } } };
  return (
    <motion.div variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
      {lines.map((line, i) => (
        <motion.div variants={child} key={i}>
          <Typography sx={{ fontSize: "1.15rem", lineHeight: 2.1, color: BRAND.sub, mb: 0.5 }}>{line}</Typography>
        </motion.div>
      ))}
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

const ECOSYSTEM = [
  { id: "3dss", name: "S.Models",          value: "3Dモデルの高品質共有DB",        status: "Live" },
  { id: "3dsl", name: "S.Layout",          value: "ブラウザ完結の空間レイアウト",   status: "Beta" },
  { id: "3dsp", name: "S.Presentations",   value: "歩き回れる3Dプレゼン生成",       status: "Alpha" },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <>
      <SEO title={SEOCONFIG.pages.about.title} description={SEOCONFIG.pages.about.description} path={SEOCONFIG.pages.about.path} />
      <Box sx={{ pb: 10, bgcolor: "#000", color: BRAND.text, overflowX: "hidden" }}>

        {/* 01 / HERO */}
        <Box sx={{ minHeight: "88vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120%", height: "70%",
            background: "radial-gradient(ellipse at 50% -5%, rgba(124,58,237,0.16) 0%, transparent 60%)", pointerEvents: "none" }} />
          <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
            <FadeInSlide direction="up">
              <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: "3rem", sm: "4.5rem", md: "6rem" }, lineHeight: 1.05, letterSpacing: "-0.05em", mb: 4, color: "#fff" }}>
                Designing the<br /><GradText>Future of Architecture.</GradText>
              </Typography>
            </FadeInSlide>
            <FadeInSlide direction="up" delay={0.15}>
              <Typography sx={{ fontSize: "1.25rem", color: BRAND.sub, fontWeight: 500, lineHeight: 1.8 }}>
                設計の未来を、今日から。<br />次世代の設計オペレーティングシステム。
              </Typography>
            </FadeInSlide>
          </Container>
        </Box>

        {/* 02 / PROBLEM */}
        <Box sx={{ py: 20, bgcolor: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Container maxWidth="md">
            <FadeInSlide direction="right">
              <SectionBadge text="Problem" />
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 6, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff",
                fontSize: { xs: "2rem", md: "3rem" } }}>
                ツールが多すぎる。<br />データが散らばる。<br /><GradText>思考が止まる。</GradText>
              </Typography>
              <StaggerLines delay={0.2} lines={[
                "モデリング、図面、レンダリング、プレゼン。",
                "工程ごとに異なるソフトやファイル形式を扱う。",
                "インポート・エクスポートの繰り返し。",
                "データの互換性合わせ。",
                "設計者は本来の業務より「管理」に追われている。",
              ]} />
            </FadeInSlide>
          </Container>
        </Box>

        {/* 03 / VISION */}
        <Box sx={{ py: 20 }}>
          <Container maxWidth="md">
            <FadeInSlide direction="left">
              <SectionBadge text="Vision" />
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 5, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff", fontSize: { xs: "2rem", md: "3rem" } }}>
                継ぎ目のない、<br /><GradText>一つの設計環境へ。</GradText>
              </Typography>
              <Typography sx={{ fontSize: "1.15rem", lineHeight: 2.0, color: BRAND.sub, maxWidth: 620 }}>
                すべての工程が一つのデータベース上で完結する。<br />
                リアルタイムに繋がり、同期される世界。<br />
                私たちはデータの「壁」を消滅させる。
              </Typography>
            </FadeInSlide>
          </Container>
        </Box>

        {/* 04 / OS CONCEPT */}
        <Box sx={{ py: 20, bgcolor: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
          <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500,
            background: `radial-gradient(ellipse, ${PURPLE_GLOW} 0%, transparent 70%)`, pointerEvents: "none" }} />
          <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
            <FadeInSlide direction="up">
              <SectionBadge text="OS Concept" />
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 4, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff", fontSize: { xs: "2rem", md: "3rem" } }}>
                なぜ、<GradText>OS</GradText>なのか。
              </Typography>
              <Typography sx={{ fontSize: "1.15rem", lineHeight: 2.0, color: BRAND.sub, maxWidth: 620, mb: 8 }}>
                従来の独立した「ツール」を捨て去る。<br />
                「Project」という単一の核に対し、<br />
                プレゼンやレイアウト機能がモジュールとして接続される。
              </Typography>
            </FadeInSlide>

            <Box sx={{ height: 480, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", mb: 6 }}>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, ease: "easeOut" }} viewport={{ once: true }}
                style={{ width: 180, height: 180, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${PURPLE_SOFT}, rgba(37,99,235,0.1))`,
                  border: `1px solid rgba(124,58,237,0.4)`,
                  display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", zIndex: 2,
                  boxShadow: `0 0 60px ${PURPLE_GLOW}` }}>
                <Typography sx={{ fontWeight: 900, color: "#fff", fontSize: "1.2rem", letterSpacing: "-0.02em" }}>Project</Typography>
              </motion.div>

              {[
                { label: "S.Models (共有)", deg: 0 },
                { label: "S.Layout (配置)", deg: 90 },
                { label: "S.Presentations (提案)", deg: 180 },
                { label: "AI (思考)",   deg: 270 },
              ].map((item, i) => {
                const r = 160;
                const x = Math.cos((item.deg * Math.PI) / 180) * r;
                const y = Math.sin((item.deg * Math.PI) / 180) * r;
                return (
                  <motion.div key={item.label}
                    initial={{ x: x * 2.5, y: y * 2.5, opacity: 0 }}
                    whileInView={{ x, y, opacity: 1 }}
                    transition={{ duration: 1.2, delay: i * 0.15, type: "spring", bounce: 0.4 }}
                    viewport={{ once: true }}
                    style={{ position: "absolute", zIndex: 1 }}>
                    <Box sx={{ px: 2.5, py: 1.2, bgcolor: "#0a0a0a", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "100px",
                      boxShadow: `0 0 20px ${PURPLE_SOFT}` }}>
                      <Typography sx={{ color: "#A78BFA", fontWeight: 700, fontSize: "0.8rem" }}>{item.label}</Typography>
                    </Box>
                  </motion.div>
                );
              })}
            </Box>
          </Container>
        </Box>

        {/* 05 / STRUCTURE */}
        <Box sx={{ py: 20 }}>
          <Container maxWidth="md">
            <FadeInSlide direction="up">
              <SectionBadge text="Structure" />
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 8, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff", fontSize: { xs: "2rem", md: "3rem" } }}>
                新しい<GradText>設計の言語。</GradText>
              </Typography>
              <Stack spacing={5}>
                {[
                  { title: "Project = 世界",       desc: "全てのデータ、モデル、履歴を包括する唯一の入れ物。" },
                  { title: "Workspace = 作業領域", desc: "世界(Project)から特定の情報を切り抜き、編集するキャンバス。" },
                  { title: "AI = 思考パートナー",  desc: "単なるアシスタントを超え、コンテキストを理解し並走する知能。" },
                ].map((item, i) => (
                  <Box key={i} sx={{ pl: 3, borderLeft: `3px solid rgba(124,58,237,0.5)` }}>
                    <Typography sx={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff", mb: 1, letterSpacing: "-0.02em" }}>{item.title}</Typography>
                    <Typography sx={{ color: BRAND.sub, lineHeight: 1.8 }}>{item.desc}</Typography>
                  </Box>
                ))}
              </Stack>
            </FadeInSlide>
          </Container>
        </Box>

        {/* 06 / ECOSYSTEM */}
        <Box sx={{ py: 20, bgcolor: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Container maxWidth="md">
            <FadeInSlide direction="up">
              <SectionBadge text="Ecosystem" />
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 8, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff", fontSize: { xs: "2rem", md: "3rem" } }}>
                OSに接続された<GradText>機能群。</GradText>
              </Typography>
            </FadeInSlide>
            <Grid container spacing={3}>
              {ECOSYSTEM.map((app, i) => (
                <Grid item xs={12} md={4} key={app.id}>
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }} whileHover={{ y: -6 }}>
                    <Box sx={{ p: 4, bgcolor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3,
                      height: 200, display: "flex", flexDirection: "column", justifyContent: "space-between",
                      transition: "all 0.3s ease",
                      "&:hover": { borderColor: "rgba(124,58,237,0.45)", boxShadow: `0 0 40px ${PURPLE_SOFT}` } }}>
                      <Box>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                          <Typography sx={{ color: "#fff", fontWeight: 900, fontSize: "1.05rem", letterSpacing: "-0.02em" }}>{app.name}</Typography>
                          <Chip label={app.status} size="small"
                            sx={{ bgcolor: PURPLE_SOFT, color: "#A78BFA", border: "1px solid rgba(124,58,237,0.3)", fontWeight: 700, height: 20, fontSize: "0.68rem" }} />
                        </Stack>
                        <Typography sx={{ color: BRAND.sub, fontSize: "0.88rem", lineHeight: 1.6 }}>{app.value}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <ArrowForwardIcon sx={{ color: BRAND.sub2, cursor: "pointer", transition: "color 0.2s", "&:hover": { color: "#A78BFA" } }}
                          onClick={() => navigate(`/${app.id}`)} />
                      </Box>
                    </Box>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* 07 / AI FUTURE */}
        <Box sx={{ py: 20 }}>
          <Container maxWidth="md">
            <FadeInSlide direction="up">
              <SectionBadge text="AI Future" />
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 4, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff", fontSize: { xs: "2rem", md: "3rem" } }}>
                AIが、<GradText>パートナーになる。</GradText>
              </Typography>
              <Typography sx={{ fontSize: "1.15rem", lineHeight: 2.0, color: BRAND.sub, maxWidth: 620 }}>
                「操作」という概念すら古くなる。<br />
                SEKKEIYAのAIは、これまでの全てのProjectとWorkspaceの<br />
                文脈を理解し、あなたの思考に合わせて自律的に空間を構築する。
              </Typography>
            </FadeInSlide>
          </Container>
        </Box>

        {/* 08 / ASSET FUTURE */}
        <Box sx={{ py: 20, bgcolor: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Container maxWidth="md">
            <FadeInSlide direction="up">
              <SectionBadge text="Asset Future" />
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 4, lineHeight: 1.2, letterSpacing: "-0.04em", color: "#fff", fontSize: { xs: "2rem", md: "3rem" } }}>
                設計スキルは、<GradText>資産になる。</GradText>
              </Typography>
              <Typography sx={{ fontSize: "1.15rem", lineHeight: 2.0, color: BRAND.sub, maxWidth: 620 }}>
                OSに蓄積されたすべての設計履歴は、<br />
                AIを通じて「組織の固有ノウハウ」として抽出される。<br />
                個人の経験は永久的な価値となり、次世代へ継承されていく。
              </Typography>
            </FadeInSlide>
          </Container>
        </Box>

        {/* 09 / CTA */}
        <Box sx={{ pt: 20, pb: 26, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "70%", height: "60%",
            background: `radial-gradient(ellipse at 50% 100%, ${PURPLE_GLOW} 0%, transparent 65%)`, pointerEvents: "none" }} />
          <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
            <FadeInSlide direction="up">
              <Typography variant="h2" sx={{ fontWeight: 900, mb: 4, letterSpacing: "-0.05em",
                background: "linear-gradient(180deg, #fff 40%, rgba(255,255,255,0.5) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                fontSize: { xs: "2.5rem", md: "4rem" } }}>
                今すぐ、始める。
              </Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: "1.05rem", mb: 8, lineHeight: 2 }}>
                SEKKEIYA Desktop をダウンロードして、<br />AI駆動の設計環境を体感してください。
              </Typography>
              <motion.div animate={{ boxShadow: [`0 0 0px ${PURPLE_GLOW}`, `0 0 50px ${PURPLE_GLOW}`, `0 0 0px ${PURPLE_GLOW}`] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ borderRadius: "100px", display: "inline-block" }}>
                <Button variant="contained" size="large" onClick={() => navigate("/")}
                  sx={{ background: GRAD_PRIMARY, color: "#fff", fontWeight: 800, px: 7, py: 2.5, borderRadius: "100px", textTransform: "none", fontSize: "1.1rem",
                    "&:hover": { background: "linear-gradient(135deg, #6D28D9, #1D4ED8)", boxShadow: `0 0 32px ${PURPLE_GLOW}` } }}>
                  Download Desktop
                </Button>
              </motion.div>
            </FadeInSlide>
          </Container>
        </Box>

      </Box>
    </>
  );
}
