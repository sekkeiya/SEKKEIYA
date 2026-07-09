import { create } from 'zustand';

export type DsdStyle = 'clean' | 'bold' | 'dark';
export type DsdTemplate = 'sun' | 'layout' | 'site' | 'env';
export type PresetShape = 'rectangle' | 'lShape' | 'uShape' | 'custom';
export type DsdEditorTab = 'shape' | 'sun' | 'style' | 'annotate';
export type AnnotationColor = '#ffffff' | '#ffd740' | '#aed581' | '#ff9800';
export type AnnotationTool = 'none' | 'text' | 'arrow';
export type EnvEditorTab = 'building' | 'env' | 'style' | 'annotate';
export type EnvLayer = 'wind' | 'noise' | 'thermal';
export type NoiseSourceType = 'road' | 'neighbor' | 'park' | 'railway';

export interface NoiseSource {
  id: string;
  type: NoiseSourceType;
  label: string;
  lx: number;
  ly: number;
  level: number;
  enabled: boolean;
}

// ─── Site diagram types ─────────────────────────────────────────────────────
export type SiteElementType = 'road' | 'building' | 'green' | 'water' | 'parking' | 'plaza';
export type SiteAccessType = 'pedestrian' | 'vehicle' | 'transit' | 'bicycle';
export type SiteEditorTab = 'site' | 'context' | 'access' | 'style' | 'annotate';
export type SiteTool = 'none' | 'addElement' | 'addAccess';
export type SiteAccessDir = 'n' | 's' | 'e' | 'w';

export interface SiteElement {
  id: string;
  type: SiteElementType;
  label: string;
  cx: number; cy: number;
  w: number; h: number;
}

export interface SiteAccess {
  id: string;
  type: SiteAccessType;
  label: string;
  dir: SiteAccessDir;
  offset: number;
}

// ─── Layout diagram types ───────────────────────────────────────────────────
export type LayoutMode = 'zoning' | 'bubble';
export type LayoutEditorTab = 'zones' | 'flow' | 'style' | 'annotate';
export type LayoutTool = 'none' | 'addZone' | 'flow';
export type ZoneCategory =
  | 'ldk' | 'bedroom' | 'water' | 'entry'
  | 'work' | 'storage' | 'outdoor' | 'other';

export interface LayoutZone {
  id: string;
  category: ZoneCategory;
  label: string;
  // Logical coords (meters from canvas center). Bounding rect; bubble mode renders an inscribed circle.
  cx: number; cy: number;
  w: number;  h: number;
}

export interface LayoutFlow {
  id: string;
  fromZoneId: string;
  toZoneId: string;
}

export type TextAnnotation = {
  id: string; type: 'text';
  lx: number; ly: number;
  text: string;
  color: AnnotationColor;
  fontSize: number;
};
export type ArrowAnnotation = {
  id: string; type: 'arrow';
  lx1: number; ly1: number;
  lx2: number; ly2: number;
  color: AnnotationColor;
};
export type Annotation = TextAnnotation | ArrowAnnotation;

export interface DsdState {
  // Building shape
  presetShape: PresetShape;
  setPresetShape: (shape: PresetShape) => void;
  customPolygon: [number, number][];
  setCustomPolygon: (polygon: [number, number][]) => void;
  buildingWidth: number;
  setBuildingWidth: (w: number) => void;
  buildingDepth: number;
  setBuildingDepth: (d: number) => void;
  buildingHeight: number;
  setBuildingHeight: (h: number) => void;
  northAngle: number;
  setNorthAngle: (angle: number) => void;

  // Sun / time
  month: number;
  setMonth: (month: number) => void;
  timeHour: number;
  setTimeHour: (hour: number) => void;
  latitude: number;
  setLatitude: (lat: number) => void;
  isAnimating: boolean;
  setIsAnimating: (v: boolean) => void;

  // Drawing mode
  isDrawingPolygon: boolean;
  setIsDrawingPolygon: (v: boolean) => void;
  draftPolygon: [number, number][];
  setDraftPolygon: (pts: [number, number][]) => void;

  // Style
  style: DsdStyle;
  setStyle: (style: DsdStyle) => void;

  // Diagram title
  diagramTitle: string;
  setDiagramTitle: (title: string) => void;

