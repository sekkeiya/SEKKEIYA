// SidePanelSection.jsx
// 右サイドバーの折りたたみ可能な共通セクション（アイコン＋見出し＋シェブロン）。
// メディア設定パネルの各ブロックを統一して、長い縦スクロールを整理する。
import React, { useState } from "react";
import { Box, Stack, Typography, Collapse } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

export default function SidePanelSection({ icon, title, accent = "#6c87ff", defaultOpen = true, right = null, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ mb: 1.25 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ cursor: "pointer", py: 0.3, userSelect: "none" }}
        onClick={() => setOpen((v) => !v)}
      >
        <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.6), transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.18s" }} />
        {icon ? React.cloneElement(icon, { sx: { fontSize: 13, color: alpha(accent, 0.9), ...(icon.props.sx || {}) } }) : null}
        <Typography sx={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: alpha("#fff", 0.55), letterSpacing: 0.4 }}>
          {title}
        </Typography>
        {right}
      </Stack>
      <Collapse in={open}>
        <Box sx={{ pt: 0.4 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}
