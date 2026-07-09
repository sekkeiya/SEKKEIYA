// src/features/layout/components/Header/Header.jsx
import React, { useMemo } from "react";
import { Box, LinearProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import GlobalMenuBar from "./components/GlobalMenuBar.jsx";
import TopBar from "./components/TopBar.jsx";
// import ProjectTabs from "./components/ProjectTabs.jsx";

export default function Header({
  // GlobalMenuBar
  onClickHome,
  onClickFile,
  onClickEdit,
  onClickHelp,
  breadcrumb,
  loadingMeta,
  onClickPreview,
  onClickProductionPreview,
  onClickShare,

  // ✅ Desktop additions
  onClickImportLocal,

  // ProjectTabs
  workspaceId,
  workspaceName,

  // loading flags
  projectSwitching,
  baseDocLoading,
  optionDocLoading,
  optionsLoading,

  // TopBar actions
  rightActions,
  dirty,
  saving,
  onSave,
  onUndo,
  onRedo,
  onDelete,
  onDuplicate,

  showTopBar = true, // default to true if undefined
  layoutItems = [],
}) {
  const theme = useTheme();
  const line = alpha(theme.palette.common.white, 0.08);

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        backdropFilter: "blur(10px)",
        background: alpha("#050815", 0.88),
        borderBottom: `1px solid ${line}`,
        minHeight: 48,
        height: "auto",
        display: "flex",
        alignItems: "center",
        flexWrap: "nowrap",
        overflowX: "auto",
        scrollbarWidth: "none", // Hide scrollbar specifically for Firefox
        "&::-webkit-scrollbar": { display: "none" }, // Hide scrollbar for Chrome/Safari
        gap: 0.75,
        px: 1,
        py: 0.5,
      }}
    >
      <GlobalMenuBar
        title="3D Shape Layout"
        onClickHome={onClickHome}
        onClickFile={onClickFile}
        onClickEdit={onClickEdit}
        onClickHelp={onClickHelp}
        breadcrumb={breadcrumb}
        loadingMeta={loadingMeta}
        onClickPreview={onClickPreview}
        onClickImportLocal={onClickImportLocal}
        dirty={dirty}
        saving={saving}
        onSave={onSave}
        onUndo={onUndo}
        onRedo={onRedo}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      >
        {showTopBar && (
          <TopBar
            loadingMeta={loadingMeta}
            rightActions={rightActions}
            dirty={dirty}
            saving={saving}
            onSave={onSave}
            onUndo={onUndo}
            onRedo={onRedo}
            layoutItems={layoutItems}
            onClickPreview={onClickPreview}
            onClickProductionPreview={onClickProductionPreview}
            onClickShare={onClickShare}
          />
        )}
      </GlobalMenuBar>
    </Box>
  );
}
