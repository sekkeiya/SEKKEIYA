import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, storage } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import type { DsmtCategory, DsmtPbrParams, DsmtTextureMaps, MaterialApplication, DsmtProduct } from '../types';
import { DEFAULT_MATERIALS } from '../data/defaultMaterials';

export type DsmtTextureSlot = keyof DsmtTextureMaps; // 'albedo' | 'normal' | 'roughness' | 'metalness' | 'ao'

export interface DsmtMaterialInput {
  title: string;
  category: DsmtCategory;
  params: DsmtPbrParams;
  tags?: string[];
  /** 適合部位（床/内壁/外壁/天井）。自動マテリアル付与の部位マッチに使う。 */
  applications?: MaterialApplication[];
  visibility?: 'public' | 'private';
  /** 既存の維持マップ（編集時に再アップロードしないスロットを引き継ぐ） */
  maps?: DsmtTextureMaps;
}

const ALLOWED_TEX_EXT = ['png', 'jpg', 'jpeg', 'webp', 'ktx2'];

/**
 * maps からローカル参照（端末固有の asset:// / C:\… / LocalAssets / asset.localhost 等）を除去する。
 * これらは別端末やファイル削除後に 404 を出す原因になるため Firestore へ保存しない（再発防止の最終防壁）。
 * Firebase Storage 等の http(s) URL のみ残す。
 */
function sanitizeMaps(maps: DsmtTextureMaps): DsmtTextureMaps {
  const out: DsmtTextureMaps = {};
  for (const k of Object.keys(maps) as DsmtTextureSlot[]) {
    const v = maps[k];
    if (v && /^https?:\/\//i.test(v) && !/asset\.localhost|tauri\.localhost/.test(v)) out[k] = v;
  }
  return out;
}

const getExt = (filename: string) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/** テクスチャ 1 枚を Storage にアップロードして URL を返す。 */
async function uploadTextureFile(
  projectId: string,
  materialId: string,
  slot: DsmtTextureSlot,
  file: File,
  onProgress?: (p: number) => void,
): Promise<{ url: string; storagePath: string }> {
  const ext = getExt(file.name);
  if (!ALLOWED_TEX_EXT.includes(ext)) {
    throw new Error(`未対応のテクスチャ形式です（${ext || 'unknown'}）。PNG / JPG / WebP を使用してください。`);
  }
  // 既存の Storage ルールが許可している assets/ 配下を再利用する
  // （projects/{pid}/materials/** はルール対象外で 403 になるため）。
  const storagePath = `projects/${projectId}/assets/${materialId}/${slot}.${ext}`;
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file);
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (s) => { if (onProgress) onProgress((s.bytesTransferred / s.totalBytes) * 100); },
      (err) => reject(err),
      () => resolve(),
    );
  });
  const url = await getDownloadURL(storageRef);
  return { url, storagePath };
}

