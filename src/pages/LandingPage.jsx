import React, { useState, useMemo, useCallback } from "react";
import { Box, Container, Typography, Stack, useMediaQuery } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { BRAND } from "@/shared/ui/theme";
import SearchBar from "@/features/search/components/SearchBar";
import ToolCircle from "@/shared/ui/ToolCircle";

import { APPS_CATALOG } from "@/shared/constants/appsCatalog";

export default function LandingPage() {
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const tools = useMemo(
    () => APPS_CATALOG.map(app => ({
      key: app.key,
      label: app.label,
      sub: app.sub,
      icon: <img src={app.icon} alt={app.key.toUpperCase()} style={{ width: 48, height: 48, borderRadius: "50%" }} />,
      href: (user && app.hrefAuth) ? app.hrefAuth : app.hrefPublic,
      badge: app.badge,
    })),
    [user]
  );

  const requireAuthForTools = false;

  const openTool = useCallback(
    (tool) => {
      if (!tool?.href) return;
      if (requireAuthForTools && !user) {
        window.location.assign(`/login?return_to=${encodeURIComponent(tool.href)}`);
        return;
      }
      window.open(tool.href, "_blank");
    },
    [user, requireAuthForTools]
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

  return (
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
          <Box
            sx={{
              pt: { xs: 2, sm: 3 },
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
              columnGap: { xs: 2, sm: 3 },
              rowGap: { xs: 2.5, sm: 3.5 },
              justifyItems: "center",
              width: "100%",
            }}
          >
            {tools.map((t) => (
              <ToolCircle key={t.key} tool={t} onOpen={() => openTool(t)} />
            ))}
          </Box>
        </Stack>
      </Box>
    </Container>
  );
}
