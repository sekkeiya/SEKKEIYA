/**
 * Desktop UI Representation of a Project Workspace Launch Context
 */
export interface WorkspaceLaunchPayload {
  appScope: string;
  projectId: string; // The Project ID
  workspaceId: string; // e.g., 'models', 'layout'
  workspaceName?: string; // The display name of the workspace for the tab
}

export interface WorkspacePayload {
  workspaceId: string; // Identifier for the workspace (e.g. 'models', 'layout')
  name: string;        // Localized/Display name
  type: string;        // Visual type/icon mapping
  appScope: string;    // Target child application (e.g. '3DSS', '3DSL')
  description: string;
}

/**
 * プロジェクト / チーム内のメンバーロール（docs/15）。
 *   owner  = 設定・削除・公開・メンバー管理が可能（各 Pj に最低 1 名）
 *   editor = 編集（子アプリ含む）が可能
 *   viewer = 閲覧のみ
 */
export type ProjectRole = 'owner' | 'editor' | 'viewer';

/** uid → role のマップ。`memberIds` は常に Object.keys(roles) と同期する（docs/15 §2.1）。 */
export type RoleMap = Record<string, ProjectRole>;

/**
 * Desktop UI Representation of a Project
 */
export interface DesktopProject {
  id: string;          // Project ID
  name: string;        // Display Name
  description: string; // Additional context
  ownerId: string;     // Primary owner UID
  lastModifiedAt: string; // ISO string for sorting
  coverThumbnailUrl?: string;
  iconEmoji?: string;   // カスタムアイコン（絵文字）
  iconUrl?: string;     // カスタムアイコン（アップロード画像）
  projectType?: string;
  visibility?: string;
  phase?: string;
  memberIds?: string[];
  roles?: RoleMap;      // uid → role（正。memberIds はこのキーと同期）
  teamId?: string;      // TEAM Pj のみ。/teams/{teamId} を指す
  promotedAt?: string;  // MY→TEAM 昇格日時（ISO・監査用）
  updatedAt?: any;
  requirements?: string;
  workspaces: WorkspacePayload[]; // List of available child-app entry points
  recentActivities?: ActivityItem[];
  isTeam?: boolean;
}

export interface ActivityItem {
  id: string;
  type: 'document' | '3d-viewer' | 'editor';
  title: string;
  description: string;
  timestamp: string;
  workFileId?: string;
}

/**
 * Raw Firestore representation conforming to the Unified Schema
 * Based on /projects/{projectId}
 */
export interface FirestoreProjectDoc {
  name?: string;
  projectType?: string;
  ownerId?: string;
  memberIds?: string[];
  roles?: RoleMap;
  teamId?: string;
  promotedAt?: string | { toDate: () => Date };
  visibility?: string;
  phase?: string;
  requirements?: string;
  coverThumbnailUrl?: string;
  iconEmoji?: string;
  iconUrl?: string;
  lastActivityAt?: string | { toDate: () => Date };
  updatedAt?: string | { toDate: () => Date };
  sourceApp?: string;
  schemaVersion?: number;
  isTeam?: boolean;
}

export type TemplateSourceType = 'official' | 'user' | 'public';

export interface RhinoTemplate {
  id: string;
  name: string;
  description: string;
  /** こんな用途におすすめ（詳細パネルに表示） */
  recommendedFor?: string;
  sourceType: TemplateSourceType;
  ownerId?: string;
  ownerName?: string;
  rhinoVersion?: number;
  unitSystem?: 'mm' | 'm' | 'inch';
  category: 'Default' | 'Architecture' | 'Large Objects' | 'Small Objects' | string;
  tags: string[];
  isPublic: boolean;
  templatePath: string;
  storagePath?: string;
  thumbnailUrl?: string;
  glbUrl?: string;
  createdAt?: string;
  isMock?: boolean;
  usageCount?: number;
  updatedAt?: string;
  toolType?: WorkFileToolType;
}

export type UploadStatus = 'idle' | 'uploading' | 'saving' | 'success' | 'error';

/* ==========================================================
 * Work File Architecture Types (Phase 1 - Unified Shared Assets)
 * =========================================================*/

export type WorkFileToolType = 'rhino' | 'blender' | 'sketchup' | 'revit' | 'other';

