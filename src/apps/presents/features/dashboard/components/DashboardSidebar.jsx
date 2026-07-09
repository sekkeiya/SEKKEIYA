import React from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic';
import PeopleIcon from '@mui/icons-material/People';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import { usePresentationUiStore } from '../../../features/presentation/store/usePresentationUiStore';
import { tokens } from '../../../shared/theme/tokens';

export const DashboardSidebar = () => {
  const { dashboardScope, setDashboardScope } = usePresentationUiStore();

  const navGroups = [
    {
      title: 'Global',
      items: [
        { label: 'Presents', icon: <PublicIcon />, scope: 'presents' }
      ]
    },
    {
      title: 'Workspace',
      items: [
        { label: 'My Presents (Public)', icon: <FolderIcon />, scope: 'my-presents-public' },
        { label: 'My Presents (Private)', icon: <LockIcon />, scope: 'my-presents-private' }
      ]
    },
    {
      title: 'Sekkeiya Integration',
      items: [
        { label: 'My Boards', icon: <AutoAwesomeMosaicIcon />, scope: 'my-boards' },
        { label: 'Team Boards', icon: <PeopleIcon />, scope: 'team-boards' }
      ]
    }
  ];

  return (
    <Box sx={{ 
      width: 240, 
      height: '100%', 
      bgcolor: tokens.background.panel, 
      backdropFilter: 'blur(12px)',
      borderRight: tokens.border.subtle, 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      <Box sx={{ p: 2, pb: 1, borderBottom: tokens.border.subtle }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderIcon fontSize="small" color="primary" /> Presents
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Data Scopes
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
        {navGroups.map((group, idx) => (
          <React.Fragment key={group.title}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 2, mt: 1, display: 'block', fontWeight: 'bold' }}>
              {group.title}
            </Typography>
            <List dense>
              {group.items.map((item) => {
                const isActive = item.scope === dashboardScope;
                return (
                <ListItem key={item.label} disablePadding>
                  <ListItemButton 
                    selected={isActive} 
                    onClick={() => setDashboardScope(item.scope)}
                    sx={{ 
                      borderRadius: 1, 
                      mb: 0.5,
                      '&.Mui-selected': { bgcolor: 'rgba(0, 160, 233, 0.15)', color: 'primary.main', border: '1px solid rgba(0, 160, 233, 0.3)' },
                      '&.Mui-selected:hover': { bgcolor: 'rgba(0, 160, 233, 0.25)' },
                      '&:hover:not(.Mui-selected)': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: isActive ? 'primary.main' : 'text.secondary' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2', fontWeight: isActive ? 'bold' : 'normal' }} />
                  </ListItemButton>
                </ListItem>
               );
              })}
            </List>
            {idx < navGroups.length - 1 && <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};
