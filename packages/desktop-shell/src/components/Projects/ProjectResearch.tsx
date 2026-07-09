import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import type { DesktopProject as Project } from '../../features/projects/types';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

interface Props {
  project: Project;
}

export const ProjectResearch: React.FC<Props> = () => {
  return (
    <Box sx={{ width: '100%', flex: 1, p: { xs: 3, md: 5, lg: 8 }, boxSizing: 'border-box', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        
        {/* Header Section */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 8 }}>
          <Box sx={{ maxWidth: 600 }}>
            <Typography variant="h4" sx={{ color: "var(--brand-fg)", fontWeight: 900, mb: 1.5, letterSpacing: 1 }}>
              立地・リサーチ分析
            </Typography>
            <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontWeight: 500, lineHeight: 1.6 }}>
              AIによる地域データの自動学習と、競合・市場トレンドの可視化を行います。設計方針の根拠となるファクトを定義します。
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
                bgcolor: "#00BFFF", color: "var(--brand-fg)", borderRadius: 8, textTransform: 'none', fontWeight: 700, px: 3,
                boxShadow: "0 0 20px rgba(0, 191, 255, 0.4)",
                "&:hover": { bgcolor: "#009acd", boxShadow: "0 0 25px rgba(0, 191, 255, 0.6)" }
              }}
            >
              AI地域市場リサーチを実行
            </Button>
          </Box>
        </Box>

        {/* Empty State Card */}
        <Box sx={{ 
          p: 6, 
          bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)", 
          border: "1px dashed rgb(var(--brand-fg-rgb) / 0.1)", 
          borderRadius: 4, 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          minHeight: 300 
        }}>
          <ManageSearchRoundedIcon sx={{ fontSize: 56, color: "rgb(var(--brand-fg-rgb) / 0.2)", mb: 2 }} />
          <Typography variant="subtitle1" sx={{ color: "var(--brand-fg)", fontWeight: 800, mb: 1 }}>
            リサーチデータがありません
          </Typography>
          <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", textAlign: 'center', lineHeight: 1.8 }}>
            「AI地域市場リサーチを実行」ボタンを押して、このエリアのペルソナ傾向や競合データを自動取得してください。
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
