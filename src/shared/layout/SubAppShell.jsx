import React from "react";
import { Box } from "@mui/material";
import WorkspaceTabBar from "./WorkspaceTabBar";

// サブアプリ(3DSL/3DSP/3DSC)用の共通シェル
// 上部にWorkspaceTabBar、下にアプリのコンテンツを表示する
export default function SubAppShell({ children }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <WorkspaceTabBar />
      <Box sx={{ flex: 1, overflow: "auto", position: "relative", display: "flex", flexDirection: "column" }}>
        {children}
      </Box>
    </Box>
  );
}
