import { create } from "zustand";
import { Object3D, Material, Texture } from "three";

export interface SceneMaterialInfo {
  id: string;
  name: string;
  material: Material;
}

export interface SceneTextureSet {
  id: string;
  name: string;
  thumbUrl: string | null;
  mapUrl: string | null;
  normalUrl: string | null;
  aoUrl: string | null;
}

export interface SceneAssetsState {
  getUniqueMaterialsFromObjects: (objects?: Object3D[]) => SceneMaterialInfo[];
  getUniqueTextureSetsFromObjects: (objects?: Object3D[]) => SceneTextureSet[];
}

function getTexKey(tex?: Texture | null): string | null {
  if (!tex) return null;
  const img = tex.image;
  if (img?.src) return img.src;
  return tex.uuid || null;
}

function collectMaterialsFromObject(root?: Object3D): Material[] {
  const out: Material[] = [];
  root?.traverse?.((c: any) => {
    if (!c?.isMesh) return;
    const mat = c.material;
    if (Array.isArray(mat)) out.push(...mat.filter(Boolean));
    else if (mat) out.push(mat);
  });
  return out;
}

export const useSceneAssetsStore = create<SceneAssetsState>((set, get) => ({
  getUniqueMaterialsFromObjects: (objects = []) => {
    const map = new Map<string, Material>();

    objects.forEach((obj) => {
      collectMaterialsFromObject(obj).forEach((m) => {
        const key = m.uuid || `${m.type}:${m.name || ""}`;
        if (!map.has(key)) map.set(key, m);
      });
    });

    return Array.from(map.values()).map((m, i) => ({
      id: m.uuid || `mat-${i}`,
      name: m.name?.trim() ? m.name : `${m.type} ${String(i + 1).padStart(2, "0")}`,
      material: m,
    }));
  },

  getUniqueTextureSetsFromObjects: (objects = []) => {
    const map = new Map<string, SceneTextureSet>();

    objects.forEach((obj) => {
      collectMaterialsFromObject(obj).forEach((m: any) => {
        const mapTex = m.map || null;
        const key = getTexKey(mapTex);
        if (!key) return;

        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: (m.name?.trim() ? m.name : "Texture") + " (map)",
            thumbUrl: key,
            mapUrl: key,
            normalUrl: getTexKey(m.normalMap) || null,
            aoUrl: getTexKey(m.aoMap) || null,
          });
        } else {
          const cur = map.get(key)!;
          if (!cur.normalUrl) cur.normalUrl = getTexKey(m.normalMap) || null;
          if (!cur.aoUrl) cur.aoUrl = getTexKey(m.aoMap) || null;
        }
      });
    });

    return Array.from(map.values());
  },
}));
