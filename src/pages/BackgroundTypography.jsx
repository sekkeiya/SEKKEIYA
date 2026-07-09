import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function BackgroundTypography() {
  const { scrollYProgress } = useScroll();
  const xLeft = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);
  const xRight = useTransform(scrollYProgress, [0, 1], ["-50%", "0%"]);

  return (
    // opacity をインラインスタイルに — emotion 注入前から不可視にしてフラッシュを防ぐ
    <Box style={{ opacity: 0.012 }} sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden", zIndex: 0, pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
      <Box sx={{ width: "400vw", display: "flex", whiteSpace: "nowrap", transform: "translateY(-5vh)" }}>
        <motion.div style={{ x: xLeft }}>
          <Typography sx={{ fontWeight: 900, fontSize: "15vw", lineHeight: 0.8, color: "#fff", letterSpacing: "-0.05em" }}>
            THE AI DESIGN OS THE AI DESIGN OS THE AI DESIGN OS THE AI DESIGN OS
          </Typography>
        </motion.div>
      </Box>
      <Box sx={{ width: "400vw", display: "flex", whiteSpace: "nowrap" }}>
        <motion.div style={{ x: xRight }}>
          <Typography sx={{ fontWeight: 900, fontSize: "15vw", lineHeight: 0.8, color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.4)", letterSpacing: "-0.05em" }}>
            BEYOND OPERATIONS BEYOND OPERATIONS BEYOND OPERATIONS
          </Typography>
        </motion.div>
      </Box>
       <Box sx={{ width: "400vw", display: "flex", whiteSpace: "nowrap", transform: "translateY(5vh)" }}>
        <motion.div style={{ x: xLeft }}>
          <Typography sx={{ fontWeight: 900, fontSize: "15vw", lineHeight: 0.8, color: "#fff", letterSpacing: "-0.05em" }}>
            DECODE THE FUTURE DECODE THE FUTURE DECODE THE FUTURE
          </Typography>
        </motion.div>
      </Box>
    </Box>
  );
}
