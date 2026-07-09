import React, { useState, useEffect, useRef } from "react";
import { Box, Stack, Typography, Button, IconButton, Drawer, Container, Collapse } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { BRAND } from "../ui/theme";
import { useAuth } from "@/features/auth/context/AuthContext";
import { usePwaInstall } from "@/shared/pwa/PwaInstallProvider";
import TopRightMenu, { checkIsAdmin } from "./TopRightMenu";
import sekkeiyaPng from "@/assets/icons/sekkeiya.png";
import { ECOSYSTEM_SERVICES, SERVICE_CATEGORIES } from "@/shared/data/marketplaceData";

const PURPLE      = "#7C3AED";
const GRAD_PRIMARY = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";

// megaMenu: true の項目は Products メガメニュー（PC=hover / モバイル=アコーディオン）
const NAV_LINKS = [
  { label: "Gallery",     href: "/gallery" },
  { label: "Vision",      href: "/vision" },
  { label: "About",       href: "/about" },
  { label: "Services",    href: "/services" },
  { label: "Products",    megaMenu: true },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Articles",    href: "/articles" },
  { label: "Pricing",     href: "/pricing" },
  { label: "Download",    href: "/#download-section" },
];

export default function GlobalHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);           // PC メガメニュー
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false); // モバイル アコーディオン
  const closeTimer = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { requestGoToApp } = usePwaInstall();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ルート遷移でメガメニューを閉じる
  useEffect(() => { setProductsOpen(false); }, [location.pathname]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // hover の出入りで即閉じないよう、閉じる側だけ僅かに遅延させる
  const openProducts = () => { clearTimeout(closeTimer.current); setProductsOpen(true); };
  const scheduleCloseProducts = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setProductsOpen(false), 160);
  };

  const handleNavClick = (href) => {
    setMobileMenuOpen(false);
    if (href.startsWith("/#")) {
      if (location.pathname !== "/") { navigate(href); }
      else {
        const id = href.replace("/#", "");
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(href);
    }
  };

  const goProduct = (svc) => {
    setProductsOpen(false);
    setMobileMenuOpen(false);
    navigate(`/products/${svc.slug}`);
  };

  return (
    <>
      <Box component="header" sx={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: { xs: 60, sm: 66 },
        px: { xs: 2, sm: 4, md: 6 },
        display: "flex", alignItems: "center", justifyContent: "space-between",
        zIndex: 1100,
        transition: "all 0.3s ease",
        bgcolor: scrolled || productsOpen ? "rgba(0,0,0,0.82)" : "transparent",
        backdropFilter: scrolled || productsOpen ? "blur(16px)" : "none",
        borderBottom: scrolled || productsOpen ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
      }}>

        {/* Logo */}
        <Box onClick={() => navigate("/")} sx={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box component="img" src={sekkeiyaPng} alt="SEKKEIYA" sx={{ width: 22, height: 22, borderRadius: "4px", objectFit: "cover" }} />
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 16, sm: 18 }, letterSpacing: "-0.01em", color: "#fff" }}>
            SEKKEIYA
          </Typography>
        </Box>

        {/* Desktop Nav */}
        <Stack direction="row" spacing={0} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
          {NAV_LINKS.map((link) => link.megaMenu ? (
            <Box key={link.label} onMouseEnter={openProducts} onMouseLeave={scheduleCloseProducts}>
              <Typography onClick={() => setProductsOpen((v) => !v)} sx={{
                fontSize: 13.5, fontWeight: 600,
                color: productsOpen ? "#fff" : BRAND.sub,
                cursor: "pointer", px: 1.5, py: 1, borderRadius: 2,
                transition: "color 0.2s",
                display: "inline-flex", alignItems: "center", gap: 0.3,
                "&:hover": { color: "#fff" },
              }}>
                {link.label}
                <KeyboardArrowDownIcon sx={{
                  fontSize: 16, transition: "transform 0.2s",
                  transform: productsOpen ? "rotate(180deg)" : "none",
                }} />
              </Typography>
            </Box>
          ) : (
            <Typography key={link.label} onClick={() => handleNavClick(link.href)} sx={{
              fontSize: 13.5, fontWeight: 600,
              color: link.label === "Download" ? "#A78BFA" : BRAND.sub,
              cursor: "pointer", px: 1.5, py: 1, borderRadius: 2,
              transition: "color 0.2s",
              "&:hover": { color: link.label === "Download" ? "#C4B5FD" : "#fff" },
            }}>
              {link.label}
            </Typography>
          ))}
        </Stack>

        {/* Right CTA */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
          {user ? (
            <TopRightMenu user={user} onDashboardClick={requestGoToApp} />
          ) : (
            <>
              <Typography onClick={() => navigate("/login")} sx={{
                fontSize: 13.5, fontWeight: 600, color: BRAND.sub, cursor: "pointer",
                "&:hover": { color: "#fff" }, transition: "color 0.2s"
              }}>
                Log in
              </Typography>
              <Button variant="contained" onClick={() => navigate("/demo")} sx={{
                background: GRAD_PRIMARY, color: "#fff", textTransform: "none",
                fontWeight: 700, fontSize: 13, px: 2.5, py: 0.9, borderRadius: "100px",
                "&:hover": { background: "linear-gradient(135deg, #6D28D9, #1D4ED8)", boxShadow: "0 0 20px rgba(124,58,237,0.35)" },
                transition: "all 0.2s",
              }}>
                Get Started Free
              </Button>
            </>
          )}
        </Stack>

        {/* Mobile toggle */}
        <IconButton sx={{ display: { xs: "flex", md: "none" }, color: BRAND.text }} onClick={() => setMobileMenuOpen(true)}>
          <MenuIcon />
        </IconButton>
      </Box>

      {/* ── Products メガメニュー（PC・hoverで展開） ── */}
      <Box onMouseEnter={openProducts} onMouseLeave={scheduleCloseProducts} sx={{
        position: "fixed", top: { xs: 60, sm: 66 }, left: 0, right: 0, zIndex: 1099,
        display: { xs: "none", md: "block" },
        opacity: productsOpen ? 1 : 0,
        visibility: productsOpen ? "visible" : "hidden",
        transform: productsOpen ? "translateY(0)" : "translateY(-10px)",
        pointerEvents: productsOpen ? "auto" : "none",
        transition: "opacity 0.22s ease, transform 0.22s ease, visibility 0.22s",
        bgcolor: "rgba(4,4,10,0.94)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 32px 64px rgba(0,0,0,0.55)",
      }}>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {/* minmax(0,1fr): 列を内容幅より縮められるようにして、説明文の nowrap 省略が
              効くようにする（1fr のままだと min-content=全文幅で列が膨張し右へ溢れる）。 */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5 }}>
            {SERVICE_CATEGORIES.map((cat) => (
              <Box key={cat.id}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: cat.themeColor }} />
                  <Typography sx={{ color: cat.themeColor, fontSize: "0.68rem", fontWeight: 700,
                    letterSpacing: "0.16em", fontFamily: "monospace" }}>
                    {cat.label}
                  </Typography>
                </Stack>
                <Typography sx={{ color: BRAND.sub2, fontSize: "0.74rem", mb: 2 }}>{cat.subtitle}</Typography>
                <Stack spacing={0.5}>
                  {ECOSYSTEM_SERVICES.filter((s) => s.category === cat.id).map((svc) => (
                    <Box key={svc.id} onClick={() => goProduct(svc)} sx={{
                      display: "flex", alignItems: "center", gap: 1.5,
                      p: 1.2, ml: -1.2, borderRadius: 2.5, cursor: "pointer",
                      transition: "background 0.15s",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                    }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: "9px", bgcolor: "rgba(255,255,255,0.96)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        boxShadow: `0 3px 10px ${svc.color}44` }}>
                        <Box component="img" src={svc.icon} alt={svc.title} sx={{ width: 25, height: 25, objectFit: "contain" }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: "0.86rem", lineHeight: 1.2 }}>
                            {svc.title}
                          </Typography>
                          {svc.status !== "ACTIVE" && (
                            <Typography sx={{ color: BRAND.sub2, fontSize: "0.58rem", fontWeight: 700,
                              letterSpacing: "0.08em", fontFamily: "monospace" }}>
                              {svc.status}
                            </Typography>
                          )}
                        </Stack>
                        <Typography sx={{ color: BRAND.sub2, fontSize: "0.7rem", whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis" }}>
                          {svc.desc}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          {/* Footer link */}
          <Box sx={{ mt: 3, pt: 2.5, borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", justifyContent: "flex-end" }}>
            <Typography onClick={() => { setProductsOpen(false); navigate("/marketplace"); }} sx={{
              color: "#A78BFA", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 0.6,
              transition: "color 0.2s", "&:hover": { color: "#C4B5FD" },
            }}>
              すべてのプロダクトを見る（Marketplace）
              <ArrowForwardIcon sx={{ fontSize: 15 }} />
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}
        PaperProps={{ sx: { width: "100%", bgcolor: "#000", p: 3 } }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 4 }}>
          <IconButton onClick={() => setMobileMenuOpen(false)} sx={{ color: BRAND.text }}>
            <CloseIcon fontSize="large" />
          </IconButton>
        </Box>
        <Stack spacing={2} alignItems="center">
          {NAV_LINKS.map((link) => link.megaMenu ? (
            <Box key={link.label} sx={{ width: "100%", textAlign: "center" }}>
              <Typography variant="h5" onClick={() => setMobileProductsOpen((v) => !v)} sx={{
                fontWeight: 700, cursor: "pointer", color: BRAND.text, letterSpacing: "-0.01em",
                display: "inline-flex", alignItems: "center", gap: 0.5,
              }}>
                {link.label}
                <KeyboardArrowDownIcon sx={{
                  transition: "transform 0.2s",
                  transform: mobileProductsOpen ? "rotate(180deg)" : "none",
                }} />
              </Typography>
              <Collapse in={mobileProductsOpen}>
                <Stack spacing={0.5} sx={{ mt: 1.5, mb: 1, mx: "auto", maxWidth: 320 }}>
                  {ECOSYSTEM_SERVICES.map((svc) => (
                    <Box key={svc.id} onClick={() => goProduct(svc)} sx={{
                      display: "flex", alignItems: "center", gap: 1.5, p: 1.2, borderRadius: 2.5,
                      cursor: "pointer", "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                    }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: "8px", bgcolor: "rgba(255,255,255,0.96)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Box component="img" src={svc.icon} alt={svc.title} sx={{ width: 24, height: 24, objectFit: "contain" }} />
                      </Box>
                      <Box sx={{ textAlign: "left", minWidth: 0 }}>
                        <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: "0.92rem" }}>{svc.title}</Typography>
                        <Typography sx={{ color: BRAND.sub2, fontSize: "0.7rem", whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis" }}>
                          {svc.desc}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          ) : (
            <Typography key={link.label} variant="h5" onClick={() => handleNavClick(link.href)} sx={{
              fontWeight: 700, cursor: "pointer",
              color: link.label === "Download" ? "#A78BFA" : BRAND.text,
              letterSpacing: "-0.01em",
            }}>
              {link.label}
            </Typography>
          ))}
          <Box sx={{ pt: 4, width: "100%", px: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {user ? (
              <>
                {checkIsAdmin(user) && (
                  <Button fullWidth variant="outlined"
                    onClick={() => { setMobileMenuOpen(false); navigate("/admin"); }}
                    sx={{ color: "#c084fc", borderColor: "rgba(192,132,252,0.45)", bgcolor: "rgba(192,132,252,0.08)", py: 1.4, borderRadius: "100px", fontWeight: 700, fontSize: 15, textTransform: "none",
                      "&:hover": { borderColor: "#c084fc", bgcolor: "rgba(192,132,252,0.15)" } }}>
                    管理画面（Admin）
                  </Button>
                )}
                <Button fullWidth variant="contained"
                  onClick={() => { setMobileMenuOpen(false); requestGoToApp(); }}
                  sx={{ background: GRAD_PRIMARY, color: "#fff", py: 1.6, borderRadius: "100px", fontWeight: 700, fontSize: 15, textTransform: "none",
                    "&:hover": { background: "linear-gradient(135deg, #6D28D9, #1D4ED8)" } }}>
                  ダッシュボードへ
                </Button>
              </>
            ) : (
              <>
                <Button fullWidth variant="contained"
                  onClick={() => { setMobileMenuOpen(false); navigate("/demo"); }}
                  sx={{ background: GRAD_PRIMARY, color: "#fff", py: 1.6, borderRadius: "100px", fontWeight: 700, fontSize: 15, textTransform: "none",
                    "&:hover": { background: "linear-gradient(135deg, #6D28D9, #1D4ED8)" } }}>
                  Get Started Free
                </Button>
                <Button fullWidth variant="outlined"
                  onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", py: 1.4, borderRadius: "100px", fontWeight: 600, fontSize: 15, textTransform: "none",
                    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.06)" } }}>
                  ログイン
                </Button>
              </>
            )}
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}
