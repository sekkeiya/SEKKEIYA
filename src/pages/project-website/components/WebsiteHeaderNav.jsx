import React from "react";
import { Box, Tabs, Tab } from "@mui/material";
import { useNavigate } from "react-router-dom";

export const PROJECT_SECTIONS = [
  { id: "landing", label: "ホーム" },
  { id: "research", label: "リサーチ" },
  { id: "strategy", label: "設計方針・戦略" },
  { id: "persona", label: "ペルソナ" },
  { id: "analysis", label: "分析と評価" },
];

export default function WebsiteHeaderNav({ projectId, currentSection }) {
  const navigate = useNavigate();

  const handleTabChange = (event, newSection) => {
    navigate(`/projects/${projectId}/${newSection}`);
  };

  return (
    <Box sx={{ 
      px: { xs: 3, md: 5, lg: 8 }, 
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      bgcolor: "rgba(10, 15, 25, 0.4)",
      backdropFilter: "blur(10px)",
      position: "sticky",
      top: 0,
      zIndex: 10,
      display: "flex",
      alignItems: "center"
    }}>
      <Tabs 
        value={currentSection} 
        onChange={handleTabChange} 
        variant="scrollable"
        scrollButtons="auto"
        textColor="inherit" 
        indicatorColor="primary"
        sx={{ 
          minHeight: 40,
          "& .MuiTabs-indicator": {
            height: 3,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            bgcolor: "#00BFFF"
          }
        }}
      >
        {PROJECT_SECTIONS.map(s => (
          <Tab 
            key={s.id} 
            label={s.label} 
            value={s.id} 
            disableRipple
            sx={{ 
              minHeight: 40, 
              textTransform: "none", 
              fontWeight: currentSection === s.id ? 700 : 500,
              fontSize: 14,
              color: currentSection === s.id ? "#fff" : "rgba(255,255,255,0.6)",
              transition: "color 0.2s",
              "&:hover": {
                color: "#fff"
              }
            }} 
          />
        ))}
      </Tabs>
    </Box>
  );
}
