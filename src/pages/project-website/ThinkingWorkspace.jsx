import React from "react";
import { Box } from "@mui/material";
import ThinkingScrollNav from "./components/ThinkingScrollNav";
import ProductionTabs from "./components/ProductionTabs";
import LandingSection from "./sections/LandingSection";
import ResearchSection from "./sections/ResearchSection";
import StrategySection from "./sections/StrategySection";
import PersonaSection from "./sections/PersonaSection";
import AnalysisSection from "./sections/AnalysisSection";

export default function ThinkingWorkspace({ project, projectId }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", position: "relative" }}>
      
      {/* Sticky Scroll Navigation for the Thinking Sections */}
      <ThinkingScrollNav projectId={projectId} />

      {/* Production Tabs - Placed at the top just below the sticky nav for easy access */}
      <Box sx={{ mb: 2 }}>
        <ProductionTabs projectId={projectId} />
      </Box>

      {/* Vertical Content Sections */}
      <Box sx={{ flex: 1, pb: 10 }}>
        {/* Landing contains the Hero banner and the #home dashboard */}
        <LandingSection project={project} projectId={projectId} />
        
        {/* Research contains Area/Market/Demographics analysis */}
        <ResearchSection project={project} projectId={projectId} />
        
        {/* Strategy contains #strategy (Concept & KPI/Issues) */}
        <StrategySection project={project} projectId={projectId} />
        
        {/* Persona contains target demographics/psychographics */}
        <PersonaSection project={project} projectId={projectId} />
        
        {/* Analysis contains Scoring & Human Reviews */}
        <AnalysisSection project={project} projectId={projectId} />
      </Box>
      
    </Box>
  );
}
