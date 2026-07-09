import React, { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

export default function SectionClipManager() {
  const { gl, scene } = useThree();

  const isSectionClipEnabled = useEditorModeStore((s) => s.isSectionClipEnabled);
  const sectionClipHeight    = useEditorModeStore((s) => s.sectionClipHeight);
  const sectionClipYEnabled  = useEditorModeStore((s) => s.sectionClipYEnabled);
  const sectionClipXEnabled  = useEditorModeStore((s) => s.sectionClipXEnabled);
  const sectionClipX         = useEditorModeStore((s) => s.sectionClipX);
  const sectionClipZEnabled  = useEditorModeStore((s) => s.sectionClipZEnabled);
  const sectionClipZ         = useEditorModeStore((s) => s.sectionClipZ);

  const lastUpdateRef = useRef(0);

  // Stable plane objects — constants are mutated in useEffect below
  // Y plane (height): show y ≤ sectionClipHeight  → normal=(0,-1,0), const=sectionClipHeight
  const clipPlaneY = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionClipHeight), []);
  // X plane (left-right): show x ≤ sectionClipX   → normal=(-1,0,0), const=sectionClipX
  const clipPlaneX = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionClipX), []);
  // Z plane (front-back): show z ≤ sectionClipZ   → normal=(0,0,-1),  const=sectionClipZ
  const clipPlaneZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), sectionClipZ), []);

  // Active plane array — rebuilt whenever enabled flags change
  const activePlanes = useMemo(() => {
    if (!isSectionClipEnabled) return [];
    const result = [];
    if (sectionClipYEnabled) result.push(clipPlaneY);
    if (sectionClipXEnabled) result.push(clipPlaneX);
    if (sectionClipZEnabled) result.push(clipPlaneZ);
    return result;
  }, [isSectionClipEnabled, sectionClipYEnabled, sectionClipXEnabled, sectionClipZEnabled,
      clipPlaneY, clipPlaneX, clipPlaneZ]);

  // Sync plane constants whenever cut positions change
  useEffect(() => {
    clipPlaneY.constant = sectionClipHeight;
  }, [sectionClipHeight, clipPlaneY]);

  useEffect(() => {
    clipPlaneX.constant = sectionClipX;
  }, [sectionClipX, clipPlaneX]);

  useEffect(() => {
    clipPlaneZ.constant = sectionClipZ;
  }, [sectionClipZ, clipPlaneZ]);

  // Enable/disable local clipping on the renderer
  useEffect(() => {
    gl.localClippingEnabled = isSectionClipEnabled;

    // When disabled: immediately scrub all planes from materials
    if (!isSectionClipEnabled) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          const clearPlanes = (mat) => {
            if (mat.clippingPlanes && mat.clippingPlanes.length > 0) {
              mat.clippingPlanes = [];
              mat.needsUpdate = true;
            }
          };
          if (Array.isArray(child.material)) {
            child.material.forEach(clearPlanes);
          } else {
            clearPlanes(child.material);
          }
        }
      });
    }
  }, [gl, scene, isSectionClipEnabled]);

  // Robustly apply active planes to all (new) meshes ~4×/sec
  useFrame((state) => {
    if (!isSectionClipEnabled) return;

    const now = state.clock.elapsedTime;
    if (now - lastUpdateRef.current < 0.25) return;
    lastUpdateRef.current = now;

    scene.traverse((child) => {
      if (child.isMesh && child.material && !child.userData.ignoreClipping) {
        const applyPlanes = (mat) => {
          const current = mat.clippingPlanes;
          // Re-apply if length changed or planes differ
          if (!current || current.length !== activePlanes.length ||
              activePlanes.some((p, i) => current[i] !== p)) {
            mat.clippingPlanes = activePlanes.length > 0 ? activePlanes : [];
            mat.clipShadows = activePlanes.length > 0;
            mat.needsUpdate = true;
          }
        };
        if (Array.isArray(child.material)) {
          child.material.forEach(applyPlanes);
        } else {
          applyPlanes(child.material);
        }
      }
    });
  });

  if (!isSectionClipEnabled) return null;

  return (
    <group>
      {/* Y (height) reference plane */}
      {sectionClipYEnabled && (
        <group position={[0, sectionClipHeight, 0]}>
          <gridHelper raycast={() => null} args={[20000, 400, 0x4f8dff, 0x4f8dff]}
            material-transparent material-opacity={0.015} material-depthWrite={false} />
          <mesh raycast={() => null} rotation={[-Math.PI / 2, 0, 0]} userData={{ ignoreClipping: true }}>
            <planeGeometry args={[20000, 20000]} />
            <meshBasicMaterial color="#4f8dff" transparent opacity={0.005} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {/* X reference plane */}
      {sectionClipXEnabled && (
        <group position={[sectionClipX, 0, 0]}>
          <mesh raycast={() => null} rotation={[0, Math.PI / 2, 0]} userData={{ ignoreClipping: true }}>
            <planeGeometry args={[20000, 20000]} />
            <meshBasicMaterial color="#ef9a9a" transparent opacity={0.006} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {/* Z reference plane */}
      {sectionClipZEnabled && (
        <group position={[0, 0, sectionClipZ]}>
          <mesh raycast={() => null} rotation={[0, 0, 0]} userData={{ ignoreClipping: true }}>
            <planeGeometry args={[20000, 20000]} />
            <meshBasicMaterial color="#90caf9" transparent opacity={0.006} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}
