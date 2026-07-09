import { create } from "zustand";
import * as THREE from "three";
import { structureFaceKeyOf, classifySurface, type SurfaceRect } from "./useMaterialFaceStore";
import { useEditorModeStore } from "./useEditorModeStore";

/** 矩形 surface から四角形の三角形配列（ワールド座標）を作る（tris が無い面の結合用）。 */
function quadTris(s: SurfaceRect): number[] {
  const c = new THREE.Vector3(s.center[0], s.center[1], s.center[2]);
  const u = new THREE.Vector3(s.uAxis[0], s.uAxis[1], s.uAxis[2]).normalize().multiplyScalar((s.width || 0) / 2);
  const v = new THREE.Vector3(s.vAxis[0], s.vAxis[1], s.vAxis[2]).normalize().multiplyScalar((s.height || 0) / 2);
  const p00 = c.clone().sub(u).sub(v);
  const p10 = c.clone().add(u).sub(v);
  const p11 = c.clone().add(u).add(v);
  const p01 = c.clone().sub(u).add(v);
  return [p00, p10, p11, p00, p11, p01].flatMap((p) => [p.x, p.y, p.z]);
}

/** 複数の面 surface を1枚の面 surface に統合する（面積加重の平均法線＋全頂点のバウンディング）。 */
function mergeSurfaces(surfaces: SurfaceRect[]): SurfaceRect | null {
  if (!surfaces.length) return null;
  const n = new THREE.Vector3();
  for (const s of surfaces) {
    const w = Math.max(1e-6, (s.width || 1) * (s.height || 1));
    n.addScaledVector(new THREE.Vector3(s.normal[0], s.normal[1], s.normal[2]).normalize(), w);
  }
  if (n.lengthSq() < 1e-9) n.set(surfaces[0].normal[0], surfaces[0].normal[1], surfaces[0].normal[2]);
  n.normalize();

  const tris: number[] = [];
  for (const s of surfaces) {
    if (Array.isArray((s as any).tris) && (s as any).tris.length >= 9) tris.push(...(s as any).tris);
    else tris.push(...quadTris(s));
  }
  const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const uAxis = new THREE.Vector3().crossVectors(up, n).normalize();
  const vAxis = new THREE.Vector3().crossVectors(n, uAxis).normalize();
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity, dSum = 0, vc = 0;
  const tmp = new THREE.Vector3();
  for (let i = 0; i + 2 < tris.length; i += 3) {
    tmp.set(tris[i], tris[i + 1], tris[i + 2]);
    const u = tmp.dot(uAxis), w = tmp.dot(vAxis), d = tmp.dot(n);
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (w < minV) minV = w; if (w > maxV) maxV = w;
    dSum += d; vc++;
  }
  if (!vc || !isFinite(minU)) return null;
  const d = dSum / vc;
  const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  const center = new THREE.Vector3().addScaledVector(n, d).addScaledVector(uAxis, cu).addScaledVector(vAxis, cv);
  return {
    center: [center.x, center.y, center.z],
    normal: [n.x, n.y, n.z],
    uAxis: [uAxis.x, uAxis.y, uAxis.z],
    vAxis: [vAxis.x, vAxis.y, vAxis.z],
    width: maxU - minU,
    height: maxV - minV,
    tris,
  } as SurfaceRect;
}

/**
 * 躯体面の意味ラベル。Material の見た目とは別に、構造的な役割を持たせる。
 *   - floor: 床（既定でコリジョン=歩行面）
 *   - inner_wall / outer_wall: 内壁 / 外壁（自動マテリアルの出し分けに使用）
 *   - ceiling: 天井
 */
export type StructureSemantic = "floor" | "outer_floor" | "inner_wall" | "outer_wall" | "ceiling" | "roof";

export const STRUCTURE_LABEL_JP: Record<StructureSemantic, string> = {
  floor: "床",
  outer_floor: "外床",
  inner_wall: "内壁",
  outer_wall: "外壁",
  ceiling: "天井",
  roof: "屋根",
};

export const STRUCTURE_COLOR: Record<StructureSemantic, string> = {
  floor: "#4fc3f7",
  outer_floor: "#22d3ee",
  inner_wall: "#ec407a",
  outer_wall: "#fb923c",
  ceiling: "#facc15",
  roof: "#a16207",
};