  // Currently active template in the editor shell ('sun' | 'layout')
  currentTemplate: DsdTemplate;
  setCurrentTemplate: (t: DsdTemplate) => void;

  // Editor dock tab
  editorTab: DsdEditorTab;
  setEditorTab: (tab: DsdEditorTab) => void;

  // ─── Layout (なぜこの配置に？) state ───
  layoutMode: LayoutMode;
  setLayoutMode: (m: LayoutMode) => void;
  layoutEditorTab: LayoutEditorTab;
  setLayoutEditorTab: (t: LayoutEditorTab) => void;
  layoutTool: LayoutTool;
  setLayoutTool: (t: LayoutTool) => void;
  layoutCategory: ZoneCategory;
  setLayoutCategory: (c: ZoneCategory) => void;
  zones: LayoutZone[];
  addZone: (z: LayoutZone) => void;
  updateZone: (id: string, patch: Partial<Omit<LayoutZone, 'id'>>) => void;
  removeZone: (id: string) => void;
  clearZones: () => void;
  selectedZoneId: string | null;
  setSelectedZoneId: (id: string | null) => void;
  flows: LayoutFlow[];
  addFlow: (f: LayoutFlow) => void;
  removeFlow: (id: string) => void;
  clearFlows: () => void;
  selectedFlowId: string | null;
  setSelectedFlowId: (id: string | null) => void;
  isLayoutAnimating: boolean;
  setIsLayoutAnimating: (v: boolean) => void;
  flowDraftFromId: string | null;
  setFlowDraftFromId: (id: string | null) => void;

  // ─── Site (なぜこの場所に？) state ───
  siteBoundaryW: number;
  setSiteBoundaryW: (w: number) => void;
  siteBoundaryH: number;
  setSiteBoundaryH: (h: number) => void;
  siteNorthAngle: number;
  setSiteNorthAngle: (a: number) => void;
  siteElements: SiteElement[];
  addSiteElement: (e: SiteElement) => void;
  updateSiteElement: (id: string, patch: Partial<Omit<SiteElement, 'id'>>) => void;
  removeSiteElement: (id: string) => void;
  clearSiteElements: () => void;
  selectedSiteElementId: string | null;
  setSelectedSiteElementId: (id: string | null) => void;
  siteAccesses: SiteAccess[];
  addSiteAccess: (a: SiteAccess) => void;
  removeSiteAccess: (id: string) => void;
  clearSiteAccesses: () => void;
  selectedSiteAccessId: string | null;
  setSelectedSiteAccessId: (id: string | null) => void;
  siteEditorTab: SiteEditorTab;
  setSiteEditorTab: (t: SiteEditorTab) => void;
  siteTool: SiteTool;
  setSiteTool: (t: SiteTool) => void;
  siteElementType: SiteElementType;
  setSiteElementType: (t: SiteElementType) => void;
  siteAccessType: SiteAccessType;
  setSiteAccessType: (t: SiteAccessType) => void;
  isSiteAnimating: boolean;
  setIsSiteAnimating: (v: boolean) => void;

  // ─── Environment (環境はどうか？) state ───
  windDirection: number;
  setWindDirection: (d: number) => void;
  windSpeed: number;
  setWindSpeed: (s: number) => void;
  isEnvAnimating: boolean;
  setIsEnvAnimating: (v: boolean) => void;
  envLayer: EnvLayer;
  setEnvLayer: (l: EnvLayer) => void;
  envEditorTab: EnvEditorTab;
  setEnvEditorTab: (t: EnvEditorTab) => void;
  noiseSources: NoiseSource[];
  setNoiseSourceEnabled: (id: string, enabled: boolean) => void;
  setNoiseSourceLevel: (id: string, level: number) => void;
  setNoiseSourcePosition: (id: string, lx: number, ly: number) => void;
  selectedNoiseSourceId: string | null;
  setSelectedNoiseSourceId: (id: string | null) => void;
  thermalSeason: 'summer' | 'winter';
  setThermalSeason: (s: 'summer' | 'winter') => void;

