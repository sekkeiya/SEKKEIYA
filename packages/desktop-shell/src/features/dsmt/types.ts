// S.Material (3dsmt) — マテリアル管理の型定義
//
// 設計メモ:
//  - DsmtMaterial は「素材の実体」。PBR パラメータ + テクスチャマップを持つ。
//    Firestore では projects/{projectId}/workFiles に appScope='3dsmt' として保存する
//    （S.Image / S.Create と同じ workFiles パターン）。
//  - MaterialBinding は「どのモデルのどのスロットにどの素材を当てたか」の永続情報。
//    S.Model 詳細 / S.Layout Properties での張り替え結果を保存する核（Phase C で本実装）。
//
// Phase A ではこれらの型を定義し、ダッシュボード/サイドバーの土台を通す。
// 実際の CRUD・3D 適用は Phase B 以降。

export type DsmtMaterialKind = 'pbr' | 'texture-set';

export type DsmtCategory =
  | 'fabric'   // 張地・ファブリック
  | 'wood'     // 木材
  | 'metal'    // 金属
  | 'stone'    // 石・タイル
  | 'leather'  // 革
  | 'plastic'  // 樹脂
  | 'glass'    // ガラス
  | 'paint'    // 塗装・単色
  | 'other';

/**
 * 素材の「部位（どこに貼るか）」。category（素材ジャンル）とは独立の軸。
 * 自動マテリアル付与で、面ラベル（床/内壁/外壁/天井）と直接突き合わせて精度を上げる。
 * 1素材が複数部位に適合してよい（例: 磁器質タイルは床にも壁にも）。
 */
export type MaterialApplication = 'floor' | 'outer_floor' | 'inner_wall' | 'outer_wall' | 'ceiling';

export const MATERIAL_APPLICATION_JP: Record<MaterialApplication, string> = {
  floor: '床',
  outer_floor: '外床',
  inner_wall: '内壁',
  outer_wall: '外壁',
  ceiling: '天井',
};

/** three.js MeshStandardMaterial へ直接マップできる PBR パラメータ。 */
export interface DsmtPbrParams {
  baseColor: string;          // #rrggbb
  roughness: number;          // 0..1
  metalness: number;          // 0..1
  normalScale?: number;
  aoIntensity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;           // 0..1
}

/** テクスチャマップ群（Firebase Storage / ローカルの URL）。 */
export interface DsmtTextureMaps {
  albedo?: string;
  normal?: string;
  roughness?: string;
  metalness?: string;
  ao?: string;
}

export interface DsmtTiling {
  repeatX: number;
  repeatY: number;
  rotation?: number;
}

/**
 * ターゲット別ネイティブ包装ファイル（任意）。
 *
 * テクスチャ画像(maps)と PBR パラメータ(params)は three.js / Rhino / Blender で共通の
 * 「正（source of truth）」。アプリ内（S.Model / S.Layout = three.js）はそれだけで動く。
 * Rhino(.rmtl)・Blender(.blend / MaterialX .mtlx)・USD は *包み方* が違うだけなので、
 * 必要なときにここへ追加ファイルとして添付（またはエクスポート時に maps から生成）する。
 */
export interface DsmtNativePackage {
  url: string;
  storagePath?: string;
  format: string; // 'rmtl' | '3dm' | 'blend' | 'mtlx' | 'usdz' など
}

export interface DsmtPackages {
  rhino?: DsmtNativePackage;
  blender?: DsmtNativePackage;
  mtlx?: DsmtNativePackage;   // MaterialX（DCC 共通中間フォーマット）
  usd?: DsmtNativePackage;
}

/**
 * マテリアルにリンクする「実商品」。1 マテリアル＝複数メーカーの商品を必ず複数ぶら下げ、
 * 価格・耐久・防火の 3 軸で比較して選定できるようにする。
 * 価格は実値、耐久/防火は 0–100 のスコア（根拠は fireRating 等に併記）。
 */