/** classifySurface（floor/ceiling/wall）→ 既定セマンティクス。壁は内壁を既定にする。 */
export function defaultSemantic(surfaceType: "floor" | "ceiling" | "wall"): StructureSemantic {
  return surfaceType === "wall" ? "inner_wall" : surfaceType;
}

export interface StructureLabel {
  semantic: StructureSemantic;
  /** 当たり判定（コリジョン）を生成するか。 */
  collision: boolean;
  /** コリジョン板／ハイライト生成用の面矩形。 */
  surface: SurfaceRect;
  /** 自動割当された階（1=1F, 2=2F, ...）。未割当は undefined。 */
  story?: number;
}

/** クリックで拾った面（ラベル付与前の一時選択）。 */
export interface PickedFace {
  key: string;
  surface: SurfaceRect;
  normalY: number;
  autoSemantic: StructureSemantic;
}

interface StructureLabelState {
  /** 確定ラベル: surfaceKey -> ラベル。 */
  labels: Record<string, StructureLabel>;
  /** 一時選択（複数）: surfaceKey -> 拾った面。 */
  selection: Record<string, PickedFace>;
  /** コリジョン再構築のトリガ（labels が変わるたびに +1）。 */
  rev: number;

  /** ラベル種別ごとの表示/非表示（オーバーレイ＆面上バッジ）。ビュー設定なので全 Base 共通。 */
  labelVisible: Record<StructureSemantic, boolean>;
  setLabelVisible: (sem: StructureSemantic, v: boolean) => void;
  toggleLabelVisible: (sem: StructureSemantic) => void;
  /** 全ラベル種別の表示/非表示を一括設定。 */
  setAllLabelVisible: (v: boolean) => void;

  /** Base ごとのラベル保管（baseId -> labels）。Base が違えば独立。 */
  byBase: Record<string, Record<string, StructureLabel>>;
  /** 現在アクティブな Base の識別子（GLB URL 等）。 */
  activeBaseId: string | null;
  /** アクティブ Base を切り替える（現在のラベルを退避し、対象 Base のラベルを読み込む）。 */
  setActiveBase: (baseId: string | null) => void;

  toggleSelect: (face: PickedFace) => void;
  /** 単独選択（従来の選択を解除してこの面だけ選ぶ）。 */
  selectOnly: (face: PickedFace) => void;
  /** 複数面を一括選択（従来の選択を置き換える）。Ctrl+A の全選択に使用。 */
  selectMany: (faces: PickedFace[]) => void;
  clearSelection: () => void;
  /** 選択中の全面へラベルを付与/更新（semantic か collision のいずれか/両方）。 */
  applyToSelection: (patch: { semantic?: StructureSemantic; collision?: boolean }) => void;
  /** 選択中の複数面を1枚の面に結合する（ラベルも統合）。 */
  mergeSelection: () => void;
  /** 選択中の面のラベルを削除。 */
  removeSelectedLabels: () => void;
  removeLabel: (key: string) => void;
  clearAll: () => void;
  /** 自動ラベリング等で複数ラベルを一括マージ（既存ラベルは上書き）。 */
  mergeLabels: (labels: Record<string, StructureLabel>) => void;
  /** 永続層から一括ロード。 */
  replaceAll: (labels: Record<string, StructureLabel>) => void;
}

