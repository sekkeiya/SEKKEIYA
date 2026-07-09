import React from 'react';
import { Box, Typography, Button, Paper, IconButton } from '@mui/material';
import type { DesktopProject as Project } from '../../features/projects/types';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

interface Props {
  project: Project;
}

export const ProjectPersona: React.FC<Props> = () => {
  return (
    <Box sx={{ width: '100%', flex: 1, p: { xs: 3, md: 5, lg: 8 }, boxSizing: 'border-box', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        
        {/* Header Section */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 8 }}>
          <Box sx={{ maxWidth: 600 }}>
            <Typography variant="h4" sx={{ color: "var(--brand-fg)", fontWeight: 900, mb: 1.5, letterSpacing: 1 }}>
              想定ペルソナ
            </Typography>
            <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontWeight: 500, lineHeight: 1.6 }}>
              誰のための空間設計か、ターゲットとなるユーザー像や主要なニーズを定義します。
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
              variant="outlined" 
              sx={{ color: "rgb(var(--brand-fg-rgb) / 0.8)", borderColor: "rgb(var(--brand-fg-rgb) / 0.2)", borderRadius: 8, textTransform: 'none', fontWeight: 600, px: 2 }}
            >
              ペルソナ像を手動編集
            </Button>
          </Box>
        </Box>

        {/* Content Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'rgba(250, 112, 154, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AccountCircleRoundedIcon sx={{ color: "light-dark(#a80637, #fa709a)", fontSize: 20 }} />
          </Box>
          <Typography variant="h6" sx={{ color: "var(--brand-fg)", fontWeight: 800 }}>対象ユーザーモデル</Typography>
        </Box>

        <Paper sx={{ p: 4, bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.08)", borderRadius: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
            <Box>
              <Typography variant="overline" sx={{ color: "light-dark(#a80637, #fa709a)", fontWeight: 800, letterSpacing: 1, display: 'block', mb: 0.5 }}>
                PERSONA PROFILE
              </Typography>
              <Typography variant="h5" sx={{ color: "var(--brand-fg)", fontWeight: 800 }}>
                New Persona
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
                <ContentCopyRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: '#f5576c' } }}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", mb: 6 }}>
            特徴・ニーズが未入力です。
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>詳細プロフィール・行動特性を開く</Typography>
            <KeyboardArrowDownRoundedIcon fontSize="small" />
          </Box>
        </Paper>

      </Box>
    </Box>
  );
};
