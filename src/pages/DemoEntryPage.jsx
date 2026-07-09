import React, { useState, useEffect } from "react";
import { Box, Typography, Container, CircularProgress, Stack, Paper, IconButton, Grid, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { BRAND } from "@/shared/ui/theme";
import { motion, AnimatePresence } from "framer-motion";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DemoProjectResult from "./DemoProjectResult";
import { SEO } from "@/shared/components/seo/SEO";
import { SEOCONFIG } from "@/config/seoConfig";

const STAGES = {
  IDLE: 0,
  TYPING: 1,
  THINKING: 2,
  LAUNCHING_3DSS: 3,
  LAUNCHING_3DSL: 4,
  RENDERING_IMAGES: 5,
  RENDERING_VIDEO: 6,
  BUILDING_PRESENTATION: 7,
  RESULT: 8
};

const TYPING_TEXT = "300㎡の先進的なデザインの住宅をデザインしてください";

const BackgroundVisuals = ({ stage }) => {
  return (
    <Box sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <AnimatePresence mode="wait">
        {stage === STAGES.THINKING && (
           <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
              {/* Neural nodes pulsing - Flashier: More layers, brighter glow, larger scale */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`node-${i}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [1, 3], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 200 + i * 80,
                    height: 200 + i * 80,
                    borderRadius: "50%",
                    border: `1px solid ${BRAND.primary}`,
                    boxShadow: `0 0 30px ${BRAND.primary}`,
                    transform: "translate(-50%, -50%)"
                  }}
                />
              ))}
              <Box sx={{ position: "absolute", top: "50%", left: "50%", width: 300, height: 300, background: `radial-gradient(circle, ${BRAND.primary} 0%, transparent 60%)`, opacity: 0.3, transform: "translate(-50%, -50%)", filter: "blur(40px)" }} />
           </motion.div>
        )}

        {stage === STAGES.LAUNCHING_3DSS && (
           <motion.div key="3dss" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
             {/* Floating cubes gathering - Flashier: More cubes, 3D rotation, intense glow, faster */}
             {[...Array(40)].map((_, i) => {
                const randomAngle = Math.random() * Math.PI * 2;
                const distance = 600 + Math.random() * 400;
                const startX = Math.cos(randomAngle) * distance;
                const startY = Math.sin(randomAngle) * distance;
                return (
                  <motion.div
                    key={`cube-${i}`}
                    initial={{ x: startX, y: startY, scale: 0, rotateX: 0, rotateY: 0, opacity: 0 }}
                    animate={{ x: 0, y: 0, scale: [0, 1.5, 0], rotateX: 360, rotateY: 360, opacity: [0, 1, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: Math.random() * 1.5, ease: "easeIn" }}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: 50 + Math.random() * 30,
                      height: 50 + Math.random() * 30,
                      background: `rgba(80, 227, 194, 0.2)`,
                      border: `2px solid #50E3C2`,
                      boxShadow: "0 0 20px rgba(80,227,194,0.5)",
                      backdropFilter: "blur(6px)"
                    }}
                  />
                );
             })}
             <Box sx={{ position: "absolute", top: "50%", left: "50%", width: 400, height: 400, background: `radial-gradient(circle, #50E3C2 0%, transparent 70%)`, opacity: 0.2, transform: "translate(-50%, -50%)", filter: "blur(50px)" }} />
           </motion.div>
        )}

        {stage === STAGES.LAUNCHING_3DSL && (
           <motion.div key="3dsl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
             {/* Grid layout lines - Flashier: Massive grid, vivid blue structure, dynamic shifting */}
             <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) perspective(1000px) rotateX(70deg) rotateZ(45deg)", width: 1400, height: 1400 }}>
               {[...Array(15)].map((_, i) => (
                 <motion.div
                    key={`lineX-${i}`}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 0.6 }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    style={{ position: "absolute", top: i * 100, left: 0, width: "100%", height: 3, background: BRAND.primary, boxShadow: `0 0 10px ${BRAND.primary}`, transformOrigin: "left" }}
                 />
               ))}
               {[...Array(15)].map((_, i) => (
                 <motion.div
                    key={`lineY-${i}`}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 0.6 }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    style={{ position: "absolute", left: i * 100, top: 0, height: "100%", width: 3, background: BRAND.primary, boxShadow: `0 0 10px ${BRAND.primary}`, transformOrigin: "top" }}
                 />
               ))}
               {/* Pulsing Floorplan Nodes */}
               {[...Array(5)].map((_, i) => (
                 <motion.div
                    key={`rect-${i}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 0.8, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                    style={{ position: "absolute", top: 200 + i*150, left: 200 + i*150, width: 300, height: 300, border: `4px solid ${BRAND.primary}`, background: "rgba(74, 144, 226, 0.3)", boxShadow: `inset 0 0 30px ${BRAND.primary}` }}
                 />
               ))}
             </Box>
           </motion.div>
        )}

        {stage === STAGES.RENDERING_IMAGES && (
           <motion.div key="rendering_images" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
             {/* Flashing camera effect */}
             <motion.div animate={{ opacity: [0, 0.15, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.2 }} style={{ position: "absolute", width: "100%", height: "100%", background: "#fff", zIndex: 1, mixBlendMode: "overlay" }} />
             {/* Popping polaroids/render frames */}
             <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", height: "100%", zIndex: 2 }}>
               {[...Array(15)].map((_, i) => (
                 <motion.div
                    key={`frame-${i}`}
                    initial={{ scale: 0, y: 100, rotate: (Math.random() - 0.5) * 80, opacity: 0 }}
                    animate={{ scale: 1, y: (Math.random() - 0.5) * 600, x: (Math.random() - 0.5) * 1000, opacity: [0, 1, 0.8] }}
                    transition={{ duration: 0.6, delay: Math.random() * 2 }}
                    style={{ position: "absolute", top: "50%", left: "50%", width: 280, height: 180, background: "rgba(0,0,0,0.8)", border: `2px solid rgba(255,255,255,0.4)`, boxShadow: "0 10px 40px rgba(0,0,0,0.8)", borderRadius: 8, backdropFilter: "blur(5px)" }}
                 />
               ))}
             </Box>
           </motion.div>
        )}

        {stage === STAGES.RENDERING_VIDEO && (
           <motion.div key="rendering_video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
             {/* Continuous film strip scrolling horizontally */}
             <Box sx={{ position: "absolute", top: "50%", left: 0, width: "200%", height: 320, transform: "translateY(-50%)", display: "flex", gap: 4, padding: "20px 0", background: "rgba(0,0,0,0.4)", borderTop: `1px solid ${BRAND.primary}`, borderBottom: `1px solid ${BRAND.primary}`, backdropFilter: "blur(10px)" }}>
               <motion.div
                  initial={{ x: 0 }}
                  animate={{ x: "-50%" }}
                  transition={{ duration: 4, ease: "linear", repeat: Infinity }}
                  style={{ display: "flex", gap: 20 }}
               >
                 {[...Array(30)].map((_, i) => (
                   <Box key={`vid-${i}`} sx={{ width: 450, height: 260, flexShrink: 0, background: "rgba(80,227,194,0.1)", borderRadius: 2, border: "1px solid rgba(80,227,194,0.3)", boxShadow: "0 0 20px rgba(80,227,194,0.1)" }} />
                 ))}
               </motion.div>
             </Box>
             {/* Central Playhead/focus */}
             <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: { xs: "90%", sm: 480 }, height: 290, border: `4px solid ${BRAND.primary}`, borderRadius: 4, boxShadow: `0 0 60px rgba(80,227,194,0.4)`, zIndex: 1 }} />
           </motion.div>
        )}

        {stage === STAGES.BUILDING_PRESENTATION && (
           <motion.div key="building_presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
             {/* Presentation boards floating and stacking toward camera */}
             <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) perspective(2000px)", width: "100%", height: "100%", transformStyle: "preserve-3d" }}>
               {[...Array(6)].map((_, i) => (
                 <motion.div
                    key={`board-${i}`}
                    initial={{ z: -2000, y: 1000, rotateX: 60, opacity: 0 }}
                    animate={{ z: 200 - i * 150, y: i * 40 - 150, rotateX: 5, opacity: 1 - i * 0.1 }}
                    transition={{ duration: 1.5, delay: i * 0.4, ease: "easeOut" }}
                    style={{ position: "absolute", top: "50%", left: "50%", marginLeft: -300, marginTop: -200, width: 600, height: 400, background: "rgba(10,15,25,0.95)", border: `1px solid rgba(255,255,255,0.2)`, boxShadow: "0 30px 60px rgba(0,0,0,0.8)", borderRadius: 16, display: "flex", flexWrap: "wrap", alignContent: "flex-start", padding: 24, gap: 12 }}
                 >
                   <Box sx={{ width: "100%", height: 30, background: "rgba(255,255,255,0.15)", borderRadius: 1, mb: 1 }} />
                   <Box sx={{ width: "48%", height: 160, background: "rgba(255,255,255,0.1)", borderRadius: 1 }} />
                   <Box sx={{ width: "48%", height: 160, background: "rgba(255,255,255,0.1)", borderRadius: 1 }} />
                   <Box sx={{ width: "30%", height: 120, background: "rgba(255,255,255,0.1)", borderRadius: 1 }} />
                   <Box sx={{ width: "65%", height: 120, background: "rgba(255,255,255,0.1)", borderRadius: 1 }} />
                 </motion.div>
               ))}
             </Box>
           </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};


export default function DemoEntryPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(STAGES.IDLE);
  const [typedText, setTypedText] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    // 1. start typing after 1.5s
    const startTimeout = setTimeout(() => setStage(STAGES.TYPING), 1500);
    return () => clearTimeout(startTimeout);
  }, []);

  useEffect(() => {
    let interval, t1, t2, t3, t4, t5, t6, t7;
    let t_chat1, t_chat2, t_chat3, t_chat4, t_chat5, t_chat6;
    
    if (stage === STAGES.TYPING) {
      let i = 0;
      interval = setInterval(() => {
        setTypedText(TYPING_TEXT.substring(0, i+1));
        i++;
        if (i === TYPING_TEXT.length) {
          clearInterval(interval);
          t1 = setTimeout(() => setStage(STAGES.THINKING), 1000);
        }
      }, 70);
    }
    
    // Slowed down timings to allow reading and appreciating the background animations
    if (stage === STAGES.THINKING) {
      t_chat1 = setTimeout(() => {
        setTypedText(""); // clear input
        setChatMessages(prev => [...prev, {role: 'user', text: TYPING_TEXT}]);
      }, 400);

      t_chat2 = setTimeout(() => {
        setChatMessages(prev => [...prev, {role: 'ai', text: "承知しました。どのようなライフスタイルを想定していますか？車や趣味の空間は必要でしょうか？"}]);
      }, 1800);

      t_chat3 = setTimeout(() => {
        setChatMessages(prev => [...prev, {role: 'user', text: "車は2台。週末は友人を呼んでホームパーティーができる開放的なLDKとテラスが欲しいです。"}]);
      }, 3800);

      t_chat4 = setTimeout(() => {
        setChatMessages(prev => [...prev, {role: 'ai', text: "LDKとテラスを連続させ、ガレージとシームレスに繋がるゾーニングを提案します。お好みの素材感を教えてください。"}]);
      }, 6000);

      t_chat5 = setTimeout(() => {
        setChatMessages(prev => [...prev, {role: 'user', text: "コンクリート打ちっぱなしと木材を組み合わせた、モダンで洗練された雰囲気で。"}]);
      }, 8200);

      t_chat6 = setTimeout(() => {
        setChatMessages(prev => [...prev, {role: 'ai', text: "了解しました。要件を統合し、最適なデザインパラメータで3Dモデルを展開します。"}]);
      }, 10000);

      t2 = setTimeout(() => setStage(STAGES.LAUNCHING_3DSS), 12500);
    }
    if (stage === STAGES.LAUNCHING_3DSS) {
      t3 = setTimeout(() => setStage(STAGES.LAUNCHING_3DSL), 2500);
    }
    if (stage === STAGES.LAUNCHING_3DSL) {
      t4 = setTimeout(() => setStage(STAGES.RENDERING_IMAGES), 2500);
    }
    if (stage === STAGES.RENDERING_IMAGES) {
      t5 = setTimeout(() => setStage(STAGES.RENDERING_VIDEO), 2500);
    }
    if (stage === STAGES.RENDERING_VIDEO) {
      t6 = setTimeout(() => setStage(STAGES.BUILDING_PRESENTATION), 3000);
    }
    if (stage === STAGES.BUILDING_PRESENTATION) {
      t7 = setTimeout(() => setStage(STAGES.RESULT), 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
      if (t4) clearTimeout(t4);
      if (t5) clearTimeout(t5);
      if (t6) clearTimeout(t6);
      if (t7) clearTimeout(t7);
      if (t_chat1) clearTimeout(t_chat1);
      if (t_chat2) clearTimeout(t_chat2);
      if (t_chat3) clearTimeout(t_chat3);
      if (t_chat4) clearTimeout(t_chat4);
      if (t_chat5) clearTimeout(t_chat5);
      if (t_chat6) clearTimeout(t_chat6);
    };
  }, [stage]);

  return (
    <>
      <SEO 
        title={SEOCONFIG.pages.demo.title} 
        description={SEOCONFIG.pages.demo.description} 
        path={SEOCONFIG.pages.demo.path}
        ogImage={SEOCONFIG.pages.demo.ogImage}
      />
    <Box sx={{ minHeight: "100vh", bgcolor: BRAND.bg, color: "#fff", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* Static Background Gradient */}
      <Box sx={{ position: "absolute", width: "150vw", height: "150vh", background: `radial-gradient(circle at 50% 50%, rgba(74, 144, 226, 0.08) 0%, transparent 50%)`, top: "-25%", left: "-25%", zIndex: 0 }} />
      
      {/* Animated Background Visuals based on Stage */}
      {stage >= STAGES.THINKING && stage < STAGES.RESULT && (
        <BackgroundVisuals stage={stage} />
      )}

      {/* Header */}
      <Box sx={{ p: 3, position: "absolute", top: 0, left: 0, zIndex: 10 }}>
        <IconButton onClick={() => navigate("/")} sx={{ color: "#fff", bgcolor: "rgba(255,255,255,0.05)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}>
          <ArrowBackIcon />
        </IconButton>
      </Box>

      {/* Main Container */}
      <Container maxWidth="md" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1, display: stage < STAGES.RESULT ? "flex" : "none" }}>
        <AnimatePresence mode="wait">
          {stage < STAGES.RESULT && (
            <motion.div 
              key="process"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ width: "100%" }}
            >
              {/* Wrapper to prevent layout shift when chat fades out */}
              <Box sx={{ minHeight: 400, width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <AnimatePresence>
                  {stage <= STAGES.THINKING && (
                    <motion.div
                      key="chat-ui"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.8 } }}
                    >
                    {/* Chat Stream (Scrolls Up) */}
                    <Box sx={{ width: "100%", maxWidth: 650, mx: "auto", height: { xs: 220, md: 280 }, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden", mb: 2, px: { xs: 2, md: 0 }, zIndex: 2, position: "relative" }}>
                      <AnimatePresence initial={false}>
                        {chatMessages.map((msg, idx) => (
                          <motion.div
                            key={`chat-${idx}`}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4 }}
                            style={{ 
                              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                              backgroundColor: msg.role === 'user' ? "rgba(255,255,255,0.1)" : `rgba(80,227,194,0.15)`,
                              border: msg.role === 'user' ? "1px solid rgba(255,255,255,0.2)" : `1px solid rgba(80,227,194,0.3)`,
                              padding: "12px 18px",
                              borderRadius: "16px",
                              marginBottom: "12px",
                              maxWidth: "85%",
                              color: msg.role === 'user' ? "#fff" : BRAND.primary,
                              backdropFilter: "blur(10px)"
                            }}
                          >
                            <Typography sx={{ fontSize: "0.95rem", lineHeight: 1.5 }}>
                              {msg.text}
                            </Typography>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </Box>

                    {/* Central AI Input Box */}
                    <Box sx={{ width: { xs: "90%", md: "100%" }, maxWidth: 650, mx: "auto", mb: 4, p: { xs: 2, md: 3 }, bgcolor: "rgba(0,0,0,0.6)", border: `1px solid ${BRAND.line}`, borderRadius: 3, backdropFilter: "blur(12px)", display: "flex", alignItems: "center", boxShadow: stage >= STAGES.THINKING && chatMessages.length === 0 ? "0 0 40px rgba(74,144,226,0.2)" : "none", transition: "all 0.5s", position: "relative", zIndex: 2 }}>
                      <Box sx={{ width: { xs: 12, md: 16 }, height: { xs: 12, md: 16 }, flexShrink: 0, borderRadius: "50%", bgcolor: stage >= STAGES.THINKING && chatMessages.length === 0 ? BRAND.primary : "transparent", border: `2px solid ${BRAND.primary}`, mr: 2, transition: "background-color 0.5s", boxShadow: stage >= STAGES.THINKING && chatMessages.length === 0 ? `0 0 10px ${BRAND.primary}` : "none" }} />
                      <Typography sx={{ fontSize: { xs: "0.9rem", md: "1.2rem" }, fontWeight: 700, color: typedText ? "#fff" : "rgba(255,255,255,0.3)", minHeight: { xs: 24, md: 32 }, letterSpacing: 1 }}>
                        {typedText || "SEKKEIYA AI Processing..."}
                      </Typography>
                      {stage === STAGES.TYPING && (
                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} style={{ width: 2, height: 24, backgroundColor: BRAND.primary, marginLeft: 6 }} />
                      )}
                    </Box>
                  </motion.div>
                )}
                </AnimatePresence>
              </Box>

              {/* Status Display: Cascading Popups */}
              <Box sx={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2, px: { xs: 2, md: 0 } }}>
                {stage >= STAGES.THINKING && (
                  <Stack spacing={2} sx={{ width: { xs: "100%", sm: 400 } }}>
                    <AnimatePresence>
                      {stage >= STAGES.THINKING && (
                         <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center' }}>
                           {stage === STAGES.THINKING ? <CircularProgress size={20} sx={{ color: BRAND.primary, mr: 2 }} /> : <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: BRAND.primary, mr: 2 }} />}
                           <Typography sx={{ color: stage === STAGES.THINKING ? "#fff" : BRAND.sub, fontWeight: 700, letterSpacing: 1 }}>Thinking context...</Typography>
                         </motion.div>
                      )}
                      {stage >= STAGES.LAUNCHING_3DSS && (
                         <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center' }}>
                           {stage === STAGES.LAUNCHING_3DSS ? <CircularProgress size={20} sx={{ color: BRAND.primary, mr: 2 }} /> : <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: BRAND.primary, mr: 2 }} />}
                           <Typography sx={{ color: stage === STAGES.LAUNCHING_3DSS ? "#fff" : BRAND.sub, fontWeight: 700, letterSpacing: 1 }}>[3DSS] Searching components...</Typography>
                         </motion.div>
                      )}
                      {stage >= STAGES.LAUNCHING_3DSL && (
                         <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center' }}>
                           {stage === STAGES.LAUNCHING_3DSL ? <CircularProgress size={20} sx={{ color: BRAND.primary, mr: 2 }} /> : <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: BRAND.primary, mr: 2 }} />}
                           <Typography sx={{ color: stage === STAGES.LAUNCHING_3DSL ? "#fff" : BRAND.sub, fontWeight: 700, letterSpacing: 1 }}>[3DSL] Generating layouts...</Typography>
                         </motion.div>
                      )}
                      {stage >= STAGES.RENDERING_IMAGES && (
                         <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center' }}>
                           {stage === STAGES.RENDERING_IMAGES ? <CircularProgress size={20} sx={{ color: BRAND.primary, mr: 2 }} /> : <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: BRAND.primary, mr: 2 }} />}
                           <Typography sx={{ color: stage === STAGES.RENDERING_IMAGES ? "#fff" : BRAND.sub, fontWeight: 700, letterSpacing: 1 }}>[3DSP] Rendering still images...</Typography>
                         </motion.div>
                      )}
                      {stage >= STAGES.RENDERING_VIDEO && (
                         <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center' }}>
                           {stage === STAGES.RENDERING_VIDEO ? <CircularProgress size={20} sx={{ color: BRAND.primary, mr: 2 }} /> : <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: BRAND.primary, mr: 2 }} />}
                           <Typography sx={{ color: stage === STAGES.RENDERING_VIDEO ? "#fff" : BRAND.sub, fontWeight: 700, letterSpacing: 1 }}>[3DSP] Generating walk-through video...</Typography>
                         </motion.div>
                      )}
                      {stage >= STAGES.BUILDING_PRESENTATION && (
                         <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center' }}>
                           {stage === STAGES.BUILDING_PRESENTATION ? <CircularProgress size={20} sx={{ color: BRAND.primary, mr: 2 }} /> : <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: BRAND.primary, mr: 2 }} />}
                           <Typography sx={{ color: stage === STAGES.BUILDING_PRESENTATION ? "#fff" : BRAND.sub, fontWeight: 700, letterSpacing: 1 }}>[3DSP] Assembling presentation boards...</Typography>
                         </motion.div>
                      )}
                    </AnimatePresence>
                  </Stack>
                )}
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
      
      {/* Final Project Layout Screen */}
      <AnimatePresence>
        {stage === STAGES.RESULT && (
          <Box sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 20 }}>
            <DemoProjectResult />
          </Box>
        )}
      </AnimatePresence>
    </Box>
    </>
  );
}
