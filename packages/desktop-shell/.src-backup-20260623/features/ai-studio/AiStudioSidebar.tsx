import React from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import { BRAND } from '../../styles/theme';
import type { AiStudioView } from './AiStudioShell';

interface AiStudioSidebarProps {
  currentView: AiStudioView;
  onViewChange: (view: AiStudioView) => void;
}

const MENU_ITEMS: { id: AiStudioView; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'ダッシュボード', icon: <DashboardRoundedIcon fontSize="small" /> },
  { id: 'aimodels', label: 'AI モデル', icon: <SmartToyRoundedIcon fontSize="small" /> },
  { id: 'save-data', label: 'セーブデータ', icon: <SaveRoundedIcon fontSize="small" /> },
  { id: 'documents', label: 'ナレッジ (知識)', icon: <DescriptionRoundedIcon fontSize="small" /> },
  { id: 'training', label: '評価基準 (ルール)', icon: <AccountTreeRoundedIcon fontSize="small" /> },
  { id: 'score', label: 'スコア (採点)', icon: <AssignmentTurnedInRoundedIcon fontSize="small" /> },
];

export const AiStudioSidebar: React.FC<AiStudioSidebarProps> = ({ currentView, onViewChange }) => {
  return (
    <Box
      sx={{
        width: 240,
        height: "100%",
        bgcolor: BRAND.panel,
        borderRight: `1px solid ${BRAND.line}`,
        display: "flex",
        flexDirection: "column",
        py: 2,
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
      }}
    >
      <Box sx={{ px: 2, mb: 2 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
          AI Studio
        </Typography>
      </Box>

      <List sx={{ px: 1 }}>
        {MENU_ITEMS.map((item) => {
          const active = currentView === item.id;
          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => onViewChange(item.id)}
                sx={{
                  borderRadius: 2,
                  bgcolor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: active ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ 
                    fontSize: 13, 
                    fontWeight: active ? 600 : 500,
                    color: active ? '#fff' : 'rgba(255,255,255,0.7)'
                  }} 
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};
