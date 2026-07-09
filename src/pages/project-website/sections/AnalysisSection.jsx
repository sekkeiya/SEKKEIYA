import React, { useState } from "react";
import { Box, Typography, Grid, Paper, Button, Chip, LinearProgress, CircularProgress } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import LightbulbCircleRoundedIcon from "@mui/icons-material/LightbulbCircleRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import AdjustRoundedIcon from "@mui/icons-material/AdjustRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import TrackChangesRoundedIcon from "@mui/icons-material/TrackChangesRounded";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import DesignServicesRoundedIcon from "@mui/icons-material/DesignServicesRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import SupervisorAccountRoundedIcon from "@mui/icons-material/SupervisorAccountRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import ProjectCenteredContainer from "../components/ProjectCenteredContainer";
import { useAnalysisWorkspace, runAnalysisForProject, HistoryDrawer, createHistorySnapshot, useSectionDraft, DraftPreviewBanner, saveAsDraft, updateAnalysisMeta, addAnalysisItem } from "@sekkeiya/global-panel";

export default function AnalysisSection({ project, projectId }) {
  const { meta, items, loading } = useAnalysisWorkspace(projectId);

  const [analyzing, setAnalyzing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { draft } = useSectionDraft(projectId, "analysis");
  
  // Dynamic Human Reviews from items (with fallback for demo purposes)
  const realReviews = items.filter(i => i.type === "review");
  const reviews = realReviews.length > 0 ? realReviews : [
    { role: "Designer", name: "Lead Architect", score: 85, status: "approved", comment: "コンセプトとペルソナの整合性が高く、デザインの方向性が明確です。" },
    { role: "Client", name: "Product Owner", score: 70, status: "pending", comment: "KPIの目標値が少し保守的かもしれません。再検討をお願いします。" },
    { role: "Manager", name: "Project Manager", score: 90, status: "approved", comment: "課題の優先順位付けが的確で、進行に問題ありません。" }
  ];

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const generatedData = await runAnalysisForProject(projectId, true);
      await saveAsDraft(projectId, "analysis", generatedData, "ai-generated");
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAcceptDraft = async (draftData) => {
    try {
      if (draftData.meta) {
        await updateAnalysisMeta(projectId, draftData.meta);
      }
      if (draftData.items && draftData.items.length > 0) {
        await addAnalysisItem(projectId, draftData.items[0]);
      }
      await createHistorySnapshot(projectId, "analysis", "AIによる戦略評価を適用しました", "", "ai-generated", "system");
    } catch (e) {
      console.error("Failed to accept analysis draft", e);
      throw e;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: '#a18cd1' }} />
      </Box>
    );
  }

  const analysisMeta = meta || {
    totalScore: 0,
    summary: "未評価",
    metrics: { conceptAlignment: 0, personaFit: 0, issueCoverage: 0, marketFeasibility: 0, kpiReliability: 0 },
    lastUpdated: null
  };
  

  const scoreComparisonData = [
    { name: 'AI', score: analysisMeta.totalScore || 82, fill: '#a18cd1' }
  ];
  
  reviews.forEach((rev, idx) => {
    const colors = ['#4facfe', '#f6d365', '#fa709a', '#00BFFF', '#43e97b'];
    scoreComparisonData.push({
      name: rev.role ? rev.role.substring(0, 3).toUpperCase() : "USR",
      score: rev.score || 0,
      fill: colors[idx % colors.length]
    });
  });
  
  const renderMetric = (label, score, color, Icon, explanation) => (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 1 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Icon fontSize="small" sx={{ color }} />
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
            {label}
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: "#fff", fontWeight: 800 }}>
          {score} <Typography component="span" variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>/ 100</Typography>
        </Typography>
      </Box>
      <LinearProgress 
        variant="determinate" 
        value={score} 
        sx={{ 
          height: 8, 
          borderRadius: 4, 
          bgcolor: "rgba(255,255,255,0.05)",
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 4 }
        }} 
      />
      {explanation && (
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", display: "block", mt: 1, lineHeight: 1.5 }}>
          {explanation}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box id="analysis" sx={{ pb: 8, scrollMarginTop: 100 }}>
      <ProjectCenteredContainer sx={{ pt: { xs: 4, md: 6 } }}>
        
        <DraftPreviewBanner 
          draft={draft} 
          projectId={projectId} 
          section="analysis" 
          onAccept={handleAcceptDraft} 
        />

        {/* Header Area */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 6 }}>
          <Box>
            <Typography variant="h4" sx={{ color: "#fff", fontWeight: 900, letterSpacing: "-0.5px", mb: 1 }}>
              戦略の分析と評価
            </Typography>
            <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.6)", maxWidth: 600 }}>
              AIによる戦略定義の充実度評価と、次のステップに向けた改善提案を確認できます。
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
              onClick={handleRunAnalysis}
              disabled={analyzing}
              sx={{ 
                background: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", 
                color: "#fff", 
                fontWeight: 800, 
                boxShadow: "0 8px 16px rgba(161,140,209,0.3)",
                textTransform: "none", 
                borderRadius: 8, px: 4, py: 1.2,
                "&:hover": { filter: "brightness(1.1)", transform: "translateY(-2px)", boxShadow: "0 12px 20px rgba(161,140,209,0.4)" },
                transition: "all 0.2s",
                "&.Mui-disabled": { background: "rgba(161,140,209,0.5)", color: "rgba(255,255,255,0.7)" }
              }}
            >
              {analyzing ? "分析中..." : "AI評価を実行する"}
            </Button>
          </Box>
        </Box>

        <Grid container spacing={4}>
          
          {/* Left Column: Total Score & Metrics */}
          <Grid size={{ xs: 12, md: 5 }}>
            {/* Total Score Card */}
            <Paper sx={{ p: 4, bgcolor: "rgba(161,140,209,0.05)", border: "1px solid rgba(161,140,209,0.2)", borderRadius: 4, position: "relative", overflow: "hidden", mb: 4 }}>
              <Box sx={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, bgcolor: "rgba(161,140,209,0.1)", borderRadius: "50%", filter: "blur(40px)" }} />
              
              <Typography variant="overline" sx={{ color: "#a18cd1", fontWeight: 800, letterSpacing: 1.5, display: "block", mb: 2 }}>
                総合スコア (OVERALL SCORE)
              </Typography>
              
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, mb: 3 }}>
                <Typography variant="h1" sx={{ color: "#fff", fontWeight: 900, lineHeight: 1 }}>
                  {analysisMeta.totalScore}
                </Typography>
                <Typography variant="h5" sx={{ color: "rgba(255,255,255,0.4)", fontWeight: 700, pb: 1 }}>
                  / 100
                </Typography>
              </Box>

              <Typography variant="body1" sx={{ color: "#fff", lineHeight: 1.6, fontWeight: 500 }}>
                {analysisMeta.summary}
              </Typography>
              
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)", display: "block", mt: 4 }}>
                最終評価: {analysisMeta.lastUpdated ? new Date(analysisMeta.lastUpdated.toMillis ? analysisMeta.lastUpdated.toMillis() : analysisMeta.lastUpdated).toLocaleString("ja-JP") : "未実行"}
              </Typography>
            </Paper>

            {/* Metric Scores */}
            <Paper sx={{ p: 4, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>
              <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800, mb: 4 }}>
                各指標の充実度
              </Typography>
              
              {renderMetric("コンセプトの明確さ", analysisMeta.metrics?.conceptAlignment || 0, "#4facfe", AdjustRoundedIcon, analysisMeta.metricExplanations?.conceptAlignment)}
              {renderMetric("ペルソナの解像度", analysisMeta.metrics?.personaFit || 0, "#fa709a", FactCheckRoundedIcon, analysisMeta.metricExplanations?.personaFit)}
              {renderMetric("解決課題の設定", analysisMeta.metrics?.issueCoverage || 0, "#f6d365", TrackChangesRoundedIcon, analysisMeta.metricExplanations?.issueCoverage)}
              {renderMetric("市場・競合の実現性 (Mock)", analysisMeta.metrics?.marketFeasibility || 75, "#00BFFF", AutoAwesomeRoundedIcon, "競合分析に基づく独自性が十分に確保されています。")}
              {renderMetric("KPI妥当性 (Mock)", analysisMeta.metrics?.kpiReliability || 88, "#43e97b", LightbulbCircleRoundedIcon, "設定された目標値が過去の実績や市場規模と整合しています。")}
            </Paper>

            {/* AI vs Human Score Chart */}
            <Paper sx={{ p: 4, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, mt: 4, height: 300 }}>
              <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800, mb: 1 }}>評価スコア比較</Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 3 }}>AI客観評価とステークホルダーの主観評価</Typography>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={scoreComparisonData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={50} />
                  <RechartsTooltip cursor={{ fill: "rgba(255,255,255,0.02)" }} contentStyle={{ backgroundColor: 'rgba(10,15,25,0.9)', borderColor: 'rgba(255,255,255,0.1)' }} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                    {scoreComparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>

          </Grid>

          {/* Right Column: Decision Log & Insights */}
          <Grid size={{ xs: 12, md: 7 }}>
            
            {/* 1. Actionable Suggestions moved to Top of Right Column */}
            {(analysisMeta.suggestions && analysisMeta.suggestions.length > 0) && (
              <Paper sx={{ p: 4, bgcolor: "rgba(246, 211, 101, 0.05)", border: "1px solid rgba(246, 211, 101, 0.3)", borderRadius: 4, mb: 5, position: "relative", overflow: "hidden" }}>
                <Box sx={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", bgcolor: "#f6d365" }} />
                <Typography variant="h5" sx={{ color: "#fff", fontWeight: 900, mb: 3, display: "flex", alignItems: "center", gap: 1.5, letterSpacing: "-0.5px" }}>
                  <LightbulbCircleRoundedIcon sx={{ color: "#f6d365", fontSize: 28 }} />
                  次へのアクション（改善提案）
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  {analysisMeta.suggestions.map((sug, i) => (
                    <Box key={i} sx={{ display: "flex", gap: 2, alignItems: "flex-start", bgcolor: "rgba(0,0,0,0.2)", p: 2.5, borderRadius: 3 }}>
                      <CheckCircleRoundedIcon sx={{ color: "#f6d365", fontSize: 20, mt: 0.2 }} />
                      <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.9)", lineHeight: 1.6, fontWeight: 700 }}>
                        {sug}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {/* Human Reviews Block */}
            <Box sx={{ mb: 5 }}>
              <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800, mb: 3 }}>ステークホルダー・レビュー</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {reviews.map((rev, i) => (
                  <Paper key={i} sx={{ p: 3, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, display: "flex", gap: 3, alignItems: "flex-start" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", mb: 1 }}>
                        {rev.role === "Designer" && <DesignServicesRoundedIcon sx={{ color: "#4facfe" }} />}
                        {rev.role === "Client" && <BusinessCenterRoundedIcon sx={{ color: "#f6d365" }} />}
                        {rev.role === "Manager" && <SupervisorAccountRoundedIcon sx={{ color: "#fa709a" }} />}
                      </Box>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{rev.role}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                        <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 800 }}>{rev.name}</Typography>
                        <Chip 
                          label={rev.status === "approved" ? "Approve" : "Pending / Needs Fix"} 
                          size="small" 
                          sx={{ 
                            bgcolor: rev.status === "approved" ? "rgba(67, 233, 123, 0.1)" : "rgba(246, 211, 101, 0.1)", 
                            color: rev.status === "approved" ? "#43e97b" : "#f6d365", 
                            fontWeight: 800, border: `1px solid ${rev.status === "approved" ? "rgba(67, 233, 123, 0.3)" : "rgba(246, 211, 101, 0.3)"}` 
                          }} 
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", mb: 2, lineHeight: 1.6 }}>{rev.comment}</Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>レビュースコア:</Typography>
                        <Typography variant="body2" sx={{ color: "#fff", fontWeight: 800 }}>{rev.score} <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>/ 100</span></Typography>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Box>

            {/* Decision Log */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>
                これまでの判断ログ
              </Typography>
              <Chip label={`${items.length}件の記録`} size="small" sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontWeight: 700 }} />
            </Box>

            <Box sx={{ position: "relative", minHeight: 200 }}>
              {/* Timeline Track */}
              {items.length > 0 && (
                <Box sx={{ position: "absolute", top: 20, bottom: 20, left: 19, width: 2, bgcolor: "rgba(255,255,255,0.05)" }} />
              )}

              {items.length === 0 && (
                <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.4)", textAlign: "center", mt: 6, p: 4, bgcolor: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                  判断ログやインサイトはまだ記録されていません。
                </Typography>
              )}

              {items.map((item, index) => {
                const isDecision = item.type === "decision";
                
                return (
                  <Box key={item.id} sx={{ display: "flex", gap: 3, mb: 3, position: "relative" }}>
                    {/* Icon Node */}
                    <Box sx={{ 
                      width: 40, height: 40, borderRadius: "50%", 
                      bgcolor: isDecision ? "rgba(67, 233, 123, 0.1)" : "rgba(250, 112, 154, 0.1)",
                      border: `1px solid ${isDecision ? "rgba(67, 233, 123, 0.3)" : "rgba(250, 112, 154, 0.3)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, zIndex: 1
                    }}>
                      {isDecision ? (
                        <CheckCircleRoundedIcon fontSize="small" sx={{ color: "#43e97b" }} />
                      ) : (
                        <LightbulbCircleRoundedIcon fontSize="small" sx={{ color: "#fa709a" }} />
                      )}
                    </Box>

                    {/* Content Card */}
                    <Box sx={{ flex: 1, mt: 1 }}>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
                        <Chip 
                          label={isDecision ? "決定 / アクション" : "インサイト"} 
                          size="small" 
                          sx={{ 
                            height: 22, fontSize: "0.7rem", fontWeight: 800,
                            bgcolor: isDecision ? "rgba(67, 233, 123, 0.2)" : "rgba(250, 112, 154, 0.2)",
                            color: isDecision ? "#43e97b" : "#fa709a"
                          }} 
                        />

                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                          {item.createdAt ? new Date(item.createdAt.toMillis ? item.createdAt.toMillis() : item.createdAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Just now"}
                        </Typography>
                      </Box>
                      
                      <Paper sx={{ p: 3, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, "&:hover": { bgcolor: "rgba(255,255,255,0.04)" } }}>
                        <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 700, mb: 1 }}>
                          {item.action || item.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {item.reason || item.description}
                        </Typography>
                      </Paper>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Grid>

        </Grid>
      </ProjectCenteredContainer>

      <HistoryDrawer 
        open={historyOpen} 
        onClose={() => setHistoryOpen(false)} 
        projectId={projectId} 
        section="analysis" 
      />
    </Box>
  );
}