  // Wind view (interactive bounding box for wind streamlines)
  windViewCx: number;
  windViewCy: number;
  windViewW: number;
  windViewH: number;
  setWindView: (cx: number, cy: number, w: number, h: number) => void;
  isWindViewSelected: boolean;
  setIsWindViewSelected: (v: boolean) => void;

  // Annotations
  annotations: Annotation[];
  addAnnotation: (a: Annotation) => void;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, patch: Partial<Omit<Annotation, 'id' | 'type'>>) => void;
  clearAnnotations: () => void;
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;
  annotationTool: AnnotationTool;
  setAnnotationTool: (t: AnnotationTool) => void;
  annotationColor: AnnotationColor;
  setAnnotationColor: (c: AnnotationColor) => void;

  // Bulk load saved state (from Firestore)
  loadState: (partial: Partial<Pick<DsdState,
    | 'currentTemplate' | 'diagramTitle' | 'style'
    | 'presetShape' | 'customPolygon'
    | 'buildingWidth' | 'buildingDepth' | 'buildingHeight' | 'northAngle'
    | 'month' | 'timeHour' | 'latitude'
    | 'layoutMode' | 'zones' | 'flows'
    | 'siteBoundaryW' | 'siteBoundaryH' | 'siteNorthAngle' | 'siteElements' | 'siteAccesses'
    | 'windDirection' | 'windSpeed' | 'envLayer' | 'noiseSources' | 'thermalSeason'
    | 'windViewCx' | 'windViewCy' | 'windViewW' | 'windViewH'
    | 'annotations'
  >>) => void;

  /** 保存完了のたびに +1。タブの「作業中」ドットの基準スナップショット更新トリガに使う。 */
  savedTick: number;
  bumpSavedTick: () => void;

  /**
   * 未保存ダイアグラムの作業状態を diagramId 単位で退避するメモリキャッシュ。
   * fields = loadState 対象フィールド、baseline = 保存版のスナップショット文字列。
   * 画面/ダイアグラム切替で loadState が上書きしても作業中状態を失わないために使う。
   */
  sessionCache: Record<string, { fields: Record<string, any>; baseline: string }>;
  setDsdSession: (key: string, value: { fields: Record<string, any>; baseline: string } | null) => void;
}

