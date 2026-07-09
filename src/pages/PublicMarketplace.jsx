import React, { useState, useMemo } from "react";
import { Box, Container, Typography, Card, CardContent, Chip, TextField, InputAdornment, Tabs, Tab } from "@mui/material";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import { motion } from "framer-motion";
import { BRAND } from "@/shared/ui/theme";
import { SEO } from "@/shared/components/seo/SEO";
import { ECOSYSTEM_SERVICES, SERVICE_CATEGORIES } from "@/shared/data/marketplaceData";

const PURPLE      = "#7C3AED";
const PURPLE_SOFT = "rgba(124,58,237,0.12)";
const PURPLE_GLOW = "rgba(124,58,237,0.22)";
const GRAD_TEXT   = "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)";

const GradText = ({ children }) => (
  <Box component="span" sx={{ background: GRAD_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
    {children}
  </Box>
);

export default function PublicMarketplace() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredServices = useMemo(() => {
    return ECOSYSTEM_SERVICES.filter(service => {
      const matchesSearch =
        service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.desc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = activeCategory === "all" || service.category === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, activeCategory]);

  return (
    <>
      <SEO title="Marketplace | SEKKEIYA" description="Discover apps, plugins, and templates for SEKKEIYA OS." path="/marketplace" />
      <Box sx={{ minHeight: "100vh", bgcolor: "#000", color: "#fff", overflowX: "hidden" }}>

        {/* Hero */}
        <Box sx={{ pt: { xs: 18, md: 24 }, pb: 10, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120%", height: "70%",
            background: "radial-gradient(ellipse at 50% -5%, rgba(124,58,237,0.16) 0%, transparent 60%)", pointerEvents: "none" }} />
          <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mb: 3, px: 2, py: 0.6, borderRadius: "100px",
              border: "1px solid rgba(124,58,237,0.35)", bgcolor: PURPLE_SOFT }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: PURPLE }} />
              <Typography sx={{ color: "#A78BFA", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", fontFamily: "monospace" }}>
                MARKETPLACE
              </Typography>
            </Box>
            <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: "2.5rem", md: "4.5rem" }, mb: 3, lineHeight: 1.1, letterSpacing: "-0.05em", color: "#fff" }}>
              SEKKEIYA <GradText>Ecosystem</GradText>
            </Typography>
            <Typography sx={{ color: BRAND.sub, fontSize: "1.05rem", maxWidth: 560, mx: "auto", lineHeight: 1.8 }}>
              設計・開発に特化したアプリ、プラグイン、テンプレートを発見する。
            </Typography>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ pb: 15 }}>
          {/* Search */}
          <Box sx={{ maxWidth: 560, mx: "auto", mb: 5 }}>
            <TextField
              placeholder="Marketplace を検索..."
              variant="outlined" fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: BRAND.sub }} /></InputAdornment> }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(255,255,255,0.04)", color: "#fff", borderRadius: "100px", height: 52,
                  "& fieldset": { border: "1px solid rgba(255,255,255,0.1)" },
                  "&:hover fieldset": { borderColor: "rgba(124,58,237,0.4)" },
                  "&.Mui-focused fieldset": { borderColor: "rgba(124,58,237,0.6)" },
                }
              }}
            />
          </Box>

          {/* Category Tabs */}
          <Tabs value={activeCategory} onChange={(_, v) => setActiveCategory(v)}
            variant="scrollable" scrollButtons="auto"
            sx={{
              mb: 6,
              "& .MuiTab-root": { color: BRAND.sub, fontWeight: 700, textTransform: "none", fontSize: "0.92rem", minHeight: 40, px: 2.5 },
              "& .Mui-selected": { color: "#fff" },
              "& .MuiTabs-indicator": { background: GRAD_TEXT, height: 2, borderRadius: 2 },
            }}>
            <Tab label="All" value="all" disableRipple />
            {SERVICE_CATEGORIES.map(cat => <Tab key={cat.id} label={cat.label} value={cat.id} disableRipple />)}
          </Tabs>

          {/* Count */}
          <Typography sx={{ color: BRAND.sub2, fontSize: "0.8rem", mb: 4, fontFamily: "monospace", letterSpacing: "0.1em" }}>
            {filteredServices.length} PRODUCTS
          </Typography>

          {/* Grid */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 3 }}>
            {filteredServices.map(service => (
              <motion.div key={service.id} whileHover={{ y: -6 }} transition={{ duration: 0.2 }}>
                <Card sx={{
                  bgcolor: "rgba(255,255,255,0.03)", borderRadius: 3,
                  border: "1px solid rgba(255,255,255,0.07)",
                  cursor: "pointer", position: "relative",
                  transition: "all 0.3s ease",
                  "&:hover": { borderColor: "rgba(124,58,237,0.45)", boxShadow: `0 0 40px ${PURPLE_SOFT}` }
                }} onClick={() => navigate(`/products/${service.slug}`)}>

                  {/* Thumbnail */}
                  <Box sx={{ height: 156, background: `radial-gradient(circle at 50% 38%, ${service.color}40 0%, ${service.color}14 45%, rgba(124,58,237,0.06) 100%)`,
                    position: "relative", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Box sx={{ width: 104, height: 104, borderRadius: "24px", bgcolor: "rgba(255,255,255,0.96)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 28px ${service.color}55, 0 0 0 1px ${service.color}45` }}>
                      <img src={service.icon} alt={service.title} style={{ width: 84, height: 84, objectFit: "contain" }} />
                    </Box>
                    {service.status !== "ACTIVE" && (
                      <Chip label="COMING SOON" size="small" sx={{
                        position: "absolute", top: 10, right: 10,
                        bgcolor: "rgba(0,0,0,0.8)", color: BRAND.sub, border: "1px solid rgba(255,255,255,0.08)",
                        fontWeight: 700, fontSize: "0.62rem", height: 20,
                      }} />
                    )}
                  </Box>

                  <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: "#fff", lineHeight: 1.2,
                        display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {service.title}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0, ml: 1 }}>
                        <StarIcon sx={{ color: "#f5a623", fontSize: 13, mr: 0.5 }} />
                        <Typography sx={{ color: BRAND.sub, fontSize: "0.78rem", fontWeight: 600 }}>5.0</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ color: BRAND.sub2, fontSize: "0.75rem", mb: 1.5 }}>SEKKEIYA Official</Typography>
                    <Typography sx={{ color: "#A78BFA", fontWeight: 800, fontSize: "0.88rem" }}>Free</Typography>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </Box>

          {filteredServices.length === 0 && (
            <Box sx={{ textAlign: "center", py: 12 }}>
              <Typography sx={{ color: BRAND.sub2 }}>該当するプロダクトが見つかりません。</Typography>
            </Box>
          )}
        </Container>
      </Box>
    </>
  );
}
