import React, { useState } from "react";
import { Box, Typography, Paper, Button, CircularProgress } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import PersonaCard from "../components/PersonaCard";
import { 
  useStrategyWorkspace, 
  addStrategyItem, 
  updateStrategyItem, 
  deleteStrategyItem, 
  updateStrategyItemsOrder,
  HistoryDrawer,
  createHistorySnapshot
} from "@sekkeiya/global-panel";
import ProjectCenteredContainer from "../components/ProjectCenteredContainer";

export default function PersonaSection({ project, projectId }) {
  const [editMode, setEditMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { items, loading } = useStrategyWorkspace(projectId);

  if (loading) {
    return (
      <Box sx={{ p: 5, display: "flex", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "rgba(255,255,255,0.5)" }} />
      </Box>
    );
  }

  // Block Handlers
  const handleBlockChange = (id, field, value) => {
    updateStrategyItem(projectId, id, { [field]: value });
  };

  const handleAddBlock = () => {
    addStrategyItem(projectId, {
      type: "persona",
      profileName: "New Persona", 
      traits: [],
      order: items.filter(b => b.type === "persona").length
    });
    setEditMode(true);
  };

  const handleRemoveBlock = (id) => {
    deleteStrategyItem(projectId, id);
  };

  const handleDuplicateBlock = (block) => {
    const newBlock = { ...block };
    delete newBlock.id; // remove original id
    newBlock.profileName = `${newBlock.profileName || 'Persona'} (Copy)`;
    newBlock.order = items.filter(b => b.type === "persona").length;
    addStrategyItem(projectId, newBlock);
    setEditMode(true);
  };

  const handleMoveBlock = (id, direction) => {
    const typeBlocks = items.filter(b => b.type === "persona").sort((a,b) => (a.order || 0) - (b.order || 0));
    const index = typeBlocks.findIndex(b => b.id === id);
    if (index < 0) return;

    let swapIndex = -1;
    if (direction === "up" && index > 0) swapIndex = index - 1;
    if (direction === "down" && index < typeBlocks.length - 1) swapIndex = index + 1;

    if (swapIndex !== -1) {
      const currentItem = typeBlocks[index];
      const swapItem = typeBlocks[swapIndex];
      const currentOrder = currentItem.order || 0;
      let swapOrder = swapItem.order || 0;
      if (currentOrder === swapOrder) {
        swapOrder = currentOrder + (direction === "up" ? -1 : 1);
      }
      
      updateStrategyItemsOrder(projectId, [
        { id: currentItem.id, order: swapOrder },
        { id: swapItem.id, order: currentOrder }
      ]);
    }
  };

  // Filter and sort by type
  const personas = items.filter(b => b.type === "persona"); 

  const handleToggleEditMode = async () => {
    if (editMode) {
      // Create history snapshot when exiting edit mode
      try {
        await createHistorySnapshot(projectId, "strategy", "ペルソナ情報を更新しました", "", "user", "user");
      } catch (e) {
        console.error(e);
      }
    }
    setEditMode(!editMode);
  };

  return (
    <ProjectCenteredContainer sx={{ py: { xs: 3, md: 5 }, display: "flex", flexDirection: "column", gap: 5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#fff", fontWeight: 900, mb: 1, letterSpacing: "-0.5px" }}>
            想定ペルソナ
          </Typography>
          <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.6)" }}>
            誰のための空間設計か。ターゲットとなるユーザー像や主要なニーズを定義します。
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Button 
            size="small"
            variant="outlined" 
            startIcon={<HistoryRoundedIcon />}
            onClick={() => setHistoryOpen(true)}
            sx={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)", borderRadius: 6, px: 2, textTransform: "none" }}
          >
            更新履歴
          </Button>
          <Button 
            variant="outlined" 
            onClick={handleToggleEditMode}
            sx={{ 
              color: editMode ? "#00BFFF" : "rgba(255,255,255,0.8)", 
              borderColor: editMode ? "#00BFFF" : "rgba(255,255,255,0.2)",
              fontWeight: 700, borderRadius: 2,
              "&:hover": { borderColor: "#00BFFF", color: "#00BFFF", bgcolor: "rgba(0,191,255,0.05)" }
            }}
          >
            {editMode ? "編集を完了する" : "ペルソナ像を手動編集"}
          </Button>
        </Box>
      </Box>

      {/* PERSONA BLOCK */}
      <Box id="persona" sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Paper sx={{ p: 5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "rgba(250, 112, 154, 0.1)", border: "1px solid rgba(250, 112, 154, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PersonRoundedIcon sx={{ color: "#fa709a", fontSize: 28 }} />
              </Box>
              <Typography variant="h5" sx={{ color: "#fff", fontWeight: 900 }}>対象ユーザーモデル</Typography>
            </Box>
            {editMode && (
              <Button size="medium" startIcon={<AddRoundedIcon />} onClick={handleAddBlock} sx={{ color: "#fa709a", fontWeight: 800, bgcolor: "rgba(250, 112, 154, 0.1)", borderRadius: 2, px: 3, textTransform: "none" }}>
                ペルソナを追加
              </Button>
            )}
          </Box>
          
          <Box sx={{ display: "flex", gap: { xs: 3, md: 4 }, flexWrap: "wrap", flexDirection: "row" }}>
            {personas.length === 0 ? (
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.4)", textAlign: "center", py: 8, width: "100%", bgcolor: "rgba(0,0,0,0.2)", borderRadius: 3 }}>
                ペルソナが定義されていません。「ペルソナを追加」からターゲットを設定してください。
              </Typography>
            ) : (
              personas.map((persona, index) => (
                <Box key={persona.id} sx={{ flex: "1 1 100%", lg: "1 1 calc(50% - 16px)", minWidth: 320 }}>
                  <PersonaCard 
                    block={persona} 
                    onChange={handleBlockChange} 
                    editMode={editMode}
                    onDelete={() => handleRemoveBlock(persona.id)}
                    onDuplicate={() => handleDuplicateBlock(persona)}
                  />
                </Box>
              ))
            )}
          </Box>
        </Paper>
      </Box>

      <HistoryDrawer 
        open={historyOpen} 
        onClose={() => setHistoryOpen(false)} 
        projectId={projectId} 
        section="strategy" 
      />
    </ProjectCenteredContainer>
  );
}
