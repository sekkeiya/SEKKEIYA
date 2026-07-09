import React from "react";
import { Box, Typography, CardActionArea, IconButton, Tooltip } from "@mui/material";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import SpaceDashboardRoundedIcon from "@mui/icons-material/SpaceDashboardRounded";
import AddBoxRoundedIcon from "@mui/icons-material/AddBoxRounded";

import { useWorkspaceStructureStore } from "../../../../store/useWorkspaceStructureStore";

export default function StructurePanel() {
  const {
    bases,
    plansOfSelectedBase,
    options,
    selectedBaseId,
    selectedPlanId,
    selectedOptionId,
    selectBase,
    selectPlan,
    selectOption,
    createPlan,
    createOption,
  } = useWorkspaceStructureStore();

  const selectedBase = bases.find((b) => b.id === selectedBaseId) || null;
  const selectedPlan = plansOfSelectedBase.find((p) => p.id === selectedPlanId) || null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", bgcolor: "transparent" }}>
      {/* BASE SECTION */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, mb: 1, textTransform: "uppercase" }}>
          Current Base
        </Typography>
        <CardActionArea
          onClick={() => selectBase(selectedBaseId)}
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: "rgba(255, 152, 0, 0.08)",
            border: "1px solid rgba(255, 152, 0, 0.2)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <LanguageRoundedIcon sx={{ fontSize: 20, color: "#ff9800", mr: 1.5 }} />
          <Box>
            <Typography sx={{ color: "#fff", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
              {selectedBase?.name || "Untitled Base"}
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
              {selectedBaseId ? `ID: ${selectedBaseId.slice(0, 6)}...` : "None"}
            </Typography>
          </Box>
        </CardActionArea>
      </Box>

      {/* PLAN SECTION */}
      {selectedBaseId && (
        <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase" }}>
              Plans
            </Typography>
            <Tooltip title="Add Plan">
              <IconButton size="small" onClick={() => createPlan(selectedBaseId)} sx={{ p: 0.5 }}>
                <AddBoxRoundedIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }} />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {plansOfSelectedBase.map((plan) => (
              <CardActionArea
                key={plan.id}
                onClick={() => selectPlan(plan.id)}
                sx={{
                  p: 1,
                  px: 1.5,
                  borderRadius: 1,
                  bgcolor: selectedPlanId === plan.id ? "rgba(76, 175, 80, 0.15)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                }}
              >
                <FolderRoundedIcon sx={{ fontSize: 18, color: selectedPlanId === plan.id ? "#4caf50" : "rgba(255,255,255,0.4)", mr: 1.5 }} />
                <Typography sx={{ color: selectedPlanId === plan.id ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: selectedPlanId === plan.id ? 600 : 400 }}>
                  {plan.name || "Untitled Plan"}
                </Typography>
              </CardActionArea>
            ))}
          </Box>
        </Box>
      )}

      {/* OPTION SECTION */}
      {selectedPlanId && (
        <Box sx={{ px: 2, py: 1.5, pb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase" }}>
              Options (Editing)
            </Typography>
            <Tooltip title="Add Option">
              <IconButton size="small" onClick={() => createOption({ baseId: selectedBaseId, planId: selectedPlanId })} sx={{ p: 0.5 }}>
                <AddBoxRoundedIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }} />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {options.map((option) => (
              <CardActionArea
                key={option.id}
                onClick={() => selectOption(option.id)}
                sx={{
                  p: 1,
                  px: 1.5,
                  borderRadius: 1,
                  bgcolor: selectedOptionId === option.id ? "rgba(0, 191, 255, 0.15)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                }}
              >
                <LanguageRoundedIcon sx={{ fontSize: 18, color: selectedOptionId === option.id ? "#00BFFF" : "rgba(255,255,255,0.4)", mr: 1.5 }} />
                <Typography sx={{ color: selectedOptionId === option.id ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: selectedOptionId === option.id ? 600 : 400 }}>
                  {option.name || "Untitled Option"}
                </Typography>
              </CardActionArea>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
