import React, { useState, useEffect } from "react";
import { Box, Typography, Button, Paper, CircularProgress, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Grid } from "@mui/material";
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { getSectionItems, saveToSection, createHistorySnapshot, HistoryDrawer, useSectionDraft, DraftPreviewBanner, saveAsDraft } from "@sekkeiya/global-panel";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import ProjectCenteredContainer from "../components/ProjectCenteredContainer";

const COLORS = ['#00BFFF', '#fa709a', '#f6d365', '#a18cd1', '#4facfe'];

export default function ResearchSection({ project, projectId }) {
  const [loading, setLoading] = useState(true);
  const [researchMeta, setResearchMeta] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { draft } = useSectionDraft(projectId, "research");

  useEffect(() => {
    let active = true;
    getSectionItems(projectId, "research").then(res => {
      if (!active) return;
      if (res && res.length > 0) {
        setResearchMeta(res[res.length - 1] || {});
      } else {
        // Default empty state mappings
        setResearchMeta({
          areaInsights: "",
          demographics: [],
          competitors: []
        });
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [projectId]);

  const handleRunResearch = async () => {
    setAnalyzing(true);
    // Simulate AI generation delay
    await new Promise(r => setTimeout(r, 2500));
    
    // Mock Data Payload for Demonstration
    const generatedData = {
      areaInsights: "周辺1km圏内は新興住宅地が広がり、直近5年で人口が15%増加しています。特に30代の子育て世帯が牽引しており、週末の昼間人口が多いのが特徴です。一方で単身世帯向けの夜間営業店舗は少なく、夕方以降の滞在ニーズに応える空白市場が存在します。",
      demographics: [
        { name: "20代以下", value: 15 },
        { name: "30代ファミリー", value: 45 },
        { name: "40代", value: 25 },
        { name: "50代以上", value: 15 }
      ],
      competitors: [
        { name: "近隣カフェA", target: "若年層・学生", price: "￥500 - ￥800", strength: "インスタ映え・コンセント" },
        { name: "ファミレスB", target: "ファミリー層", price: "￥1,000 - ￥1,500", strength: "駐車場完備・長時間滞在可" },
        { name: "ベーカリーC", target: "主婦・テイクアウト", price: "￥300 - ￥600", strength: "朝の集客・自然派" }
      ]
    };

    setAnalyzing(false);
    
    // Save to Firestore using new draft api instead of immediate overwrite
    try {
      await saveAsDraft(projectId, "research", generatedData, "ai-generated");
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptDraft = async (draftData) => {
    try {
      await saveToSection(projectId, "research", draftData);
      await createHistorySnapshot(projectId, "research", "AIリサーチの提案を適用しました", "", "ai-edited-by-human", "user");
      setResearchMeta(draftData);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  if (loading || !researchMeta) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#00BFFF" }} />
      </Box>
    );
  }

  const hasData = researchMeta.demographics?.length > 0 || researchMeta.competitors?.length > 0;

  return (
    <Box id="research" sx={{ width: "100%", scrollMarginTop: 80, pb: 10 }}>
      {/* Background aesthetics */}
      <Box sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: 300, background: "linear-gradient(180deg, rgba(79, 172, 254, 0.05) 0%, transparent 100%)", pointerEvents: "none" }} />

      <ProjectCenteredContainer sx={{ pt: { xs: 4, md: 6 }, position: "relative", zIndex: 1 }}>
        
        {/* Draft Banner */}
        <DraftPreviewBanner 
          draft={draft} 
          projectId={projectId} 
          section="research" 
          onAccept={handleAcceptDraft} 
        />

        {/* Header Area */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 6, flexWrap: "wrap", gap: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ color: "#fff", fontWeight: 900, mb: 1, letterSpacing: "-0.5px" }}>
              立地・リサーチ分析
            </Typography>
            <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.6)", maxWidth: 600 }}>
              AIによる地域データの自動学習と、競合・市場トレンドの可視化を行います。設計方針の根拠となるファクトを定義します。
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
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
              variant="contained" 
              startIcon={analyzing ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeRoundedIcon />}
              onClick={handleRunResearch}
              disabled={analyzing}
              sx={{ 
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", 
                color: "#fff", 
                fontWeight: 800, 
                boxShadow: "0 8px 16px rgba(79, 172, 254, 0.3)",
                textTransform: "none", 
                borderRadius: 8, px: 4, py: 1.2,
                "&:hover": { filter: "brightness(1.1)", transform: "translateY(-2px)", boxShadow: "0 12px 20px rgba(79, 172, 254, 0.4)" },
                transition: "all 0.2s",
                "&.Mui-disabled": { background: "rgba(79, 172, 254, 0.5)", color: "rgba(255,255,255,0.7)" }
              }}
            >
              {analyzing ? "AIで地域データを分析中..." : "AI地域市場リサーチを実行"}
            </Button>
          </Box>
        </Box>

        {!hasData ? (
          <Paper sx={{ p: 8, bgcolor: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 4, textAlign: "center" }}>
            <TravelExploreRoundedIcon sx={{ fontSize: 64, color: "rgba(255,255,255,0.2)", mb: 2 }} />
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800, mb: 1 }}>
              リサーチデータがありません
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 4 }}>
              「AI地域市場リサーチを実行」ボタンを押して、このエリアのペルソナ傾向や競合データを自動取得してください。
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
            
            {/* Area Insights Summary */}
            <Paper sx={{ p: 5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
              <Box sx={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", bgcolor: "#00BFFF" }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                <TravelExploreRoundedIcon sx={{ color: "#00BFFF", fontSize: 28 }} />
                <Typography variant="h5" sx={{ color: "#fff", fontWeight: 900 }}>エリア・インサイト</Typography>
              </Box>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.9)", lineHeight: 1.8, fontSize: "1.05rem", whiteSpace: "pre-wrap" }}>
                {researchMeta.areaInsights}
              </Typography>
            </Paper>

            <Grid container spacing={4}>
              {/* Demographics Pie */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Paper sx={{ p: 4, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, height: 400, display: "flex", flexDirection: "column" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <GroupsRoundedIcon sx={{ color: "#fa709a", fontSize: 24 }} />
                    <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>想定居住者属性 (Target Propensity)</Typography>
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={researchMeta.demographics}
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {researchMeta.demographics.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(10,15,25,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ padding: "20px 0 0 0" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              {/* Competitor Matrix Table */}
              <Grid size={{ xs: 12, md: 7 }}>
                <Paper sx={{ p: 4, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, height: 400, display: "flex", flexDirection: "column" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                    <CompareArrowsRoundedIcon sx={{ color: "#f6d365", fontSize: 24 }} />
                    <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>競合・近隣ベンチマーク (Competitor Matrix)</Typography>
                  </Box>
                  <TableContainer sx={{ flex: 1, overflowY: "auto", 
                    '&::-webkit-scrollbar': { width: '6px' }, 
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: '4px' } 
                  }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: "#0a0f19", color: "rgba(255,255,255,0.6)", fontWeight: 700, borderColor: "rgba(255,255,255,0.1)" }}>ベンチマーク店</TableCell>
                          <TableCell sx={{ bgcolor: "#0a0f19", color: "rgba(255,255,255,0.6)", fontWeight: 700, borderColor: "rgba(255,255,255,0.1)" }}>メイン客層</TableCell>
                          <TableCell sx={{ bgcolor: "#0a0f19", color: "rgba(255,255,255,0.6)", fontWeight: 700, borderColor: "rgba(255,255,255,0.1)" }}>価格帯</TableCell>
                          <TableCell sx={{ bgcolor: "#0a0f19", color: "rgba(255,255,255,0.6)", fontWeight: 700, borderColor: "rgba(255,255,255,0.1)" }}>強み・提供価値</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {researchMeta.competitors.map((row, i) => (
                          <TableRow key={i} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                            <TableCell component="th" scope="row" sx={{ color: "#fff", fontWeight: 700, borderColor: "rgba(255,255,255,0.05)" }}>
                              {row.name}
                            </TableCell>
                            <TableCell sx={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.05)" }}>
                              <Chip label={row.target} size="small" sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "#fff", fontSize: "0.75rem" }} />
                            </TableCell>
                            <TableCell sx={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.05)", fontWeight: 600 }}>{row.price}</TableCell>
                            <TableCell sx={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.05)" }}>{row.strength}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </ProjectCenteredContainer>

      <HistoryDrawer 
        open={historyOpen} 
        onClose={() => setHistoryOpen(false)} 
        projectId={projectId} 
        section="research" 
      />
    </Box>
  );
}
