import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box } from "@mui/material";
import ShapeSearchDashboard from "./pages/ShapeSearchDashboard";
import ModelDetailPage from "./pages/ModelDetailPage";
import ModelsSidebar from "./components/ModelsSidebar";

export default function ShapeSearchApp() {
  const [scope, setScope] = useState("explore");
  const [activeProjectId, setActiveProjectId] = useState(null);

  return (
    <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <ModelsSidebar
        scope={scope}
        setScope={setScope}
        activeProjectId={activeProjectId}
        setActiveProjectId={setActiveProjectId}
      />
      <Box sx={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={
            <ShapeSearchDashboard
              scope={scope}
              setScope={setScope}
              activeProjectId={activeProjectId}
              setActiveProjectId={setActiveProjectId}
            />
          } />
          <Route path="model/:modelId" element={<ModelDetailPage />} />
        </Routes>
      </Box>
    </Box>
  );
}
