// diagram-spec ↔ useDsdStore ブリッジ。
// 設計核心（docs/12 §0）: diagram-spec は useDsdStore.loadState() ペイロードと同型。
// 別フォーマットを作らず、保存ドキュメント(DsdSerializableState)をそのまま spec として扱う。

import { useDsdStore } from '../store/useDsdStore';
import type { DsdSerializableState } from '../library/dsdDiagramService';

export type DiagramTemplate = 'sun' | 'layout' | 'site' | 'env' | 'massing';
/** diagram-spec = DsdSerializableState の部分集合（loadState 対象フィールド）。 */
export type DiagramSpec = Partial<DsdSerializableState> & { currentTemplate?: string };

// useDsdStore の既定値に揃えた、新規ダイアグラムの初期 state。
export function defaultDiagramState(template: DiagramTemplate, title?: string): DsdSerializableState {
  return {
    currentTemplate: template === 'massing' ? 'layout' : template, // massing は当面 layout シェルに同居
    diagramTitle: title ?? '新規ダイアグラム',
    style: 'clean',
    // Building shape
    presetShape: 'rectangle',
    customPolygon: [],
    buildingWidth: 12,
    buildingDepth: 8,
    buildingHeight: 6,
    northAngle: 0,
    // Sun / time
    month: 6,
    timeHour: 12,
    latitude: 35.7,
    // Layout
    layoutMode: 'zoning',
    zones: [],
    flows: [],
    // Site
    siteBoundaryW: 20,
    siteBoundaryH: 15,
    siteNorthAngle: 0,
    siteElements: [],
    siteAccesses: [],
    // Environment
    windDirection: 225,
    windSpeed: 3,
    envLayer: 'wind',
    noiseSources: [
      { id: 'road', type: 'road', label: '前面道路', lx: 0, ly: -22, level: 4, enabled: true },
      { id: 'neighbor_e', type: 'neighbor', label: '隣家(東)', lx: 16, ly: 0, level: 2, enabled: false },
      { id: 'neighbor_w', type: 'neighbor', label: '隣家(西)', lx: -16, ly: 0, level: 2, enabled: false },
      { id: 'park', type: 'park', label: '公園', lx: 0, ly: 22, level: 1, enabled: false },
    ],
    thermalSeason: 'summer',
    windViewCx: 0,
    windViewCy: 0,
    windViewW: 80,
    windViewH: 64,
    // Annotations
    annotations: [],
  };
}

// 現在の useDsdStore を保存用 DsdSerializableState にシリアライズ。
export function storeToSerializable(): DsdSerializableState {
  const s = useDsdStore.getState();
  return {
    currentTemplate: s.currentTemplate,
    diagramTitle: s.diagramTitle,
    style: s.style,
    presetShape: s.presetShape,
    customPolygon: s.customPolygon,
    buildingWidth: s.buildingWidth,
    buildingDepth: s.buildingDepth,
    buildingHeight: s.buildingHeight,
    northAngle: s.northAngle,
    month: s.month,
    timeHour: s.timeHour,
    latitude: s.latitude,
    layoutMode: s.layoutMode,
    zones: s.zones,
    flows: s.flows,
    siteBoundaryW: s.siteBoundaryW,
    siteBoundaryH: s.siteBoundaryH,
    siteNorthAngle: s.siteNorthAngle,
    siteElements: s.siteElements,
    siteAccesses: s.siteAccesses,
    windDirection: s.windDirection,
    windSpeed: s.windSpeed,
    envLayer: s.envLayer,
    noiseSources: s.noiseSources,
    thermalSeason: s.thermalSeason,
    windViewCx: s.windViewCx,
    windViewCy: s.windViewCy,
    windViewW: s.windViewW,
    windViewH: s.windViewH,
    annotations: s.annotations,
  };
}

// spec（完全 or 部分）を canvas（useDsdStore）に即時反映。
export function applySpecToStore(spec: DiagramSpec): void {
  useDsdStore.getState().loadState(spec as any);
}

// 部分パッチを現在の state にマージして反映（既存編集 = フロー2）。
export function patchStore(patch: DiagramSpec): DsdSerializableState {
  const merged = { ...storeToSerializable(), ...patch } as DsdSerializableState;
  applySpecToStore(merged as DiagramSpec);
  return merged;
}
