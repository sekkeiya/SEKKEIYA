import React, { useState } from 'react';
import { Box, Typography, Divider, IconButton, TextField, InputAdornment, Button, Collapse } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic';
import PeopleIcon from '@mui/icons-material/People';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SettingsIcon from '@mui/icons-material/Settings';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { usePresentationUiStore } from '../../../features/presentation/store/usePresentationUiStore';
import { tokens } from '../../../shared/theme/tokens';

const ExpandedSidebarItem = ({ icon, label, active, onClick, rightIcon }) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.25,
        cursor: "pointer",
        borderRadius: 1.5,
        mx: 1.5,
        color: active ? "#fff" : "rgba(255,255,255,0.7)",
        bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.06)",
          color: "#fff",
        }
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
        {icon}
      </Box>
      <Box sx={{ fontSize: 13, fontWeight: active ? 700 : 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Box>
      {rightIcon && <Box sx={{ display: 'flex', alignItems: 'center', opacity: 0.5 }}>{rightIcon}</Box>}
    </Box>
  );
};

export const LeftSidebar = () => {
  const { dashboardScope, setDashboardScope } = usePresentationUiStore();
  const [myBoardsOpen, setMyBoardsOpen] = useState(true);
  const [teamBoardsOpen, setTeamBoardsOpen] = useState(true);

  const myBoardsMock = [
    { id: '1', name: 'MyHouse' },
    { id: '2', name: '新規ボード3' },
    { id: '3', name: '新規ボード2' }
  ];

  const teamBoardsMock = [
    { id: '4', name: 'チームボード' },
    { id: '5', name: '新規ボード' }
  ];

  return (
    <Box sx={{ 
      width: 240, 
      height: '100%', 
      bgcolor: 'rgba(10, 12, 16, 0.95)', 
      borderRight: `1px solid ${tokens.border.subtle}`, 
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: "4px 0 24px rgba(0,0,0,0.4)"
    }}>
      {/* Top Menu Items */}
      <Box sx={{ pt: 2, pb: 1, px: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <ExpandedSidebarItem 
            icon={<AutoAwesomeMosaicIcon sx={{ color: '#3498db', fontSize: 18 }} />} 
            label="Presents" 
            active={dashboardScope === 'presents'}
            onClick={() => setDashboardScope('presents')}
          />
          <ExpandedSidebarItem 
            icon={<FolderIcon sx={{ color: 'text.secondary', fontSize: 18 }} />} 
            label="Boards" 
            active={dashboardScope === 'my-boards'}
            onClick={() => setDashboardScope('my-boards')}
          />
          <ExpandedSidebarItem 
            icon={<PublicIcon sx={{ color: 'text.secondary', fontSize: 18 }} />} 
            label="Public Presents" 
            active={dashboardScope === 'my-presents-public'}
            onClick={() => setDashboardScope('my-presents-public')}
          />
          <ExpandedSidebarItem 
            icon={<LockIcon sx={{ color: 'text.secondary', fontSize: 18 }} />} 
            label="Private Presents" 
            active={dashboardScope === 'my-presents-private'}
            onClick={() => setDashboardScope('my-presents-private')}
          />
        </Box>
        
        {/* Search Input */}
        <Box sx={{ mt: 2, mb: 1, px: 1.5 }}>
          <TextField
            fullWidth
            placeholder="プレゼン名で検索"
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} />
                </InputAdornment>
              ),
              sx: {
                bgcolor: 'rgba(255,255,255,0.04)',
                borderRadius: 2,
                fontSize: 13,
                height: 36,
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: '1px solid rgba(255,255,255,0.2)' },
              }
            }}
          />
        </Box>
      </Box>

      {/* Accordions Container */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        
        {/* My Boards Accordion */}
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', py: 1, mt: 1 }}>
          <Box 
            onClick={() => setMyBoardsOpen(!myBoardsOpen)}
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, mb: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)", transform: myBoardsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5 }}>My Boards</Typography>
            </Box>
            <IconButton 
              size="small" 
              onClick={(e) => { e.stopPropagation(); alert("My Boardsの新規作成処理です"); }}
              sx={{ color: "rgba(255,255,255,0.5)", p: 0.5 }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Collapse in={myBoardsOpen} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 0.5 }}>
              {myBoardsMock.map(b => (
                <ExpandedSidebarItem 
                  key={b.id} 
                  icon={<DragIndicatorIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }} />} 
                  label={b.name} 
                  active={dashboardScope === `my-boards-${b.id}`}
                  onClick={() => setDashboardScope(`my-boards-${b.id}`)}
                  rightIcon={<PublicIcon sx={{ fontSize: 14 }} />}
                />
              ))}
            </Box>
          </Collapse>
        </Box>

        <Divider sx={{ opacity: 0.05 }} />

        {/* Team Boards Accordion */}
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', py: 1 }}>
          <Box 
            onClick={() => setTeamBoardsOpen(!teamBoardsOpen)}
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, mb: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)", transform: teamBoardsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5 }}>Team Boards</Typography>
            </Box>
            <IconButton 
              size="small" 
              onClick={(e) => { e.stopPropagation(); alert("Team Boardsの新規作成処理です"); }}
              sx={{ color: "rgba(255,255,255,0.5)", p: 0.5 }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Collapse in={teamBoardsOpen} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 0.5 }}>
              {teamBoardsMock.map(b => (
                <ExpandedSidebarItem 
                  key={b.id} 
                  icon={<DragIndicatorIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }} />} 
                  label={b.name} 
                  active={dashboardScope === `team-boards-${b.id}`}
                  onClick={() => setDashboardScope(`team-boards-${b.id}`)}
                  rightIcon={<PublicIcon sx={{ fontSize: 14 }} />}
                />
              ))}
            </Box>
          </Collapse>
        </Box>
      </Box>

      <Divider sx={{ opacity: 0.1 }} />

      {/* Bottom Fixed Action */}
      <Box sx={{ p: 2, pt: 1.5, pb: 3 }}>
        <Button 
          fullWidth
          variant="outlined"
          startIcon={<SettingsIcon />}
          sx={{
            justifyContent: 'center',
            height: 40,
            color: 'rgba(255,255,255,0.9)',
            borderColor: 'rgba(255,255,255,0.15)',
            bgcolor: 'rgba(255,255,255,0.02)',
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 13,
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.3)',
              bgcolor: 'rgba(255,255,255,0.08)'
            }
          }}
        >
          プレゼン管理
        </Button>
      </Box>
    </Box>
  );
};
