import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLBファイルから寸法 (W/D/H) を自動算出するユーティリティ。
 * THREE.Box3 を使用し、scene のバウンディングボックスサイズを取得します。
 * X = width, Z = depth, Y = height として扱います。
 * @param {File|Blob} glbFile - GLBファイルオブジェクト
 * @returns {Promise<{width: number, depth: number, height: number}>} - mm単位の寸法オブジェクト
 */
export async function extractDimensionsFromGlb(glbFile) {
  if (!glbFile) {
      throw new Error("GLB file is required");
  }

  const localUrl = URL.createObjectURL(glbFile);
  let root = null;

  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(localUrl);

    root = gltf.scene || gltf.scenes?.[0];
    if (!root) throw new Error("GLBにsceneが存在しません。");

    // バウンディングボックスの計算
    // 非表示メッシュ等がある場合は適切な走査が必要になるケースもありますが、基本はsetFromObject
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());

    // Three.js 座標系: X=width, Z=depth, Y=height
    // モデルの単位系によってスケールが異なりますが、一般的なMeterベースを想定し mm に変換
    // TODO: 必要に応じて単位の判定ロジックを入れるか、UI側で調整できるようにする
    // 今回は安全のため取得値を * 1000 して mm 換算する想定としますが、
    // 実データによっては mm で作られていることもあるため、大きすぎる場合は調整が必要かもしれません。
    let w = size.x;
    let d = size.z;
    let h = size.y;

    // もし抽出されたサイズがとても小さい場合(例: 1.5)はメートルと判定して1000倍するなど
    // 基本的なロジックとして 10 未満のサイズの場合は m とみなして mm に変換
    const maxDim = Math.max(w, d, h);
    if (maxDim > 0 && maxDim < 20) {
        w *= 1000;
        d *= 1000;
        h *= 1000;
    }

    return {
      width: Math.round(w),
      depth: Math.round(d),
      height: Math.round(h),
    };

  } finally {
    URL.revokeObjectURL(localUrl);
    // メモリ解放
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
  }
}
