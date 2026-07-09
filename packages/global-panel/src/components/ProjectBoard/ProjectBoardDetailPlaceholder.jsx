import React, { useState } from 'react';
import { Box, Typography, Container } from '@mui/material';
import ProjectBoardHero from './ProjectBoardHero.jsx';
import ProjectBoardTabs from './ProjectBoardTabs.jsx';
import ModelsTab from './tabs/ModelsTab.jsx';

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

export default function ProjectBoardDetailPlaceholder({ board }) {
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
          {currentTab === "models" ? (
            <ModelsTab board={board} />
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}>
              <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>
                {tabsConfig.find(t => t.value === currentTab)?.label} の表示は現在準備中です。
              </Typography>
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  );
}
