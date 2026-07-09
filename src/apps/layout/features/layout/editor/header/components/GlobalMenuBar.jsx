// src/features/layout/components/Header/components/GlobalMenuBar.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Button, Divider, Typography, Tooltip } from "@mui/material";
import { alpha, useTheme, keyframes } from "@mui/material/styles";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

export default function GlobalMenuBar({
  title = "S.Layout",
  onClickHome,
  onClickFile,
  onClickEdit,
  onClickHelp,

  // breadcrumb
  breadcrumb = "",
  loadingMeta = false,

  // ✅ Preview
  onClickPreview,
}) {
  const theme = useTheme();

  const shine = useMemo(
    () =>
      keyframes`
        0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
        15% { opacity: 0.55; }
        45% { opacity: 0.25; }
        100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
      `,
    []
  );

  const s = useMemo(() => {
    const fg = alpha(theme.palette.common.white, 0.92);
    const sub = alpha(theme.palette.common.white, 0.62);
    const line = alpha(theme.palette.common.white, 0.08);
    const primary = theme.palette.primary.main;

    return {
      fg,
      sub,
      line,
      root: {
        height: 32,
        display: "flex",
        alignItems: "center",
        px: 1,
        gap: 0.75,
        borderBottom: `1px solid ${line}`,
        position: "relative",
      },
      brandBtn: {
        borderRadius: 10,
        color: fg,
        textTransform: "none",
        fontWeight: 900,
        letterSpacing: 0.2,
        px: 1,
        py: 0.15,
        minHeight: 28,
        "&:hover": { backgroundColor: alpha(theme.palette.common.white, 0.06) },
      },
      menuBtn: {
        borderRadius: 10,
        color: sub,
        textTransform: "none",
        fontWeight: 750,
        px: 1,
        py: 0.15,
        minHeight: 28,
        "&:hover": { backgroundColor: alpha(theme.palette.common.white, 0.06), color: fg },
      },
      divider: { height: 18, mx: 0.35, borderColor: line },

      breadcrumbWrap: {
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "52%",
        px: 1,
        pointerEvents: "none",
      },
      breadcrumbText: {
        fontSize: 12,
        fontWeight: 800,
        opacity: 0.65,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: sub,
      },

      rightWrap: { display: "flex", alignItems: "center", gap: 0.75 },

      // ✅ Premium pill button
      previewBtn: {
        position: "relative",
        overflow: "hidden",
        height: 28,
        borderRadius: 999,
        px: 1.1,
        gap: 0.6,
        textTransform: "none",
        fontWeight: 950,
        letterSpacing: 0.2,
        color: fg,

        background: `linear-gradient(180deg, ${alpha("#ffffff", 0.11)} 0%, ${alpha("#ffffff", 0.06)} 55%, ${alpha(
          "#000000",
          0.08
        )} 100%)`,
        border: `1px solid ${alpha("#fff", 0.16)}`,
        boxShadow: `
          0 10px 20px ${alpha("#000", 0.28)},
          inset 0 1px 0 ${alpha("#fff", 0.14)}
        `,

        "&::before": {
          content: '""',
          position: "absolute",
          inset: -2,
          borderRadius: 999,
          background: `radial-gradient(120px 42px at 30% 20%, ${alpha(primary, 0.35)} 0%, transparent 60%)`,
          opacity: 0.9,
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          left: 10,
          right: 10,
          top: 4,
          height: 1,
          borderRadius: 999,
          background: alpha("#fff", 0.14),
          pointerEvents: "none",
        },

        "& .MuiButton-startIcon, & .MuiButton-endIcon": { margin: 0 },

        "&:hover": {
          transform: "translateY(-0.5px)",
          borderColor: alpha("#fff", 0.22),
          background: `linear-gradient(180deg, ${alpha("#ffffff", 0.14)} 0%, ${alpha("#ffffff", 0.07)} 55%, ${alpha(
            "#000000",
            0.10
          )} 100%)`,
          boxShadow: `
            0 14px 26px ${alpha("#000", 0.34)},
            0 0 0 1px ${alpha(primary, 0.18)},
            inset 0 1px 0 ${alpha("#fff", 0.16)}
          `,
        },
        "&:active": {
          transform: "translateY(0px)",
          boxShadow: `
            0 8px 16px ${alpha("#000", 0.30)},
            inset 0 1px 0 ${alpha("#fff", 0.10)}
          `,
        },
      },

      previewShine: {
        position: "absolute",
        top: -10,
        left: -40,
        width: 60,
        height: 60,
        background: `linear-gradient(90deg, transparent 0%, ${alpha("#fff", 0.30)} 45%, transparent 100%)`,
        filter: "blur(0.4px)",
        opacity: 0,
        pointerEvents: "none",
      },

      iconSx: { opacity: 0.88 },
      labelSx: { fontSize: 12.5, lineHeight: 1, mt: "1px" },
    };
  }, [theme, shine]);

  const crumb = loadingMeta ? "Loading..." : breadcrumb;

  const openPreviewByCurrentUrl = useCallback(() => {
    // fallback: 現在URLを別タブ（Viewer設計が未接続でも壊れない）
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  }, []);

  const handlePreview = useCallback(() => {
    if (typeof onClickPreview === "function") return onClickPreview();
    openPreviewByCurrentUrl();
  }, [onClickPreview, openPreviewByCurrentUrl]);

  return (
    <Box sx={s.root}>
      
      <Button startIcon={<HomeRoundedIcon fontSize="small" />} onClick={onClickHome} sx={s.brandBtn}>
        <Typography component="span" sx={{ fontSize: 13, fontWeight: 900 }}>
          {title}
        </Typography>
      </Button>

      <Divider orientation="vertical" flexItem sx={s.divider} />



      {/* ===Menu:File Edit Help=== */}
      <Button onClick={onClickFile} sx={s.menuBtn}>
        File
      </Button>

      {/* ===File=== */}
      <Button onClick={onClickEdit} sx={s.menuBtn}>
        Edit
      </Button>

      {/* ===Edit=== */}
      <Button onClick={onClickHelp} sx={s.menuBtn}>
        Help
      </Button>
      {/* ============= */}



      {/* ===Title: 例）03/TestHouse/Plan1/A-1=== */}
      {crumb ? (
        <Box sx={s.breadcrumbWrap}>
          <Typography title={breadcrumb || ""} sx={s.breadcrumbText}>
            {crumb}
          </Typography>
        </Box>
      ) : null}
      {/* ============= */}

      <Box sx={{ flex: 1 }} />

      {/* ===Preview=== */}
      <Box sx={s.rightWrap}>
        <Tooltip title="共有前に “閲覧者と同じ画面” を別タブで確認（?preview=1）">
          <Button
            onClick={handlePreview}
            startIcon={<VisibilityRoundedIcon fontSize="small" sx={s.iconSx} />}
            endIcon={<OpenInNewRoundedIcon fontSize="small" sx={s.iconSx} />}
            sx={s.previewBtn}
            >
            <Box
              sx={{
                ...s.previewShine,
                animation: `${shine} 1.9s ease-in-out infinite`,
              }}
              />
            <Typography component="span" sx={s.labelSx}>
              Preview
            </Typography>
          </Button>
        </Tooltip>
      </Box>
      {/* ============= */}

    </Box>
  );
}
