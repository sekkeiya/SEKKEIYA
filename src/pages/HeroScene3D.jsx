import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BRAND } from '@/shared/ui/theme';

const circleTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF';
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
})();

const SignalPulses = ({ positions, lineIndices, count = 50 }) => {
  const geomRef = useRef();
  
  const signals = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
        idxA: 0,
        idxB: 0,
        progress: 1, // trigger immediate respawn
        speed: 1.0 + Math.random() * 2.0, // fast synapse
    }));
  }, [count]);

  const [pulsePositions, pulseColors] = useMemo(() => {
    const pos = new Float32Array(count * 3 * 3); // head, body, tail
    const col = new Float32Array(count * 3 * 3);
    
    for (let i = 0; i < count; i++) {
        // Head: Brilliant Glowing White
        col[i*9 + 0] = 2.0; col[i*9 + 1] = 2.0; col[i*9 + 2] = 2.0; 
        // Body: Intense Blue Glow
        col[i*9 + 3] = 0.2; col[i*9 + 4] = 1.0; col[i*9 + 5] = 2.5; 
        // Tail: Deep Blue
        col[i*9 + 6] = 0.0; col[i*9 + 7] = 0.3; col[i*9 + 8] = 0.8; 
    }
    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    if (!geomRef.current) return;
    const numLines = lineIndices.length / 2;
    if (numLines === 0) return;
    
    const posAttr = geomRef.current.attributes.position;
    
    for (let i = 0; i < signals.length; i++) {
      const sig = signals[i];
      sig.progress += delta * sig.speed;
      
      if (sig.progress >= 1) {
        sig.progress = 0;
        const lineIdx = Math.floor(Math.random() * numLines) * 2;
        sig.idxA = lineIndices[lineIdx] * 3;
        sig.idxB = lineIndices[lineIdx + 1] * 3;
      }
      
      const xA = positions[sig.idxA], yA = positions[sig.idxA+1], zA = positions[sig.idxA+2];
      const xB = positions[sig.idxB], yB = positions[sig.idxB+1], zB = positions[sig.idxB+2];
      
      const pHead = sig.progress;
      const pBody = Math.max(0, sig.progress - 0.08);
      const pTail = Math.max(0, sig.progress - 0.16);
      
      const lerp = (a, b, t) => a + (b - a) * t;
      
      posAttr.setXYZ(i*3, lerp(xA, xB, pHead), lerp(yA, yB, pHead), lerp(zA, zB, pHead));
      posAttr.setXYZ(i*3+1, lerp(xA, xB, pBody), lerp(yA, yB, pBody), lerp(zA, zB, pBody));
      posAttr.setXYZ(i*3+2, lerp(xA, xB, pTail), lerp(yA, yB, pTail), lerp(zA, zB, pTail));
    }
    posAttr.needsUpdate = true;
  });

  return (
    <Points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={pulsePositions.length / 3}
          array={pulsePositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={pulseColors.length / 3}
          array={pulseColors}
          itemSize={3}
        />
      </bufferGeometry>
      <PointMaterial
        transparent
        map={circleTexture}
        alphaTest={0.001}
        vertexColors={true}
        size={0.4}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
};

const NetworkSwarm = ({ count = 300 }) => {
  const groupRef = useRef();
  const geomRef = useRef();
  const linesGeomRef = useRef();
  
  // Static spherical layout like the original elegant design
  const [positions, lines, staticNodes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const snodes = [];
    for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(Math.random()) * 20;
        
        pos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i*3+2] = r * Math.cos(phi);
        
        snodes.push({
            phase: Math.random() * Math.PI * 2,
            speed: 0.8 + Math.random() * 2.0,
        });
    }

    const lineIndices = [];
    const threshold = 4.5;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = pos[i*3] - pos[j*3];
        const dy = pos[i*3+1] - pos[j*3+1];
        const dz = pos[i*3+2] - pos[j*3+2];
        if (dx*dx + dy*dy + dz*dz < threshold * threshold) {
          lineIndices.push(i, j);
        }
      }
    }
    return [pos, new Uint16Array(lineIndices), snodes];
  }, [count]);

  const [colors] = useMemo(() => {
    return [new Float32Array(count * 3)];
  }, [count]);

  useFrame((state, delta) => {
    // Softly fade nodes in and out
    for (let i = 0; i < count; i++) {
        const node = staticNodes[i];
        node.phase += delta * node.speed;
        
        // sine wave mapped to 0 -> 1 for opacity
        const alpha = Math.max(0, Math.sin(node.phase));
        
        // Rich Glowing Blue
        colors[i*3] = 0.1 * alpha;
        colors[i*3+1] = 0.6 * alpha;
        colors[i*3+2] = 2.0 * alpha;
    }
    
    if (geomRef.current) {
        geomRef.current.attributes.color.needsUpdate = true;
    }
    
    if (linesGeomRef.current) {
        linesGeomRef.current.attributes.color.needsUpdate = true;
    }

    if (groupRef.current) {
      groupRef.current.rotation.x -= delta * 0.04;
      groupRef.current.rotation.y -= delta * 0.08;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 0.4) * 0.03;
      groupRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={groupRef} rotation={[0, 0, Math.PI / 8]}>
      {/* Nodes */}
      <Points frustumCulled={false}>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={count}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <PointMaterial
          transparent
          map={circleTexture}
          alphaTest={0.001}
          vertexColors={true}
          size={0.25}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      {/* Connections (automatically fade based on vertex colors) */}
      <lineSegments>
        <bufferGeometry ref={linesGeomRef}>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={count}
            array={colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="index"
            count={lines.length}
            array={lines}
            itemSize={1}
          />
        </bufferGeometry>
        <lineBasicMaterial
          transparent
          vertexColors={true}
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      {/* Synapse effect */}
      <SignalPulses positions={positions} lineIndices={lines} count={180} />
    </group>
  );
};



export default function HeroScene3D() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }} dpr={[1, 1.5]}>
        {/* Soft fog to blend the horizon */}
        <fog attach="fog" args={["#0A0F1A", 5, 25]} />
        <ambientLight intensity={0.5} />
        
        {/* Networking Particles */}
        <NetworkSwarm count={500} />

        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} />
        </EffectComposer>
      </Canvas>
      
      {/* CSS overlay gradient to blend bottom edge into the next section */}
      <div style={{
         position: 'absolute',
         bottom: 0, left: 0, width: '100%', height: '30vh',
         background: `linear-gradient(to top, #0A0F1A 0%, transparent 100%)`,
         zIndex: 1
      }} />
    </div>
  );
}