export interface WorkFile {
  id: string;
  projectId: string;         // Project ID
  name: string;              // e.g., 01_BaseModel.3dm
  toolType?: WorkFileToolType;
  currentVersionId?: string | null;
  latestVersionNumber?: number;
  updatedAt: string;
  updatedBy: string;
  status?: 'active' | 'archived';
  thumbnailUrl?: string | null;
  glbUrl?: string | null;
  storagePath?: string | null;
  lastOpenedAt?: string | null;
  createdAt: string;
  createdBy: string;
  appScope?: string;         // E.g., '3dsp', '3dss' etc
  type?: string;             // E.g., 'presentation', 'document'
  localPath?: string;        // Local filesystem path tracking
  isDeleted?: boolean;       // Soft delete flag
  size?: number;             // File size in bytes (of the latest version)
}

export interface WorkFileVersion {
  id: string; // versionId
  workFileId: string;
  versionNumber: number;
  comment?: string;
  storagePath?: string;
  createdAt: string;
  createdBy: string;
  size?: number;             // File size in bytes
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  type: 'work_file_created' | 'work_file_opened' | 'work_file_version_created' | 'work_file_updated';
  targetType: 'workFile' | 'project' | 'workspace' | 'document';
  targetId: string;
  userId: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface JournalEntry {
  id: string;
  projectId: string;
  authorId: string;
  content: string; // Markdown text
  title?: string;
  excerpt?: string;
  aiContextSnapshot: {
    contextLevel: string;
    watchedScopes: string[];
    activeProfileId?: string;
    activeProfileName?: string;
    workspaceId?: string | null;
    workspaceName?: string | null;
    promptLength?: number;
    contextSummaryHash?: string;
  };
  tags?: string[];
  embeddingState?: "none" | "pending" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface JournalEntryDoc {
  projectId: string;
  authorId: string;
  content: string;
  title?: string;
  excerpt?: string;
  aiContextSnapshot: {
    contextLevel: string;
    watchedScopes: string[];
    activeProfileId?: string;
    activeProfileName?: string;
    workspaceId?: string | null;
    workspaceName?: string | null;
    promptLength?: number;
    contextSummaryHash?: string;
  };
  tags?: string[];
  embeddingState?: "none" | "pending" | "completed" | "failed";
  createdAt: string | { toDate: () => Date };
  updatedAt: string | { toDate: () => Date };
  isDeleted?: boolean;
  deletedAt?: string | { toDate: () => Date };
  deletedBy?: string;
}

export interface WorkFileLocalBinding {
  workFileId: string;
  localPath: string; // The fully resolved path at the time of opening
  projectId?: string; // Stored to prevent brittle path parsing
  machineId?: string;
  lastOpenedAt?: string;
  existsLocally: boolean;
  localModifiedAt?: number | null;
  openedVersionId?: string;
}

/* ==========================================================
 * Phase 12 Ecosystem Architecture (Unified Projects SSOT)
 * =========================================================*/

/**
 * 3DSS Asset (Project Library)
 * Exists at /projects/{projectId}/assets/{assetId}
 */
export interface ProjectAssetDoc {
  itemType: string; // 'furniture', 'material', etc.
  name: string;
  modelUrl?: string; // Original or derived GLB url
  thumbnailUrl?: string;
  entityId?: string; // Reference to global master if applicable
  dimensions?: { x: number; y: number; z: number };
  materials?: any; // Configurable materials
  tags?: string[];
  addedBy: string;
  createdAt: string;
  updatedAt?: string;
  status?: 'active' | 'archived'; // For soft deletes
  usageCount?: number;
  isDeleted?: boolean; // Soft delete flag
}

/**
 * 3DSL Layout Node
 * Exists at /projects/{projectId}/workspaces/{workspaceId}/plans/{planId}
 */
export interface LayoutPlanDoc {
  type: 'base' | 'plan' | 'option';
  name: string;
  parentId?: string | null; // Null for root nodes
  description?: string;
  thumbnailUrl?: string;    // Representative render or viewport capture
  rendersCount?: number;    // Denormalized count for display
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 3DSL Render — a saved still image produced from a Layout
 * Exists at /projects/{projectId}/workspaces/{workspaceId}/layouts/{planId}/renders/{renderId}
 */
export interface DslRenderDoc {
  type: 'image' | 'video';
  shotName?: string;         // Name of the shot this was rendered from
  quality: 'standard' | 'cycles';
  url: string;               // Firebase Storage download URL
  thumbnailUrl?: string;     // Downscaled thumbnail (optional)
  width: number;
  height: number;
  durationSec?: number;      // For video renders
  samples?: number;          // Cycles samples count
  isHero?: boolean;          // If true this is used as the plan's thumbnailUrl
  createdBy: string;
  createdAt: string;
}

/**
 * 3DSL Layout Instance
 * Exists at /projects/{projectId}/workspaces/{workspaceId}/plans/{planId}/items/{itemId}
 */
export interface LayoutItemDoc {
  itemType: string;
  assetId: string; // Reference to a ProjectAssetDoc
  transform: {
    position: [number, number, number];
    rotation: [number, number, number]; // Euler angles (radians, standard order)
    scale: [number, number, number];
  };
  visible?: boolean;
  overrides?: Record<string, any>; // Instance specific color/material overrides
  addedBy: string;
  createdAt: string;
}

/* ==========================================================
 * Project Site (Phase 1) — Project = 公開可能な 1 枚の Web サイト
 * 仕様: docs/09_project_site_spec.md
 * Firestore: /projects/{projectId}/site/main
 * =========================================================*/

/** サイト初期テンプレートの 3 系統 + 3 新系統。系統内に複数テンプレを内包する（templateId で個別指定）。 */
export type SiteTemplateFamily =
  | 'proposal'   // 設計提案プレゼン
  | 'record'     // 竣工記録
  | 'portfolio'  // 作品ポートフォリオ
  | 'residence'  // 集合住宅・分譲プロジェクト（部屋一覧・価格・間取り）
  | 'parcel'     // 区画セレクター / 戸建て分譲（棟・敷地図＋仕様）
  | 'studio';    // 事務所・スタジオ紹介（サービス・実績・比較）

/** 縦スクロールサイトを構成する section の種別。 */
export type SiteSectionType =
  | 'hero'         // プロジェクト名・キービジュアル
  | 'overview'     // 概要・コンセプト文
  | 'layout'       // S.Layout レンダー
  | 'presentation' // S.Slide スライド
  | 'walkthrough'  // 動画
  | 'diagram'      // S.Diagram
  | 'drawing'      // S.Drawing 図面
  | 'gallery'      // S.Image 画像群
  | 'portfolio'    // S.Portfolio PDF
  | 'spec'         // 数値サマリー表（用途/規模/席数 など）
  | 'research'     // 敷地・周辺リサーチ（写真＋観察メモ）
  | 'target'       // ターゲット分析（グラフ）
  | 'regulation'   // 法規・与条件（容積率/建蔽率/用途地域 など）
  | 'concept'      // コンセプト（キーワード＋ステートメント）
  | 'process'      // 検討過程・いきさつ（タイムライン）
  | 'references'   // 参考文献・出典（参照 URL リスト）
  | 'zoning'       // ゾーニング（図＋各ゾーンの狙い）
  | 'flow'         // 動線計画（図＋導線解説）
  | 'itemspec'     // アイテムスペック（家具/什器：型番・寸法・数量）
  | 'comparison'   // プラン比較（A / B …）
  | 'works'        // 実績一覧（アカウントサイト: プロジェクトサイトをカード表示）
  | 'projectlink'  // 単一プロジェクトへのリンク（アカウントサイトの各プロジェクトページ）
  | 'usergenres'   // 得意ジャンル（投稿モデルから集計したスキル分布グラフ）
  | 'usermodels'   // 投稿モデル（公開した 3D モデルのギャラリー）
  | 'profilestats' // 統計（フォロワー / フォロー中 / 投稿モデル / 公開プロジェクト）
  | 'unitlist'     // 部屋一覧（集合住宅：間取り・面積・価格・ステータス）
  | 'unitpicker'   // 区画セレクター（建物図＋区画カード一覧）
  | 'services'     // サービスカード（事務所：業務領域のカードグリッド）
  | 'blog'         // ブログ記事一覧（カテゴリ絞り込み付き。S.Blog の公開済み記事を表示）
  | 'custom';      // 自由テキスト / 埋め込み

/** アカウントサイトの projectlink セクションが指すプロジェクト。 */
export interface SiteProjectRef {
  projectId: string;
  name: string;
  cover?: string | null;
  team?: boolean;
  /** 公開時に焼き込む：このプロジェクトが公開済みなら `@user/slug` 形式のスラッグ（Web のリンク先）。 */
  publishedSlug?: string | null;
}

/** 公開スナップショットに焼き込む works カード（Web は live store でなくこれを描画）。 */
export interface ResolvedWork {
  id: string;
  name: string;
  cover?: string | null;
  isTeam?: boolean;
  iconEmoji?: string | null;
  iconUrl?: string | null;
  publishedSlug?: string | null; // 公開済みなら `@user/slug`、未公開なら null
}

/** 公開スナップショットに焼き込むブログ記事1件（blog セクション）。公開済みのみ。 */
export interface ResolvedBlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover?: string | null;
  category: string;
  publishedAt?: string | null;
}

/** 公開スナップショットに焼き込むブログ一覧（blog セクション）。 */
export interface ResolvedBlog {
  articles: ResolvedBlogArticle[];
  categories: { name: string; count: number }[];
}

/** 公開スナップショットに焼き込むプロフィール統計（usergenres / usermodels / profilestats）。 */
export interface ResolvedProfile {
  followers: number;
  following: number;
  models: { id: string; name: string; thumb?: string | null }[];
  genres: ChartDatum[];
  publishedProjectCount: number;
}

/* 構造化セクションの内容（提案書の部品） */
export interface SpecRow { label: string; value: string; }
export interface ItemSpecRow { name: string; spec?: string; qty?: string; }
export interface Callout { no: number; title: string; body: string; }
export interface ComparisonColumn { title: string; rows: string[]; }
export interface ChartDatum { label: string; value: number; }
export type ChartType = 'donut' | 'bar' | 'radar';
export interface ProcessStep { phase?: string; title: string; body?: string; }
export interface ReferenceItem { title: string; url?: string; }

/** unitlist: 集合住宅の部屋一行。 */
export interface UnitRow {
  id: string;
  name: string;            // "101" "A棟203" など
  floor: number;
  rooms: string;           // "2LDK" "1K" など
  area: number;            // 専有面積 m²
  balconyArea?: number;    // バルコニー面積 m²
  price?: string;          // "4,500万円" など
  status: 'available' | 'reserved' | 'sold';
}

/** unitpicker: 区画・棟セレクターの1エントリ。 */
export interface UnitPickerEntry {
  id: string;
  label: string;           // "A棟" "38A" など
  area: number;            // 建物面積 m²
  siteArea?: number;       // 敷地面積 m²
  price?: string;
  status: 'available' | 'reserved' | 'sold';
  spec?: string;           // "木造2階建て" など
}

/** services: 事務所サービスカード1枚。 */
export interface ServiceCard {
  title: string;
  icon?: string;           // emoji
  body: string;
  tags?: string[];
}

/** assetRef の供給元子アプリ（内部コード）。 */
export type SiteAssetSourceApp =
  | '3dss' | '3dsl' | '3dsp' | '3dsc' | '3dsd' | '3dsr' | '3dsi' | '3dsf';

export type SiteAssetKind =
  | 'image' | 'video' | 'pdf' | 'slidedeck' | 'render' | 'embed3d';

/**
 * 子アプリ成果物への「参照」。実体はコピーせず、表示用に thumbnailUrl 等を
 * スナップショットとして持つ（S.Image の参照インデックス方式を踏襲）。
 */
export interface SiteAssetRef {
  id: string;                    // 安定キー（GalleryItem.id 等）
  sourceApp: SiteAssetSourceApp;
  assetId: string;               // 元ドキュメント ID
  kind: SiteAssetKind;
  title?: string;
  thumbnailUrl?: string | null;  // 表示用キャッシュ。公開時に実 URL へ再解決する
  videoUrl?: string | null;      // 動画素材（あれば <video> で再生。thumbnailUrl はポスター）
  placeholder?: boolean;         // ダミー枠（実素材が無い項目を視覚的に埋めるための仮配置）
  sample?: boolean;              // テンプレ用サンプル素材（完成像確認用。公開時は実素材に差し替える）
}

/** 誌面(エディトリアル)レイアウトの型。セクション種別ごとに取りうる値が異なる。 */
export type SiteSectionVariant =
  // hero（10）
  | 'hero-fullbleed' | 'hero-editorial' | 'hero-split' | 'hero-typographic'
  | 'hero-minimal' | 'hero-centered' | 'hero-left' | 'hero-card' | 'hero-duotone' | 'hero-stack'
  | 'hero-spec' | 'hero-3d' | 'hero-scroll3d'
  // text（10）
  | 'lead' | 'statement' | 'two-column' | 'quote'
  | 'three-column' | 'boxed' | 'centered-text' | 'display-text' | 'manifesto' | 'sidenote'
  // asset（12）
  | 'feature' | 'split' | 'duo' | 'mosaic' | 'filmstrip'
  | 'band' | 'masonry' | 'index-list' | 'overlap'
  | 'grid-3' | 'grid-4' | 'carousel'
  // structured（データ駆動セクションの装飾的見せ方・10）
  | 'st-plain' | 'st-center' | 'st-surface' | 'st-inverted' | 'st-boxed'
  | 'st-divided' | 'st-accent' | 'st-spacious' | 'st-rule' | 'st-quiet'
  // blog（ブログ記事一覧の見せ方・5）
  | 'blog-cards' | 'blog-list' | 'blog-magazine' | 'blog-minimal' | 'blog-bar';

export interface SiteSection {
  id: string;
  type: SiteSectionType;
  title?: string;
  kicker?: string;                        // キッカーテキスト（ヒーロー等の上部小見出し）
  layout: 'full' | 'split' | 'grid';      // 後方互換（旧グリッド指定）。新規は variant を使う。
  variant?: SiteSectionVariant;           // 誌面レイアウトの型
  assetRefs: SiteAssetRef[];
  body?: string;                 // 説明テキスト（手動 or 将来 AI 生成）
  hidden?: boolean;              // 公開対象から外す（下書き）
  // 構造化セクションの内容（提案書の部品）
  specRows?: SpecRow[];          // spec / regulation
  items?: ItemSpecRow[];         // itemspec
  callouts?: Callout[];          // zoning / flow / research の番号付き解説
  columns?: ComparisonColumn[];  // comparison
  chartType?: ChartType;         // target
  chartData?: ChartDatum[];      // target
  keywords?: string[];           // concept
  steps?: ProcessStep[];         // process
  mapQuery?: string;             // research（Google Map 埋め込みの検索クエリ/住所）
  references?: ReferenceItem[];  // references
  projectRef?: SiteProjectRef;   // projectlink
  embedUrl?: string | null;      // walkthrough（共有ウォークスルー等を iframe 埋め込み）
  scroll3dModelUrl?: string | null; // hero-scroll3d（スクロール連動3Dの glTF/glb URL。未指定でプロシージャル表示）
  worksScope?: 'my' | 'team' | 'all'; // works（My / Team / 全プロジェクトの絞り込み）
  units?: UnitRow[];             // unitlist
  unitEntries?: UnitPickerEntry[]; // unitpicker
  serviceCards?: ServiceCard[];  // services
  // 公開時に焼き込む解決済みデータ（Web の静的描画用。デスクトップの描画では読まない）
  resolvedWorks?: ResolvedWork[];      // works
  resolvedProfile?: ResolvedProfile;   // usergenres / usermodels / profilestats
  resolvedBlog?: ResolvedBlog;         // blog（公開時に焼き込む公開済み記事＋カテゴリ）
}

/** エディトリアルテーマの人格。配色・タイポ・既定 variant のセットを決める。 */
export type SiteThemePersonality = 'journal' | 'atelier' | 'gallery' | 'salon' | 'mono' | 'studio';

/**
 * スクロールモーションの強度モード（デザインの第 4 軸）。
 * 各人格に既定値を持たせ、ユーザーは motionOverride で明示変更できる。
 *   still        = 静止（アクセシビリティ/オプトアウト）
 *   subtle       = 控えめ（建築相応の既定。静かなフェード＋慣性スクロール）
 *   bold         = 大胆（大きめの立ち上がり）
 *   cinematic    = シネマティック（ヒーロー強パララックス＋画像 clip リビール）
 *   experimental = 変わり種（オプトインの攻めた演出）
 */
export type MotionMode = 'still' | 'subtle' | 'bold' | 'cinematic' | 'experimental';

/** プリセット適用時のテーマ上書き値（人格の既定値を部分的に差し替える）。 */
export interface SiteThemeOverrides {
  bg?: string;
  surface?: string;
  text?: string;
  subtext?: string;
  border?: string;
  displayFamily?: string;
  headingFamily?: string;
  bodyFamily?: string;
  headingWeight?: number;
  headingLetterSpacing?: string;
  airy?: number;
  heroOverlay?: boolean;
}

/**
 * サイト全体の構造レイアウト（第 5 の軸）。
 * スタイル（色・フォント）とは独立に「ナビ／ヘッダーの有無・コンテンツ幅」を決める。
 * スタイル(6) × レイアウト(8) × モーション(5) で約 240 のベース、
 * さらにセクション構成の掛け合わせで 1000+ パターンを表現する。
 *   editorial  = 左 ToC サイドバー＋エディトリアル幅（既定）
 *   minimal    = ナビなし・センタリング・余白多め
 *   magazine   = 上部固定ヘッダー＋フル幅セクション
 *   portfolio  = フルスクリーン没入＋フローティングミニナビ
 *   split      = 左ナビ＋右コンテンツ（editorial の変種）
 *   studio     = 上部バー＋フル幅（サイドバーなし）
 *   immersive  = ナビなしの完全没入
 *   grid       = 上部ヘッダー＋グリッド寄りのマガジン
 */
export type SiteLayoutMode =
  | 'editorial' | 'minimal' | 'magazine' | 'portfolio'
  | 'split' | 'studio' | 'immersive' | 'grid';

/** モーション実装に使うライブラリ（プリセットが配列で保持。複数併用可）。 */
export type SiteMotionLib = 'css' | 'gsap' | 'lenis' | 'threejs' | 'r3f' | 'drei' | 'framer' | 'animejs' | 'motionone';

export interface SiteTheme {
  accent: string;                // アクセントカラー
  mode: 'dark' | 'light';
  personality?: SiteThemePersonality;
  /** 人格の既定モーションを上書きする（未指定＝人格の既定）。「変わり種」スイッチ。 */
  motionOverride?: MotionMode;
  /** 最後に適用したプリセットの ID（参照用）。 */
  presetId?: string;
  /** プリセットや手動調整によるテーマ上書き値。 */
  overrides?: SiteThemeOverrides;
  /** サイト全体の構造レイアウト（未指定＝editorial）。 */
  layoutMode?: SiteLayoutMode;
  /** 適用中モーションプリセットの ID（参照用）。 */
  motionPresetId?: string;
  /** モーションプリセットが要求するライブラリ群（解決済み・参照用）。 */
  motionLibs?: SiteMotionLib[];
  /** 適用中レイアウトプリセットの ID（参照用）。 */
  layoutPresetId?: string;
}

export interface SitePublishState {
  status: 'draft' | 'published';
  slug: string;                  // sekkeiya.web.app/s/{slug}（Phase 2 で使用）
  visibility: 'public' | 'private';
  publishedAt?: string | null;
  lastDeployId?: string | null;
}

/** サイト内の 1 ページ。複数ページ構成の単位。 */
export interface SitePage {
  id: string;
  title: string;
  slug: string;
  sections: SiteSection[];
}

/** Project に 1:1 で紐づく最終成果物の実体。 */
export interface ProjectSite {
  projectId: string;
  templateFamily: SiteTemplateFamily;
  templateId: string;
  theme: SiteTheme;
  pages: SitePage[];             // 複数ページ構成（[0] がホーム）
  sections?: SiteSection[];      // 旧・単一ページ構成（移行用に残置。読み込み時 pages へ正規化）
  publish: SitePublishState;
  logoUrl?: string;              // サイトロゴ画像
  bannerUrl?: string;            // バナー / OGP 画像
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}
