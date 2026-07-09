import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "../../../../lib/firebase/client";
import { WorkspaceItemRepository } from "../../../workspace/WorkspaceItemRepository";

export interface NewModelDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface SaveItemAsNewModelInput {
  /** カテゴリ・タグ・サムネ等を引き継ぐ元アセット（globalAsset または配置item） */
  sourceAsset: any;
  /** 取得可能な GLB の URL（Firebase ダウンロードURL等） */
  glbUrl: string;
  /** 新規モデル名 */
  title: string;
  /** 上書きする寸法 (mm) */
  dimensions: NewModelDimensions;
  /** 公開設定（既定: private） */
  visibility?: "public" | "private";
}

/**
 * S.Layout 上で寸法を編集したアイテムを、独立した新規モデルとして S.Model（グローバル /assets）へ保存する。
 * 元の GLB を複製アップロードし、寸法だけを差し替えた新しいアセットを作成する。
 * （マテリアルの焼き込みは未対応。GLBジオメトリは元モデルと同一で、寸法のみメタデータ上書き。）
 * @returns 作成された新規モデルの ID
 */
export async function saveItemAsNewModel(input: SaveItemAsNewModelInput): Promise<string> {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("ログインが必要です。");
  if (!input.glbUrl) throw new Error("元モデルのGLBが見つかりません。");

  const src = input.sourceAsset || {};
  const modelId = crypto.randomUUID();
  const storageDir = `assets/${modelId}`;

  // 1) 元GLBを取得し、独立コピーとして再アップロード
  const res = await fetch(input.glbUrl);
  if (!res.ok) throw new Error(`GLBの取得に失敗しました (${res.status})`);
  const blob = await res.blob();
  const glbPath = `${storageDir}/model.glb`;
  const glbRef = ref(storage, glbPath);
  await uploadBytes(glbRef, blob, { customMetadata: { ownerId: uid } });
  const glbDownloadUrl = await getDownloadURL(glbRef);

  const thumbnailUrl = src.thumbnailUrl || src.thumbUrl || "";
  const dimensions = {
    width: Number(input.dimensions.width) || 0,
    depth: Number(input.dimensions.depth) || 0,
    height: Number(input.dimensions.height) || 0,
  };

  // 2) 寸法を差し替えたグローバルアセットを作成
  await WorkspaceItemRepository.createGlobalAsset(modelId, {
    id: modelId,
    name: input.title,
    title: input.title,
    type: "3d-model",
    format: "glb",
    sizeBytes: blob.size,
    storagePath: glbPath,
    downloadUrl: glbDownloadUrl,
    glbUrl: glbDownloadUrl,
    thumbnailUrl,
    ownerId: uid,
    visibility: input.visibility || "private",
    category: src.category || src.macroCategory || "家具 (既製品)",
    macroCategory: src.macroCategory || src.category || "家具 (既製品)",
    mainCategory: src.mainCategory || "",
    subCategory: src.subCategory || src.userCategory || "",
    dimensions,
    dimensionSource: "manual",
    tags: Array.isArray(src.tags) ? src.tags : [],
    materials: Array.isArray(src.materials) ? src.materials : [],
    buildingTypes: Array.isArray(src.buildingTypes) ? src.buildingTypes : [],
    rooms: Array.isArray(src.rooms) ? src.rooms : [],
    zones: Array.isArray(src.zones) ? src.zones : [],
    companionClasses: Array.isArray(src.companionClasses) ? src.companionClasses : [],
    derivedFromModelId: src.id || src.modelId || null,
    latestVersion: 1,
    versions: {
      "1": {
        downloadUrl: glbDownloadUrl,
        glbUrl: glbDownloadUrl,
        thumbnailUrl,
        createdAt: Date.now(),
      },
    },
  });

  return modelId;
}
