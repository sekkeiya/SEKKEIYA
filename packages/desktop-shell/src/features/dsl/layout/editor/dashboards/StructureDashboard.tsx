import { useState, useEffect } from "react";
import { Box, Typography, CardActionArea, Grid, alpha, CircularProgress } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";

export interface StructureDashboardProps {
  title: string;
  items: any[];
  type: "base" | "plan" | "option";
  onCreate: () => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  isLoading?: boolean;
}

export default function StructureDashboard({ title, items, type, onCreate, onSelect, selectedId, isLoading }: StructureDashboardProps) {
  const icon = 
    type === "base" ? <LanguageRoundedIcon sx={{ fontSize: 28, mb: 1, color: "#ff9800" }} /> : 
    type === "plan" ? <FolderRoundedIcon sx={{ fontSize: 28, mb: 1, color: "#4caf50" }} /> : 
    <LanguageRoundedIcon sx={{ fontSize: 28, mb: 1, color: "#00BFFF" }} />;
    
  const creatingLabel = 
    type === "base" ? "新規Baseを追加" : 
    type === "plan" ? "新規Planを追加" : "新規Optionを追加";

  const [progress, setProgress] = useState(0);
  const [showFlow, setShowFlow] = useState(true);

  // Restart the loading flow whenever the dashboard title/context changes
  useEffect(() => {
    setProgress(0);
    setShowFlow(true);
  }, [title]);

  useEffect(() => {
    if (!showFlow && !isLoading) {
      setProgress(100);
      return;
    }

    const timer = setInterval(() => {
      setProgress((old) => {
        // If data is genuinely loading, cap at 95%
        if (isLoading && old >= 95) return 95;

        // Animate upwards
        const next = old + Math.floor(Math.random() * 20) + 10;
        
        if (!isLoading && next >= 100) {
          clearInterval(timer);
          setTimeout(() => setShowFlow(false), 250); // Pause for a split second at 100%
          return 100;
        }
        return next;
      });
    }, 40);

    return () => clearInterval(timer);
  }, [isLoading, showFlow]);

  const isCurrentlyShowingLoader = isLoading || showFlow;

  return (
    <Box sx={{ width: "100%", height: "100%", bgcolor: "var(--brand-bg)", p: 4, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <Typography variant="h5" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.9)", mb: 4, fontWeight: 600 }}>
        {title}
      </Typography>

      {isCurrentlyShowingLoader ? (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress 
              variant="determinate" 
              value={progress} 
              size={120} 
              thickness={3} 
              sx={{ color: type === "base" ? "#ff9800" : type === "plan" ? "#4caf50" : "#00BFFF" }} 
            />
            <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h5" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.9)', fontWeight: 700 }}>
                {Math.round(progress)}%
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ mt: 4, color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 15, letterSpacing: 1 }}>
            データを取得しています...
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <CardActionArea
              onClick={onCreate}
              sx={{
                height: 160,
                borderRadius: 2,
                border: "1px dashed rgb(var(--brand-fg-rgb) / 0.2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)",
                "&:hover": {
                  bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)",
                  borderColor: "rgb(var(--brand-fg-rgb) / 0.4)",
                },
              }}
            >
              <AddRoundedIcon sx={{ fontSize: 32, color: "rgb(var(--brand-fg-rgb) / 0.5)", mb: 1 }} />
              <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 500, fontSize: 14 }}>
                {creatingLabel}
              </Typography>
            </CardActionArea>
          </Grid>

          {items.map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.id}>
              <CardActionArea
              onClick={() => onSelect(item.id)}
              sx={{
                height: 160,
                borderRadius: 2,
                border: "1px solid",
                borderColor: selectedId === item.id ? (type === "base" ? "#ff9800" : type === "plan" ? "#4caf50" : "#00BFFF") : "rgb(var(--brand-fg-rgb) / 0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: selectedId === item.id ? alpha(type === "base" ? "#ff9800" : type === "plan" ? "#4caf50" : "#00BFFF", 0.08) : "rgb(var(--brand-fg-rgb) / 0.04)",
                "&:hover": {
                  bgcolor: selectedId === item.id ? alpha(type === "base" ? "#ff9800" : type === "plan" ? "#4caf50" : "#00BFFF", 0.12) : "rgb(var(--brand-fg-rgb) / 0.08)",
                },
                position: "relative",
              }}
            >
              {icon}
              <Typography sx={{ color: "var(--brand-fg)", fontWeight: 600, fontSize: 16, mb: 0.5 }}>
                {item.name || "Untitled"}
              </Typography>
              <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontSize: 12 }}>
                {type === "plan" ? "Plan" : "Option"} ID: {item.id.slice(0, 6)}...
              </Typography>
            </CardActionArea>
          </Grid>
        ))}
        </Grid>
      )}
    </Box>
  );
}
