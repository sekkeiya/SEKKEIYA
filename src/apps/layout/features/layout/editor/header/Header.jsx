// src/features/layout/components/Header/Header.jsx
import React, { useMemo } from "react";
import { Box, LinearProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import GlobalMenuBar from "./components/GlobalMenuBar.jsx";
import TopBar from "./components/TopBar.jsx";
import ProjectTabs from "./components/ProjectTabs.jsx";

export default function Header({
  // GlobalMenuBar
  onClickHome,
  onClickFile,
  onClickEdit,
  onClickHelp,
  breadcrumb,
  loadingMeta,
  onClickPreview,

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
}) {
  const theme = useTheme();
  const line = alpha(theme.palette.common.white, 0.08);

  // ✅ 「遷移中」 + 「データ取得中」 をまとめて Header loading にする
  const headerLoading = useMemo(() => {
    return (
      Boolean(projectSwitching) ||
      Boolean(loadingMeta) ||
      Boolean(baseDocLoading) ||
      Boolean(optionDocLoading) ||
      Boolean(optionsLoading)
    );
  }, [projectSwitching, loadingMeta, baseDocLoading, optionDocLoading, optionsLoading]);

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        backdropFilter: "blur(10px)",
        background: alpha("#050815", 0.88),
        borderBottom: `1px solid ${line}`,
      }}
    >
      <GlobalMenuBar
        title="S.Layout"
        onClickHome={onClickHome}
        onClickFile={onClickFile}
        onClickEdit={onClickEdit}
        onClickHelp={onClickHelp}
        breadcrumb={breadcrumb}
        loadingMeta={loadingMeta}
        onClickPreview={onClickPreview}
      />

      <Box
        sx={{
          height: 48,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          minWidth: 0,
          borderBottom: `1px solid ${line}`,
          position: "relative",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ProjectTabs
            currentBoardKey={workspaceId}
            currentBoardName={workspaceName}
          />
        </Box>

        <Box sx={{ flex: "0 0 auto", minWidth: 0 }}>
          <TopBar
            loadingMeta={loadingMeta}
            rightActions={rightActions}
            dirty={dirty}
            saving={saving}
            onSave={onSave}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        </Box>

        {/* ✅ Loading bar */}
        {headerLoading ? (
          <LinearProgress
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -1,
              height: 2,
              opacity: 0.9,
              borderRadius: 999,
              backgroundColor: "transparent",
            }}
          />
        ) : null}
      </Box>
    </Box>
  );
}
