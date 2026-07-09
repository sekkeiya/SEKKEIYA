import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import type { DesktopProject as Project } from '../../features/projects/types';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded';

interface Props {
  project: Project;
}

export const ProjectStrategy: React.FC<Props> = () => {
  return (
    <Box sx={{ width: '100%', flex: 1, p: { xs: 3, md: 5, lg: 8 }, boxSizing: 'border-box', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        
        {/* Header Section */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 8 }}>
          <Box sx={{ maxWidth: 600 }}>
            <Typography variant="h4" sx={{ color: "#fff", fontWeight: 900, mb: 1.5, letterSpacing: 1 }}>
              設計方針と戦略
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 500, lineHeight: 1.6 }}>
              プロジェクトの中心となるコア・コンセプトと、解決すべき課題を定義します。
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
              入力進捗: 0%
            </Typography>
            <Button 
              variant="outlined" 
              startIcon={<HistoryRoundedIcon />}
              sx={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)", borderRadius: 8, textTransform: 'none', fontWeight: 600, px: 2 }}
            >
              更新履歴
            </Button>
            <Button 
              variant="outlined" 
              sx={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)", borderRadius: 8, textTransform: 'none', fontWeight: 600, px: 2 }}
            >
              設計方針を編集
            </Button>
          </Box>
        </Box>

        {/* Content Cards */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Core Concept */}
          <Paper sx={{ p: 4, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
              <LightbulbRoundedIcon sx={{ color: "#00BFFF" }} />
              <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 800 }}>コア・コンセプト</Typography>
            </Box>
            <Typography variant="h5" sx={{ color: "#fff", fontWeight: 800, mb: 1 }}>
              コンセプト名が設定されていません
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
              詳細を記述することでプロジェクトのブレを防ぎます。
            </Typography>
          </Paper>

          {/* KPI */}
          <Paper sx={{ p: 4, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6 }}>
              <TrendingUpRoundedIcon sx={{ color: "#00BFFF" }} />
              <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 800 }}>KPI・期待効果</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)", textAlign: 'center' }}>
              定義されたKPIはありません。
            </Typography>
          </Paper>

          {/* Matrix / Issues */}
          <Paper sx={{ p: 4, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6 }}>
              <BugReportRoundedIcon sx={{ color: "#f5576c" }} />
              <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 800 }}>課題マトリクス・調査事項</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)", textAlign: 'center' }}>
              定義された課題はありません。
            </Typography>
          </Paper>
        </Box>

      </Box>
    </Box>
  );
};
