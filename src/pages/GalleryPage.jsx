import React, { useState } from "react";
import { Box, Container, Typography, InputBase } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { BRAND } from "@/shared/ui/theme";
import { SEO } from "@/shared/components/seo/SEO";
import PublicModelGallery from "@/pages/gallery/PublicModelGallery";

const GRAD_TEXT = "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)";

export default function GalleryPage() {
  const [keyword, setKeyword] = useState("");

  return (
    <>
      <SEO title="Gallery — SEKKEIYA" description="SEKKEIYA で作られた 3D モデル・成果物のギャラリー。" path="/gallery" />
      <Box sx={{ bgcolor: "#000", color: BRAND.text, minHeight: "100vh", pt: { xs: 14, md: 18 }, pb: 12 }}>
        <Container maxWidth="xl">
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: "2.4rem", md: "3.6rem" },
              letterSpacing: "-0.04em", mb: 2 }}>
              みんなの<Box component="span" sx={{ background: GRAD_TEXT,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>成果物</Box>
            </Typography>
            <Typography sx={{ color: BRAND.sub, fontSize: "1.05rem", mb: 4 }}>
              3D モデル・AIパース・図面など、SEKKEIYA で生み出されたすべての成果物。
            </Typography>

            <Box sx={{ maxWidth: 520, mx: "auto", display: "flex", alignItems: "center", gap: 1.5,
              px: 2.5, py: 1.2, borderRadius: "100px", bgcolor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              "&:focus-within": { borderColor: "rgba(124,58,237,0.5)" } }}>
              <SearchIcon sx={{ color: BRAND.sub2 }} />
              <InputBase value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder="タイトル・作者・タグで検索..."
                sx={{ flex: 1, color: "#fff", fontSize: "0.95rem", "& input::placeholder": { color: BRAND.sub2, opacity: 1 } }} />
            </Box>
          </Box>

          <PublicModelGallery limit={120} keyword={keyword} />
        </Container>
      </Box>
    </>
  );
}
