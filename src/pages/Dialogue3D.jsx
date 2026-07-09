import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, Edges } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND } from '@/shared/ui/theme';
import * as THREE from 'three';

// Sequence states
const SCRIPT = [
  { id: 1, type: "user", text: "ここにカフェ風のラウンジを作りたい", delay: 1000 },
  { id: 2, type: "ai", text: "ウッド調のデスクとソファを配置しました", delay: 2500, action: "add_furniture" },
  { id: 3, type: "user", text: "南側をもっと開放的にできる？", delay: 5000 },
  { id: 4, type: "ai", text: "壁を取り払い、空間を拡張しました", delay: 6500, action: "open_south" },
  { id: 5, type: "user", text: "すごくいい！角に植物も置こうか", delay: 9000 },
  { id: 6, type: "ai", text: "日当たりの良いコーナーに植物を追加しました", delay: 10500, action: "add_plant" },
  { id: 7, type: "reset", text: "", delay: 13000, action: "reset" }
];

const ArchitecturalModel = ({ currentAction }) => {
  const southWallRef = useRef();
  const furnitureRef = useRef();
  const plantRef = useRef();
  
  // Track continuous states for smooth animations across multiple steps
  const [states, setStates] = useState({
    furnitureScale: 0,
    furnitureY: 5,
    wallY: 0,
    plantScale: 0,
    plantY: 5
  });

  useEffect(() => {
    if (currentAction === "reset") {
      setStates({ furnitureScale: 0, furnitureY: 5, wallY: 0, plantScale: 0, plantY: 5 });
    } else if (currentAction === "add_furniture") {
      setStates(s => ({ ...s, furnitureScale: 1, furnitureY: 0 }));
    } else if (currentAction === "open_south") {
      setStates(s => ({ ...s, wallY: -5 }));
    } else if (currentAction === "add_plant") {
      setStates(s => ({ ...s, plantScale: 1, plantY: 0 }));
    }
  }, [currentAction]);

  useFrame((state, delta) => {
    // Smooth transitions based on continuous states
    if (southWallRef.current) {
      southWallRef.current.position.y = THREE.MathUtils.lerp(southWallRef.current.position.y, states.wallY, delta * 3);
      southWallRef.current.material.opacity = THREE.MathUtils.lerp(southWallRef.current.material.opacity, states.wallY === -5 ? 0 : 0.8, delta * 3);
      // Give the wall an emissive glow when it drops
      southWallRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(southWallRef.current.material.emissiveIntensity, states.wallY === -5 ? 2 : 0, delta * 4);
    }
    
    if (furnitureRef.current) {
      furnitureRef.current.scale.setScalar(THREE.MathUtils.lerp(furnitureRef.current.scale.x, states.furnitureScale, delta * 5));
      // Bounce drop effect
      furnitureRef.current.position.y = THREE.MathUtils.lerp(furnitureRef.current.position.y, states.furnitureY, delta * 8);
    }

    if (plantRef.current) {
      plantRef.current.scale.setScalar(THREE.MathUtils.lerp(plantRef.current.scale.x, states.plantScale, delta * 6));
      plantRef.current.position.y = THREE.MathUtils.lerp(plantRef.current.position.y, states.plantY, delta * 8);
    }
  });

  return (
    <group position={[0, -1, 0]}>
      {/* Holographic Grid Floor */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[7, 0.1, 7]} />
        <meshStandardMaterial color="#0a0c10" roughness={0.2} metalness={0.8} />
        <Edges scale={1.01} color="#50E3C2" transparent opacity={0.15} />
      </mesh>
      
      {/* Add a literal GridHelper object underneath to make it sci-fi */}
      <gridHelper args={[7, 14, "#4A90E2", "#4A90E2"]} position={[0, -0.44, 0]} material-opacity={0.15} material-transparent={true} />

      {/* Base Floor */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[6, 0.2, 6]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.8} />
        <Edges scale={1.01} color="#50E3C2" transparent opacity={0.3} />
      </mesh>

      {/* North Wall */}
      <mesh position={[0, 1.2, -2.9]}>
        <boxGeometry args={[6, 2.4, 0.2]} />
        <meshPhysicalMaterial color="#2a2e33" roughness={0.1} transmission={0.9} ior={1.5} thickness={0.5} transparent opacity={0.8} />
        <Edges scale={1.01} color="#4A90E2" transparent opacity={0.3} />
      </mesh>

      {/* East/West Walls */}
      <mesh position={[-2.9, 1.2, 0]}>
        <boxGeometry args={[0.2, 2.4, 6]} />
        <meshPhysicalMaterial color="#2a2e33" roughness={0.1} transmission={0.9} ior={1.5} thickness={0.5} transparent opacity={0.8} />
        <Edges scale={1.01} color="#4A90E2" transparent opacity={0.3} />
      </mesh>
      <mesh position={[2.9, 1.2, 0]}>
        <boxGeometry args={[0.2, 2.4, 6]} />
        <meshPhysicalMaterial color="#2a2e33" roughness={0.1} transmission={0.9} ior={1.5} thickness={0.5} transparent opacity={0.8} />
        <Edges scale={1.01} color="#4A90E2" transparent opacity={0.3} />
      </mesh>

      {/* South Wall (Dynamic) */}
      <mesh ref={southWallRef} position={[0, 0, 2.9]}>
        <boxGeometry args={[6, 2.4, 0.2]} />
        <meshStandardMaterial color="#2a2e33" emissive="#50E3C2" emissiveIntensity={0} roughness={0.5} transparent opacity={0.8} />
        <Edges scale={1.01} color="#50E3C2" transparent opacity={0.8} />
      </mesh>

      {/* Furniture Group (Dynamic) */}
      <group ref={furnitureRef} position={[0, states.furnitureY, 0]} scale={0}>
        {/* Table */}
        <mesh position={[0.5, 0.3, 0]}>
           <boxGeometry args={[1.5, 0.05, 1]} />
           {/* Emissive initially to simulate "materialization" -> The bloom will catch this since we scale it up */}
           <meshStandardMaterial color="#F5A623" emissive="#F5A623" emissiveIntensity={states.furnitureScale < 0.9 ? 1 : 0.1} roughness={0.2} metalness={0.5} />
        </mesh>
        <mesh position={[0.5, 0.15, -0.4]}>
           <boxGeometry args={[0.1, 0.3, 0.1]} />
           <meshStandardMaterial color="#333" emissive="#50E3C2" emissiveIntensity={states.furnitureScale < 0.9 ? 1 : 0} />
        </mesh>
        <mesh position={[0.5, 0.15, 0.4]}>
           <boxGeometry args={[0.1, 0.3, 0.1]} />
           <meshStandardMaterial color="#333" emissive="#50E3C2" emissiveIntensity={states.furnitureScale < 0.9 ? 1 : 0} />
        </mesh>
        
        {/* Sofa */}
        <mesh position={[-0.8, 0.2, 0]}>
           <boxGeometry args={[0.8, 0.25, 2.0]} />
           <meshStandardMaterial color="#50E3C2" emissive="#50E3C2" emissiveIntensity={0.2} roughness={0.5} metalness={0.5} />
           <Edges scale={1.02} color="#ffffff" transparent opacity={0.5} />
        </mesh>
        {/* Sofa Backrest */}
        <mesh position={[-1.0, 0.5, 0]}>
           <boxGeometry args={[0.2, 0.5, 2.0]} />
           <meshStandardMaterial color="#50E3C2" roughness={0.5} metalness={0.5} />
           <Edges scale={1.02} color="#ffffff" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Plant Group (Dynamic) */}
      <group ref={plantRef} position={[2.2, states.plantY, -2.2]} scale={0}>
        {/* Pot */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.25, 0.15, 0.4, 16]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={states.plantScale < 0.9 ? 1 : 0.1} roughness={0.2} />
        </mesh>
        {/* Leaves */}
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="#7ED321" emissive="#7ED321" emissiveIntensity={0.5} roughness={0.2} metalness={0.5} />
          <Edges scale={1.05} color="#4A90E2" transparent opacity={0.5} />
        </mesh>
      </group>
    </group>
  );
};

