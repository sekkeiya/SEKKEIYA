import React, { useState } from "react";
import { Box, Tabs, Tab, Container } from "@mui/material";

export default function ProjectBoardTabs({ currentTab, onTabChange, tabsConfig }) {
  const handleChange = (event, newValue) => {
    onTabChange(newValue);
  };

  return (
    <Box sx={{ width: "100%", borderBottom: 1, borderColor: "rgba(255,255,255,0.12)", bgcolor: "#141820" }}>
      <Container maxWidth="xl">
        <Tabs
          value={currentTab}
          onChange={handleChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 48,
            "& .MuiTab-root": {
              minHeight: 48,
              textTransform: "none",
              color: "rgba(255,255,255,0.6)",
              fontWeight: 500,
              fontSize: "0.95rem",
              "&.Mui-selected": {
                color: "#fff",
                fontWeight: 700,
              },
            },
            "& .MuiTabs-indicator": {
              backgroundColor: "#3498db",
              height: 3,
            },
          }}
        >
          {tabsConfig.map((tab) => (
            <Tab key={tab.value} label={tab.label} value={tab.value} />
          ))}
        </Tabs>
      </Container>
    </Box>
  );
}
