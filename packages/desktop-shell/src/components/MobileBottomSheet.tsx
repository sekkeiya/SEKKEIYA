import React from 'react';
import { Box } from '@mui/material';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { BRAND } from '../styles/theme';

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Sheet height. Default 88vh (leaves safe room for status bar) */
  height?: string;
}

/**
 * iOS-style bottom sheet using framer-motion dragControls.
 * Drag only initiates from the handle bar at the top so inner content
 * can scroll freely without fighting the dismiss gesture.
 * Swipe down > 100px or velocity > 500 → close.
 */
const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  open,
  onClose,
  children,
  height = '88vh',
}) => {
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim — fixed so it covers the bottom nav and top bar */}
          <motion.div
            key="sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 1900,
              WebkitTapHighlightColor: 'transparent',
            }}
          />

          {/* Sheet panel */}
          <motion.div
            key="sheet-panel"
            drag="y"
            dragControls={dragControls}
            dragListener={false}          // only handle area starts drag
            dragConstraints={{ top: 0 }}  // can't pull up past start
            dragElastic={{ top: 0.05, bottom: 0.4 }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height,
              background: BRAND.bg,
              borderRadius: '20px 20px 0 0',
              borderTop: `1px solid ${BRAND.line2}`,
              zIndex: 1910,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Drag handle — only this area triggers the dismiss drag */}
            <Box
              onPointerDown={(e) => dragControls.start(e)}
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: 40,
                flexShrink: 0,
                cursor: 'grab',
                touchAction: 'none',
                '&:active': { cursor: 'grabbing' },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.22)',
                }}
              />
            </Box>

            {/* Content — scrolls independently of the drag gesture */}
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {children}
            </Box>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileBottomSheet;
