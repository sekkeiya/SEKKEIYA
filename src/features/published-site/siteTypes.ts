// 公開サイトレンダラ用の型（デスクトップ src/features/projects/types.ts のサイト関連を抽出）。
// すべて type-only。esbuild で消えるので、利用側は必ず `import type` で参照する。

export type SiteTemplateFamily = 'proposal' | 'record' | 'portfolio';

export type SiteSectionType =
  | 'hero' | 'overview' | 'layout' | 'presentation' | 'walkthrough' | 'diagram'
  | 'drawing' | 'gallery' | 'portfolio' | 'spec' | 'research' | 'target'
  | 'regulation' | 'concept' | 'process' | 'references' | 'zoning' | 'flow'
  | 'itemspec' | 'comparison' | 'works' | 'projectlink' | 'usergenres'
  | 'usermodels' | 'profilestats' | 'custom';

export interface SiteProjectRef {
  projectId: string;
  name: string;
  cover?: string | null;
  team?: boolean;
  publishedSlug?: string | null;
}

export interface ResolvedWork {
  id: string;
  name: string;
  cover?: string | null;
  isTeam?: boolean;
  iconEmoji?: string | null;
  iconUrl?: string | null;
  publishedSlug?: string | null;
}

export interface ResolvedProfile {
  followers: number;
  following: number;
  models: { id: string; name: string; thumb?: string | null }[];
  genres: ChartDatum[];
  publishedProjectCount: number;
}

export interface SpecRow { label: string; value: string; }
export interface ItemSpecRow { name: string; spec?: string; qty?: string; }
export interface Callout { no: number; title: string; body: string; }
export interface ComparisonColumn { title: string; rows: string[]; }
export interface ChartDatum { label: string; value: number; }
export type ChartType = 'donut' | 'bar' | 'radar';
export interface ProcessStep { phase?: string; title: string; body?: string; }
export interface ReferenceItem { title: string; url?: string; }

export type SiteAssetSourceApp =
  | '3dss' | '3dsl' | '3dsp' | '3dsc' | '3dsd' | '3dsr' | '3dsi' | '3dsf';

export type SiteAssetKind =
  | 'image' | 'video' | 'pdf' | 'slidedeck' | 'render' | 'embed3d';

export interface SiteAssetRef {
  id: string;
  sourceApp: SiteAssetSourceApp;
  assetId: string;
  kind: SiteAssetKind;
  title?: string;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  placeholder?: boolean;
  sample?: boolean;
}

export type SiteSectionVariant =
  | 'hero-fullbleed' | 'hero-editorial' | 'hero-split' | 'hero-typographic'
  | 'lead' | 'statement' | 'two-column' | 'quote'
  | 'feature' | 'split' | 'duo' | 'mosaic' | 'filmstrip'
  | 'band' | 'masonry' | 'index-list' | 'overlap';

export interface SiteSection {
  id: string;
  type: SiteSectionType;
  title?: string;
  layout: 'full' | 'split' | 'grid';
  variant?: SiteSectionVariant;
  assetRefs: SiteAssetRef[];
  body?: string;
  hidden?: boolean;
  specRows?: SpecRow[];
  items?: ItemSpecRow[];
  callouts?: Callout[];
  columns?: ComparisonColumn[];
  chartType?: ChartType;
  chartData?: ChartDatum[];
  keywords?: string[];
  steps?: ProcessStep[];
  mapQuery?: string;
  references?: ReferenceItem[];
  projectRef?: SiteProjectRef;
  worksScope?: 'my' | 'team' | 'all';
  resolvedWorks?: ResolvedWork[];
  resolvedProfile?: ResolvedProfile;
}

export type SiteThemePersonality = 'journal' | 'atelier' | 'gallery' | 'salon' | 'mono' | 'studio';

export type MotionMode = 'still' | 'subtle' | 'bold' | 'cinematic' | 'experimental';

export interface SiteTheme {
  accent: string;
  mode: 'dark' | 'light';
  personality?: SiteThemePersonality;
  motionOverride?: MotionMode;
}

export interface SitePublishState {
  status: 'draft' | 'published';
  slug: string;
  visibility: 'public' | 'private';
  publishedAt?: string | null;
  lastDeployId?: string | null;
}

export interface SitePage {
  id: string;
  title: string;
  slug: string;
  sections: SiteSection[];
}

export interface ProjectSite {
  projectId: string;
  templateFamily: SiteTemplateFamily;
  templateId: string;
  theme: SiteTheme;
  pages: SitePage[];
  sections?: SiteSection[];
  publish: SitePublishState;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}
