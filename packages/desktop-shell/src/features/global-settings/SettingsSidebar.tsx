import React from 'react';
import { Box, Typography, List, ListItemButton, ListItemText, ListItemIcon, Divider } from '@mui/material';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SaveRoundedIcon     from '@mui/icons-material/SaveRounded';
import LinkRoundedIcon     from '@mui/icons-material/LinkRounded';
import ArticleRoundedIcon  from '@mui/icons-material/ArticleRounded';
import TuneRoundedIcon     from '@mui/icons-material/TuneRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';

export type SettingsAppId = 'general' | 'ai' | '3dss' | 'sekkeiya' | '3dsl' | '3dsp' | '3dsb' | 'autosave' | 'connectors' | 'voice' | 'admin';

interface Props {
  activeApp: SettingsAppId;
  onSelectApp: (app: SettingsAppId) => void;
  /** 管理者のみ、末尾に「管理者」項目を表示する。 */
  isAdmin?: boolean;
}

export const SettingsSidebar: React.FC<Props> = ({ activeApp, onSelectApp, isAdmin = false }) => {
  const menuItems: { id: SettingsAppId; label: string; icon: React.ReactNode }[] = [
    { id: 'general',     label: '一般',            icon: <TuneRoundedIcon /> },
    { id: 'ai',          label: 'AI',              icon: <SmartToyRoundedIcon /> },
    { id: 'sekkeiya',    label: 'SEKKEIYA',      icon: <DashboardRoundedIcon /> },
    { id: 'connectors',  label: 'コネクタ',       icon: <LinkRoundedIcon /> },
    { id: 'autosave',    label: '自動保存',        icon: <SaveRoundedIcon /> },
    { id: 'voice',       label: '音声',            icon: <RecordVoiceOverRoundedIcon /> },
    { id: '3dss',        label: 'S.Model',        icon: <ViewInArRoundedIcon /> },
    { id: '3dsl',        label: 'S.Layout',        icon: <GridViewRoundedIcon /> },
    { id: '3dsp',        label: 'S.Slide', icon: <PresentToAllRoundedIcon /> },
    { id: '3dsb',        label: 'S.Blog',          icon: <ArticleRoundedIcon /> },
  ];

  const itemSx = () => ({
    borderRadius: 2,
    mb: 0.5,
    py: 1,
    '&.Mui-selected': { bgcolor: 'rgba(79, 195, 247, 0.15)', color: '#2196d6' },
    '&.Mui-selected:hover': { bgcolor: 'rgba(79, 195, 247, 0.25)' },
    '&:hover': { bgcolor: 'action.hover' },
    color: 'text.secondary',
  });

  return (
    <Box sx={theme => ({ width: 260, bgcolor: theme.palette.mode === 'dark' ? 'var(--brand-surface2)' : '#e9ebef', borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' })}>
      <Box sx={{ p: 3, pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 18, color: 'text.primary' }}>Global Settings</Typography>
      </Box>
      <List sx={{ px: 2 }}>
        {menuItems.map(item => (
          <ListItemButton
            key={item.id}
            selected={activeApp === item.id}
            onClick={() => onSelectApp(item.id)}
            sx={itemSx()}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13, fontWeight: activeApp === item.id ? 600 : 500 }} />
          </ListItemButton>
        ))}

        {isAdmin && (
          <>
            <Divider sx={{ my: 1, mx: 1 }} />
            <ListItemButton
              key="admin"
              selected={activeApp === 'admin'}
              onClick={() => onSelectApp('admin')}
              sx={itemSx()}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}><AdminPanelSettingsRoundedIcon /></ListItemIcon>
              <ListItemText primary="管理者" primaryTypographyProps={{ fontSize: 13, fontWeight: activeApp === 'admin' ? 600 : 500 }} />
            </ListItemButton>
          </>
        )}
      </List>
    </Box>
  );
};