export const useDsdStore = create<DsdState>((set) => ({
  savedTick: 0,
  bumpSavedTick: () => set((s) => ({ savedTick: s.savedTick + 1 })),
  sessionCache: {},
  setDsdSession: (key, value) => set((s) => {
    const next = { ...s.sessionCache };
    if (value) next[key] = value; else delete next[key];
    return { sessionCache: next };
  }),
  presetShape: 'rectangle',
  setPresetShape: (presetShape) => set({ presetShape }),
  customPolygon: [],
  setCustomPolygon: (customPolygon) => set({ customPolygon }),
  buildingWidth: 12,
  setBuildingWidth: (buildingWidth) => set({ buildingWidth }),
  buildingDepth: 8,
  setBuildingDepth: (buildingDepth) => set({ buildingDepth }),
  buildingHeight: 6,
  setBuildingHeight: (buildingHeight) => set({ buildingHeight }),
  northAngle: 0,
  setNorthAngle: (northAngle) => set({ northAngle }),

  month: 6,
  setMonth: (month) => set({ month }),
  timeHour: 12,
  setTimeHour: (timeHour) => set({ timeHour }),
  latitude: 35.7,
  setLatitude: (latitude) => set({ latitude }),
  isAnimating: false,
  setIsAnimating: (isAnimating) => set({ isAnimating }),

  isDrawingPolygon: false,
  setIsDrawingPolygon: (isDrawingPolygon) => set({ isDrawingPolygon }),
  draftPolygon: [],
  setDraftPolygon: (draftPolygon) => set({ draftPolygon }),

  style: 'clean',
  setStyle: (style) => set({ style }),

  diagramTitle: '日照・環境ダイアグラム',
  setDiagramTitle: (diagramTitle) => set({ diagramTitle }),

  currentTemplate: 'sun',
  setCurrentTemplate: (currentTemplate) => set({ currentTemplate }),

  editorTab: 'shape',
  setEditorTab: (editorTab) => set({ editorTab }),

  // ─── Layout defaults ───
  layoutMode: 'zoning',
  setLayoutMode: (layoutMode) => set({ layoutMode, selectedZoneId: null, selectedFlowId: null, flowDraftFromId: null }),
  layoutEditorTab: 'zones',
  setLayoutEditorTab: (layoutEditorTab) => set({ layoutEditorTab }),
  layoutTool: 'none',
  setLayoutTool: (layoutTool) => set({ layoutTool, flowDraftFromId: null, selectedZoneId: null, selectedFlowId: null }),
  layoutCategory: 'ldk',
  setLayoutCategory: (layoutCategory) => set({ layoutCategory }),
  zones: [],
  addZone: (z) => set((s) => ({ zones: [...s.zones, z] })),
  updateZone: (id, patch) => set((s) => ({
    zones: s.zones.map(z => z.id === id ? { ...z, ...patch } : z),
  })),
  removeZone: (id) => set((s) => ({
    zones: s.zones.filter(z => z.id !== id),
    flows: s.flows.filter(f => f.fromZoneId !== id && f.toZoneId !== id),
    selectedZoneId: s.selectedZoneId === id ? null : s.selectedZoneId,
    flowDraftFromId: s.flowDraftFromId === id ? null : s.flowDraftFromId,
  })),
  clearZones: () => set({ zones: [], flows: [], selectedZoneId: null, selectedFlowId: null, flowDraftFromId: null }),
  selectedZoneId: null,
  setSelectedZoneId: (selectedZoneId) => set({ selectedZoneId }),
  flows: [],
  addFlow: (f) => set((s) => ({ flows: [...s.flows, f] })),
  removeFlow: (id) => set((s) => ({
    flows: s.flows.filter(f => f.id !== id),
    selectedFlowId: s.selectedFlowId === id ? null : s.selectedFlowId,
  })),
  clearFlows: () => set({ flows: [], selectedFlowId: null }),
  selectedFlowId: null,
  setSelectedFlowId: (selectedFlowId) => set({ selectedFlowId }),
  isLayoutAnimating: false,
  setIsLayoutAnimating: (isLayoutAnimating) => set({ isLayoutAnimating }),
  flowDraftFromId: null,
  setFlowDraftFromId: (flowDraftFromId) => set({ flowDraftFromId }),

  // ─── Site defaults ───
  siteBoundaryW: 20,
  setSiteBoundaryW: (siteBoundaryW) => set({ siteBoundaryW }),
  siteBoundaryH: 15,
  setSiteBoundaryH: (siteBoundaryH) => set({ siteBoundaryH }),
  siteNorthAngle: 0,
  setSiteNorthAngle: (siteNorthAngle) => set({ siteNorthAngle }),
  siteElements: [],
  addSiteElement: (e) => set((s) => ({ siteElements: [...s.siteElements, e] })),
  updateSiteElement: (id, patch) => set((s) => ({
    siteElements: s.siteElements.map(el => el.id === id ? { ...el, ...patch } : el),
  })),
  removeSiteElement: (id) => set((s) => ({
    siteElements: s.siteElements.filter(el => el.id !== id),
    selectedSiteElementId: s.selectedSiteElementId === id ? null : s.selectedSiteElementId,
  })),
  clearSiteElements: () => set({ siteElements: [], selectedSiteElementId: null }),
  selectedSiteElementId: null,
  setSelectedSiteElementId: (selectedSiteElementId) => set({ selectedSiteElementId }),
  siteAccesses: [],
  addSiteAccess: (a) => set((s) => ({ siteAccesses: [...s.siteAccesses, a] })),
  removeSiteAccess: (id) => set((s) => ({
    siteAccesses: s.siteAccesses.filter(a => a.id !== id),
    selectedSiteAccessId: s.selectedSiteAccessId === id ? null : s.selectedSiteAccessId,
  })),
  clearSiteAccesses: () => set({ siteAccesses: [], selectedSiteAccessId: null }),
  selectedSiteAccessId: null,
  setSelectedSiteAccessId: (selectedSiteAccessId) => set({ selectedSiteAccessId }),
  siteEditorTab: 'site',
  setSiteEditorTab: (siteEditorTab) => set({ siteEditorTab }),
  siteTool: 'none',
  setSiteTool: (siteTool) => set({ siteTool, selectedSiteElementId: null }),
  siteElementType: 'road',
  setSiteElementType: (siteElementType) => set({ siteElementType }),
  siteAccessType: 'pedestrian',
  setSiteAccessType: (siteAccessType) => set({ siteAccessType }),
  isSiteAnimating: false,
  setIsSiteAnimating: (isSiteAnimating) => set({ isSiteAnimating }),

  // ─── Environment defaults ───
  windDirection: 225,
  setWindDirection: (windDirection) => set({ windDirection }),
  windSpeed: 3,
  setWindSpeed: (windSpeed) => set({ windSpeed }),
  isEnvAnimating: true,
  setIsEnvAnimating: (isEnvAnimating) => set({ isEnvAnimating }),
  envLayer: 'wind',
  setEnvLayer: (envLayer) => set({ envLayer }),
  envEditorTab: 'building',
  setEnvEditorTab: (envEditorTab) => set({ envEditorTab }),
  noiseSources: [
    { id: 'road',       type: 'road',     label: '前面道路', lx:   0, ly: -22, level: 4, enabled: true  },
    { id: 'neighbor_e', type: 'neighbor', label: '隣家(東)', lx:  16, ly:   0, level: 2, enabled: false },
    { id: 'neighbor_w', type: 'neighbor', label: '隣家(西)', lx: -16, ly:   0, level: 2, enabled: false },
    { id: 'park',       type: 'park',     label: '公園',     lx:   0, ly:  22, level: 1, enabled: false },
  ],
  setNoiseSourceEnabled: (id, enabled) => set((s) => ({
    noiseSources: s.noiseSources.map(n => n.id === id ? { ...n, enabled } : n),
  })),
  setNoiseSourceLevel: (id, level) => set((s) => ({
    noiseSources: s.noiseSources.map(n => n.id === id ? { ...n, level } : n),
  })),
  setNoiseSourcePosition: (id, lx, ly) => set((s) => ({
    noiseSources: s.noiseSources.map(n => n.id === id ? { ...n, lx, ly } : n),
  })),
  selectedNoiseSourceId: null,
  setSelectedNoiseSourceId: (selectedNoiseSourceId) => set({ selectedNoiseSourceId }),
  thermalSeason: 'summer',
  setThermalSeason: (thermalSeason) => set({ thermalSeason }),

  windViewCx: 0,
  windViewCy: 0,
  windViewW: 80,
  windViewH: 64,
  setWindView: (windViewCx, windViewCy, windViewW, windViewH) => set({ windViewCx, windViewCy, windViewW, windViewH }),
  isWindViewSelected: false,
  setIsWindViewSelected: (isWindViewSelected) => set({ isWindViewSelected }),

  annotations: [],
  addAnnotation: (a) => set((s) => ({ annotations: [...s.annotations, a] })),
  removeAnnotation: (id) => set((s) => ({
    annotations: s.annotations.filter(a => a.id !== id),
    selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
  })),
  updateAnnotation: (id, patch) => set((s) => ({
    annotations: s.annotations.map(a => a.id === id ? ({ ...a, ...patch } as Annotation) : a),
  })),
  clearAnnotations: () => set({ annotations: [], selectedAnnotationId: null }),
  selectedAnnotationId: null,
  setSelectedAnnotationId: (selectedAnnotationId) => set({ selectedAnnotationId }),
  annotationTool: 'none',
  setAnnotationTool: (annotationTool) => set({ annotationTool, selectedAnnotationId: null }),
  annotationColor: '#ffffff',
  setAnnotationColor: (annotationColor) => set({ annotationColor }),

  loadState: (partial) => set((s) => ({
    ...s,
    ...partial,
    // Reset UI-only state on load
    selectedZoneId: null,
    selectedFlowId: null,
    flowDraftFromId: null,
    selectedSiteElementId: null,
    selectedSiteAccessId: null,
    selectedAnnotationId: null,
    isAnimating: false,
    isLayoutAnimating: false,
    isSiteAnimating: false,
    isEnvAnimating: false,
    isDrawingPolygon: false,
    draftPolygon: [],
    layoutTool: 'none',
    siteTool: 'none',
    annotationTool: 'none',
  })),
}));
