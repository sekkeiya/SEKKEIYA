import React from 'react';
import { Box, Typography, Button, Paper, Grid } from '@mui/material';
import type { DesktopProject as Project } from '../../features/projects/types';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import ContactPageRoundedIcon from '@mui/icons-material/ContactPageRounded';
import AdjustRoundedIcon from '@mui/icons-material/AdjustRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';

interface Props {
  project: Project;
}

export const ProjectAnalysis: React.FC<Props> = () => {
  return (
    <Box sx={{ width: '100%', flex: 1, p: { xs: 3, md: 5, lg: 8 }, boxSizing: 'border-box', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        
        {/* Header Section */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 8 }}>
          <Box sx={{ maxWidth: 600 }}>
            <Typography variant="h4" sx={{ color: "var(--brand-fg)", fontWeight: 900, mb: 1.5, letterSpacing: 1 }}>
              戦略の分析と評価
            </Typography>
            <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontWeight: 500, lineHeight: 1.6 }}>
              AIによる戦略定義の充実度評価と、次のステップに向けた改善提案を確認できます。
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant="outlined" 
              startIcon={<HistoryRoundedIcon />}
              sx={{ color: "rgb(var(--brand-fg-rgb) / 0.8)", borderColor: "rgb(var(--brand-fg-rgb) / 0.2)", borderRadius: 8, textTransform: 'none', fontWeight: 600, px: 2 }}
            >
              更新履歴
            </Button>
            <Button 
              variant="contained" 
              startIcon={<AutoAwesomeRoundedIcon />}
              sx={{ 
                bgcolor: "#e0c3fc", color: "#000", borderRadius: 8, textTransform: 'none', fontWeight: 800, px: 3,
                boxShadow: "0 0 20px rgba(224, 195, 252, 0.4)",
                "&:hover": { bgcolor: "#d3aefc", boxShadow: "0 0 25px rgba(224, 195, 252, 0.6)" }
              }}
            >
              AI評価を実行する
            </Button>
          </Box>
        </Box>

        {/* Dashboard Grid */}
        <Grid container spacing={4}>
          {/* Left Column (Scores) */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              <Paper sx={{ p: 4, bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.08)", borderRadius: 4 }}>
                <Typography variant="overline" sx={{ color: "light-dark(#4c00ad, #b983ff)", fontWeight: 800, letterSpacing: 1, display: 'block', mb: 2 }}>
                  総合スコア (OVERALL SCORE)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 3 }}>
                  <Typography variant="h1" sx={{ color: "var(--brand-fg)", fontWeight: 900, lineHeight: 1 }}>0</Typography>
                  <Typography variant="h6" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 600 }}>/ 100</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: "var(--brand-fg)", fontWeight: 600, lineHeight: 1.6, mb: 6 }}>
                  まだ分析されていません。右上の「Run AI Analysis」を押して戦略の評価を実行してください。
                </Typography>
                <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.3)" }}>
                  最終評価: 未実行
                </Typography>
              </Paper>

              <Paper sx={{ p: 4, bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.08)", borderRadius: 4 }}>
                <Typography variant="subtitle1" sx={{ color: "var(--brand-fg)", fontWeight: 800, mb: 4 }}>
                  各指標の充実度
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, pb: 2, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <RadioButtonUncheckedRoundedIcon sx={{ color: "#00BFFF", fontSize: 20 }} />
                    <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.8)", fontWeight: 600 }}>コンセプトの明確さ</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontWeight: 700 }}>0 / 100</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, pb: 2, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ContactPageRoundedIcon sx={{ color: "light-dark(#a80637, #fa709a)", fontSize: 20 }} />
                    <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.8)", fontWeight: 600 }}>ペルソナの解像度</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontWeight: 700 }}>0 / 100</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <AdjustRoundedIcon sx={{ color: "light-dark(#a47f0a, #f6d365)", fontSize: 20 }} />
                    <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.8)", fontWeight: 600 }}>解決課題の設定</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontWeight: 700 }}>0 / 100</Typography>
                </Box>
              </Paper>
            </Box>
          </Grid>

          {/* Right Column (Reviews) */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", fontWeight: 800, mb: 3 }}>
              ステークホルダー・レビュー
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 6 }}>
              
              <Paper sx={{ p: 3, bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.08)", borderRadius: 3, display: 'flex', gap: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 80 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(0, 191, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DesignServicesRoundedIcon sx={{ color: "#00BFFF", fontSize: 20 }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 600 }}>Designer</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ color: "var(--brand-fg)", fontWeight: 800 }}>Lead Architect</Typography>
                    <Typography variant="caption" sx={{ color: "#43e97b", border: "1px solid rgba(67, 233, 123, 0.3)", borderRadius: 4, px: 1.5, py: 0.5, fontWeight: 700 }}>Approve</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", lineHeight: 1.6, mb: 3 }}>
                    コンセプトとペルソナの整合性が高く、デザインの方向性が明確です。
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>
                    レビュースコア <span style={{ color: "var(--brand-fg)", fontWeight: 800 }}>85</span> / 100
                  </Typography>
                </Box>
              </Paper>

              <Paper sx={{ p: 3, bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.08)", borderRadius: 3, display: 'flex', gap: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 80 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(246, 211, 101, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BusinessCenterRoundedIcon sx={{ color: "light-dark(#a47f0a, #f6d365)", fontSize: 20 }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 600 }}>Client</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ color: "var(--brand-fg)", fontWeight: 800 }}>Product Owner</Typography>
                    <Typography variant="caption" sx={{ color: "light-dark(#a47f0a, #f6d365)", border: "1px solid rgba(246, 211, 101, 0.3)", borderRadius: 4, px: 1.5, py: 0.5, fontWeight: 700 }}>Pending / Needs Fix</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", lineHeight: 1.6, mb: 3 }}>
                    KPIの目標値が少し保守的かもしれません。再検討をお願いします。
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>
                    レビュースコア <span style={{ color: "var(--brand-fg)", fontWeight: 800 }}>70</span> / 100
                  </Typography>
                </Box>
              </Paper>

              <Paper sx={{ p: 3, bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.08)", borderRadius: 3, display: 'flex', gap: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 80 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(250, 112, 154, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GroupRoundedIcon sx={{ color: "light-dark(#a80637, #fa709a)", fontSize: 20 }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 600 }}>Manager</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ color: "var(--brand-fg)", fontWeight: 800 }}>Project Manager</Typography>
                    <Typography variant="caption" sx={{ color: "#43e97b", border: "1px solid rgba(67, 233, 123, 0.3)", borderRadius: 4, px: 1.5, py: 0.5, fontWeight: 700 }}>Approve</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", lineHeight: 1.6, mb: 3 }}>
                    課題の優先順位付けが的確で、進行に問題ありません。
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>
                    レビュースコア <span style={{ color: "var(--brand-fg)", fontWeight: 800 }}>90</span> / 100
                  </Typography>
                </Box>
              </Paper>

            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ color: "var(--brand-fg)", fontWeight: 800 }}>これまでの判断ログ</Typography>
              <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", borderRadius: 4, px: 1.5, py: 0.5 }}>0件の記録</Typography>
            </Box>
          </Grid>
        </Grid>

      </Box>
    </Box>
  );
};
