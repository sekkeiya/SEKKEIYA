import React from "react";
import { Box, Typography, Stack, Divider, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";

function safeStr(v, fb = "") {
  return typeof v === "string" && v.trim() ? v : fb;
}

export default function PropertiesLibraryModelPanel({ selection }) {
  const m = selection?.model;
  if (!m) return null;

  const modelId = m?.id || "";
  const displayName = safeStr(m?.title, safeStr(m?.name, modelId));
  const brand = safeStr(m?.brand, "Unknown Brand");
  const author = safeStr(m?.ownerHandle, "Unknown Author");
  const thumbUrl = m?.thumbUrl || m?.thumbnailUrl || null;
  const type = safeStr(m?.type, "");
  const category = safeStr(m?.category, "");
  const subCategory = safeStr(m?.subCategory, "");
  
  // Dimensions
  // Dimensions
  const w = m?.metadata?.width || m?.metadata?.dimensions?.width || m?.dimensionsMm?.width || m?.dimensions?.width || "-";
  const d = m?.metadata?.depth || m?.metadata?.dimensions?.depth || m?.dimensionsMm?.depth || m?.dimensions?.depth || "-";
  const h = m?.metadata?.height || m?.metadata?.dimensions?.height || m?.dimensionsMm?.height || m?.dimensions?.height || "-";

  return (
    <Box sx={{ p: 0.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <InfoOutlinedIcon sx={{ fontSize: 18, color: "#38bdf8" }} />
        <Typography sx={{ fontWeight: 800, fontSize: 13, color: "#fff" }}>
          Library Model Info
        </Typography>
      </Stack>

      <Box
        sx={{
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 2,
          backgroundColor: "#020617",
          backgroundImage: "radial-gradient(circle at 20% 0%, rgba(51, 65, 85, 0.3) 0%, rgba(2, 6, 23, 1) 70%)",
          border: `1px solid ${alpha("#fff", 0.05)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          mb: 2,
        }}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={displayName}
            style={{ width: "100%", height: "100%", objectFit: "contain", transform: "scale(2)" }}
          />
        ) : (
          <Inventory2RoundedIcon sx={{ fontSize: 48, opacity: 0.2 }} />
        )}
      </Box>

      <Stack spacing={2.5}>
        <Box>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: alpha("#fff", 0.5), mb: 0.5 }}>
            TITLE
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#fff", wordBreak: "break-all" }}>
            {displayName}
          </Typography>
        </Box>

        <Box>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: alpha("#fff", 0.5), mb: 0.5 }}>
            BRAND / AUTHOR
          </Typography>
          <Typography sx={{ fontSize: 12, color: alpha("#fff", 0.8) }}>
            {brand}
          </Typography>
          <Typography sx={{ fontSize: 12, color: alpha("#fff", 0.6) }}>
            @{author}
          </Typography>
        </Box>

        <Box>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: alpha("#fff", 0.5), mb: 0.5 }}>
            CLASSIFICATION
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {type && <Chip label={type} size="small" sx={{ fontSize: 10, height: 20, bgcolor: alpha("#38bdf8", 0.15), color: "#38bdf8" }} />}
            {category && <Chip label={category} size="small" sx={{ fontSize: 10, height: 20, bgcolor: alpha("#fff", 0.1), color: alpha("#fff", 0.8) }} />}
            {subCategory && <Chip label={subCategory} size="small" sx={{ fontSize: 10, height: 20, bgcolor: alpha("#fff", 0.1), color: alpha("#fff", 0.8) }} />}
          </Stack>
        </Box>

        <Box>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: alpha("#fff", 0.5), mb: 0.5 }}>
            DIMENSIONS (mm)
          </Typography>
          <Stack direction="row" spacing={1}>
            <Box sx={{ flex: 1, p: 0.75, bgcolor: alpha("#000", 0.3), borderRadius: 1, border: `1px solid ${alpha("#fff", 0.05)}` }}>
              <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.4), mb: 0.25 }}>W</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{w}</Typography>
            </Box>
            <Box sx={{ flex: 1, p: 0.75, bgcolor: alpha("#000", 0.3), borderRadius: 1, border: `1px solid ${alpha("#fff", 0.05)}` }}>
              <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.4), mb: 0.25 }}>D</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{d}</Typography>
            </Box>
            <Box sx={{ flex: 1, p: 0.75, bgcolor: alpha("#000", 0.3), borderRadius: 1, border: `1px solid ${alpha("#fff", 0.05)}` }}>
              <Typography sx={{ fontSize: 10, color: alpha("#fff", 0.4), mb: 0.25 }}>H</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{h}</Typography>
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        <Box>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: alpha("#fff", 0.5), mb: 0.5 }}>
            MODEL ID
          </Typography>
          <Typography sx={{ fontSize: 11, fontFamily: "monospace", color: alpha("#fff", 0.6), wordBreak: "break-all" }}>
            {modelId}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
