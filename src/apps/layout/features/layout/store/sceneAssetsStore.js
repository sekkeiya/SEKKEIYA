// Object3D を“解析した結果”だけを扱う
// マテリアル一覧
// テクスチャ一覧
// 将来：使用回数 / 未使用チェック / purge など
// 「Scene から抽出されたアセット情報」

// src/store/sceneAssetsStore.js
import { create } from "zustand";

function getTexKey(tex) {
    if (!tex) return null;
    const img = tex.image;
    if (img?.src) return img.src;
    return tex.uuid || null;
}

function collectMaterialsFromObject(root) {
    const out = [];
    root?.traverse?.((c) => {
        if (!c?.isMesh) return;
        const mat = c.material;
        if (Array.isArray(mat)) out.push(...mat.filter(Boolean));
        else if (mat) out.push(mat);
    });
    return out;
}

export const useSceneAssetsStore = create((set, get) => ({
    /**
     * SceneObjectRegistry から Object3D を引いて解析する
     * ※ ここでは Object3D を保持しない
     */

    getUniqueMaterialsFromObjects: (objects = []) => {
        const map = new Map();

        objects.forEach((obj) => {
            collectMaterialsFromObject(obj).forEach((m) => {
                const key = m.uuid || `${m.type}:${m.name || ""}`;
                if (!map.has(key)) map.set(key, m);
            });
        });

        return Array.from(map.values()).map((m, i) => ({
            id: m.uuid || `mat-${i}`,
            name: m.name?.trim()
                ? m.name
                : `${m.type} ${String(i + 1).padStart(2, "0")}`,
            material: m,
        }));
    },

    getUniqueTextureSetsFromObjects: (objects = []) => {
        const map = new Map();

        objects.forEach((obj) => {
            collectMaterialsFromObject(obj).forEach((m) => {
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
                    const cur = map.get(key);
                    if (!cur.normalUrl) cur.normalUrl = getTexKey(m.normalMap) || null;
                    if (!cur.aoUrl) cur.aoUrl = getTexKey(m.aoMap) || null;
                }
            });
        });

        return Array.from(map.values());
    },
}));
