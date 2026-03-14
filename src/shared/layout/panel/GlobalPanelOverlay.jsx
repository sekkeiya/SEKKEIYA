import React, { useEffect, useCallback } from 'react';
import { Box, IconButton, Slide, Fade, Backdrop } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useGlobalPanelStore } from '../../store/useGlobalPanelStore';
import { BRAND } from '../../ui/theme';
import { useSearchParams } from 'react-router-dom';

export default function GlobalPanelOverlay({ children, panelName, isOpen: propIsOpen }) {
  const activePanel = useGlobalPanelStore((state) => state.activePanel);
  const [searchParams, setSearchParams] = useSearchParams();

  const isOpen = propIsOpen !== undefined ? propIsOpen : activePanel === panelName;

  const closePanelUrl = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("panel");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Handle ESC key to close panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closePanelUrl();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanelUrl]);

  return (
    <>
      <Fade in={isOpen} unmountOnExit>
        <Backdrop
          open={isOpen}
          onClick={closePanelUrl}
          sx={{
            zIndex: 100,
            backdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(0,0,0,0.5)'
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
            left: { xs: 0, sm: 72 + 16 }, // 72px (MiniSidebar) + 16px margin
            zIndex: 101, // Above backdrop
            display: "flex",
            flexDirection: "column",
            bgcolor: BRAND.bg,
            borderRadius: { xs: 0, sm: 3 },
            border: { xs: 'none', sm: `1px solid ${BRAND.line}` },
            overflow: "hidden",
            boxShadow: '-12px 12px 48px rgba(0,0,0,0.6)',
          }}
        >
          {/* Close Button top-right absolute */}
          <IconButton
            onClick={closePanelUrl}
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
