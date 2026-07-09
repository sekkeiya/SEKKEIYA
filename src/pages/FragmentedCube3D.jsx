import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Edges } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BRAND } from '@/shared/ui/theme';
import * as THREE from 'three';

const Fragment = ({ position, initialRotation, offsetScale }) => {
  const meshRef = useRef();
  
  // Random speeds for each fragment to emphasize lack of sync
  const rotationSpeed = useMemo(() => ({
    x: (Math.random() - 0.5) * 0.2,
    y: (Math.random() - 0.5) * 0.2,
    z: (Math.random() - 0.5) * 0.2
  }), []);

  const driftSpeed = useMemo(() => Math.random() * 0.5 + 0.1, []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Sluggish, uncoordinated rotation
      meshRef.current.rotation.x += rotationSpeed.x * delta;
      meshRef.current.rotation.y += rotationSpeed.y * delta;
      meshRef.current.rotation.z += rotationSpeed.z * delta;

      // Heavy drifting
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * driftSpeed + position[0]) * 0.5;
    }
  });

  return (
    <Float 
      speed={0.5} 
      rotationIntensity={0.2} 
      floatIntensity={0.5} 
      position={position}
    >
      <mesh ref={meshRef} rotation={initialRotation}>
        <boxGeometry args={[offsetScale, offsetScale, offsetScale]} />
        {/* Monolithic dark concrete look */}
        <meshStandardMaterial 
           color="#1a1c20"
           roughness={0.8}
           metalness={0.4}
        />
        {/* Glowing red/orange fractured edges to symbolize friction/errors */}
        <Edges scale={1.01} threshold={15} color="#FF3B30" transparent opacity={0.15} />
      </mesh>
    </Float>
  );
};

export default function FragmentedCube3D() {
  // Generate exploded 3x3x3 grid
  const fragments = useMemo(() => {
    const pieces = [];
    const spacing = 4.5; // Large spacing to show fragmentation
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          // Skip the very center piece to make it hollow
          if (x === 0 && y === 0 && z === 0) continue;
          
          // Explode outwards
          pieces.push({
            position: [
              x * spacing + (Math.random() - 0.5) * 2,
              y * spacing + (Math.random() - 0.5) * 2,
              z * spacing + (Math.random() - 0.5) * 2
            ],
            initialRotation: [
              Math.random() * Math.PI,
              Math.random() * Math.PI,
              Math.random() * Math.PI
            ],
            offsetScale: 2.5 + Math.random() * 1.5 
          });
        }
      }
    }
    return pieces;
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '350px' }}>
       <Canvas camera={{ position: [0, 0, 18], fov: 45 }}>
         <ambientLight intensity={0.2} />
         <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
         <directionalLight position={[-10, -5, -5]} intensity={0.5} color="#FF3B30" />
         
         <group>
            {fragments.map((props, i) => (
              <Fragment key={i} {...props} />
            ))}
          </group>

          <EffectComposer disableNormalPass>
             <Bloom luminanceThreshold={0.01} mipmapBlur intensity={1.5} kernelSize={3} />
             <Noise opacity={0.15} />
             <Vignette eskil={false} offset={0.1} darkness={1.3} />
          </EffectComposer>
       </Canvas>
    </div>
  );
}
