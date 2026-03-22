import React, { useEffect } from 'react';
import { Box, IconButton, Slide, Fade, Backdrop } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useGlobalPanelStore } from '../store/useGlobalPanelStore';
import { usePanelTheme } from '../theme/ThemeContext.jsx';

export default function GlobalPanelOverlay({ children, panelName, isOpen: propIsOpen, onClose: propOnClose }) {
  const activePanel = useGlobalPanelStore((state) => state.activePanel);
  const storeClosePanel = useGlobalPanelStore((state) => state.closePanel);
  const isSidebarExpanded = useGlobalPanelStore((state) => state.isSidebarExpanded);
  const BRAND = usePanelTheme();

  const isOpen = propIsOpen !== undefined ? propIsOpen : activePanel === panelName;
  const closePanel = propOnClose !== undefined ? propOnClose : storeClosePanel;

  // Handle ESC key to close panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  return (
    <>
      <Fade in={isOpen} unmountOnExit>
        <Backdrop
          open={isOpen}
          onClick={closePanel}
          sx={{
            zIndex: 100,
            backdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(0,0,0,0.5)',
            // MiniSidebarと表示中のLeftSidebarを覆わないように設定
            position: 'fixed',
            left: { xs: 0, sm: isSidebarExpanded ? 240 + 72 : 72 },
            top: 0,
            bottom: 0,
            right: 0,
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </Fade>

      <Slide direction="left" in={isOpen} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: "fixed", // relative to viewport
            top: { xs: 0, sm: 16 },
            right: { xs: 0, sm: 16 },
            bottom: { xs: 84, sm: 16 }, // adjust for mobile bottom bar
            left: { xs: 0, sm: (isSidebarExpanded ? 240 + 72 : 72) + 16 }, // 312px or 72px + 16px margin
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 101, // Above backdrop
            display: "flex",
            flexDirection: "column",
            bgcolor: 'rgba(12, 16, 24, 0.85)',
            backdropFilter: 'blur(24px)',
            borderRadius: { xs: 0, sm: 3 },
            border: { xs: 'none', sm: `1px solid rgba(255,255,255,0.1)` },
            overflow: "hidden",
            boxShadow: '-12px 12px 48px rgba(0,0,0,0.8)',
          }}
        >
          {/* Close Button top-right absolute */}
          <IconButton
            onClick={closePanel}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
              bgcolor: 'rgba(0,0,0,0.4)',
              color: BRAND.text,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }}
            size="small"
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
          
          <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {children}
          </Box>
        </Box>
      </Slide>
    </>
  );
}
