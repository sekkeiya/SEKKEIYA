import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html, Icosahedron, Torus, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlurPass, Resizer, KernelSize } from 'postprocessing';
import { BRAND } from '@/shared/ui/theme';
import * as THREE from 'three';

const DataPacket = ({ startDeg, radius, color, delay }) => {
  const packetRef = useRef();
  const trailRef = useRef();

  useFrame((state) => {
    if (packetRef.current) {
      const speed = 0.4;
      // Time loops from 1 down to 0, representing flow from outer nodes to center core
      const rawT = (state.clock.elapsedTime * speed + delay) % 1;
      // Ease-in effect
      const t = 1 - (rawT * rawT * rawT);
      
      const startX = Math.cos((startDeg * Math.PI) / 180) * radius;
      const startZ = Math.sin((startDeg * Math.PI) / 180) * radius;

      if (t < 0.15) {
         packetRef.current.visible = false;
         if (trailRef.current) trailRef.current.visible = false;
      } else {
         packetRef.current.visible = true;
         packetRef.current.position.set(startX * t, 0, startZ * t);
         
         if (trailRef.current) {
            trailRef.current.visible = true;
            trailRef.current.position.copy(packetRef.current.position);
            // Trail stretching
            const stretch = rawT * 0.8 + 0.2;
            trailRef.current.scale.set(1, stretch * 4, 1);
            // Look at center
            trailRef.current.lookAt(0, 0, 0);
            // Rotate 90deg to align cylinder length with direction
            trailRef.current.rotateX(Math.PI / 2);
         }
      }
    }
  });

  return (
    <group>
      <mesh ref={packetRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Glowing trail */}
      <mesh ref={trailRef}>
        <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

const OrbitingNodes = () => {
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
      groupRef.current.rotation.z += Math.sin(state.clock.elapsedTime * 0.5) * 0.001;
    }
  });

  const nodes = [
    { label: "Data Share", deg: 0, color: "#4A90E2" },
    { label: "AI Layout", deg: 72, color: "#50E3C2" },
    { label: "Presents", deg: 144, color: "#F5A623" },
    { label: "Analytics", deg: 216, color: "#9013FE" },
    { label: "Assets", deg: 288, color: "#7ED321" }
  ];

  const radius = 3.8;

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => {
        const x = Math.cos((node.deg * Math.PI) / 180) * radius;
        const z = Math.sin((node.deg * Math.PI) / 180) * radius;

        return (
          <group key={i}>
            {/* Connection Line to center with pulsing data flow effect */}
            <mesh>
              <tubeGeometry args={[new THREE.LineCurve3(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 0, 0)), 20, 0.015, 8, false]} />
              <meshBasicMaterial color={node.color} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
            </mesh>

            {/* Inbound Data Packets */}
            {Array.from({ length: 5 }).map((_, packetIdx) => (
               <DataPacket key={packetIdx} startDeg={node.deg} radius={radius} color={node.color} delay={packetIdx * 0.2} />
            ))}
            
            {/* Satellite Node Outer Ring */}
            <mesh position={[x, 0, z]} rotation={[Math.PI/2, 0, 0]}>
               <torusGeometry args={[0.25, 0.01, 16, 32]} />
               <meshBasicMaterial color={node.color} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
            </mesh>
            
            {/* Satellite Node Inner Core */}
            <mesh position={[x, 0, z]}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshStandardMaterial color="#0A0F1A" emissive={node.color} emissiveIntensity={1.5} roughness={0.2} metalness={0.8} />
              <Html distanceFactor={12} position={[0, -0.4, 0]} center zIndexRange={[100, 0]}>
                <div style={{ 
                  color: "#fff", fontSize: "14px", fontWeight: "bold", 
                  background: "rgba(0,0,0,0.4)", padding: "4px 12px", 
                  borderRadius: "20px", border: `1px solid rgba(255,255,255,0.1)`, 
                  whiteSpace: "nowrap", backdropFilter: "blur(8px)",
                  boxShadow: `0 0 15px ${node.color}60`,
                  textShadow: `0 0 5px ${node.color}`,
                  userSelect: 'none'
                }}>
                  {node.label}
                </div>
              </Html>
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const DataDust = () => {
  const pointsRef = useRef();
  const particleCount = 600;
  
  const [positions, scales] = useMemo(() => {
    const p = new Float32Array(particleCount * 3);
    const s = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      // Create a swirling vortex shape
      const radius = 1.5 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 4 * Math.max(0.1, 1 - Math.abs(radius - 2) / 2);
      
      p[i * 3] = Math.cos(theta) * radius;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = Math.sin(theta) * radius;
      
      s[i] = Math.random() * 0.5 + 0.1;
    }
    return [p, s];
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y -= delta * 0.05; // Counter-rotate the dust slowly
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} itemSize={3} count={particleCount} />
        <bufferAttribute attach="attributes-size" array={scales} itemSize={1} count={particleCount} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#4A90E2" transparent opacity={0.6} sizeAttenuation={true} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const CoreNode = () => {
  const outerSphereRef = useRef();
  const innerIcosaRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const coreMatRef = useRef();

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    
    // Rotate parts independently
    if (outerSphereRef.current) {
      outerSphereRef.current.rotation.y += delta * 0.1;
      outerSphereRef.current.rotation.x += delta * 0.05;
    }
    if (innerIcosaRef.current) {
      innerIcosaRef.current.rotation.y -= delta * 0.3;
      innerIcosaRef.current.rotation.z += delta * 0.2;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.5;
      ring1Ref.current.rotation.y -= delta * 0.1;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= delta * 0.4;
      ring2Ref.current.rotation.x -= delta * 0.2;
    }

    // Heartbeat pulse effect
    const pulse = Math.sin(time * 2) * Math.sin(time * 2); 
    const scale = 1 + pulse * 0.03;
    
    if (outerSphereRef.current) outerSphereRef.current.scale.setScalar(scale);

    // Material emissive pulse
    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity = 0.5 + pulse * 1.5;
    }
  });

  return (
    <group>
      {/* Absolute center glowing core */}
      <mesh>
         <sphereGeometry args={[0.5, 32, 32]} />
         <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Rotating inner wireframe Icosahedron */}
      <mesh ref={innerIcosaRef}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial color={BRAND.accent} emissive={BRAND.accent} emissiveIntensity={0.8} wireframe transparent opacity={0.6} />
      </mesh>

      {/* Astrolabe / Dyson Rings */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.3, 0.02, 16, 64]} />
        <meshBasicMaterial color="#4A90E2" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[1.4, 0.015, 16, 64]} />
        <meshBasicMaterial color="#50E3C2" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Main Glass Shell */}
      <mesh ref={outerSphereRef}>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshPhysicalMaterial 
            ref={coreMatRef}
            color="#0A0F1A"
            emissive="#4A90E2"
            emissiveIntensity={0.5}
            metalness={1}
            roughness={0}
            clearcoat={1}
            clearcoatRoughness={0}
            transmission={0.95}
            transparent
            opacity={1}
            ior={1.2}
            thickness={2.0}
        />
        <Html distanceFactor={10} center zIndexRange={[100, 0]}>
           <div style={{ 
              color: "#ffffff", fontSize: "2.5rem", fontWeight: 900, 
              letterSpacing: "8px", textShadow: "0 0 25px rgba(255,255,255,1), 0 0 10px #4A90E2",
              pointerEvents: "none", userSelect: "none"
           }}>
              SSOT
           </div>
           <div style={{ 
              color: "#50E3C2", fontSize: "0.8rem", fontWeight: 700, 
              letterSpacing: "4px", textShadow: "0 0 10px #50E3C2",
              textAlign: "center", marginTop: "4px",
              pointerEvents: "none", userSelect: "none"
           }}>
              SINGLE SOURCE OF TRUTH
           </div>
        </Html>
      </mesh>
    </group>
  );
};

export default function CoreNetwork3D() {
  return (
    <Canvas camera={{ position: [0, 3, 10], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={1.5} color="#50E3C2" />
      <spotLight position={[0, 8, 0]} intensity={2} angle={0.6} penumbra={0.5} color="#4A90E2" />
      
      {/* Enhanced dark starfield */}
      <Stars radius={50} depth={50} count={3000} factor={3} saturation={0.5} fade speed={1.5} />
      
      {/* Central Architecture */}
      <CoreNode />
      <DataDust />
      <OrbitingNodes />
      
      {/* Post Processing for Cinematic Sci-Fi Look */}
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.15} mipmapBlur intensity={2.5} radius={0.8} />
        <ChromaticAberration offset={[0.001, 0.001]} />
      </EffectComposer>

      <OrbitControls 
         enableZoom={false} 
         enablePan={false} 
         autoRotate 
         autoRotateSpeed={0.8} 
         maxPolarAngle={Math.PI / 2 + 0.3}
         minPolarAngle={Math.PI / 2 - 0.4}
      />
    </Canvas>
  );
}
