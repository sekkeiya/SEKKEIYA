import React, { useState, useEffect, Suspense, useRef } from "react";
import { Box, Typography, Stack, Button, IconButton, Grid } from "@mui/material";
import { BRAND } from "@/shared/ui/theme";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, Center } from "@react-three/drei";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from "react-router-dom";

import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import { Dialog } from "@mui/material";

// Loaded Custom House Model Component
const LoadedHouse = ({ isAssembling }) => {
  const { scene } = useGLTF("/models/sekkeiya_demo.glb");
  const groupRef = useRef();

  // Reset rotation and scale initially
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.scale.set(0, 0, 0);
      groupRef.current.position.y = -5;
    }
  }, []);

  useFrame((state, delta) => {
    if (groupRef.current) {
      if (!isAssembling) {
        // Smoothly animate to normal size and position
        const lerpFactor = 5 * delta;
        const currentScale = groupRef.current.scale.x;
        const targetScale = 1;
        const s = currentScale + (targetScale - currentScale) * lerpFactor;
        
        groupRef.current.scale.set(s, s, s);
        groupRef.current.position.y += (0 - groupRef.current.position.y) * lerpFactor;
      } else {
        // Keep hidden/tiny during assemble phase
        groupRef.current.scale.set(0.01, 0.01, 0.01);
        groupRef.current.position.y = -5;
      }
    }
  });

  return (
    <group>
      {/* Show scanning/building grid effect while assembling */}
      {isAssembling && (
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[20, 0.1, 15]} />
          <meshBasicMaterial color="#50E3C2" wireframe opacity={0.3} transparent />
        </mesh>
      )}
      
      <group ref={groupRef}>
        <Center>
          <primitive object={scene} />
        </Center>
      </group>
    </group>
  );
};
useGLTF.preload("/models/sekkeiya_demo.glb");

