// ヒーロー用のプロシージャル 3D シーン（three を動的 import）。外部モデル不要。
// 床グリッド＋浮遊するスラブ＋ソフトライトで「建築的な空間」を表現し、
// スクロール/時間でゆるくカメラを動かす。pointer-events:none で前面のテキスト編集を妨げない。
import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

export const Hero3DScene: React.FC<{ accent: string; scrollerRef: React.RefObject<HTMLElement | null> }> = ({ accent, scrollerRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false; let raf = 0; let cleanup = () => {};
    (async () => {
      let THREE: typeof import('three');
      try { THREE = await import('three'); } catch { return; }
      if (disposed) return;
      let renderer: import('three').WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const scene = new THREE.Scene();
      const accentColor = new THREE.Color(accent || '#00BFFF');
      scene.fog = new THREE.Fog(0x000000, 8, 26);
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 2.2, 9);

      const disposables: { dispose: () => void }[] = [];
      // 床グリッド
      const grid = new THREE.GridHelper(60, 60, accentColor, 0x444444);
      (grid.material as any).opacity = 0.25; (grid.material as any).transparent = true;
      grid.position.y = -2;
      scene.add(grid);
      // 浮遊スラブ（薄い直方体）
      const slabGeo = new THREE.BoxGeometry(3, 0.15, 2);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.85 });
      disposables.push(slabGeo, slabMat);
      const slabs: import('three').Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(slabGeo, slabMat);
        m.position.set((Math.sin(i * 1.3) * 4), -1.4 + i * 0.9, (Math.cos(i * 1.7) * 3) - 2);
        m.rotation.y = i * 0.4;
        scene.add(m); slabs.push(m);
      }
      // ライト
      const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(5, 8, 6); scene.add(key);
      const amb = new THREE.AmbientLight(accentColor, 0.4); scene.add(amb);
      const pt = new THREE.PointLight(accentColor, 2, 30); pt.position.set(-4, 3, 4); scene.add(pt);

      const resize = () => { const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(canvas);
      let t = 0;
      const animate = () => {
        t += 0.004;
        const sc = scrollerRef.current ? scrollerRef.current.scrollTop * 0.002 : 0;
        camera.position.x = Math.sin(t) * 1.5;
        camera.position.y = 2.2 + sc * 0.6;
        camera.lookAt(0, 0.5 - sc, 0);
        slabs.forEach((m, i) => { m.rotation.y += 0.002 + i * 0.0004; m.position.y += Math.sin(t * 2 + i) * 0.002; });
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();
      cleanup = () => { cancelAnimationFrame(raf); ro.disconnect(); disposables.forEach(d => { try { d.dispose(); } catch {} }); try { renderer.dispose(); } catch {} };
    })();
    return () => { disposed = true; cancelAnimationFrame(raf); cleanup(); };
  }, [accent, scrollerRef]);

  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Box component="canvas" ref={canvasRef} sx={{ width: '100%', height: '100%', display: 'block' }} />
    </Box>
  );
};
