import React from "react";
import { Box, Container, Grid, Typography, Stack, Divider } from "@mui/material";
import { BRAND } from "../ui/theme";
import { ECOSYSTEM_SERVICES } from "@/shared/data/marketplaceData";

export default function GlobalFooter() {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: "#000",
        color: BRAND.sub,
        pt: { xs: 8, md: 10 },
        pb: 4,
        borderTop: `1px solid ${BRAND.line}`,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={6} sx={{ mb: 8 }}>
          <Grid item xs={12} md={4}>
            <Typography variant="h5" sx={{ color: BRAND.text, fontWeight: 800, letterSpacing: 1, mb: 2 }}>
              SEKKEIYA
            </Typography>
            <Typography sx={{ color: BRAND.sub, mb: 1, fontSize: "0.85rem", letterSpacing: 0.5 }}>
              Design With AI.
            </Typography>
            <Typography sx={{ color: BRAND.sub, lineHeight: 1.8, fontSize: "0.85rem" }}>
              すべての設計プロセスを対話へ、すべてのデータを資産へと変える統合OSプラットフォーム。
            </Typography>
          </Grid>

          <Grid item xs={12} sm={4} md={2}>
            <Typography sx={{ color: BRAND.text, fontWeight: 600, mb: 2.5 }}>Products</Typography>
            <Stack spacing={1.5}>
              {/* 製品LP（/products/{slug}）へ。データ源は marketplaceData（単一の真実） */}
              {ECOSYSTEM_SERVICES.map((svc) => (
                <FooterLink key={svc.id} href={`/products/${svc.slug}`}>{svc.title}</FooterLink>
              ))}
            </Stack>
          </Grid>

          <Grid item xs={12} sm={4} md={2}>
            <Typography sx={{ color: BRAND.text, fontWeight: 600, mb: 2.5 }}>Company</Typography>
            <Stack spacing={1.5}>
              <FooterLink href="/about">About Us</FooterLink>
              <FooterLink href="/services">Services</FooterLink>
              <FooterLink href="/articles">Articles</FooterLink>
              <FooterLink>Careers</FooterLink>
              <FooterLink href="/support">Support / Contact</FooterLink>
            </Stack>
          </Grid>

          <Grid item xs={12} sm={4} md={4}>
            <Typography sx={{ color: BRAND.text, fontWeight: 600, mb: 2.5 }}>Contact</Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 2 }}>
              お問い合わせやデモのご依頼などは、お気軽にご連絡ください。
            </Typography>
            <FooterLink href="mailto:hello@sekkeiya.com" sx={{ color: "#fff", textDecoration: "underline" }}>
              hello@sekkeiya.com
            </FooterLink>
          </Grid>
        </Grid>

        <Divider sx={{ borderColor: BRAND.line, mb: 4 }} />

        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Typography variant="caption" sx={{ color: BRAND.sub2 }}>
            © {new Date().getFullYear()} SEKKEIYA Inc. All rights reserved.
          </Typography>
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <FooterLink href="/legal/privacy" sx={{ fontSize: 12 }}>Privacy Policy</FooterLink>
            <FooterLink href="/legal/terms" sx={{ fontSize: 12 }}>Terms of Service</FooterLink>
            <FooterLink href="/legal/tokushoho" sx={{ fontSize: 12 }}>特定商取引法に基づく表記</FooterLink>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

function FooterLink({ children, sx, href }) {
  return (
    <Typography
      component={href ? "a" : "span"}
      href={href}
      sx={{
        fontSize: 14,
        cursor: "pointer",
        transition: "color 0.2s",
        color: "inherit",
        textDecoration: "none",
        display: "inline-block",
        "&:hover": { color: BRAND.text },
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}
