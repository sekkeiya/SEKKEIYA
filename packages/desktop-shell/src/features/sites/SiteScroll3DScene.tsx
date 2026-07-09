// B方式：スクロール進行度でカメラを動かすリアルタイム3Dシーン。
// Hero3DScene の流儀を踏襲（three 動的 import / scrollerRef 駆動 / dispose 管理 /
// pointer-events:none）。modelUrl があれば glTF をロード、無ければプロシージャルな
// 建築風ジオメトリ（床グリッド＋浮遊スラブ＋柱）をプレースホルダとして表示する。
// 参照: .claude/skills/3d-scroll-website/references/realtime-3d.md
import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { DEFAULT_CAM_PATH, sampleCameraPath, scrollProgress, type CamKey } from './scroll3dPath';

export const SiteScroll3DScene: React.FC<{
  accent: string;
  /** glb/gltf の URL。未指定ならプロシージャルなプレースホルダを表示。 */
  modelUrl?: string;
  /** カメラパス。未指定なら DEFAULT_CAM_PATH。 */
  path?: CamKey[];
  scrollerRef: React.RefObject<HTMLElement | null>;
}> = ({ accent, modelUrl, path = DEFAULT_CAM_PATH, scrollerRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0;
    let running = true;
    let cleanup = () => {};

    (async () => {
      let THREE: typeof import('three');
      try { THREE = await import('three'); } catch { return; }
      if (disposed) return;

      let renderer: import('three').WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const accentColor = new THREE.Color(accent || '#00BFFF');
      scene.fog = new THREE.Fog(0x000000, 8, 32);
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

      const disposables: { dispose: () => void }[] = [];

      // ライト
      const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(5, 8, 6); scene.add(key);
      scene.add(new THREE.AmbientLight(accentColor, 0.4));
      const pt = new THREE.PointLight(accentColor, 2, 40); pt.position.set(-4, 3, 4); scene.add(pt);

      // 床グリッド
      const grid = new THREE.GridHelper(80, 80, accentColor, 0x444444);
      (grid.material as any).opacity = 0.22; (grid.material as any).transparent = true;
      grid.position.y = -2; scene.add(grid);

      const animatedSlabs: import('three').Mesh[] = [];

      if (modelUrl) {
        try {
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(modelUrl);
          if (disposed) return;
          // bounding box でモデルを原点付近に正規化
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const s = 6 / maxDim;
          gltf.scene.scale.setScalar(s);
          gltf.scene.position.set(-center.x * s, -center.y * s - 1.5, -center.z * s);
          scene.add(gltf.scene);
        } catch (e) {
          console.warn('[SiteScroll3DScene] glTF load failed, using placeholder', e);
          buildPlaceholder(THREE, scene, disposables, animatedSlabs);
        }
      } else {
        buildPlaceholder(THREE, scene, disposables, animatedSlabs);
      }

      const resize = () => {
        const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(canvas);

      // 画面外では rAF を止める
      const io = new IntersectionObserver((entries) => {
        running = entries.some(e => e.isIntersecting);
        if (running && !raf) raf = requestAnimationFrame(animate);
      }, { threshold: 0.01 });
      io.observe(canvas);

      let displayed = 0; // 慣性つき進行度
      let t = 0;
      const animate = () => {
        raf = 0;
        if (!running) return;
        t += 0.004;
        const sc = scrollerRef.current;
        const target = sc ? scrollProgress(sc) : 0;
        displayed += (target - displayed) * 0.08; // ダンピング
        const { pos, look } = sampleCameraPath(path, displayed);
        camera.position.set(pos[0], pos[1], pos[2]);
        camera.lookAt(look[0], look[1], look[2]);
        animatedSlabs.forEach((m, i) => {
          m.rotation.y += 0.002 + i * 0.0004;
          m.position.y += Math.sin(t * 2 + i) * 0.002;
        });
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      raf = requestAnimationFrame(animate);

      cleanup = () => {
        cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
        scene.traverse((o: any) => {
          if (o.geometry) { try { o.geometry.dispose(); } catch {} }
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m: any) => { try { m.dispose(); } catch {} });
          }
        });
        disposables.forEach(d => { try { d.dispose(); } catch {} });
        try { renderer.dispose(); } catch {}
      };
    })();

    return () => { disposed = true; running = false; cancelAnimationFrame(raf); cleanup(); };
  }, [accent, modelUrl, path, scrollerRef]);

  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Box component="canvas" ref={canvasRef} sx={{ width: '100%', height: '100%', display: 'block' }} />
    </Box>
  );
};

// モデル未指定時のプレースホルダ：浮遊スラブ＋柱で「建築的な空間」を作る。
function buildPlaceholder(
  THREE: typeof import('three'),
  scene: import('three').Scene,
  disposables: { dispose: () => void }[],
  animatedSlabs: import('three').Mesh[],
) {
  const slabGeo = new THREE.BoxGeometry(3, 0.15, 2);
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.85 });
  disposables.push(slabGeo, slabMat);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(slabGeo, slabMat);
    m.position.set(Math.sin(i * 1.3) * 4, -1.4 + i * 0.9, Math.cos(i * 1.7) * 3 - 2);
    m.rotation.y = i * 0.4;
    scene.add(m); animatedSlabs.push(m);
  }
  // 柱（空間の奥行きをカメラ移動で感じさせる）
  const colGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 12);
  const colMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.05, roughness: 0.8 });
  disposables.push(colGeo, colMat);
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(colGeo, colMat);
    c.position.set((i % 4) * 3 - 4.5, 1, Math.floor(i / 4) * -6 - 1);
    scene.add(c);
  }
}
