import React from 'react';
import { Box, Typography, List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SaveRoundedIcon     from '@mui/icons-material/SaveRounded';
import LinkRoundedIcon     from '@mui/icons-material/LinkRounded';

export type SettingsAppId = '3dss' | 'sekkeiya' | '3dsl' | '3dsp' | 'autosave' | 'connectors';

interface Props {
  activeApp: SettingsAppId;
  onSelectApp: (app: SettingsAppId) => void;
}

export const SettingsSidebar: React.FC<Props> = ({ activeApp, onSelectApp }) => {
  const menuItems: { id: SettingsAppId; label: string; icon: React.ReactNode }[] = [
    { id: 'sekkeiya',    label: 'SEKKEIYA',      icon: <DashboardRoundedIcon /> },
    { id: 'connectors',  label: 'コネクタ',       icon: <LinkRoundedIcon /> },
    { id: 'autosave',    label: '自動保存',        icon: <SaveRoundedIcon /> },
    { id: '3dss',        label: 'S.Models',        icon: <ViewInArRoundedIcon /> },
    { id: '3dsl',        label: 'S.Layout',        icon: <GridViewRoundedIcon /> },
    { id: '3dsp',        label: 'S.Presentations', icon: <PresentToAllRoundedIcon /> },
  ];

  return (
    <Box sx={{ width: 260, bgcolor: '#1a1e27', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>Global Settings</Typography>
      </Box>
      <List sx={{ px: 2 }}>
        {menuItems.map(item => (
          <ListItemButton
            key={item.id}
            selected={activeApp === item.id}
            onClick={() => onSelectApp(item.id)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              py: 1,
              '&.Mui-selected': { bgcolor: 'rgba(79, 195, 247, 0.15)', color: '#4fc3f7' },
              '&.Mui-selected:hover': { bgcolor: 'rgba(79, 195, 247, 0.25)' },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13, fontWeight: activeApp === item.id ? 600 : 500 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};
