import React, { useState, useRef, useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { BRAND } from '@desktop/styles/theme';
// @ts-ignore
import FloatingLibraryPanelShell from './FloatingLibraryPanelShell';

interface FloatingLibraryPanelProps {
  toggleLibraryDetached: () => void;
  projectId: string | null;
  workspaceId: string | null;
  planId?: string | null;
}

export default function FloatingLibraryPanel({ toggleLibraryDetached, projectId, workspaceId, planId }: FloatingLibraryPanelProps) {
  const [pos, setPos] = useState({ x: 320, y: 80 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  
  const minWidth = 500;
  const minHeight = 200;

  const stateRef = useRef({ ...pos, ...size });
  stateRef.current = { ...pos, ...size };

  const handlePointerDown = useCallback((e: React.PointerEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // For drag, only left click
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startState = { ...stateRef.current };

    const handlePointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      let newX = startState.x;
      let newY = startState.y;
      let newW = startState.w;
      let newH = startState.h;

      if (type === 'drag') {
        newX += dx;
        newY += dy;
      } else {
        if (type.includes('e')) newW += dx;
        if (type.includes('s')) newH += dy;
        if (type.includes('w')) {
          newX += dx;
          newW -= dx;
        }
        if (type.includes('n')) {
          newY += dy;
          newH -= dy;
        }
      }

      if (newW < minWidth && type !== 'drag') {
         if (type.includes('w')) newX += (newW - minWidth);
         newW = minWidth;
      }
      if (newH < minHeight && type !== 'drag' && !isCollapsed) {
         if (type.includes('n')) newY += (newH - minHeight);
         newH = minHeight;
      }

      stateRef.current = { x: newX, y: newY, w: newW, h: newH };
      if (panelRef.current) {
         panelRef.current.style.left = `${newX}px`;
         panelRef.current.style.top = `${newY}px`;
         panelRef.current.style.width = `${newW}px`;
         if (!isCollapsed) panelRef.current.style.height = `${newH}px`;
      }
    };

    const handlePointerUp = () => {
      setPos({ x: stateRef.current.x, y: stateRef.current.y });
      setSize({ w: stateRef.current.w, h: stateRef.current.h });
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [minWidth, minHeight, isCollapsed]);

  const cornerSize = 10;
  
  return (
    <Box
      ref={panelRef}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: isCollapsed ? 'auto' : size.h,
      }}
      sx={{
        position: 'fixed',
        zIndex: 1300,
        backgroundColor: 'rgba(30, 30, 30, 0.4)',
        backdropFilter: 'blur(16px)',
        border: `1px solid rgba(255,255,255,0.1)`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}
    >
      {/* 8 Drag Resizer Handles */}
      <Box sx={{ position: 'absolute', top: -5, left: cornerSize, right: cornerSize, height: 10, cursor: 'ns-resize', zIndex: 10 }} onPointerDown={(e) => handlePointerDown(e, 'n')} />
      <Box sx={{ position: 'absolute', bottom: -5, left: cornerSize, right: cornerSize, height: 10, cursor: 'ns-resize', zIndex: 10 }} onPointerDown={(e) => handlePointerDown(e, 's')} />
      <Box sx={{ position: 'absolute', left: -5, top: cornerSize, bottom: cornerSize, width: 10, cursor: 'ew-resize', zIndex: 10 }} onPointerDown={(e) => handlePointerDown(e, 'w')} />
      <Box sx={{ position: 'absolute', right: -5, top: cornerSize, bottom: cornerSize, width: 10, cursor: 'ew-resize', zIndex: 10 }} onPointerDown={(e) => handlePointerDown(e, 'e')} />
      
      <Box sx={{ position: 'absolute', top: -5, left: -5, width: cornerSize+5, height: cornerSize+5, cursor: 'nwse-resize', zIndex: 10 }} onPointerDown={(e) => handlePointerDown(e, 'nw')} />
      <Box sx={{ position: 'absolute', top: -5, right: -5, width: cornerSize+5, height: cornerSize+5, cursor: 'nesw-resize', zIndex: 10 }} onPointerDown={(e) => handlePointerDown(e, 'ne')} />
      <Box sx={{ position: 'absolute', bottom: -5, left: -5, width: cornerSize+5, height: cornerSize+5, cursor: 'nesw-resize', zIndex: 10 }} onPointerDown={(e) => handlePointerDown(e, 'sw')} />
      <Box sx={{ position: 'absolute', bottom: -5, right: -5, width: cornerSize+5, height: cornerSize+5, cursor: 'nwse-resize', zIndex: 10 }} onPointerDown={(e) => handlePointerDown(e, 'se')} />

      <Box
        onPointerDown={(e) => handlePointerDown(e, 'drag')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          bgcolor: BRAND.bg,
          borderBottom: isCollapsed ? 'none' : `1px solid rgba(255,255,255,0.05)`,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, px: 1, opacity: 0.9 }}>Library</Typography>
        <Box 
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking buttons
        >
          <IconButton size="small" onClick={() => setIsCollapsed(!isCollapsed)} sx={{ color: 'rgba(255,255,255,0.7)', padding: '2px' }} title={isCollapsed ? "Expand" : "Collapse"}>
            {isCollapsed ? <KeyboardArrowDownIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />}
          </IconButton>
          <IconButton size="small" onClick={toggleLibraryDetached} sx={{ color: 'rgba(255,255,255,0.7)', padding: '2px' }} title="Attach to Sidebar">
            <OpenInBrowserIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Panel Content */}
      <Box 
        sx={{ flex: 1, overflow: 'hidden', display: isCollapsed ? 'none' : 'flex', flexDirection: 'column' }} 
      >
        <FloatingLibraryPanelShell
          projectId={projectId}
          workspaceId={workspaceId}
          planId={planId}
        />
      </Box>
    </Box>
  );
}
