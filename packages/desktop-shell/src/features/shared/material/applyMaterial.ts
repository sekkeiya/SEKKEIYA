// MaterialBinding を three.js オブジェクトへ適用するヘルパー（Phase C 基盤・純粋関数）
//
// dsl エンジンに依存しないため、S.Models 詳細ビューア / S.Layout シーンの双方から再利用できる。
// 既存の FurnitureItem.jsx と同じ「traverse → mesh.material 差し替え」方式に揃える。

import * as THREE from 'three';
import type { DsmtMaterialSnapshot, MaterialBinding, MaterialBindingSlot } from '../../dsmt/types';

const texLoader = new THREE.TextureLoader();

/**
 * URL ごとにデコード済みの「ベーステクスチャ」をキャッシュする。
 * 同じテクスチャを何度も fetch/デコードしないため、2回目以降の buildThreeMaterial が即時化する。
 * （自動マテリアルのスキャンライン演出で、走行中に新素材を間に合わせるために重要）
 */
const textureCache = new Map<string, Promise<THREE.Texture | null>>();

function loadTextureRaw(url: string): Promise<THREE.Texture | null> {
  return (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      return await new Promise<THREE.Texture | null>((resolve) => {
        texLoader.load(
          obj,
          (t) => { URL.revokeObjectURL(obj); resolve(t); },
          undefined,
          () => { URL.revokeObjectURL(obj); resolve(null); },
        );
      });
    } catch {
      return null;
    }
  })();
}

/**
 * テクスチャを取得する。ベースは URL 単位でキャッシュし、呼び出しごとに clone を返す
 * （clone は画像を共有しデコード不要・repeat/colorSpace は個別に設定可能）。
 */
async function loadTexture(url?: string, colorSpace: THREE.ColorSpace = THREE.NoColorSpace): Promise<THREE.Texture | null> {
  if (!url) return null;
  let p = textureCache.get(url);
  if (!p) { p = loadTextureRaw(url); textureCache.set(url, p); }
  const base = await p;
  if (!base) { textureCache.delete(url); return null; }
  const t = base.clone();
  t.colorSpace = colorSpace;
  t.needsUpdate = true;
  return t;
}

/** 素材スナップショットから MeshStandardMaterial を構築（テクスチャは非同期ロード）。 */
export async function buildThreeMaterial(snap: DsmtMaterialSnapshot): Promise<THREE.MeshStandardMaterial> {
  const p = snap.params || ({} as any);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(p.baseColor || '#b0b0b0'),
    roughness: p.roughness ?? 0.6,
    metalness: p.metalness ?? 0.0,
    opacity: p.opacity ?? 1,
    transparent: (p.opacity ?? 1) < 1,
  });
  if (p.emissive) {
    mat.emissive = new THREE.Color(p.emissive);
    mat.emissiveIntensity = p.emissiveIntensity ?? 1;
  }

  const maps = snap.maps || {};
  const [albedo, normal, roughnessMap, aoMap] = await Promise.all([
    loadTexture(maps.albedo, THREE.SRGBColorSpace),
    loadTexture(maps.normal),
    loadTexture(maps.roughness),
    loadTexture(maps.ao),
  ]);

  const tiling = snap.tiling;
  const applyTiling = (t: THREE.Texture | null) => {
    if (!t) return;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (tiling) { t.repeat.set(tiling.repeatX || 1, tiling.repeatY || 1); if (tiling.rotation) t.rotation = tiling.rotation; }
  };

  if (albedo) { applyTiling(albedo); mat.map = albedo; }
  if (normal) { applyTiling(normal); mat.normalMap = normal; if (p.normalScale != null) mat.normalScale.set(p.normalScale, p.normalScale); }
  if (roughnessMap) { applyTiling(roughnessMap); mat.roughnessMap = roughnessMap; }
  if (aoMap) { applyTiling(aoMap); mat.aoMap = aoMap; mat.aoMapIntensity = p.aoIntensity ?? 1; }

  mat.needsUpdate = true;
  return mat;
}

/** 1 スロット記述子（S.Models 詳細でのスロット列挙結果）。 */
export interface EnumeratedSlot {
  meshName: string;
  meshUuid: string;
  materialIndex: number;
  materialName: string;
  /** 埋め込みマテリアルから読み取った概算パラメータ（「ライブラリに登録」用）。 */
  baseColor?: string;
  roughness?: number;
  metalness?: number;
}

