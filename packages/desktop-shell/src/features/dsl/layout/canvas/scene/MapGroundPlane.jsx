import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { useMapGroundStore } from "../../store/useMapGroundStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";

/**
 * MapGroundPlane
 * 住所から生成した航空写真/地図テクスチャを地面（XZ平面）に貼る。
 * 寸法はタイル数学で算出した実寸(mm)×ユーザー縮尺。位置/回転/不透明度はストアで調整。
 *
 * 操作: Map モード中（かつ作図していないとき）は右ドラッグで地図を平行移動。
 *       Ctrl+右ドラッグはカメラズーム（OrbitControls 側）に譲る。
 */
export default function MapGroundPlane() {
  const imageUrl = useMapGroundStore((s) => s.imageUrl);
  const visible = useMapGroundStore((s) => s.visible);
  const baseWidthMm = useMapGroundStore((s) => s.baseWidthMm);
  const scale = useMapGroundStore((s) => s.scale);
  const yMm = useMapGroundStore((s) => s.yMm);
  const offsetXMm = useMapGroundStore((s) => s.offsetXMm);
  const offsetZMm = useMapGroundStore((s) => s.offsetZMm);
  const rotationDeg = useMapGroundStore((s) => s.rotationDeg);
  const opacity = useMapGroundStore((s) => s.opacity);
  const drawMode = useMapGroundStore((s) => s.drawMode);
  const setOffset = useMapGroundStore((s) => s.setOffset);
  const isMapMode = useEditorModeStore((s) => s.editorMode === "map");

  // 右ドラッグ移動が有効なのは Map モードかつ作図していないとき。
  const movable = isMapMode && drawMode === "none";

  const [texture, setTexture] = useState(null);
  const dragRef = useRef(null);

  // y=yMm 水平面との交点を返す（右ドラッグの移動量算出用）。
  const pickPlanePoint = useCallback(
    (e) => {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yMm);
      const out = new THREE.Vector3();
      const hit = e?.ray?.intersectPlane(plane, out);
      return hit ? out : null;
    },
    [yMm]
  );

  // dataURL からテクスチャを読み込み（アンマウント/差し替え時に dispose）。
  useEffect(() => {
    if (!imageUrl) {
      setTexture(null);
      return;
    }
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      setTexture(tex);
    });
    return () => {
      disposed = true;
    };
  }, [imageUrl]);

  // 直前のテクスチャを破棄
  useEffect(() => {
    return () => {
      if (texture) texture.dispose();
    };
  }, [texture]);

  const sizeMm = useMemo(() => Math.max(1, baseWidthMm * scale), [baseWidthMm, scale]);

  if (!imageUrl || !visible || !texture || baseWidthMm <= 0) return null;

  const rotY = (rotationDeg * Math.PI) / 180;
  const transparent = opacity < 1;

  return (
    <group position={[offsetXMm, yMm, offsetZMm]} rotation={[0, rotY, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        renderOrder={-1}
        userData={{ isMapGround: true }}
        /* 右ドラッグ移動が有効なときだけ pointer を拾う。 */
        raycast={movable ? undefined : () => null}
        onPointerDown={
          movable
            ? (e) => {
                // 右ボタン(2)のみ移動。Ctrl+右はズームに譲る。
                if (e.button !== 2 || e.ctrlKey) return;
                e.stopPropagation();
                const p = pickPlanePoint(e);
                if (p) {
                  dragRef.current = { dx: p.x - offsetXMm, dz: p.z - offsetZMm };
                  try {
                    e.target.setPointerCapture(e.pointerId);
                  } catch {}
                }
              }
            : undefined
        }
        onPointerMove={
          movable
            ? (e) => {
                if (!dragRef.current) return;
                e.stopPropagation();
                const p = pickPlanePoint(e);
                if (p) setOffset(p.x - dragRef.current.dx, p.z - dragRef.current.dz);
              }
            : undefined
        }
        onPointerUp={
          movable
            ? (e) => {
                if (!dragRef.current) return;
                dragRef.current = null;
                e.stopPropagation();
                try {
                  e.target.releasePointerCapture(e.pointerId);
                } catch {}
              }
            : undefined
        }
        onContextMenu={
          isMapMode ? (e) => e.nativeEvent?.preventDefault?.() : undefined
        }
      >
        <planeGeometry args={[sizeMm, sizeMm, 1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent={transparent}
          opacity={opacity}
          toneMapped={false}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}