export const dsmtUploadService = {
  uploadTextureFile,

  /**
   * 新規マテリアルを projects/{projectId}/workFiles に保存する（appScope='3dsmt', type='material'）。
   * files に渡したテクスチャは Storage へアップロードし maps に格納する。
   */
  async createMaterial(
    projectId: string,
    input: DsmtMaterialInput,
    files?: Partial<Record<DsmtTextureSlot, File>>,
    onProgress?: (p: number) => void,
    /** 指定すると固定ID（upsert）。同IDの再実行で重複せず上書きされる（スターター生成等）。 */
    idOverride?: string,
  ): Promise<string> {
    const materialId = idOverride ?? crypto.randomUUID();
    const ownerId = useAuthStore.getState().currentUser?.uid ?? null;

    // 既存maps（引き継ぎ）はローカル参照を除去してから使う。アップロード分は下で remote URL を入れる。
    const maps: DsmtTextureMaps = sanitizeMaps({ ...(input.maps ?? {}) });
    const storagePaths: string[] = [];
    if (files) {
      const slots = Object.keys(files) as DsmtTextureSlot[];
      for (const slot of slots) {
        const f = files[slot];
        if (!f) continue;
        const { url, storagePath } = await uploadTextureFile(projectId, materialId, slot, f, onProgress);
        maps[slot] = url;
        storagePaths.push(storagePath);
      }
    }

    await setDoc(doc(db, `projects/${projectId}/workFiles`, materialId), {
      id: materialId,
      appScope: '3dsmt',
      type: 'material',
      title: input.title || '無題の素材',
      category: input.category,
      params: input.params,
      maps,
      // カードのサムネはアルベドがあればそれを使う（無ければカード側で球プレビュー）
      thumbnailUrl: maps.albedo ?? null,
      tags: input.tags ?? [],
      applications: input.applications ?? [],
      ownerId,
      createdBy: ownerId,
      visibility: input.visibility ?? 'private',
      projectId,
      status: 'active',
      storagePaths,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return materialId;
  },

  /** 既存マテリアルのメタ/パラメータ/テクスチャを更新する。 */
  async updateMaterial(
    projectId: string,
    materialId: string,
    input: DsmtMaterialInput,
    files?: Partial<Record<DsmtTextureSlot, File>>,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    const maps: DsmtTextureMaps = sanitizeMaps({ ...(input.maps ?? {}) });
    if (files) {
      const slots = Object.keys(files) as DsmtTextureSlot[];
      for (const slot of slots) {
        const f = files[slot];
        if (!f) continue;
        const { url } = await uploadTextureFile(projectId, materialId, slot, f, onProgress);
        maps[slot] = url;
      }
    }

    await updateDoc(doc(db, `projects/${projectId}/workFiles`, materialId), {
      title: input.title || '無題の素材',
      category: input.category,
      params: input.params,
      maps,
      thumbnailUrl: maps.albedo ?? null,
      tags: input.tags ?? [],
      applications: input.applications ?? [],
      ...(input.visibility ? { visibility: input.visibility } : {}),
      updatedAt: serverTimestamp(),
    });
  },

  /** マテリアルにリンクされた実商品（複数メーカー）の配列を保存する。 */
  async updateMaterialProducts(
    projectId: string,
    materialId: string,
    products: DsmtProduct[],
  ): Promise<void> {
    // Firestore は undefined を弾くため、各商品から undefined フィールドを除去する。
    const clean = products.map((p) =>
      Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)),
    );
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, materialId), {
      products: clean,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * 1 スロットにテクスチャを設定する（File を Storage へ上げて maps.<slot> を更新）。
   * three.js の乗算二重適用を避けるため、albedo なら baseColor を白に、
   * roughness マップなら scalar roughness を 1.0 に寄せる（既定 ON）。
   */
  async setMaterialMapFromFile(
    projectId: string,
    materialId: string,
    slot: DsmtTextureSlot,
    file: File,
    opts: { normalizeParams?: boolean } = {},
  ): Promise<string> {
    const { normalizeParams = true } = opts;
    const { url, storagePath } = await uploadTextureFile(projectId, materialId, slot, file);
    const update: Record<string, any> = {
      [`maps.${slot}`]: url,
      storagePaths: arrayUnion(storagePath),
      updatedAt: serverTimestamp(),
    };
    if (slot === 'albedo') {
      update.thumbnailUrl = url;
      if (normalizeParams) update['params.baseColor'] = '#ffffff';
    }
    if (slot === 'roughness' && normalizeParams) update['params.roughness'] = 1;
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, materialId), update);
    return url;
  },

  /** 1 スロットのテクスチャを外す（maps.<slot> = null）。 */
  async clearMaterialMap(projectId: string, materialId: string, slot: DsmtTextureSlot): Promise<void> {
    const update: Record<string, any> = { [`maps.${slot}`]: null, updatedAt: serverTimestamp() };
    if (slot === 'albedo') update.thumbnailUrl = null;
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, materialId), update);
  },

  /** 公開/非公開トグル。 */
  async setMaterialVisibility(projectId: string, materialId: string, visibility: 'public' | 'private'): Promise<void> {
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, materialId), {
      visibility,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * デフォルト素材一式を projects/{projectId}/workFiles に「公開」で投入する。
   * 決定的 ID（dsmt_seed_<slug>）で冪等。複数回押しても重複しない。
   * テクスチャ無しの PBR パラメータのみ＝オフラインでも動く共通コア。
   */
  async seedDefaultMaterials(projectId: string): Promise<number> {
    const ownerId = useAuthStore.getState().currentUser?.uid ?? null;
    let count = 0;
    for (const def of DEFAULT_MATERIALS) {
      const id = `dsmt_seed_${def.slug}`;
      await setDoc(doc(db, `projects/${projectId}/workFiles`, id), {
        id,
        appScope: '3dsmt',
        type: 'material',
        title: def.title,
        category: def.category,
        params: def.params,
        maps: {},
        thumbnailUrl: null,
        tags: def.tags,
        isSeed: true,
        ownerId,
        createdBy: ownerId,
        visibility: 'public',
        projectId,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      count++;
    }
    return count;
  },

  /** マテリアル削除（Firestore + Storage のテクスチャ実体）。 */
  async deleteMaterial(projectId: string, item: any): Promise<void> {
    await deleteDoc(doc(db, `projects/${projectId}/workFiles`, item.id));
    const paths: string[] = Array.isArray(item.storagePaths) ? item.storagePaths : [];
    await Promise.all(paths.map(async (p) => {
      try { await deleteObject(ref(storage, p)); }
      catch (e) { console.warn('[dsmtUploadService] storage delete skipped', p, e); }
    }));
  },
};
