export interface LayoutAssetRef {
  sourceType: 'ref' | 'local' | 'asset';
  modelId?: string;
  ownerUid?: string;
  url?: string; // glbUrl or objectUrl
}

export interface TransformState {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface LayoutSceneObject {
  id: string; // Unique instance ID
  kind: 'model' | 'group' | 'light' | string;
  modelId?: string;   // Reference to global/local model library

  /** 紐付く 3DSS アセットの ID。追加時に一時マッピングされ、保存後に確定する。 */
  assetId?: string;
  /**
   * 保存時の Batch 処理用の一時メタデータ。追加フローで付与し、useOptionDoc の保存で
   * 消費して assetId を確定したのち delete される（Firestore には保存されない）。
   */
  _assetDraft?: {
    type: 'revive' | 'existing' | 'new';
    assetId?: string;
    payload?: unknown;
    glbRaw?: unknown;
  };

  title: string;
  name?: string;
  label?: string;

  brand?: string;
  ownerHandle?: string;
  type?: string;
  subType?: string;
  group?: string;
  thumbUrl?: string | null;

  glbUrl: string; // Resolvable GLB/GLTF string (network url, or blob objectUrl)

  dimensionsMm?: { width?: number; depth?: number; height?: number } | null;
  dimensionSource?: string | null;
  pinnedVersion?: number;

  // ウォークスルーのギミック定義（ドア開閉など）。S.Model の extendedMetadata 由来。
  gimmick?: {
    type: 'clip' | 'hinge';
    label?: string;
    openClip?: string;
    closeClip?: string;
    axis?: 'x' | 'y' | 'z';
    openDeg?: number;
    pivot?: string;
  } | null;
  // 複数ギミック（新スキーマ）/ 常時アニメ / ⓘ アイテム情報
  gimmicks?: any[] | null;
  anim?: any | null;
  info?: { description?: string; links?: Array<{ title?: string; url?: string }> } | null;

  transform: TransformState;

  createdAtMs: number;
}

export interface LayoutDocument {
  id?: string;
  name?: string;
  memo?: string;
  order?: number;
  layout: {
    items: LayoutSceneObject[];
  };
  // Firebase specific timestamps will be omitted or handled in adapters
}

export interface LayoutWorkspaceProps {
  projectId: string;
  workspaceId: string;
  workspaceName?: string;
  appScope?: string;
}