export interface DsmtProduct {
  id: string;
  /** メーカー名（プリセット or 自由入力）。 */
  manufacturer: string;
  /** 商品名。 */
  name: string;
  /** 品番。 */
  code?: string;
  /** 商品 / デジタルカタログの URL。 */
  url?: string;
  /** 商品サムネイル画像 URL。 */
  imageUrl?: string;
  /** 参考単価（数値）。 */
  price?: number;
  /** 単価の単位（㎡ / m / 本 / ケース / 枚 など）。既定は ㎡。 */
  priceUnit?: string;
  /** 耐久性・メンテ性スコア（0–100）。大きいほど良い。 */
  durability?: number;
  /** 防火・安全性能スコア（0–100）。大きいほど良い。 */
  fireSafety?: number;
  /** 防火等級などの根拠表示（不燃 / 準不燃 / 難燃 / 防炎 など）。 */
  fireRating?: string;
  /** 補足メモ。 */
  notes?: string;
  /** 取り込み元（'manual' | 'url-import' など）。 */
  source?: string;
  createdAt?: number;
}

/** 素材の実体。 */
export interface DsmtMaterial {
  id: string;
  appScope: '3dsmt';
  title: string;
  kind: DsmtMaterialKind;
  category: DsmtCategory;

  params: DsmtPbrParams;
  maps?: DsmtTextureMaps;
  tiling?: DsmtTiling;
  /** ターゲット別ネイティブ包装（Rhino/Blender/USD など、任意）。 */
  packages?: DsmtPackages;

  thumbnailUrl?: string;
  tags?: string[];
  /** 適合する部位（床/内壁/外壁/天井）。自動マテリアル付与の部位マッチに使う。複数可。 */
  applications?: MaterialApplication[];
  /** リンクされた実商品（複数メーカー）。比較グラフのデータ源。 */
  products?: DsmtProduct[];

  visibility: 'public' | 'private';
  ownerId?: string;
  createdBy?: string;

  /** Firestore 由来の付随情報（プロジェクトスコープ取得時に付与）。 */
  projectId?: string;
  status?: string;
  isArchived?: boolean;
  createdAt?: number | string;
  updatedAt?: number | string;
}

/** 素材の自己完結スナップショット（バインディングに埋め込み、適用時の再フェッチを不要にする）。 */
export interface DsmtMaterialSnapshot {
  title?: string;
  category?: DsmtCategory;
  params: DsmtPbrParams;
  maps?: DsmtTextureMaps;
  tiling?: DsmtTiling;
}

/** モデルの 1 スロットへの素材割当。 */
export interface MaterialBindingSlot {
  meshName?: string;
  materialIndex?: number;
  /** "張地" / "脚フレーム" / "クッション" 等（人手 or AI 命名）。 */
  semanticLabel?: string;
  materialId: string;
  /**
   * バインド時点の素材スナップショット。素材本体が移動・削除されても再現でき、
   * 適用時に workFiles を再取得しなくて済む（自己完結）。
   */
  material?: DsmtMaterialSnapshot;
}

/** どのモデル/配置インスタンスに、どの素材を当てたかの永続情報。 */
export interface MaterialBinding {
  id: string;
  targetType: 'model' | 'layoutObject';
  modelId: string;
  layoutObjectId?: string;
  slots: MaterialBindingSlot[];
  updatedAt?: number;
  updatedBy?: string;
}

/** カテゴリの表示メタ（サイドバー/フィルタ/プレビュー用）。 */
export const DSMT_CATEGORY_META: Record<DsmtCategory, { label: string; color: string }> = {
  fabric:  { label: 'ファブリック / 張地', color: '#ec407a' },
  wood:    { label: '木材',               color: '#a1672f' },
  metal:   { label: '金属',               color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
  stone:   { label: '石・タイル',         color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
  leather: { label: '革',                 color: '#8d5524' },
  plastic: { label: '樹脂',               color: '#5c6bc0' },
  glass:   { label: 'ガラス',             color: 'light-dark(#198694, #4dd0e1)' },
  paint:   { label: '塗装・単色',         color: '#66bb6a' },
  other:   { label: 'その他',             color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
};
