import React, { useRef, useCallback } from 'react';
import { Card, CardActionArea, Box, Typography, Chip } from '@mui/material';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';

export const DssProjectCard: React.FC<{
  project: any;
  isSelected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  badgeColor?: string;
}> = ({ project, isSelected, onClick, onDoubleClick, badgeColor }) => {
  const title = project?.name || 'Untitled Project';

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const mouseXSpring = useSpring(mouseX, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(mouseY, { stiffness: 400, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["6deg", "-6deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-6deg", "6deg"]);

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["100%", "0%"]);

  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 65%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseX.set(x / width - 0.5);
    mouseY.set(y / height - 0.5);
  };

  const handlePointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Implement native double click threshold check since we don't have separate onDoubleClick working perfectly inside framer-motion easily on pointer
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
      if (onClick) onClick();
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 400); // 400ms double click window
    } else if (clickCountRef.current === 2) {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      if (onDoubleClick) onDoubleClick();
    }
  }, [onClick, onDoubleClick]);

  return (
    <Box sx={{ width: '100%', height: '100%', perspective: 1400 }}>
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <Card
          elevation={0}
          sx={{
            position: 'relative',
            height: '100%',
            aspectRatio: '1 / 1',
            backgroundColor: '#0f172a',
            borderRadius: 3,
            border: '1px solid rgba(51,65,85,0.9)',
            boxShadow: isSelected
              ? `0 18px 30px rgba(15,23,42,0.9), 0 0 18px ${badgeColor ? badgeColor : '#3b82f6'}33`
              : '0 8px 16px rgba(0,0,0,0.4)',
            borderColor: isSelected ? undefined : 'rgba(148,163,184,0.2)',
            transition: 'box-shadow 0.2s, border-color 0.2s',
            overflow: 'hidden',
            userSelect: 'none',
            '&:hover': {
              boxShadow: isSelected
                ? `0 24px 40px rgba(15,23,42,1), 0 0 24px ${badgeColor ? badgeColor : '#3b82f6'}33`
                : '0 16px 32px rgba(0,0,0,0.6), 0 0 4px rgba(148,163,184,0.3)',
              borderColor: isSelected ? undefined : 'rgba(148,163,184,0.4)',
            },
            '&::after': isSelected ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              border: `3px solid ${badgeColor ? badgeColor : 'rgba(59, 130, 246, 0.4)'}`,
              pointerEvents: 'none',
              zIndex: 1,
            } : undefined,
          }}
        >
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              background: glareBackground,
              zIndex: 2,
              pointerEvents: 'none',
              mixBlendMode: 'screen',
            }}
          />
          <CardActionArea
            component="div"
            onClick={handleClick}
            sx={{
              position: 'relative',
              width: '100%',
              height: '100%',
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3,
              overflow: 'hidden',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {/* Center Icon */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <ShapeLineRoundedIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.05)' }} />
            </Box>

             {/* Overlays */}
             <Box sx={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 2 }}>
               <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, fontSize: 16, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  {title}
               </Typography>
               <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                  By {project?.ownerName || 'Unknown'}
               </Typography>
             </Box>
             
             {/* Bottom Badges */}
             <Box sx={{ position: 'absolute', bottom: 12, left: 12, zIndex: 2, display: 'flex', gap: 1 }}>
                {project?.isTeam && (
                   <Chip 
                     size="small" 
                     icon={<GroupRoundedIcon sx={{ fontSize: '14px !important', color: 'rgba(255,255,255,0.7)' }} />} 
                     label="Team" 
                     sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#fff', fontSize: 10, height: 20, border: '1px solid rgba(59, 130, 246, 0.3)' }} 
                   />
                )}
                <Chip size="small" label="Project" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#ccc', fontSize: 10, height: 20 }} />
             </Box>
          </CardActionArea>
        </Card>
      </motion.div>
    </Box>
  );
};