export default function DemoProjectResult() {
  const navigate = useNavigate();
  const scrollerRef = useRef(null);

  // Scroll and Dialog States
  const [fadeoutPresentation, setFadeoutPresentation] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isScreenDarkened, setIsScreenDarkened] = useState(false);
  const scrollRef = useRef();

  // Phase 0: Initial slide in
  // Phase 1: Assembling Model (Grid view, loading text)
  // Phase 2: Complete Model, Infos streaming in
  const [phase, setPhase] = useState(0);

  const [streamCount, setStreamCount] = useState(0);
  const fullStream = [
    "[SYSTEM] AI Analysis Completed.",
    "[SYSTEM] Total Area 300sqm Optimized.",
    "[3DSL] Zoning applied: LDK + 4 Rooms.",
    "[3DSS] 124 Furniture assets placed.",
    "[3DSP] 12 Camera views rendered.",
    "BOM Generated.",
    "Proposition is Ready."
  ];

  const streamText = fullStream.slice(0, streamCount);

  // Phase transitions
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 4000); 
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Trigger Auto-Scroll Sequence when Phase 3 starts
  useEffect(() => {
    if (phase === 3) {
      setTimeout(() => {
        const stream = document.getElementById("presentation-stream");
        if (stream) stream.scrollIntoView({ behavior: "smooth", block: "start" });

        // Wait for the smooth scroll to start the slow cinematic pan
        setTimeout(() => {
          const bottom = document.getElementById("section-bottom");
          if (!bottom) return;

          let scroller = scrollerRef.current;
          if (!scroller) scroller = document.documentElement;

          const isWindow = scroller === document.documentElement || scroller === document.body;
          const startY = isWindow ? window.scrollY : scroller.scrollTop;
          
          let containerRectTop = isWindow ? 0 : scroller.getBoundingClientRect().top;
          let distance = bottom.getBoundingClientRect().top - containerRectTop;

          // Subtract viewport offset so bottom lands near center/bottom of screen
          distance -= window.innerHeight / 3;

          const duration = 28000; // 28 seconds
          let start = null;

          function step(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            
            // Linear constant pan over duration
            const run = startY + (distance * (progress / duration));
            
            if (isWindow) {
               window.scrollTo({ top: run, left: 0, behavior: "auto" });
            } else {
               scroller.scrollTo({ top: run, left: 0, behavior: "auto" });
            }

            if (progress >= duration) {
              cancelAnimationFrame(scrollRef.current);
              
              // Darken the screen gradually
              setIsScreenDarkened(true);
              
              // Show the dialog after the 1.5s darken transition finishes
              setTimeout(() => {
                setShowAuthDialog(true);
              }, 1500);
              return;
            }
            
            scrollRef.current = window.requestAnimationFrame(step);
          }
          
          scrollRef.current = window.requestAnimationFrame(step);

        }, 2000);
      }, 500);
    }
  }, [phase]);

  // Text streaming logic
  useEffect(() => {
    if (phase === 2 && streamCount < fullStream.length) {
      const t = setTimeout(() => setStreamCount(s => s + 1), 500);
      return () => clearTimeout(t);
    } else if (phase === 2 && streamCount === fullStream.length) {
      const tcta = setTimeout(() => {
        setPhase(3);
      }, 500);
      return () => clearTimeout(tcta);
    }
  }, [phase, streamCount]);

  return (
    <Box ref={scrollerRef} sx={{ width: "100%", height: "100vh", bgcolor: BRAND.bg, display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden", color: "#fff", position: "relative" }}>
      
      {/* Home Navigation Button (Sticky Top Left) */}
      <IconButton 
        onClick={() => navigate("/")} 
        sx={{ position: "fixed", top: 16, left: 16, zIndex: 9999, color: "rgba(255,255,255,0.7)", bgcolor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", "&:hover": { color: "#fff", bgcolor: "rgba(0,0,0,0.8)" } }}
      >
        <HomeIcon />
      </IconButton>

      {/* First Fold: Dashboard Viewer */}
      <Box sx={{ display: "flex", width: "100%", minHeight: "100vh", flexShrink: 0 }}>
        {/* Sidebar Mockup */}
        <motion.div
          initial={{ x: -100 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Box sx={{ width: 64, height: "100%", bgcolor: "rgba(0,0,0,0.8)", borderRight: `1px solid ${BRAND.line}`, display: { xs: "none", md: "flex" }, flexDirection: "column", alignItems: "center", py: 3, zIndex: 10 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: BRAND.primary, mb: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 'bold' }}>S</Box>
            <Stack spacing={3}>
              <HomeIcon sx={{ color: BRAND.sub, opacity: 0.5 }} />
              <FolderIcon sx={{ color: BRAND.primary }} />
              <SettingsIcon sx={{ color: BRAND.sub, opacity: 0.5 }} />
            </Stack>
          </Box>
        </motion.div>

        {/* Main Area */}
        <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
          {/* Top Nav Mock */}
          <motion.div
            initial={{ y: -64 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            <Box sx={{ height: 64, borderBottom: `1px solid ${BRAND.line}`, px: 4, display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "rgba(0,0,0,0.5)" }}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <IconButton onClick={() => navigate("/")} sx={{ color: BRAND.sub, mr: 2 }}><ArrowBackIcon /></IconButton>
                <Box>
                  <Typography sx={{ fontSize: "0.8rem", color: BRAND.sub }}>マイプロジェクト / アクティブ</Typography>
                  <Typography sx={{ fontSize: "1.2rem", fontWeight: 700 }}>300㎡ Advanced Design House</Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={3} sx={{ color: BRAND.sub, fontSize: "0.9rem", display: { xs: "none", md: "flex" } }}>
                <Typography sx={{ color: "#fff", borderBottom: `2px solid ${BRAND.primary}`, pb: 2, pt: 2 }}>Overview</Typography>
                <Typography sx={{ pt: 2 }}>Work Files</Typography>
                <Typography sx={{ pt: 2 }}>Models</Typography>
              </Stack>
            </Box>
          </motion.div>

        {/* Content Area */}
        <Box sx={{ flexGrow: 1, display: "flex", p: { xs: 2, md: 3 }, gap: { xs: 2, md: 3 }, flexDirection: { xs: "column", md: "row" } }}>
          {/* Left Canvas Area (Large) */}
          <Box
            component={motion.div}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            sx={{ flexGrow: 1, borderRadius: "16px", overflow: "hidden", position: "relative", border: `1px solid ${BRAND.line}`, backgroundColor: "#050810", height: { xs: 350, md: "auto" } }}
          >
            {phase === 1 && (
               <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10, textAlign: "center" }}>
                 <Typography sx={{ color: BRAND.primary, fontWeight: 700, letterSpacing: 4, fontSize: "1.5rem" }} className="blink">
                   ASSEMBLING PROJECT...
                 </Typography>
                 <Box sx={{ width: 200, height: 2, bgcolor: "rgba(255,255,255,0.1)", mx: "auto", mt: 2, position: "relative" }}>
                   <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 4, ease: "linear" }} style={{ height: "100%", backgroundColor: BRAND.primary }} />
                 </Box>
               </Box>
            )}

            <Canvas camera={{ position: [20, 15, 20], fov: 50 }}>
              <color attach="background" args={["#050810"]} />
              <ambientLight intensity={0.7} />
              <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
              <directionalLight position={[-10, 5, -5]} intensity={1} color={BRAND.primary} />
              <Suspense fallback={null}>
                <LoadedHouse isAssembling={phase === 1} />
              </Suspense>
              <OrbitControls autoRotate={phase >= 2} autoRotateSpeed={1} enableZoom={true} enablePan={false} />
            <Environment preset="city" />
            </Canvas>
          </Box>

          {/* Right Info Panel */}
          <Box
            component={motion.div}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            sx={{ width: { xs: "100%", md: "400px" }, display: "flex", flexDirection: "column" }}
          >
            <Box sx={{ flexGrow: 1, p: 4, bgcolor: "rgba(0,0,0,0.6)", borderRadius: 4, border: `1px solid ${BRAND.line}`, backdropFilter: "blur(20px)", display: "flex", flexDirection: "column" }}>
              <Typography sx={{ color: BRAND.sub, fontWeight: 700, mb: 3, letterSpacing: 2 }}>DATA STREAM</Typography>
              
              <Stack spacing={2} sx={{ flexGrow: 1, fontFamily: "monospace", fontSize: "0.9rem" }}>
                <AnimatePresence>
                  {streamText.map((text, i) => (
                    <motion.div
                      key={text}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{ color: text.includes("Ready") ? BRAND.primary : "#fff", display: "flex", alignItems: "center" }}
                    >
                      <Box sx={{ width: 4, height: 12, bgcolor: text.includes("Ready") ? BRAND.primary : BRAND.sub, mr: 2 }} />
                      {text}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {phase >= 2 && phase < 3 && (
                  <motion.div animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>
                    <Box sx={{ width: 10, height: 16, bgcolor: BRAND.primary, mt: 1 }} />
                  </motion.div>
                )}
              </Stack>

              {/* Final CTA */}
              <AnimatePresence>
                {phase === 3 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Box sx={{ mt: 4 }}>
                      <Typography sx={{ fontSize: "1.2rem", fontWeight: 800, mb: 2 }}>
                        Presentation is Ready
                      </Typography>
                      <Button variant="contained" fullWidth size="large" onClick={() => document.getElementById("presentation-stream")?.scrollIntoView({ behavior: "smooth" })} sx={{ bgcolor: "#fff", color: "#000", fontWeight: 800, borderRadius: 2, py: 2, fontSize: "1.1rem", "&:hover": { bgcolor: "rgba(255,255,255,0.8)" } }}>
                        VIEW PRESENTATION
                      </Button>
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </Box>
        </Box>
      </Box>
      </Box>

      {/* Second Fold: Presentation Stream Section */}
      {phase === 3 && (
        <Box id="presentation-stream" sx={{ 
          minHeight: "100vh", bgcolor: "#0a0d14", borderTop: `1px solid ${BRAND.line}`, pt: 12, pb: 20, px: { xs: 4, md: 10 }, 
          display: "flex", flexDirection: "column", alignItems: "center", 
          backgroundImage: "radial-gradient(ellipse at top, rgba(80,227,194,0.05), transparent 60%)",
          transition: "opacity 1.5s ease-out",
          opacity: fadeoutPresentation ? 0 : 1,
          pointerEvents: fadeoutPresentation ? "none" : "auto"
        }}>
          <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} style={{ width: "100%", maxWidth: 1200 }}>
            <Typography sx={{ fontSize: { xs: "1.8rem", md: "3rem" }, fontWeight: 800, mb: 1, letterSpacing: { xs: 1, md: 2 }, textAlign: "center", color: "#fff" }}>
              次世代建築デザイン・プロポーザル
            </Typography>
            <Typography sx={{ fontSize: "1.2rem", color: BRAND.sub, mb: 6, textAlign: "center", maxWidth: 600, mx: "auto" }}>
              AI駆動型設計による最適化された空間体験
            </Typography>

            {/* Design Concept Text */}
            <Box sx={{ textAlign: "center", mb: 10, maxWidth: 800, mx: "auto" }}>
              <Typography sx={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.8)", lineHeight: 2 }}>
                モダンな美学と機能的なゾーニングの完璧な融合。打ち放しコンクリートと温かみのある天然木材の組み合わせが、洗練されつつも居心地の良い空間を創出します。あなたのライフスタイルを中心にデザインされた、全く新しい建築体験です。
              </Typography>
            </Box>

            {/* Section 1: Hero Exterior */}
            <Box sx={{ width: "100%", height: { xs: "60vh", md: "80vh" }, maxHeight: 800, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 4, overflow: "hidden", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", mb: { xs: 16, md: 32 } }}>
               <Box sx={{ width: "100%", height: "100%", backgroundImage: "url('/images/demo_assets/exterior.png')", backgroundSize: "cover", backgroundPosition: "center", transition: "transform 0.5s ease", "&:hover": { transform: "scale(1.02)" } }} />
               <Box sx={{ position: "absolute", bottom: 40, left: 40, px: 4, py: 2, bgcolor: "rgba(0,0,0,0.6)", borderRadius: 4, backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                 <Typography sx={{ color: BRAND.primary, fontWeight: 800, letterSpacing: 2, fontSize: "0.9rem", mb: 1 }}>外観デザイン (EXTERIOR)</Typography>
                 <Typography sx={{ color: "#fff", fontSize: "1.2rem" }}>景観に溶け込む、普遍的で洗練されたファサード</Typography>
               </Box>
            </Box>

            {/* Section 2: Interior Spatial Concept */}
            <Grid container spacing={{ xs: 4, md: 10 }} alignItems="center" sx={{ mb: { xs: 16, md: 32 }, maxWidth: 1200, width: "100%", mx: "auto" }}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Typography sx={{ color: BRAND.primary, fontWeight: 800, letterSpacing: 2, fontSize: "0.9rem", mb: 2 }}>空間構成 (INTERIOR)</Typography>
                <Typography sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 800, color: "#fff", mb: 4, lineHeight: 1.2 }}>シームレスに繋がる<br/>圧倒的な大空間</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 4, fontSize: "1.1rem", lineHeight: 1.8 }}>吹き抜けのある連続したLDKはテラスやプールエリアへと完全に開放され、内と外の境界を曖昧にします。セレクトされた天然木や石の質感が、空間全体に落ち着きと品格をもたらします。</Typography>
                <Box sx={{ height: 2, width: 80, bgcolor: BRAND.primary }} />
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <Box sx={{ height: { xs: 300, sm: 450, md: 600 }, width: "100%", bgcolor: "rgba(255,255,255,0.03)", borderRadius: 4, overflow: "hidden", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                  <Box sx={{ width: "100%", height: "100%", backgroundImage: "url('/images/demo_assets/interior.png')", backgroundSize: "cover", backgroundPosition: "center", transition: "transform 0.5s ease", "&:hover": { transform: "scale(1.02)" } }} />
                </Box>
              </Grid>
            </Grid>

            {/* Section 3: Layout & Flow */}
            <Grid container spacing={{ xs: 4, md: 10 }} alignItems="center" sx={{ mb: { xs: 16, md: 32 }, maxWidth: 1200, width: "100%", mx: "auto", flexDirection: { xs: "column-reverse", md: "row" } }}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Box sx={{ height: { xs: 300, sm: 450, md: 600 }, width: "100%", bgcolor: "#05070a", borderRadius: 4, overflow: "hidden", position: "relative", border: `1px solid rgba(80,227,194,0.3)`, boxShadow: "0 20px 80px rgba(80,227,194,0.15)" }}>
                  <Box sx={{ width: "100%", height: "100%", backgroundImage: "url('/images/demo_assets/floorplan.png')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.9, transition: "transform 0.5s ease", "&:hover": { transform: "scale(1.02)" } }} />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Typography sx={{ color: BRAND.primary, fontWeight: 800, letterSpacing: 2, fontSize: "0.9rem", mb: 2 }}>配置と動線 (ZONING & FUNCTION)</Typography>
                <Typography sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 800, color: "#fff", mb: 4, lineHeight: 1.2 }}>理想の暮らしを支える<br/>インテリジェントな動線</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 4, fontSize: "1.1rem", lineHeight: 1.8 }}>プライベートな寝室群は音響的に分離して配置され、パブリックスペースは開放感を最大化しています。また、ビルトインの2台用ガレージから直接アクセスできるプレミアムなマッドルーム動線を確保しています。</Typography>
                <Box sx={{ height: 2, width: 80, bgcolor: BRAND.primary }} />
              </Grid>
            </Grid>

            {/* Section 4: Furniture & 3D Interactive */}
            <Grid container spacing={{ xs: 4, md: 10 }} alignItems="center" sx={{ mb: { xs: 16, md: 32 }, maxWidth: 1200, width: "100%", mx: "auto" }}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Typography sx={{ color: BRAND.primary, fontWeight: 800, letterSpacing: 2, fontSize: "0.9rem", mb: 2 }}>家具・アセット選定 (FURNITURE SELECTION)</Typography>
                <Typography sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 800, color: "#fff", mb: 4, lineHeight: 1.2 }}>厳選された家具と<br/>インタラクティブな3D体験</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 4, fontSize: "1.1rem", lineHeight: 1.8 }}>本提案に配置されている家具やアセットはすべて実際の製品データをもとに構築されています。空間のバランスやディテールを、インタラクティブな3Dモデルでご検討ください。</Typography>
                <Box sx={{ height: 2, width: 80, bgcolor: BRAND.primary }} />
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <Box sx={{ height: { xs: 300, sm: 450, md: 600 }, width: "100%", bgcolor: "#0a0f1a", borderRadius: 4, overflow: "hidden", position: "relative", boxShadow: "0 20px 80px rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <Canvas camera={{ position: [15, 12, 15], fov: 45 }}>
                    <color attach="background" args={["#0a0f1a"]} />
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 10, 5]} intensity={1.2} />
                    <directionalLight position={[-10, 5, -5]} intensity={0.5} color={BRAND.primary} />
                    <Suspense fallback={null}>
                      <LoadedHouse isAssembling={false} />
                    </Suspense>
                    <OrbitControls autoRotate autoRotateSpeed={1.5} enableZoom={false} enablePan={false} />
                  </Canvas>
                  <Box sx={{ position: "absolute", bottom: 16, right: 16, px: 2, py: 0.5, bgcolor: "rgba(0,0,0,0.6)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", pointerEvents: "none" }}>
                    DRAG TO ROTATE
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {/* Section 5: Estimation */}
            <Box sx={{ mb: 20, maxWidth: 1000, width: "100%", mx: "auto", textAlign: "center" }}>
              <Typography sx={{ color: BRAND.primary, fontWeight: 800, letterSpacing: 2, fontSize: "0.9rem", mb: 2 }}>概算見積もり (ESTIMATION)</Typography>
              <Typography sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 800, color: "#fff", mb: 6, lineHeight: 1.2 }}>リアルタイムで算出される<br/>透明性の高いコスト提示</Typography>
              
              <Box sx={{ bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 4, p: { xs: 4, md: 8 } }}>
                <Grid container spacing={4} sx={{ mb: 4 }}>
                  <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)", pb: 2 }}>
                    <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>本体工事費用</Typography>
                    <Typography sx={{ color: "#fff", fontSize: "1.5rem", fontWeight: 700 }}>¥45,000,000</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)", pb: 2 }}>
                    <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>家具・アセット費用</Typography>
                    <Typography sx={{ color: "#fff", fontSize: "1.5rem", fontWeight: 700 }}>¥6,200,000</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)", pb: 2 }}>
                    <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>設計・システム利用料</Typography>
                    <Typography sx={{ color: "#fff", fontSize: "1.5rem", fontWeight: 700 }}>¥5,100,000</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)", pb: 2 }}>
                    <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>スマートホーム拡張枠</Typography>
                    <Typography sx={{ color: "#fff", fontSize: "1.5rem", fontWeight: 700 }}>¥2,800,000</Typography>
                  </Grid>
                </Grid>
                
                <Box sx={{ bgcolor: "rgba(80,227,194,0.1)", border: `1px solid ${BRAND.primary}`, borderRadius: 2, p: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontWeight: 800, color: BRAND.primary }}>Total Estimated Cost</Typography>
                  <Typography sx={{ fontSize: "2rem", fontWeight: 800, color: "#fff" }}>¥59,100,000 <span style={{ fontSize: "1rem", fontWeight: "normal", color: "rgba(255,255,255,0.6)" }}>+税</span></Typography>
                </Box>
              </Box>
            </Box>

            {/* The bottom anchor needed for scrolling and fadeout calculation. Content removed. */}
            <Box id="section-bottom" sx={{ pb: 10 }} />
          </motion.div>
        </Box>
      )}

      {/* Cinematic Dark Overlay */}
      <Box 
        sx={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          bgcolor: "rgba(0,0,0,0.85)", zIndex: 1200,
          opacity: isScreenDarkened ? 1 : 0,
          pointerEvents: isScreenDarkened ? "auto" : "none",
          transition: "opacity 1.5s ease"
        }}
        onClick={() => {
          setShowAuthDialog(false);
          setIsScreenDarkened(false);
        }}
      />

      {/* Final Auth Dialog */}
      <Dialog 
        open={showAuthDialog} 
        onClose={() => {
          setShowAuthDialog(false);
          setIsScreenDarkened(false);
        }}
        hideBackdrop={true}
        PaperProps={{ sx: { bgcolor: "#11141d", color: "#fff", p: { xs: 4, md: 6 }, borderRadius: 4, border: `1px solid rgba(80,227,194,0.3)`, width: "90%", maxWidth: 450, textAlign: "center", boxShadow: "0 20px 80px rgba(0,0,0,0.8)", position: "relative" } }}
      >
        <IconButton 
          onClick={() => {
            setShowAuthDialog(false);
            setIsScreenDarkened(false);
          }} 
          sx={{ position: "absolute", top: 16, right: 16, color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" } }}
        >
          <Typography sx={{ fontWeight: 800 }}>X</Typography>
        </IconButton>

        <Typography sx={{ fontSize: "1.8rem", fontWeight: 800, mb: 2, color: BRAND.primary }}>
          Experience the Future
        </Typography>
        <Typography sx={{ mb: 4, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          SEKKEIYA Design OS is ready to accelerate your architectural workflow.
        </Typography>
        <Button 
          fullWidth variant="contained" 
          onClick={() => navigate("/signup")} 
          sx={{ bgcolor: BRAND.primary, color: "#000", fontWeight: 800, py: 1.8, mb: 2, borderRadius: 2, fontSize: "1.05rem", "&:hover": { bgcolor: "#3bc1a2" } }}
        >
          アカウントを作成して始める
        </Button>
        <Button 
          fullWidth variant="outlined" 
          onClick={() => navigate("/login")} 
          sx={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff", py: 1.8, mb: 2, borderRadius: 2, fontWeight: 700, "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.05)" } }}
        >
          ログイン
        </Button>
        <Button 
          fullWidth variant="text" 
          onClick={() => navigate("/")} 
          sx={{ color: "rgba(255,255,255,0.5)", py: 1.5, borderRadius: 2, fontWeight: 700, "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.05)" } }}
        >
          ホームへ戻る
        </Button>
      </Dialog>



      {/* Global CSS for blink */}
      <style>{`
        .blink {
          animation: blink-anim 1.5s infinite;
        }
        @keyframes blink-anim {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </Box>
  );
}
