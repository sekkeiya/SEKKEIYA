// src/features/layout/components/Header/components/GlobalMenuBar.jsx
import React, { useMemo, useCallback, useState } from "react";
import { Box, Button, Divider, Typography, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import { alpha, useTheme, keyframes } from "@mui/material/styles";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";

import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { listen } from "@tauri-apps/api/event";

import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";
import ViewportHelpModal from "../../modals/ViewportHelpModal";
import { SettingsModal } from "../../overlays/SettingsModal";

export default function GlobalMenuBar({
  title = "3D Shape Layout",
  onClickHome,
  onClickFile,
  onClickEdit,
  onClickHelp,

  // breadcrumb
  breadcrumb = "",
  loadingMeta = false,

  // ✅ Preview
  onClickPreview,

  // ✅ Desktop additions
  onClickImportLocal,

  // ✅ Editor Actions
  dirty,
  saving,
  onSave,
  onUndo,
  onRedo,
  onDelete,
  onDuplicate,

  children,
}) {
  const theme = useTheme();
  
  const setHelpModalOpen = useViewportUiStore((s) => s.setHelpModalOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        px: 1,
        pointerEvents: "none",
        minWidth: 0,
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


  React.useEffect(() => {
    let unlisten;
    const setupListener = async () => {
      try {
        unlisten = await listen("menu-action", (event) => {
          const actionId = event.payload;
          switch (actionId) {
            case "file-save":
              if (!saving && dirty && onSave) onSave();
              break;
            case "file-import":
              if (onClickImportLocal) onClickImportLocal();
              else if (onClickFile) onClickFile();
              break;
            case "edit-undo":
              if (onUndo) onUndo();
              break;
            case "edit-redo":
              if (onRedo) onRedo();
              break;
            case "edit-copy":
            case "edit-paste":
            case "file-new":
            case "file-open":
            case "file-export":
              console.warn(`[NativeMenu] 未実装/未接続アクション: ${actionId}`);
              alert(`未実装/未接続: ${actionId}`);
              break;
            case "help-about":
              console.warn(`[NativeMenu] 未実装/未接続アクション: ${actionId}`);
              break;
            case "help-docs":
              setHelpModalOpen(true);
              break;
            default:
              console.warn(`[NativeMenu] 不明なアクション: ${actionId}`);
          }
        });
      } catch (err) {
        console.warn("Native menu listen error:", err);
      }
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [saving, dirty, onSave, onClickImportLocal, onClickFile, onUndo, onRedo, setHelpModalOpen]);

  const mode = useEditorModeStore((s) => s.editorMode);
  const isLayout = mode === "layout";

  return (
    <Box sx={{ display: "contents" }}>


      {/* Inject children (which will be TopBar) right here so it's between Menus and Preview! */}
      {children}

      <Box sx={{ flex: 1, minWidth: 0 }} />


      <ViewportHelpModal />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
}
