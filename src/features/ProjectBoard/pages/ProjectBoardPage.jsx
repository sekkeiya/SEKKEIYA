import React, { useState } from "react";
import { Box, Container } from "@mui/material";

import ProjectBoardHero from "../layout/ProjectBoardHero";
import ProjectBoardTabs from "../layout/ProjectBoardTabs";

// Tabs
import ModelsTab from "../tabs/ModelsTab";
import BoardDetailInformation from "../../ProjectBoard/BoardDetailInformation";
import GenericMediaTab from "../tabs/GenericMediaTab";

const tabsConfig = [
  { label: "Models", value: "models" },
  { label: "Drawings", value: "drawings" },
  { label: "Renders", value: "renders" },
  { label: "Movies", value: "movies" },
  { label: "Detail", value: "detail" },
  { label: "Articles", value: "articles" },
  { label: "Slides", value: "slides" },
  { label: "Analysis", value: "analysis" },
];

export default function ProjectBoardPage({ board }) {
  const [currentTab, setCurrentTab] = useState("models");

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", bgcolor: "#111" }}>
      <ProjectBoardHero board={board} />
      
      <ProjectBoardTabs 
        currentTab={currentTab} 
        onTabChange={setCurrentTab} 
        tabsConfig={tabsConfig} 
      />

      <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 2, md: 4 } }}>
        <Container maxWidth="xl" disableGutters>
          {currentTab === "models" && <ModelsTab board={board} />}
          {currentTab === "drawings" && <GenericMediaTab board={board} itemCollection="drawings" emptyMessage="まだ図面がありません" />}
          {currentTab === "renders" && <GenericMediaTab board={board} itemCollection="renders" emptyMessage="まだレンダリング画像がありません" />}
          {currentTab === "movies" && <GenericMediaTab board={board} itemCollection="movies" emptyMessage="まだ動画がありません" />}
          {currentTab === "detail" && <Box sx={{ p: 2, bgcolor: "#1a1a1a", borderRadius: 2 }}><BoardDetailInformation board={board} /></Box>}
          {currentTab === "articles" && <GenericMediaTab board={board} itemCollection="articles" emptyMessage="まだ記事がありません" />}
          {currentTab === "slides" && <GenericMediaTab board={board} itemCollection="slides" emptyMessage="まだスライドがありません" />}
          {currentTab === "analysis" && <GenericMediaTab board={board} itemCollection="analysis" emptyMessage="まだ解析データがありません" />}
        </Container>
      </Box>
    </Box>
  );
}
