// 横断 Gallery の正規化スキーマ。
// v1 は読み取り時ファンアウト（各子アプリの公開クエリを束ねてクライアントで正規化）。
// 将来 galleryItems Index コレクションへ昇格する際は、この型がそのまま doc 定義になる。

export type GalleryKind = 'model' | 'layout' | 'presentation' | 'furniture' | 'diagram' | 'image' | 'portfolio';

export type GalleryScope = 'all' | 'following';

// 元ソースへのディープリンク（カードクリックで該当アプリへ遷移するために使う）
export type GalleryRef =
  | { kind: 'model'; assetId: string }
  | { kind: 'layout'; projectId?: string; workspaceId?: string; layoutId: string }
  | { kind: 'presentation' | 'furniture' | 'diagram' | 'image' | 'portfolio'; projectId?: string; workFileId: string; appScope: string };

export interface GalleryItem {
  id: string;                 // 安定キー: `${kind}:${docId}`
  kind: GalleryKind;
  title: string;
  thumbnailUrl: string | null;
  /** kind==='model' の場合: 実際の GLB/GLTF ファイルの Storage URL */
  modelUrl?: string | null;
  author: {
    id: string;
    displayName?: string;
    photoURL?: string;
  };
  createdAtMs: number;        // ソート用に epoch ms へ正規化（Firestore Timestamp / ISO / number を吸収）
  updatedAtMs: number;
  tags: string[];
  ref: GalleryRef;
}

export const GALLERY_KINDS: GalleryKind[] = ['model', 'layout', 'presentation', 'furniture', 'diagram', 'image', 'portfolio'];

export const KIND_META: Record<GalleryKind, { label: string; color: string }> = {
  model:        { label: 'モデル',       color: '#5dade2' },
  layout:       { label: 'レイアウト',   color: '#58d68d' },
  presentation: { label: 'プレゼン',     color: '#f5b041' },
  furniture:    { label: '家具',         color: '#bb8fce' },
  diagram:      { label: 'ダイアグラム', color: '#f1948a' },
  image:        { label: '画像・動画',   color: '#ec407a' },
  portfolio:    { label: 'ポートフォリオ', color: '#9575cd' },
};
