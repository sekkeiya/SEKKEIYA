// モーションプリセットが Three.js を要求するとき（webgl カテゴリ）に背景として描画する
// WebGL ランタイム。three を動的 import するため、未使用時はロードもバンドル評価もされない。
//
// 設計:
//   - sticky(top:0, height:0) のラッパ＋absolute(100vh) の canvas で、スクロールしても
//     ビューポートに貼り付く「固定背景」になる。pointer-events:none で操作を妨げない。
//   - scroller.scrollTop を読み、ごく僅かにカメラ/回転へ反映（スクロール連動）。
//   - 失敗時（WebGL 非対応・three ロード失敗）は静かに何も描画しない（CSS 背景のまま）。

import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

export type WebGLVariant = 'particles' | 'fluid' | 'geometry';

interface Props {
  variant: WebGLVariant;
  accent: string;
  scrollerRef: React.RefObject<HTMLElement | null>;
}

export const MotionWebGLBackground: React.FC<Props> = ({ variant, accent, scrollerRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0;
    let cleanup: () => void = () => {};

    (async () => {
      let THREE: typeof import('three');
      try {
        THREE = await import('three');
      } catch (e) {
        console.warn('[MotionWebGL] three のロードに失敗。CSS 背景にフォールバックします。', e);
        return;
      }
      if (disposed) return;

      let renderer: import('three').WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      } catch (e) {
        console.warn('[MotionWebGL] WebGL 初期化に失敗。', e);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 7;

      const color = new THREE.Color(accent || '#00BFFF');
      const disposables: { dispose: () => void }[] = [];
      const meshes: import('three').Object3D[] = [];

      if (variant === 'geometry') {
        // ワイヤーフレームの幾何形状を複数浮遊させる
        const geom = new THREE.IcosahedronGeometry(1, 0);
        const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.4 });
        disposables.push(geom, mat);
        for (let i = 0; i < 7; i++) {
          const m = new THREE.Mesh(geom, mat);
          m.position.set((Math.sin(i * 1.7) * 5), (Math.cos(i * 2.3) * 3), -i * 1.2);
          const s = 0.5 + (i % 3) * 0.5;
          m.scale.setScalar(s);
          scene.add(m);
          meshes.push(m);
        }
      } else {
        // particles / fluid: 点群。fluid は大粒・低密度・加算合成でブロブ感。
        const isFluid = variant === 'fluid';
        const count = isFluid ? 240 : 900;
        const spread = 14;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * spread;
          positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
          positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          color,
          size: isFluid ? 0.9 : 0.06,
          transparent: true,
          opacity: isFluid ? 0.18 : 0.6,
          blending: isFluid ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });
        disposables.push(geom, mat);
        const points = new THREE.Points(geom, mat);
        scene.add(points);
        meshes.push(points);
      }

      const resize = () => {
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      let t = 0;
      const animate = () => {
        t += 0.0025;
        const scrollY = scrollerRef.current ? scrollerRef.current.scrollTop : 0;
        const scrollN = scrollY * 0.0006;
        meshes.forEach((m, i) => {
          m.rotation.x = t * (0.4 + i * 0.03) + scrollN * 0.5;
          m.rotation.y = t * (0.55 + i * 0.04) + scrollN;
        });
        // スクロールでカメラをわずかに引き／パン（奥行き感）
        camera.position.y = -scrollN * 1.2;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        disposables.forEach(d => { try { d.dispose(); } catch { /* noop */ } });
        try { renderer.dispose(); } catch { /* noop */ }
      };
    })();

    return () => { disposed = true; cancelAnimationFrame(raf); cleanup(); };
  }, [variant, accent, scrollerRef]);

  return (
    <Box aria-hidden sx={{ position: 'sticky', top: 0, height: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', display: 'block' }}
      />
    </Box>
  );
};
