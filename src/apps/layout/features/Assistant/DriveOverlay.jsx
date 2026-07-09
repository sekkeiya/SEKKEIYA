import React from 'react';
import { Box, Typography, IconButton, InputBase, Divider } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useAssistantStore } from '@layout/shared/store/useAssistantStore';
import { BRAND } from '@layout/shared/ui/theme';

const DriveOverlay = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Box sx={{
      position: 'fixed',
      top: 0,
      left: 72, // Leave space for MiniSidebar
      width: 'calc(100vw - 72px)',
      height: '100vh',
      bgcolor: BRAND.bg, // SEKKEIYA Drive background
      zIndex: 1150, // Between LeftSidebar (1100) and MiniSidebar (1200) wrappers in DashboardLayout
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top App Header / Breadcrumbs Area */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        px: 3,
        py: 1.5,
        borderBottom: `1px solid ${BRAND.line}`,
        bgcolor: BRAND.panel
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FolderRoundedIcon sx={{ color: BRAND.primary }} />
          <Typography variant="h6" sx={{ color: BRAND.text, fontWeight: 600 }}>
            AI Drive
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Mock Search Bar */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'rgba(255,255,255,0.05)',
            border: `1px solid ${BRAND.line}`,
            borderRadius: 2,
            px: 1.5,
            py: 0.5,
            width: 300
          }}>
            <SearchRoundedIcon sx={{ color: 'rgba(255,255,255,0.5)', mr: 1, fontSize: 20 }} />
            <InputBase 
              placeholder="ドライブ内を検索" 
              sx={{ color: BRAND.text, flex: 1, fontSize: '0.875rem' }} 
            />
          </Box>
          <IconButton onClick={onClose} sx={{ color: BRAND.text, bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Workspace Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left: Drive Sidebar (Folders) */}
        <Box sx={{ 
          width: 260, 
          borderRight: `1px solid ${BRAND.line}`, 
          bgcolor: 'rgba(255,255,255,0.02)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.5)', p: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Folders
          </Typography>
          <Box sx={{ flex: 1, p: 2, pt: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)', mb: 1, cursor: 'pointer' }}>
              <FolderRoundedIcon sx={{ color: BRAND.text, fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: BRAND.text }}>My Drive</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }, mb: 1, cursor: 'pointer' }}>
              <FolderRoundedIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Shared with me</Typography>
            </Box>
          </Box>
        </Box>

        {/* Center: Main Area (Asset Grid) */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'transparent'
        }}>
          <Box sx={{ p: 3 }}>
             <Typography variant="h5" sx={{ color: BRAND.text, fontWeight: 'bold', mb: 3 }}>
               My Drive
             </Typography>
             
             {/* Mock Asset Grid */}
             <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((item) => (
                  <Box key={item} sx={{ 
                    bgcolor: BRAND.panel, 
                    border: `1px solid ${BRAND.line}`, 
                    borderRadius: 2,
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: 'pointer',
                    '&:hover': { borderColor: BRAND.primary }
                  }}>
                    <Box sx={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
                      <InsertDriveFileOutlinedIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.3)' }} />
                    </Box>
                    <Typography variant="body2" sx={{ color: BRAND.text }}>Asset {item}.glb</Typography>
                  </Box>
                ))}
             </Box>
          </Box>
        </Box>

        {/* Right: Details Pane */}
        <Box sx={{ 
          width: 320, 
          borderLeft: `1px solid ${BRAND.line}`, 
          bgcolor: BRAND.panel,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoOutlinedIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ color: BRAND.text, fontWeight: 600 }}>
              詳細
            </Typography>
          </Box>
          <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <InsertDriveFileOutlinedIcon sx={{ fontSize: 60, color: 'rgba(255,255,255,0.2)' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              アセットを選択すると詳細が表示されます。
            </Typography>
            <Divider sx={{ width: '100%', borderColor: BRAND.line, my: 2 }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              ※これはS.Model上のDriveOverlayモックです。将来的に@sekkeiya/global-panelからDriveWorkspaceが供給されます。
            </Typography>
          </Box>
        </Box>

      </Box>
    </Box>
  );
};

export default DriveOverlay;