export const useStructureLabelStore = create<StructureLabelState>((set) => ({
  labels: {},
  selection: {},
  rev: 0,
  labelVisible: { floor: true, outer_floor: true, inner_wall: true, outer_wall: true, ceiling: true, roof: true },
  setLabelVisible: (sem, v) => set((s) => ({ labelVisible: { ...s.labelVisible, [sem]: v } })),
  toggleLabelVisible: (sem) => set((s) => ({ labelVisible: { ...s.labelVisible, [sem]: !s.labelVisible[sem] } })),
  setAllLabelVisible: (v) => set({
    labelVisible: { floor: v, outer_floor: v, inner_wall: v, outer_wall: v, ceiling: v, roof: v },
  }),
  byBase: {},
  activeBaseId: null,

  setActiveBase: (baseId) => set((s) => {
    if (baseId === s.activeBaseId) return {};
    const byBase = { ...s.byBase };
    // 現在のラベルを退避
    if (s.activeBaseId != null) byBase[s.activeBaseId] = s.labels;
    // 対象 Base のラベルを読み込み（無ければ空）。Base が違えば独立。
    const labels = (baseId != null ? byBase[baseId] : undefined) || {};
    return { byBase, activeBaseId: baseId, labels, selection: {}, rev: s.rev + 1 };
  }),

  toggleSelect: (face) => set((s) => {
    const selection = { ...s.selection };
    if (selection[face.key]) delete selection[face.key];
    else selection[face.key] = face;
    return { selection };
  }),
  selectOnly: (face) => set({ selection: { [face.key]: face } }),
  selectMany: (faces) => set(() => {
    const selection: Record<string, PickedFace> = {};
    for (const f of faces || []) if (f?.key) selection[f.key] = f;
    return { selection };
  }),
  clearSelection: () => set({ selection: {} }),

  applyToSelection: (patch) => set((s) => {
    const labels = { ...s.labels };
    for (const key of Object.keys(s.selection)) {
      const f = s.selection[key];
      const prev = labels[key];
      const semantic = patch.semantic ?? prev?.semantic ?? f.autoSemantic;
      const collision = patch.collision ?? prev?.collision ?? (semantic === "floor");
      labels[key] = { semantic, collision, surface: f.surface };
    }
    return { labels, rev: s.rev + 1 };
  }),

  mergeSelection: () => set((s) => {
    const keys = Object.keys(s.selection);
    if (keys.length < 2) return s;
    const faces = keys.map((k) => s.selection[k]).filter((f) => f?.surface);
    const surfaces = faces.map((f) => f.surface);
    if (surfaces.length < 2) return s;
    const merged = mergeSurfaces(surfaces);
    if (!merged) return s;

    // セマンティクス＝選択面の既存ラベルの多数決（無ければ法線分類）。collision=どれか true。story=最小。
    const semCount: Partial<Record<StructureSemantic, number>> = {};
    let anyCollision = false;
    let minStory: number | undefined;
    let hadLabel = false;
    for (const k of keys) {
      const lab = s.labels[k];
      if (!lab) continue;
      hadLabel = true;
      semCount[lab.semantic] = (semCount[lab.semantic] || 0) + 1;
      if (lab.collision) anyCollision = true;
      if (lab.story != null) minStory = minStory == null ? lab.story : Math.min(minStory, lab.story);
    }
    let semantic: StructureSemantic;
    const entries = Object.entries(semCount) as [StructureSemantic, number][];
    if (entries.length) semantic = entries.sort((a, b) => b[1] - a[1])[0][0];
    else semantic = defaultSemantic(classifySurface(merged.normal[1]));
    const collision = hadLabel ? anyCollision : semantic !== "ceiling";

    const upm = (useEditorModeStore.getState().sceneMaxY || 0) > 100 ? 1000 : 1;
    const mergedKey = structureFaceKeyOf(merged.normal, merged.center, upm);
    const labels = { ...s.labels };
    for (const k of keys) delete labels[k];
    labels[mergedKey] = { semantic, collision, surface: merged, ...(minStory != null ? { story: minStory } : {}) };
    const picked: PickedFace = { key: mergedKey, surface: merged, normalY: merged.normal[1], autoSemantic: semantic };
    return { labels, selection: { [mergedKey]: picked }, rev: s.rev + 1 };
  }),

  removeSelectedLabels: () => set((s) => {
    const labels = { ...s.labels };
    for (const key of Object.keys(s.selection)) delete labels[key];
    return { labels, rev: s.rev + 1 };
  }),
  removeLabel: (key) => set((s) => {
    const labels = { ...s.labels };
    delete labels[key];
    return { labels, rev: s.rev + 1 };
  }),
  clearAll: () => set((s) => ({ labels: {}, selection: {}, rev: s.rev + 1 })),
  mergeLabels: (incoming) => set((s) => ({ labels: { ...s.labels, ...incoming }, rev: s.rev + 1 })),
  replaceAll: (labels) => set((s) => ({ labels, rev: s.rev + 1 })),
}));
