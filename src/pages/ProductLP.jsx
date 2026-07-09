import React, { useEffect } from "react";
import { Box, Container, Typography, Stack, Button, Chip } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { motion } from "framer-motion";
import { BRAND } from "@/shared/ui/theme";
import { SEO } from "@/shared/components/seo/SEO";
import { ECOSYSTEM_SERVICES, SERVICE_CATEGORIES, findServiceBySlug } from "@/shared/data/marketplaceData";

const GRAD_PRIMARY = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";

/**
 * 製品LP（/products/:slug）— 子アプリ1つにつき1枚の「専用サイト」。
 * コンテンツはすべて marketplaceData.js（単一データ源）から差し込む共通テンプレート。
 * 旧 `/:handle` 単一セグメント経由（/3dss 等）でも描画できるが、canonical は
 * 常に /products/{slug} を指す。
 */
export default function ProductLP() {
  const { slug, handle, appId } = useParams();
  const navigate = useNavigate();

  const service = findServiceBySlug(slug || handle || appId);

  // 兄弟LP間の遷移でスクロール位置が残らないように
  useEffect(() => { window.scrollTo(0, 0); }, [service?.id]);

  if (!service) {
    return (
      <Container sx={{ py: 20, textAlign: "center" }}>
        <Typography variant="h4" sx={{ color: "#fff" }}>Product Not Found</Typography>
        <Button onClick={() => navigate("/marketplace")} sx={{ mt: 2 }}>Marketplace へ戻る</Button>
      </Container>
    );
  }

  const category = SERVICE_CATEGORIES.find((c) => c.id === service.category);
  const siblings = ECOSYSTEM_SERVICES.filter((s) => s.category === service.category && s.id !== service.id);

  // 表記ゆれ対策: 「smodels」「slayout」等のドット無し検索は、Google が
  // 「S.Model」を s / models に分割するため素通りする。連結表記（SModels）を
  // title・本文・JSON-LD alternateName に明示して拾えるようにする。
  const alias = service.title.replace(/\./g, "");        // S.Model → SModels
  const aliasSpaced = service.title.replace(/\./g, " "); // S.Model → S Models

  return (
    <Box sx={{ bgcolor: "#000", color: "#fff", overflowX: "hidden" }}>
      {/* title はアプリ名 + 一般キーワード句（seoTitle）。ブランド名を知らない
          「間取り 3D シミュレーション」等の検索にも title/description で応答する。 */}
      <SEO
        title={`${service.title}（${alias}）｜${service.seoTitle}`}
        description={`${alias}（${service.title}）— ${service.longDesc}`}
        path={`/products/${service.slug}`}
      >
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: service.title,
            alternateName: [alias, alias.toLowerCase(), aliasSpaced],
            description: service.longDesc,
            url: `https://sekkeiya.com/products/${service.slug}`,
            applicationCategory: "DesignApplication",
            operatingSystem: "Web, Windows, macOS",
            offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
            publisher: { "@type": "Organization", name: "SEKKEIYA", url: "https://sekkeiya.com" },
          })}
        </script>
        {/* FAQ の構造化データ（リッチリザルト候補）。FAQ を持つアプリのみ出力。 */}
        {service.faq?.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: service.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            })}
          </script>
        )}
      </SEO>

      {/* ── Hero ─────────────────────────────────────────── */}
      <Box sx={{ position: "relative", pt: { xs: 16, md: 22 }, pb: { xs: 8, md: 12 }, overflow: "hidden",
        borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Box sx={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120%", height: "80%",
          background: `radial-gradient(ellipse at 50% -5%, ${service.color}2E 0%, transparent 62%)`, pointerEvents: "none" }} />
        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.15fr 0.85fr" }, gap: { xs: 6, md: 8 }, alignItems: "center" }}>

            {/* Copy */}
            <Box>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 3 }}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 2, py: 0.6, borderRadius: "100px",
                  border: `1px solid ${category?.themeColor || "#7C3AED"}55`, bgcolor: `${category?.themeColor || "#7C3AED"}14` }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: category?.themeColor || "#7C3AED" }} />
                  <Typography sx={{ color: category?.themeColor || "#A78BFA", fontSize: "0.7rem", fontWeight: 700,
                    letterSpacing: "0.16em", fontFamily: "monospace" }}>
                    {category?.label || "PRODUCT"}
                  </Typography>
                </Box>
                {service.status !== "ACTIVE" && (
                  <Chip label={service.status} size="small" sx={{
                    bgcolor: "rgba(255,255,255,0.06)", color: BRAND.sub, border: "1px solid rgba(255,255,255,0.12)",
                    fontWeight: 700, fontSize: "0.62rem", height: 22, letterSpacing: "0.08em" }} />
                )}
              </Stack>

              <Typography sx={{ color: service.color, fontWeight: 800, letterSpacing: "0.06em", mb: 1.5, fontSize: "0.95rem" }}>
                {service.title}
              </Typography>
              <Typography component="h1" sx={{ fontWeight: 900, color: "#fff", mb: 3, lineHeight: 1.16,
                letterSpacing: "-0.03em", fontSize: { xs: "2.1rem", sm: "2.8rem", md: "3.3rem" } }}>
                {service.catchphrase}
              </Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: { xs: "1rem", md: "1.08rem" }, lineHeight: 1.9, mb: 4, maxWidth: 560 }}>
                {service.longDesc}
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button variant="contained" size="large" endIcon={<PlayArrowIcon />}
                  onClick={() => navigate(`/demo/${service.id}`)}
                  sx={{ background: GRAD_PRIMARY, color: "#fff", fontWeight: 800, px: 4, py: 1.5,
                    borderRadius: "100px", textTransform: "none", fontSize: 15,
                    "&:hover": { background: "linear-gradient(135deg, #6D28D9, #1D4ED8)", boxShadow: "0 0 24px rgba(124,58,237,0.4)" },
                    transition: "all 0.2s" }}>
                  {service.title} を試す（DEMO）
                </Button>
                <Button variant="outlined" size="large" onClick={() => navigate("/pricing")}
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)", px: 4, py: 1.5,
                    borderRadius: "100px", textTransform: "none", fontWeight: 700, fontSize: 15,
                    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.06)" } }}>
                  料金プランを見る
                </Button>
              </Stack>
            </Box>

            {/* Icon tile */}
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Box sx={{ position: "relative", width: { xs: 220, md: 300 }, height: { xs: 220, md: 300 } }}>
                <Box sx={{ position: "absolute", inset: -40, borderRadius: "50%",
                  background: `radial-gradient(circle, ${service.color}40 0%, transparent 68%)`, filter: "blur(30px)" }} />
                <Box sx={{ position: "relative", width: "100%", height: "100%", borderRadius: "26%",
                  bgcolor: "rgba(255,255,255,0.97)", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 24px 64px ${service.color}55, 0 0 0 1px ${service.color}45` }}>
                  <Box component="img" src={service.icon} alt={service.title}
                    sx={{ width: "72%", height: "72%", objectFit: "contain" }} />
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── Overview（SEO本文） ──────────────────────────── */}
      {service.overview && (
        <Box sx={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <Container maxWidth="md" sx={{ py: { xs: 8, md: 11 } }}>
            <Typography sx={{ color: "#A78BFA", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em",
              fontFamily: "monospace", mb: 2.5 }}>
              OVERVIEW
            </Typography>
            <Typography component="h2" sx={{ fontWeight: 900, fontSize: { xs: "1.5rem", md: "2.1rem" },
              letterSpacing: "-0.03em", lineHeight: 1.35, mb: 4 }}>
              {service.overview.heading}
            </Typography>
            <Stack spacing={3}>
              {service.overview.paragraphs.map((p, i) => (
                <Typography key={i} sx={{ color: BRAND.sub, fontSize: { xs: "0.98rem", md: "1.05rem" }, lineHeight: 2 }}>
                  {p}
                </Typography>
              ))}
            </Stack>
          </Container>
        </Box>
      )}

      {/* ── Features ─────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Box sx={{ textAlign: "center", mb: { xs: 5, md: 8 } }}>
          <Typography sx={{ color: "#A78BFA", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em",
            fontFamily: "monospace", mb: 2 }}>
            FEATURES
          </Typography>
          <Typography component="h2" variant="h3" sx={{ fontWeight: 900, fontSize: { xs: "1.7rem", md: "2.4rem" }, letterSpacing: "-0.03em" }}>
            {service.title} でできること
          </Typography>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: `repeat(${Math.min(service.features.length, 3)}, 1fr)` }, gap: 3 }}>
          {service.features.map((feat, idx) => (
            <Box key={idx} sx={{ p: 4, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.07)", height: "100%",
              transition: "border-color 0.3s", "&:hover": { borderColor: `${service.color}66` } }}>
              <Typography sx={{ color: `${service.color}59`, fontWeight: 900, fontSize: "2.6rem", lineHeight: 1, mb: 2, fontFamily: "monospace" }}>
                0{idx + 1}
              </Typography>
              <Typography sx={{ fontWeight: 800, mb: 1.2, color: "#fff", fontSize: "1.05rem" }}>{feat.title}</Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: "0.9rem", lineHeight: 1.8 }}>{feat.desc}</Typography>
            </Box>
          ))}
        </Box>
      </Container>

      {/* ── Use Cases（利用シーン） ──────────────────────── */}
      {service.useCases?.length > 0 && (
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.07)", bgcolor: "rgba(255,255,255,0.015)" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 8 } }}>
              <Typography sx={{ color: "#A78BFA", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em",
                fontFamily: "monospace", mb: 2 }}>
                USE CASES
              </Typography>
              <Typography component="h2" variant="h3" sx={{ fontWeight: 900, fontSize: { xs: "1.7rem", md: "2.4rem" }, letterSpacing: "-0.03em" }}>
                こんな場面で使えます
              </Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: `repeat(${Math.min(service.useCases.length, 3)}, 1fr)` }, gap: 3 }}>
              {service.useCases.map((uc, idx) => (
                <Box key={idx} sx={{ p: 4, borderRadius: 4, height: "100%",
                  border: "1px solid rgba(255,255,255,0.07)", bgcolor: "rgba(0,0,0,0.4)" }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: "12px", mb: 2.5,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: `${service.color}1F`, border: `1px solid ${service.color}59` }}>
                    <Typography sx={{ color: service.color, fontWeight: 900, fontSize: "1.1rem" }}>{idx + 1}</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 800, mb: 1.2, color: "#fff", fontSize: "1.05rem" }}>{uc.title}</Typography>
                  <Typography sx={{ color: BRAND.sub, fontSize: "0.9rem", lineHeight: 1.85 }}>{uc.desc}</Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>
      )}

      {/* ── FAQ ──────────────────────────────────────────── */}
      {service.faq?.length > 0 && (
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 } }}>
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
              <Typography sx={{ color: "#A78BFA", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em",
                fontFamily: "monospace", mb: 2 }}>
                FAQ
              </Typography>
              <Typography component="h2" variant="h3" sx={{ fontWeight: 900, fontSize: { xs: "1.7rem", md: "2.4rem" }, letterSpacing: "-0.03em" }}>
                よくある質問
              </Typography>
            </Box>
            <Stack spacing={2}>
              {service.faq.map((f, idx) => (
                <Box key={idx} sx={{ p: { xs: 3, md: 3.5 }, borderRadius: 3,
                  border: "1px solid rgba(255,255,255,0.08)", bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography component="h3" sx={{ fontWeight: 800, color: "#fff", fontSize: "1rem", mb: 1.2,
                    display: "flex", gap: 1.2 }}>
                    <Box component="span" sx={{ color: service.color, flexShrink: 0 }}>Q.</Box>
                    {f.q}
                  </Typography>
                  <Typography sx={{ color: BRAND.sub, fontSize: "0.92rem", lineHeight: 1.9, pl: 2.8 }}>{f.a}</Typography>
                </Box>
              ))}
            </Stack>
          </Container>
        </Box>
      )}

      {/* ── Same-category products ───────────────────────── */}
      {siblings.length > 0 && (
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 8, md: 10 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 4, flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography sx={{ color: category?.themeColor, fontSize: "0.7rem", fontWeight: 700,
                  letterSpacing: "0.16em", fontFamily: "monospace", mb: 1 }}>
                  {category?.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: "1.4rem", md: "1.8rem" }, letterSpacing: "-0.02em" }}>
                  同じカテゴリのアプリ
                </Typography>
              </Box>
              <Button endIcon={<ArrowForwardIcon />} onClick={() => navigate("/marketplace")}
                sx={{ color: "#A78BFA", textTransform: "none", fontWeight: 700,
                  "&:hover": { color: "#C4B5FD", bgcolor: "transparent" } }}>
                すべてのプロダクトを見る
              </Button>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 3 }}>
              {siblings.map((sib) => (
                <motion.div key={sib.id} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                  <Box onClick={() => navigate(`/products/${sib.slug}`)}
                    sx={{ p: 3, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 4, cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.07)", height: "100%",
                      transition: "all 0.3s ease",
                      "&:hover": { borderColor: `${sib.color}66`, boxShadow: `0 0 32px ${sib.color}22` } }}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: "12px", bgcolor: "rgba(255,255,255,0.96)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        boxShadow: `0 4px 14px ${sib.color}44` }}>
                        <Box component="img" src={sib.icon} alt={sib.title} sx={{ width: 32, height: 32, objectFit: "contain" }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>{sib.title}</Typography>
                      </Box>
                    </Stack>
                    <Typography sx={{ color: BRAND.sub, fontSize: "0.84rem", lineHeight: 1.7,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {sib.desc}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>
          </Container>
        </Box>
      )}

      {/* ── Bottom CTA ───────────────────────────────────── */}
      <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden" }}>
        <Box sx={{ position: "absolute", bottom: "-40%", left: "50%", transform: "translateX(-50%)", width: "90%", height: "100%",
          background: "radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.18) 0%, transparent 65%)", pointerEvents: "none" }} />
        <Container maxWidth="md" sx={{ py: { xs: 10, md: 14 }, textAlign: "center", position: "relative", zIndex: 1 }}>
          <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: "1.7rem", md: "2.4rem" }, letterSpacing: "-0.03em", mb: 2.5 }}>
            SEKKEIYAで、設計のすべてをひとつに。
          </Typography>
          <Typography sx={{ color: BRAND.sub, fontSize: "1rem", lineHeight: 1.9, mb: 5, maxWidth: 520, mx: "auto" }}>
            {service.title}（{alias}）は SEKKEIYA OS のエコシステムの一部。プロジェクトのデータはすべてのアプリでつながります。
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button variant="contained" size="large" onClick={() => navigate("/demo")}
              sx={{ background: GRAD_PRIMARY, color: "#fff", fontWeight: 800, px: 5, py: 1.6,
                borderRadius: "100px", textTransform: "none", fontSize: 15,
                "&:hover": { background: "linear-gradient(135deg, #6D28D9, #1D4ED8)", boxShadow: "0 0 24px rgba(124,58,237,0.4)" } }}>
              Get Started Free
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate("/marketplace")}
              sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)", px: 5, py: 1.6,
                borderRadius: "100px", textTransform: "none", fontWeight: 700, fontSize: 15,
                "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.06)" } }}>
              Marketplace を見る
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
