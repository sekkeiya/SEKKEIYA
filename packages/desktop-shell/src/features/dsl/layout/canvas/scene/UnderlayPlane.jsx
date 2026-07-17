import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { useUnderlayStore } from "../../store/useUnderlayStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";

/**
 * UnderlayPlane
 * 取り込んだ下絵（PDF 1 ページ目 / 画像）を床下の XZ 平面に貼る。
 * 寸法は基準線で校正した実寸(mm)。位置/回転/不透明度はストアで調整。
 *
 * 操作: 「下絵」パネルを開いている間（かつ作図していないとき）は右ドラッグで平行移動。
 *       パネルを閉じていれば pointer を拾わないので、通常の配置作業の邪魔をしない。
 */
export default function UnderlayPlane() {
  const imageUrl = useUnderlayStore((s) => s.imageUrl);
  const visible = useUnderlayStore((s) => s.visible);
  const widthMm = useUnderlayStore((s) => s.widthMm);
  const aspect = useUnderlayStore((s) => s.aspect);
  const yMm = useUnderlayStore((s) => s.yMm);
  const offsetXMm = useUnderlayStore((s) => s.offsetXMm);
  const offsetZMm = useUnderlayStore((s) => s.offsetZMm);
  const rotationDeg = useUnderlayStore((s) => s.rotationDeg);
  const opacity = useUnderlayStore((s) => s.opacity);
  const drawMode = useUnderlayStore((s) => s.drawMode);
  const setOffset = useUnderlayStore((s) => s.setOffset);
  const panelOpen = useUiRightSidebarStore((s) => s.rightPanels.underlay);

  // 右ドラッグ移動が有効なのは下絵パネルを開いていて、かつ作図していないとき。
  const movable = !!panelOpen && drawMode === "none";

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

  // Storage の downloadURL からテクスチャを読み込み（差し替え/アンマウント時に dispose）。
  // マップと違い dataURL ではなくクロスオリジン URL なので crossOrigin を明示する。
  useEffect(() => {
    if (!imageUrl) {
      setTexture(null);
      return;
    }
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      imageUrl,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.needsUpdate = true;
        setTexture(tex);
      },
      undefined,
      (err) => {
        console.error("[UnderlayPlane] failed to load underlay texture", err);
      }
    );
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

  // 幅は校正済みの実寸、高さは縦横比から導く。
  const sizeMm = useMemo(() => {
    const w = Math.max(1, widthMm);
    const a = aspect > 0 ? aspect : 1;
    return { w, h: Math.max(1, w / a) };
  }, [widthMm, aspect]);

  if (!imageUrl || !visible || !texture || widthMm <= 0) return null;

  const rotY = (rotationDeg * Math.PI) / 180;
  const transparent = opacity < 1;

  return (
    <group position={[offsetXMm, yMm, offsetZMm]} rotation={[0, rotY, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        renderOrder={-2}
        userData={{ isUnderlay: true }}
        /* 右ドラッグ移動が有効なときだけ pointer を拾う。 */
        raycast={movable ? undefined : () => null}
        onPointerDown={
          movable
            ? (e) => {
                // 右ボタン(2)のみ移動。Ctrl+右はカメラ操作に譲る。
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
        onContextMenu={movable ? (e) => e.nativeEvent?.preventDefault?.() : undefined}
      >
        <planeGeometry args={[sizeMm.w, sizeMm.h, 1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent={transparent}
          opacity={opacity}
          toneMapped={false}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}