const ChatBubble = ({ type, text }) => {
  const isAi = type === "ai";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        background: isAi ? "rgba(80, 227, 194, 0.15)" : "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${isAi ? "rgba(80, 227, 194, 0.4)" : "rgba(255, 255, 255, 0.2)"}`,
        padding: "12px 20px",
        borderRadius: isAi ? "2px 16px 16px 16px" : "16px 2px 16px 16px",
        color: isAi ? "#50E3C2" : "#ffffff",
        fontFamily: "'Inter', sans-serif",
        fontSize: "0.9rem",
        fontWeight: isAi ? 600 : 400,
        whiteSpace: "nowrap", // Prevents text from being squished vertically
        boxShadow: isAi ? "0 8px 32px rgba(80, 227, 194, 0.3)" : "0 8px 32px rgba(0,0,0,0.6)",
        pointerEvents: "none",
        textShadow: isAi ? "0 0 10px rgba(80, 227, 194, 0.5)" : "none"
      }}
    >
      {text}
    </motion.div>
  );
};

export default function Dialogue3D() {
  const [activeMessage, setActiveMessage] = useState(null);
  const [currentAction, setCurrentAction] = useState("reset");

  useEffect(() => {
    let timeouts = [];
    
    const runSequence = () => {
      // Clear all to start
      setActiveMessage(null);
      setCurrentAction("reset");
      
      SCRIPT.forEach((step) => {
        const timeout = setTimeout(() => {
          if (step.type === "reset") {
            setActiveMessage(null);
            setCurrentAction("reset");
            // Loop back quickly after reset
            setTimeout(runSequence, 1000);
          } else {
            setActiveMessage(step);
            if (step.action) {
              setCurrentAction(step.action);
            }
          }
        }, step.delay);
        timeouts.push(timeout);
      });
    };

    runSequence();

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px' }}>
      <Canvas camera={{ position: [6, 4, 8], fov: 45 }}>
        {/* Add more intense lights for a flashier look */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={2.0} color="#ffffff" />
        <directionalLight position={[-10, 5, -5]} intensity={1.5} color={BRAND.accent} />
        <pointLight position={[0, 2, 0]} intensity={1.0} color="#4A90E2" />
        
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
           <group rotation={[0, -Math.PI / 4, 0]}>
             <ArchitecturalModel currentAction={currentAction} />
           </group>
        </Float>

        {/* 3D UI Overlay */}
        <Html position={[-3, 2, 0]} center zIndexRange={[100, 0]}>
           <AnimatePresence mode="wait">
             {activeMessage && activeMessage.type === "user" && (
                <ChatBubble key={activeMessage.id} type="user" text={activeMessage.text} />
             )}
           </AnimatePresence>
        </Html>

        <Html position={[3, 1, 0]} center zIndexRange={[100, 0]}>
           <AnimatePresence mode="wait">
             {activeMessage && activeMessage.type === "ai" && (
                <ChatBubble key={activeMessage.id} type="ai" text={activeMessage.text} />
             )}
           </AnimatePresence>
        </Html>

        {/* Flashier post processing */}
        <EffectComposer disableNormalPass>
           <Bloom luminanceThreshold={0.15} mipmapBlur intensity={1.8} radius={0.8} />
           <Vignette eskil={false} offset={0.1} darkness={1.2} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
