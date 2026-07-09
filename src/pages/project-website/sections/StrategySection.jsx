import React, { useState } from "react";
import { Box, Typography, Grid, Paper, Button, CircularProgress } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LightbulbCircleRoundedIcon from "@mui/icons-material/LightbulbCircleRounded";
import BugReportRoundedIcon from "@mui/icons-material/BugReportRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { ConceptBlock, IssueBlock, KPIBlock } from "../components/StrategyBlocks";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { 
  useStrategyWorkspace, 
  updateStrategyMeta, 
  addStrategyItem, 
  updateStrategyItem, 
  deleteStrategyItem, 
  updateStrategyItemsOrder,
  HistoryDrawer,
  createHistorySnapshot
} from "@sekkeiya/global-panel";
import ProjectCenteredContainer from "../components/ProjectCenteredContainer";

export default function StrategySection({ project, projectId }) {
  const [editMode, setEditMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { meta, items, loading } = useStrategyWorkspace(projectId);

  if (loading) {
    return (
      <Box sx={{ p: 5, display: "flex", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "rgba(255,255,255,0.5)" }} />
      </Box>
    );
  }

  const strategyMeta = meta || {};

  // Meta Handlers
  const handleMetaChange = (field, value) => {
    updateStrategyMeta(projectId, { [field]: value });
  };

  // Block Handlers
  const handleBlockChange = (id, field, value) => {
    updateStrategyItem(projectId, id, { [field]: value });
  };

  const handleAddBlock = (type) => {
    const baseItem = { title: "New Issue", description: "", status: "open" };
      
    addStrategyItem(projectId, {
      type,
      ...baseItem,
      order: items.filter(b => b.type === type).length
    });
    setEditMode(true);
  };

  const handleRemoveBlock = (id) => {
    deleteStrategyItem(projectId, id);
  };

  const handleMoveBlock = (id, type, direction) => {
    const typeBlocks = items.filter(b => b.type === type).sort((a,b) => (a.order || 0) - (b.order || 0));
    const index = typeBlocks.findIndex(b => b.id === id);
    if (index < 0) return;

    let swapIndex = -1;
    if (direction === "up" && index > 0) swapIndex = index - 1;
    if (direction === "down" && index < typeBlocks.length - 1) swapIndex = index + 1;

    if (swapIndex !== -1) {
      const currentItem = typeBlocks[index];
      const swapItem = typeBlocks[swapIndex];
      // Note: If orders are the same, we fake it by re-indexing all. Or handle robustly.
      // Usually dragging algorithms assign floats, but here we just swap. Wait, if both are 0, swapping doesn't help.
      // So if order is equal, we force a difference.
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

  const handleToggleEditMode = async () => {
    if (editMode) {
      // Create history snapshot when exiting edit mode
      try {
        await createHistorySnapshot(projectId, "strategy", "戦略・課題情報を更新しました", "", "user", "user");
      } catch (e) {
        console.error(e);
      }
    }
    setEditMode(!editMode);
  };

  // Filter and sort by type
  const issues = items.filter(b => b.type === "issue").sort((a,b) => (a.order || 0) - (b.order || 0));
  const kpis = items.filter(b => b.type === "kpi").sort((a,b) => (a.order || 0) - (b.order || 0));

  const openIssues = issues.filter(i => i.status !== "resolved");
  const resolvedIssues = issues.filter(i => i.status === "resolved");
  const highIssues = openIssues.filter(i => i.priority === "high");
  const medIssues = openIssues.filter(i => !i.priority || i.priority === "medium");
  const lowIssues = openIssues.filter(i => i.priority === "low");

  return (
    <ProjectCenteredContainer sx={{ py: { xs: 3, md: 5 }, display: "flex", flexDirection: "column", gap: 5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#fff", fontWeight: 900, mb: 1, letterSpacing: "-0.5px" }}>
            設計方針と戦略
          </Typography>
          <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.6)" }}>
            プロジェクトの中心となるコア・コンセプトと、解決すべき課題を定義します。
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>
            入力進捗: {strategyMeta.progress || 0}%
          </Typography>
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
            {editMode ? "編集を完了する" : "設計方針を編集"}
          </Button>
        </Box>
      </Box>

      {/* STRATEGY BLOCK (Concept + Issues) */}
      <Box id="strategy" sx={{ scrollMarginTop: 100, display: "flex", flexDirection: "column", gap: 4 }}>
        <Paper sx={{ p: 5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(79, 172, 254, 0.2)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
          <Box sx={{ position: "absolute", top: -100, left: -100, width: 300, height: 300, bgcolor: "rgba(79, 172, 254, 0.05)", borderRadius: "50%", filter: "blur(60px)" }} />
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
              <LightbulbCircleRoundedIcon sx={{ color: "#4facfe", fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: "#fff", fontWeight: 900, letterSpacing: "-0.5px" }}>コア・コンセプト</Typography>
            </Box>
            <ConceptBlock meta={strategyMeta} onChange={handleMetaChange} editMode={editMode} />
          </Box>
        </Paper>

        {/* KPI / Expected Effects Block */}
        <Paper sx={{ p: 5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <TrendingUpRoundedIcon sx={{ color: "#00BFFF", fontSize: 28 }} />
              <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>KPI・期待効果</Typography>
            </Box>
            {editMode && (
              <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => handleAddBlock("kpi")} sx={{ color: "#00BFFF", fontWeight: 700, bgcolor: "rgba(0,191,255,0.1)", borderRadius: 2, px: 2, textTransform: "none" }}>
                KPIを追加
              </Button>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", flexDirection: { xs: "column", md: "row" } }}>
            {kpis.length === 0 ? (
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)", textAlign: "center", py: 4, width: "100%" }}>
                定義されたKPIはありません。
              </Typography>
            ) : (
              kpis.map((kpi, index) => (
                <KPIBlock 
                  key={kpi.id} block={kpi} editMode={editMode} onChange={handleBlockChange}
                  onMoveUp={() => handleMoveBlock(kpi.id, "kpi", "up")} onMoveDown={() => handleMoveBlock(kpi.id, "kpi", "down")} onDelete={() => handleRemoveBlock(kpi.id)}
                />
              ))
            )}
          </Box>
        </Paper>

        {/* ISSUES BLOCK */}
        <Paper sx={{ p: 5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, minHeight: 150 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <BugReportRoundedIcon sx={{ color: "#ffb199", fontSize: 28 }} />
              <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>課題マトリクス・調査事項</Typography>
            </Box>
            {editMode && (
              <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => handleAddBlock("issue")} sx={{ color: "#00BFFF", fontWeight: 700, bgcolor: "rgba(0,191,255,0.1)", borderRadius: 2, px: 2, textTransform: "none" }}>
                課題を追加
              </Button>
            )}
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {issues.length === 0 ? (
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)", textAlign: "center", py: 4, width: "100%" }}>
                定義された課題はありません。
              </Typography>
            ) : (
              <>
                {/* HIGH PRIORITY */}
                {highIssues.length > 0 && (
                  <Box>
                    <Typography variant="overline" sx={{ color: "#ff4d4f", fontWeight: 800, mb: 2, display: "block" }}>Priority: High</Typography>
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", flexDirection: { xs: "column", md: "row" } }}>
                      {highIssues.map((issue, index) => (
                        <IssueBlock key={issue.id} block={issue} onChange={handleBlockChange} editMode={editMode} onMoveUp={() => handleMoveBlock(issue.id, "issue", "up")} onMoveDown={() => handleMoveBlock(issue.id, "issue", "down")} onDelete={() => handleRemoveBlock(issue.id)} />
                      ))}
                    </Box>
                  </Box>
                )}
                {/* MEDIUM PRIORITY */}
                {medIssues.length > 0 && (
                  <Box>
                    <Typography variant="overline" sx={{ color: "#f6d365", fontWeight: 800, mb: 2, display: "block" }}>Priority: Medium</Typography>
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", flexDirection: { xs: "column", md: "row" } }}>
                      {medIssues.map((issue, index) => (
                        <IssueBlock key={issue.id} block={issue} onChange={handleBlockChange} editMode={editMode} onMoveUp={() => handleMoveBlock(issue.id, "issue", "up")} onMoveDown={() => handleMoveBlock(issue.id, "issue", "down")} onDelete={() => handleRemoveBlock(issue.id)} />
                      ))}
                    </Box>
                  </Box>
                )}
                {/* LOW PRIORITY */}
                {lowIssues.length > 0 && (
                  <Box>
                    <Typography variant="overline" sx={{ color: "#4facfe", fontWeight: 800, mb: 2, display: "block" }}>Priority: Low</Typography>
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", flexDirection: { xs: "column", md: "row" } }}>
                      {lowIssues.map((issue, index) => (
                        <IssueBlock key={issue.id} block={issue} onChange={handleBlockChange} editMode={editMode} onMoveUp={() => handleMoveBlock(issue.id, "issue", "up")} onMoveDown={() => handleMoveBlock(issue.id, "issue", "down")} onDelete={() => handleRemoveBlock(issue.id)} />
                      ))}
                    </Box>
                  </Box>
                )}
                {/* RESOLVED */}
                {resolvedIssues.length > 0 && (
                  <Box>
                    <Typography variant="overline" sx={{ color: "#43e97b", fontWeight: 800, mb: 2, display: "block" }}>Resolved</Typography>
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", flexDirection: { xs: "column", md: "row" }, opacity: 0.6 }}>
                      {resolvedIssues.map((issue, index) => (
                        <IssueBlock key={issue.id} block={issue} onChange={handleBlockChange} editMode={editMode} onMoveUp={() => handleMoveBlock(issue.id, "issue", "up")} onMoveDown={() => handleMoveBlock(issue.id, "issue", "down")} onDelete={() => handleRemoveBlock(issue.id)} />
                      ))}
                    </Box>
                  </Box>
                )}
              </>
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
