import React, { useState, useEffect } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const SCROLL_SECTIONS = [
  { id: "home", label: "Home" },
  { id: "strategy", label: "Strategy" },
  { id: "persona", label: "Persona" },
  { id: "analysis", label: "Analysis" },
];

export default function ThinkingScrollNav({ projectId }) {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    const hashId = hash.replace('#', '');
    if (SCROLL_SECTIONS.some(s => s.id === hashId)) {
      setActiveTab(hashId);
    } else {
      setActiveTab("home");
    }
  }, [hash]);

  const handleTabChange = (event, newSection) => {
    setActiveTab(newSection);
    navigate(`/projects/${projectId}/landing#${newSection}`, { replace: true });
    
    // Add brief delay to ensure DOM is ready if navigating across pages
    setTimeout(() => {
      const element = document.getElementById(newSection);
      if (element) {
        // Offset for sticky header heights
        const headerOffset = 180;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    }, 100);
  };

  return (
    <Box sx={{ 
      px: { xs: 2, md: 4 }, 
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      bgcolor: "rgba(10, 15, 25, 0.4)",
      backdropFilter: "blur(10px)",
      position: "sticky",
      top: 60, // under the main header if necessary, or 0
      zIndex: 10,
      display: "flex",
      alignItems: "center"
    }}>
      <Tabs 
        value={activeTab} 
        onChange={handleTabChange} 
        variant="scrollable"
        scrollButtons="auto"
        textColor="inherit" 
        indicatorColor="primary"
        sx={{ 
          minHeight: 56,
          "& .MuiTabs-indicator": {
            height: 3,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            bgcolor: "#00BFFF"
          }
        }}
      >
        {SCROLL_SECTIONS.map(s => (
          <Tab 
            key={s.id} 
            label={s.label} 
            value={s.id} 
            disableRipple
            sx={{ 
              minHeight: 56, 
              textTransform: "none", 
              fontWeight: activeTab === s.id ? 700 : 500,
              fontSize: 14,
              color: activeTab === s.id ? "#fff" : "rgba(255,255,255,0.6)",
              transition: "color 0.2s",
              "&:hover": { color: "#fff" }
            }} 
          />
        ))}
      </Tabs>
    </Box>
  );
}
