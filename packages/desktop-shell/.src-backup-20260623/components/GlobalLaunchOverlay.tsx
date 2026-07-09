import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

export const GlobalLaunchOverlay: React.FC = () => {
  const globalLaunchingTool = useAppStore(s => s.globalLaunchingTool);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (globalLaunchingTool) {
      setLoadingStep(0);
      const prepareTimeout = setTimeout(() => setLoadingStep(1), 1500);
      const launchTimeout = setTimeout(() => setLoadingStep(2), 3000);
      return () => {
        clearTimeout(prepareTimeout);
        clearTimeout(launchTimeout);
      };
    }
  }, [globalLaunchingTool]);

  return (
    <AnimatePresence>
      {globalLaunchingTool && (
        <Box 
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          sx={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999,
            bgcolor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "all"
          }}
        >
          <Box sx={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", mb: 4 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '2px dashed rgba(0,191,255,0.4)', borderTopColor: 'transparent' }}
            />
            <CircularProgress size={80} thickness={2} sx={{ color: "#00BFFF", zIndex: 1 }} />
          </Box>
          <Typography 
            component={motion.h5}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            variant="h5" 
            sx={{ color: "#fff", fontWeight: 800, letterSpacing: 2 }}
          >
            {globalLaunchingTool === 'rhino' ? 'Rhino 🦏' : globalLaunchingTool === 'blender' ? 'Blender 🟧' : globalLaunchingTool.toUpperCase()} を起動しています...
          </Typography>

          <Box sx={{ mt: 3, height: 40, overflow: 'hidden', position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <AnimatePresence mode="wait">
              <Typography 
                key={loadingStep}
                component={motion.p}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
                variant="subtitle1" 
                sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 700 }}
              >
                {loadingStep === 0 && "ローカル環境を準備しています..."}
                {loadingStep === 1 && "ネイティブアプリを初期化しています..."}
                {loadingStep >= 2 && "ソフトウェアの起動を待機しています..."}
              </Typography>
            </AnimatePresence>
          </Box>

          <Typography 
            component={motion.p}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            variant="body2" 
            sx={{ color: "rgba(255,255,255,0.4)", mt: 4, textAlign: "center", lineHeight: 1.8 }}
          >
            3Dソフトウェアの起動には数秒から十数秒かかる場合があります。<br/>
            画面が切り替わるまで、このまましばらくお待ちください。
          </Typography>
        </Box>
      )}
    </AnimatePresence>
  );
};