function readMaterialParams(m: any): Pick<EnumeratedSlot, 'baseColor' | 'roughness' | 'metalness'> {
  if (!m) return {};
  return {
    baseColor: m.color?.getHexString ? `#${m.color.getHexString()}` : undefined,
    roughness: typeof m.roughness === 'number' ? m.roughness : undefined,
    metalness: typeof m.metalness === 'number' ? m.metalness : undefined,
  };
}

/** ロード済みオブジェクトのマテリアルスロットを列挙する（Phase D のスロット命名 UI 用）。 */
export function enumerateMaterialSlots(root?: THREE.Object3D): EnumeratedSlot[] {
  const out: EnumeratedSlot[] = [];
  root?.traverse?.((c: any) => {
    if (!c?.isMesh) return;
    const mat = c.material;
    if (Array.isArray(mat)) {
      mat.forEach((m: THREE.Material, i: number) => out.push({ meshName: c.name || '', meshUuid: c.uuid, materialIndex: i, materialName: m?.name || `material ${i}`, ...readMaterialParams(m) }));
    } else if (mat) {
      out.push({ meshName: c.name || '', meshUuid: c.uuid, materialIndex: 0, materialName: mat.name || c.name || 'material', ...readMaterialParams(mat) });
    }
  });
  return out;
}

/**
 * オブジェクト全体（全メッシュ）に 1 つのマテリアルを適用する（Tier2 / 単一マテリアル想定）。
 * S.Layout の選択ハイライト（applySelectedEmissive）は選択中メッシュの元マテリアルを
 * userData._origMat に退避し、解除時に復元する。そのため選択中に差し替える場合は
 * _origMat も新マテリアルへ更新し、表示はハイライト用クローンに差し替える（解除後も新材が残る）。
 */
export function applyWholeObjectMaterial(root: THREE.Object3D, material: THREE.Material): void {
  root.traverse((c: any) => {
    if (!c?.isMesh) return;
    if (c.userData?._origMat) {
      // 選択中：解除時の復元先を新マテリアルにし、表示はハイライト付きクローン
      c.userData._origMat = material;
      const cloned: any = material.clone();
      if (cloned.emissive !== undefined) {
        cloned.emissive = new THREE.Color('#ffa726');
        cloned.emissiveIntensity = 0.45;
      }
      cloned.needsUpdate = true;
      c.material = cloned;
    } else {
      c.material = material;
    }
  });
}

/** 1 つのメッシュ + スロット index に新マテリアルを差し込む（配列マテリアル対応）。 */
function setMeshSlotMaterial(mesh: any, materialIndex: number, material: THREE.Material) {
  if (Array.isArray(mesh.material)) {
    const arr = mesh.material.slice();
    arr[materialIndex] = material;
    mesh.material = arr;
  } else {
    mesh.material = material;
  }
}

/**
 * バインディングのスロットを root に適用する。
 * スロットは meshName（優先）または materialIndex でマッチする。
 * material スナップショットを持つスロットのみ適用（持たない場合はスキップ）。
 * 戻り値: 適用したスロット数。
 */
export async function applyBindingToObject(root: THREE.Object3D, binding: MaterialBinding): Promise<number> {
  if (!root || !binding?.slots?.length) return 0;

  // メッシュを名前で索引（同名が複数ある場合は最初を採用）
  const meshesByName = new Map<string, any>();
  const allMeshes: any[] = [];
  root.traverse((c: any) => {
    if (c?.isMesh) {
      allMeshes.push(c);
      if (c.name && !meshesByName.has(c.name)) meshesByName.set(c.name, c);
    }
  });

  let applied = 0;
  for (const slot of binding.slots as MaterialBindingSlot[]) {
    if (!slot.material) continue;
    const material = await buildThreeMaterial(slot.material);
    const idx = slot.materialIndex ?? 0;
    if (slot.meshName && meshesByName.has(slot.meshName)) {
      setMeshSlotMaterial(meshesByName.get(slot.meshName), idx, material);
      applied++;
    } else if (slot.meshName == null && allMeshes.length) {
      // meshName 未指定 = オブジェクト全体に適用（Tripo 等の単一メッシュ向け Tier2）
      allMeshes.forEach((m) => setMeshSlotMaterial(m, Array.isArray(m.material) ? idx : 0, material));
      applied++;
    }
  }
  return applied;
}
