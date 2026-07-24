import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Generates a thumbnail image (WebP) from a GLB file.
 * Automatically frames the camera to fit the model.
 * @param {File} glbFile  - The .glb File object.
 * @param {Object} options - Options (width, height, quality)
 * @returns {Promise<{ blob: Blob, file: File, width: number, height: number }>}
 */
export async function generateThumbnailFromGlb(glbFile, options = {}) {
  // 既定を正方形・高解像度にする。カードもモデル詳細のビューアも正方形〜横長の
  // 大きな領域で表示するため、従来の 800x450 では詳細画面で 1.7 倍ほど引き伸ばされ
  // 画質が落ちていた。正方形にすることで正方形カードでの上下の空白帯も無くなる。
  const { width = 1024, height = 1024, quality = 0.9 } = options;

  if (!glbFile || !glbFile.name.toLowerCase().endsWith('.glb')) {
    throw new Error("Invalid file type. Only .glb files are supported.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = "fixed";
  canvas.style.left = "-99999px";
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    canvas,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.0);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5, 10, 7);
  scene.add(hemi, dir);

  let root = null;
  const localUrl = URL.createObjectURL(glbFile);

  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(localUrl);

    root = gltf.scene || gltf.scenes?.[0];
    if (!root) throw new Error("GLB に scene がありません。");
    scene.add(root);

    // Box calculation
    const box = new THREE.Box3();
    let hasGeometry = false;
    
    root.updateMatrixWorld(true);
    let childCount = 0;
    root.traverse((child) => {
      childCount++;
      if ((child.isMesh || child.isLine || child.isLineSegments || child.isPoints) && child.geometry) {
        child.geometry.computeBoundingBox();
        if (child.geometry.boundingBox) {
          const childBox = new THREE.Box3().copy(child.geometry.boundingBox);
          childBox.applyMatrix4(child.matrixWorld);
          if (!childBox.isEmpty() && isFinite(childBox.min.x)) {
            box.union(childBox);
            hasGeometry = true;
          }
        }
      }
    });

    console.log(`[generateThumbnail] Traversed ${childCount} children. hasGeometry: ${hasGeometry}. Box bounds:`, box.min, box.max);

    if (!hasGeometry) {
      box.setFromObject(root);
      console.log(`[generateThumbnail] Fallback box bounds:`, box.min, box.max);
    }

    let size = box.getSize(new THREE.Vector3());
    let center = box.getCenter(new THREE.Vector3());
    
    // Fallback if size is unreasonable
    if (size.lengthSq() === 0 || !isFinite(size.x) || size.x > 1e6) {
       size = new THREE.Vector3(1, 1, 1);
       center = new THREE.Vector3(0, 0, 0);
    }

    // Center the model at 0,0,0
    root.position.sub(center);

    // Camera setup: isometric view (front + slight top angle).
    //
    // 以前は distance = maxDim * 2.8 とし camera.position.set(d*0.9, d*0.6, d*0.9) と
    // していたが、この位置ベクトルの長さは d*1.407 になるため実際には maxDim の
    // 約3.94倍まで引いており、被写体が小さく余白だらけのサムネイルになっていた
    // （その余白をカード側が width:250% で打ち消していた）。
    //
    // ここではバウンディングスフィアが画角にちょうど収まる距離を計算し、
    // 視線方向の単位ベクトルに掛けて配置する。縦横で狭い方の画角に合わせるので
    // アスペクト比が変わっても破綻しない。
    const radius = size.length() / 2 || 1;
    const halfV = ((camera.fov * Math.PI) / 180) / 2;
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
    const FIT_MARGIN = 1.08; // 端に触れないよう少しだけ余白を残す
    const distance = (radius / Math.sin(Math.min(halfV, halfH))) * FIT_MARGIN;

    const dir = new THREE.Vector3(0.9, 0.6, 0.9).normalize();
    camera.position.copy(dir.multiplyScalar(distance));

    // Dynamically adjust clipping planes to accommodate huge models
    camera.near = Math.max(0.01, distance * 0.001);
    camera.far = Math.max(5000, distance * 10);
    camera.updateProjectionMatrix();

    camera.lookAt(0, 0, 0);

    // Force shader compilation and texture upload to the GPU
    try {
      if (renderer.compileAsync) {
        console.log('[generateThumbnailFromGlb] Calling compileAsync...');
        await renderer.compileAsync(scene, camera);
        console.log('[generateThumbnailFromGlb] compileAsync finished.');
      } else {
        renderer.compile(scene, camera);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (compileErr) {
      console.warn('[generateThumbnailFromGlb] compileAsync failed, proceeding anyway:', compileErr);
    }

    try {
      // Ensure lighting updates and render
      console.log('[generateThumbnailFromGlb] First render...');
      renderer.render(scene, camera);
      
      // Render a second time to ensure any deferred texture uploads are caught
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('[generateThumbnailFromGlb] Second render...');
      renderer.render(scene, camera);
    } catch (renderErr) {
      console.error('[generateThumbnailFromGlb] Render failed:', renderErr);
      throw renderErr;
    }

    const blob = await new Promise((res) => {
      try {
        canvas.toBlob((b) => {
          console.log('[generateThumbnailFromGlb] toBlob finished, blob:', b);
          res(b);
        }, "image/webp", quality);
      } catch (e) {
        console.error('[generateThumbnailFromGlb] toBlob failed:', e);
        res(null);
      }
    });

    if (!blob) throw new Error("サムネイル生成に失敗しました。");

    const fileName = glbFile.name.replace(/\.glb$/i, '_thumbnail.webp');
    const thumbFile = new File([blob], fileName, { type: "image/webp" });

    return {
      blob,
      file: thumbFile,
      width,
      height
    };
  } finally {
    URL.revokeObjectURL(localUrl);
    
    if (root) {
      root.traverse((obj) => {
        if (obj.isMesh) {
          if (obj.geometry) obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) {
            m.forEach((mm) => { 
                if (mm.map) mm.map.dispose();
                if (mm.dispose) mm.dispose(); 
            });
          } else if (m) {
            if (m.map) m.map.dispose();
            if (m.dispose) m.dispose();
          }
        }
      });
    }
    if (pmremGenerator) pmremGenerator.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
    renderer.dispose();
    scene.clear();
    if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
    }
  }
}
