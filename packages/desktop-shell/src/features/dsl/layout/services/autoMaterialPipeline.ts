/**
 * 自動マテリアル付与パイプライン v1（非破壊・SurfaceFinish オーバーレイ方式）
 *
 * 設計メモ:
 *  - 指示書(auto_material_pipeline_v2.md)の Phase 5 は mesh.material を直接書き換える前提
 *    だったが、本アプリの実体は「躯体を一切いじらず、面の手前にオーバーレイ板を重ねる」
 *    非破壊方式（SurfaceFinishOverlays.jsx）。本実装はそれに合わせて SurfaceFinish を
 *    生成し useSurfaceFinishStore に流し込む。
 *  - 面分類は既存の classifySurface（法線Yで floor/ceiling/wall）を流用。
 *  - 各平面の矩形は既存の extractSurfaceRect（手動クリック時と同じ計算）を全平面に対して回す。
 *  - 面の束ね方は surfaceKeyOf（手動適用と同一）なので、後から手動で1面だけ張り替えても整合する。
 *
 * v1 スコープ: style="natural" の単色仕上げを全躯体面へ（テクスチャ素材依存なし）。
 * 次段: スタイルDB拡充 / S.Material ライブラリの DsmtMaterialSnapshot 連携 / スコープ指定 / 永続保存。
 */
import * as THREE from "three";
import type { DsmtMaterial, DsmtMaterialSnapshot, DsmtCategory, MaterialApplication } from "../../../dsmt/types";
import { layoutSceneRef } from "./layoutSceneRef";
import { structureFaceKeyOf, classifySurface, type SurfaceType } from "../store/useMaterialFaceStore";
import { useSurfaceFinishStore, type FinishRegion } from "../store/useSurfaceFinishStore";
import { normalizeRects } from "../lib/rectilinear";
import { extractSurfaceRect, extractConnectedFaceRect, clampWallSurfaceToCeiling } from "../canvas/viewports/controllers/FacePickController";
import { materialToSnapshot } from "../../../shared/material/useMaterialBinding";
import { buildThreeMaterial } from "../../../shared/material/applyMaterial";
import { useMaterialSweepStore } from "./materialSweep";
import { useStructureLabelStore, type StructureSemantic } from "../store/useStructureLabelStore";
import { useWallStore } from "../store/useWallStore";
import { useSlabStore } from "../store/useSlabStore";
import { useDrawnFinishStore } from "../store/useDrawnFinishStore";

export type AutoMaterialStyleKey = "natural" | "modern" | "japandi";

/**
 * 面1種別ぶんの素材選定ルール。実行時に S.Material ライブラリ（projectのworkFiles）から
 * category（必要なら title キーワード）で実素材を解決し、テクスチャ付きを優先採用する。
 * 該当素材が無ければ fallback の単色スナップショットを使う。
 */
interface SurfaceRule {
  /** 部位（床/内壁/外壁/天井）。素材の applications / 部位タグと突き合わせる主軸。 */
  application: MaterialApplication;
  /** 部位タグが無い既存ライブラリ向けのフォールバック絞り込み＋単色fallbackの素材ジャンル。 */
  category: DsmtCategory;
  /** スタイル/仕上げ種別の加点キーワード（title・tags を対象）。 */
  keywords?: string[];
  fallback: DsmtMaterialSnapshot;
}

interface StyleSpec {
  label: string;
  floor: SurfaceRule;
  wall: SurfaceRule;
  ceiling: SurfaceRule;
  /** 外壁（面ラベルで outer_wall を付けた面に適用）。未ラベル時は wall を使う。 */
  outerWall: SurfaceRule;
  /** 外床（面ラベルで outer_floor を付けた露天の床に適用）。未ラベル時は floor を使う。 */
  outerFloor: SurfaceRule;
}

const solid = (
  title: string,
  category: DsmtCategory,
  baseColor: string,
  roughness: number,
  metalness = 0
): DsmtMaterialSnapshot => ({ title, category, params: { baseColor, roughness, metalness } });

/**
 * スタイルDB。各面は「カテゴリ＋キーワード」で実素材を解決し、無ければ fallback 単色。
 * fallback の色は、ライブラリに素材が無くてもひと目で判別できるトーンにしている。
 */
export const AUTO_MATERIAL_STYLES: Record<AutoMaterialStyleKey, StyleSpec> = {
  natural: {
    label: "ナチュラル",
    floor: { application: "floor", category: "wood", keywords: ["無垢", "フローリング", "オーク", "oak", "ナチュラル", "パイン", "pine"], fallback: solid("ナチュラル床（オーク調）", "wood", "#b07a3c", 0.75) },
    wall: { application: "inner_wall", category: "paint", keywords: ["クロス", "漆喰", "塗り壁", "ホワイト", "白", "ベージュ", "plaster"], fallback: solid("暖色ハニーベージュ壁", "paint", "#d8a55f", 0.9) },
    ceiling: { application: "ceiling", category: "paint", keywords: ["クロス", "ホワイト", "白", "クリーム"], fallback: solid("天井（クリーム）", "paint", "#efe6d3", 1.0) },
    outerWall: { application: "outer_wall", category: "stone", keywords: ["サイディング", "siding", "塗り壁", "そとん", "コンクリート", "concrete"], fallback: solid("外壁（塗り壁）", "stone", "#9c9488", 0.9) },
    outerFloor: { application: "outer_floor", category: "wood", keywords: ["ウッドデッキ", "デッキ", "deck", "枕木", "屋外", "テラス"], fallback: solid("外床（ウッドデッキ）", "wood", "#8a6d4b", 0.85) },
  },
  modern: {
    label: "モダン",
    floor: { application: "floor", category: "stone", keywords: ["磁器質タイル", "磁器", "タイル", "tile", "ポリッシュ", "コンクリート", "concrete", "モルタル"], fallback: solid("ダークコンクリート床", "stone", "#6e7276", 0.55) },
    wall: { application: "inner_wall", category: "paint", keywords: ["クロス", "グレー", "塗装", "コンクリート", "gray"], fallback: solid("クールグレー壁", "paint", "#aeb4ba", 0.85) },
    ceiling: { application: "ceiling", category: "paint", keywords: ["クロス", "ホワイト", "白"], fallback: solid("天井（ホワイト）", "paint", "#f7f8fa", 1.0) },
    outerWall: { application: "outer_wall", category: "metal", keywords: ["ガルバ", "金属", "metal", "パネル", "siding", "コンクリート"], fallback: solid("外壁（ガルバ）", "metal", "#5c6064", 0.5, 0.2) },
    outerFloor: { application: "outer_floor", category: "stone", keywords: ["磁器質タイル", "タイル", "tile", "コンクリート", "concrete", "石", "テラス", "土間"], fallback: solid("外床（磁器質タイル）", "stone", "#7c7f83", 0.5) },
  },
  japandi: {
    label: "ジャパンディ",
    floor: { application: "floor", category: "wood", keywords: ["無垢", "フローリング", "アッシュ", "ash", "ライト", "light", "オーク", "oak"], fallback: solid("ライトアッシュ床", "wood", "#c2a878", 0.8) },
    wall: { application: "inner_wall", category: "stone", keywords: ["塗り壁", "珪藻土", "和紙", "クレイ", "プラスター", "plaster", "clay"], fallback: solid("クレイ塗り壁", "stone", "#b59a6f", 0.95) },
    ceiling: { application: "ceiling", category: "paint", keywords: ["クロス", "生成り", "白", "ホワイト"], fallback: solid("天井（生成り）", "paint", "#e8ddc8", 1.0) },
    outerWall: { application: "outer_wall", category: "wood", keywords: ["焼杉", "杉", "板張り", "siding", "ウッド"], fallback: solid("外壁（板張り）", "wood", "#7a6a52", 0.85) },
    outerFloor: { application: "outer_floor", category: "stone", keywords: ["洗い出し", "石", "御影", "テラス", "土間", "砂利"], fallback: solid("外床（洗い出し）", "stone", "#9a948a", 0.8) },
  },
};

/** 素材にテクスチャ（アルベド）があるか。 */
const hasTexture = (m: DsmtMaterial): boolean => !!m?.maps?.albedo;

interface ResolvedMaterial {
  material: DsmtMaterialSnapshot;
  materialId: string;
  textured: boolean;
}

/** 部位タグのエイリアス（タグ規約での部位判定用。タグは完全一致で照合）。 */
const APP_ALIASES: Record<MaterialApplication, string[]> = {
  floor: ["floor", "床", "ゆか", "フロア"],
  outer_floor: ["outer_floor", "外床", "土間", "テラス", "デッキ", "deck", "terrace"],
  inner_wall: ["inner_wall", "内壁", "壁", "かべ", "wall"],
  outer_wall: ["outer_wall", "外壁", "外装", "siding", "facade"],
  ceiling: ["ceiling", "天井", "てんじょう"],
};
const ALL_APP_TAGS = new Set(Object.values(APP_ALIASES).flat());

/**
 * 素材が指定部位に適合するか。
 *  - applications フィールドがあれば最優先（true/false 確定）
 *  - 無ければ tags の部位タグ規約で判定（部位タグが1つでもあれば確定、無ければ null=不明）
 */
function appMatch(m: DsmtMaterial, application: MaterialApplication): boolean | null {
  if (m.applications && m.applications.length) return m.applications.includes(application);
  const tags = (m.tags || []).map((t) => t.toLowerCase());
  if (!tags.length) return null;
  const hasAnyAppTag = tags.some((t) => ALL_APP_TAGS.has(t));
  if (!hasAnyAppTag) return null; // 部位タグ無し → 不明
  return APP_ALIASES[application].some((a) => tags.includes(a));
}

/**
 * ルールを実素材ライブラリに対して解決する。
 *  1) 部位（applications / 部位タグ）が一致する素材を最優先で母集団に。
 *  2) 無ければ「他部位に確定していない」かつ category 一致でフォールバック（部位未タグの既存ライブラリ対応）。
 *  3) 母集団内で キーワード一致(+2) ＋ 部位一致(+2) ＋ テクスチャ有り(+1) のスコア最大を採用。
 *  4) それも無ければ fallback 単色。
 */
function resolveRule(rule: SurfaceRule, materials: DsmtMaterial[], styleKey: string, type: SurfaceType): ResolvedMaterial {
  const app = rule.application;
  const all = materials || [];

  let pool = all.filter((m) => appMatch(m, app) === true);
  if (!pool.length) {
    // 部位が明示されていない（=null）かつ素材ジャンル一致のものに限ってフォールバック。
    // 他部位に明示された素材（appMatch===false）は混ぜない（床用が壁に出る事故を防ぐ）。
    pool = all.filter((m) => appMatch(m, app) !== false && m?.category === rule.category);
  }

  if (pool.length) {
    const kws = (rule.keywords || []).map((k) => k.toLowerCase());
    const score = (m: DsmtMaterial) => {
      const hay = `${m.title || ""} ${(m.tags || []).join(" ")}`.toLowerCase();
      let s = 0;
      if (kws.length && kws.some((k) => hay.includes(k))) s += 2;
      if (appMatch(m, app) === true) s += 2; // 部位一致を強く優遇
      if (hasTexture(m)) s += 1;
      return s;
    };
    let best = pool[0];
    let bestScore = score(best);
    for (const m of pool) {
      const s = score(m);
      if (s > bestScore) { best = m; bestScore = s; }
    }
    return { material: materialToSnapshot(best), materialId: best.id, textured: hasTexture(best) };
  }
  return { material: rule.fallback, materialId: `auto-${styleKey}-${type}`, textured: false };
}

export interface AutoMaterialResult {
  ok: boolean;
  reason?: string;
  styleLabel?: string;
  counts: Record<SurfaceType, number>;
  planes: number;
  /** テクスチャ実素材を採用した面種別（例: ["床","壁"]）。 */
  texturedTypes: string[];
  /** 単色フォールバックになった面種別（ライブラリに素材が無い）。 */
  solidTypes: string[];
}

/** 安全弁: 面の束ねが想定外に多い場合に暴走を防ぐ。 */
const MAX_PLANES = 400;

const SURFACE_JP: Record<SurfaceType, string> = { floor: "床", wall: "壁", ceiling: "天井" };

/** 点 p が水平方向に壁で囲まれているか（屋内床＝true）。8方位レイで blocked>=6 を屋内とみなす。 */
function isFloorEnclosed(p: THREE.Vector3, meshes: THREE.Mesh[], diag: number, upm: number): boolean {
  const eps = 0.02 * upm;
  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  const origin = new THREE.Vector3();
  let blocked = 0;
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2;
    dir.set(Math.cos(ang), 0, Math.sin(ang));
    origin.set(p.x, p.y + eps * 4, p.z).addScaledVector(dir, eps);
    ray.set(origin, dir);
    ray.far = diag;
    const hits = ray.intersectObjects(meshes, true);
    if (hits.some((h) => h.distance > eps * 2)) blocked++;
  }
  return blocked >= 6;
}

/**
 * 床面をグリッドで内外判定し、屋内セル/屋外セルの面ローカル矩形に分ける。
 * 「壁の外側の床」を外床材で塗り分けるための分割。常に inside/outside を返す
 * （両方空でない＝混在、片方のみ＝一様）。
 */
function splitFloorRegions(
  rect: { center: number[]; uAxis: number[]; vAxis: number[]; width: number; height: number },
  meshes: THREE.Mesh[], diag: number, upm: number,
): { inside: FinishRegion[]; outside: FinishRegion[] } {
  const W = rect.width, H = rect.height;
  if (!(W > 0) || !(H > 0)) return { inside: [{ u0: -1, u1: 1, v0: -1, v1: 1 }], outside: [] };
  const center = new THREE.Vector3(rect.center[0], rect.center[1], rect.center[2]);
  const uAxis = new THREE.Vector3(rect.uAxis[0], rect.uAxis[1], rect.uAxis[2]).normalize();
  const vAxis = new THREE.Vector3(rect.vAxis[0], rect.vAxis[1], rect.vAxis[2]).normalize();
  const cell = 0.7 * upm; // 約700mm グリッド
  const nu = Math.max(1, Math.min(16, Math.round(W / cell)));
  const nv = Math.max(1, Math.min(16, Math.round(H / cell)));
  const du = W / nu, dv = H / nv;
  const inside: FinishRegion[] = [];
  const outside: FinishRegion[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const u0 = -W / 2 + i * du, u1 = u0 + du;
      const v0 = -H / 2 + j * dv, v1 = v0 + dv;
      p.copy(center).addScaledVector(uAxis, (u0 + u1) / 2).addScaledVector(vAxis, (v0 + v1) / 2);
      (isFloorEnclosed(p, meshes, diag, upm) ? inside : outside).push({ u0, u1, v0, v1 });
    }
  }
  return {
    inside: inside.length ? normalizeRects(inside) : [],
    outside: outside.length ? normalizeRects(outside) : [],
  };
}

/**
 * 現在読み込まれている躯体（layoutSceneRef.baseRoot）の全平面を検出し、
 * 床/壁/天井へスタイルの仕上げを自動付与する。
 * @param styleKey  スタイルキー
 * @param materials S.Material ライブラリの実素材（projectのworkFiles）。テクスチャ解決に使う。
 */
/** スナップショット群の素材を事前ビルドし、テクスチャをデコード＆キャッシュしておく。
 *  これで FinishGroup の buildThreeMaterial がキャッシュヒットで即時完了し、
 *  スイープ中に新素材が前線の奥から現れる（＝グラデーションで切り替わる）。 */
async function prefetchTextures(snaps: DsmtMaterialSnapshot[]) {
  const withMaps = snaps.filter((s) => s?.maps && Object.keys(s.maps).length > 0);
  if (!withMaps.length) return;
  // buildThreeMaterial 内の loadTexture が URL 単位でデコード結果をキャッシュする。
  await Promise.allSettled(withMaps.map((s) => buildThreeMaterial(s)));
}

export async function autoApplyMaterials(
  styleKey: AutoMaterialStyleKey = "natural",
  materials: DsmtMaterial[] = []
): Promise<AutoMaterialResult> {
  const counts: Record<SurfaceType, number> = { floor: 0, wall: 0, ceiling: 0 };
  const style = AUTO_MATERIAL_STYLES[styleKey];
  const root = layoutSceneRef.baseRoot as THREE.Object3D | null;
  const empty = { counts, planes: 0, texturedTypes: [], solidTypes: [] };
  if (!style) return { ok: false, reason: `未知のスタイル: ${styleKey}`, ...empty };

  // 面種別ごとに実素材を一度だけ解決（テクスチャ優先 → 無ければ単色）。
  const resolved: Record<SurfaceType, ResolvedMaterial> & { outerWall: ResolvedMaterial; outerFloor: ResolvedMaterial } = {
    floor: resolveRule(style.floor, materials, styleKey, "floor"),
    wall: resolveRule(style.wall, materials, styleKey, "wall"),
    ceiling: resolveRule(style.ceiling, materials, styleKey, "ceiling"),
    outerWall: resolveRule(style.outerWall, materials, styleKey, "wall"),
    outerFloor: resolveRule(style.outerFloor, materials, styleKey, "floor"),
  };

  // ── S.Layout で作図した壁/床（useWallStore / useSlabStore）へ仕上げを適用 ──
  // これらは種別（外壁/内壁/床）が最初から分かっているので、躯体のような面検出＋
  // 面キーのオーバーレイを介さず、素材スナップショットを直接持たせる（確実で安価）。
  // 躯体（baseRoot）の有無に関わらず先に処理する＝Base 無しで壁だけ描いた場合も効く。
  const drawnWallCount = useWallStore.getState().walls.length;
  const drawnSlabCount = useSlabStore.getState().slabs.length;
  const hasDrawn = drawnWallCount > 0 || drawnSlabCount > 0;
  if (hasDrawn) {
    await prefetchTextures([resolved.wall.material, resolved.outerWall.material, resolved.floor.material]);
    useDrawnFinishStore.getState().setFinishes({
      interiorWall: resolved.wall.material,
      exteriorWall: resolved.outerWall.material,
      floor: resolved.floor.material,
      styleKey,
    });
    if (drawnWallCount) counts.wall += drawnWallCount;
    if (drawnSlabCount) counts.floor += drawnSlabCount;
  }

  /** 躯体の面が取れなくても、作図した壁/床に貼れていれば成功として返す。 */
  const drawnOnlyResult = (): AutoMaterialResult => {
    const used = (Object.keys(counts) as SurfaceType[]).filter((t) => counts[t] > 0);
    return {
      ok: true,
      styleLabel: style.label,
      counts,
      planes: 0,
      texturedTypes: used.filter((t) => resolved[t].textured).map((t) => SURFACE_JP[t]),
      solidTypes: used.filter((t) => !resolved[t].textured).map((t) => SURFACE_JP[t]),
    };
  };

  if (!root) {
    return hasDrawn ? drawnOnlyResult() : { ok: false, reason: "躯体モデルが読み込まれていません", ...empty };
  }

  // 手動の面ラベル（床/外床/内壁/外壁/天井）。あれば法線分類より優先する。
  const faceLabels = useStructureLabelStore.getState().labels;
  // セマンティクス → (集計種別, 解決ルールキー)
  const semanticMap: Record<StructureSemantic, { type: SurfaceType; rule: keyof typeof resolved }> = {
    floor: { type: "floor", rule: "floor" },
    outer_floor: { type: "floor", rule: "outerFloor" },
    ceiling: { type: "ceiling", rule: "ceiling" },
    inner_wall: { type: "wall", rule: "wall" },
    outer_wall: { type: "wall", rule: "outerWall" },
    // 屋根：外装材で塗る（集計は天井種別に寄せる）。
    roof: { type: "ceiling", rule: "outerWall" },
  };

  // 躯体メッシュを収集
  const meshes: THREE.Mesh[] = [];
  root.traverse((o: any) => {
    if (!o?.isMesh || !o.geometry || o.userData?.replacedByUnion) return;
    // 補助メッシュ（平面図ポシェの黒塗り isSectionFill / 仕上げオーバーレイ isSurfaceFinish）は
    // 躯体面ではなく壁ジオメトリの複製なので除外（含めると「変な壁」が二重に出る）。
    if (o.userData?.isSectionFill || o.userData?.isSurfaceFinish) return;
    meshes.push(o);
  });
  if (!meshes.length) return hasDrawn ? drawnOnlyResult() : { ok: false, reason: "躯体メッシュが見つかりません", ...empty };

  // units-per-meter（mm スケール=1000 / m スケール=1）。面キーの位置量子化グリッドに使う。
  const rootUpm = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y > 100 ? 1000 : 1;

  // ── 適用対象の面を集める ──
  // 自動ラベルがあれば、その「連結成分の面」をそのまま使う（自動ラベルと完全一致＝謎の面が出ない）。
  // 無ければ連結成分で列挙する（旧・平面署名の全体束ねは 1 枚の壁が複数に分裂し謎の面の原因なので使わない）。
  type FaceItem = { surface: any; surfaceType: SurfaceType; rule: keyof typeof resolved | null };
  const faceItems: FaceItem[] = [];
  const labelKeys = Object.keys(faceLabels);

  if (labelKeys.length) {
    for (const k of labelKeys) {
      const l = faceLabels[k];
      if (!l?.surface) continue;
      const mapped = semanticMap[l.semantic];
      if (!mapped) continue;
      faceItems.push({ surface: l.surface, surfaceType: mapped.type, rule: mapped.rule });
    }
  } else {
    // 連結成分で列挙（structureAutoLabel と同じ方式）
    const reps = new Map<string, any>();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nC = new THREE.Vector3();
    const faceN = new THREE.Vector3(), centroid = new THREE.Vector3();
    for (const mesh of meshes) {
      mesh.updateMatrixWorld(true);
      const geo = mesh.geometry as THREE.BufferGeometry;
      const pos = geo.attributes.position;
      if (!pos) continue;
      const nrm = geo.attributes.normal;
      const idx = geo.index;
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      const used = new Set<number>();
      for (let t = 0; t < triCount; t++) {
        if (used.has(t)) continue;
        const ia = idx ? idx.getX(t * 3) : t * 3;
        const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
        const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);
        centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        if (nrm) {
          nA.fromBufferAttribute(nrm, ia);
          nB.fromBufferAttribute(nrm, ib);
          nC.fromBufferAttribute(nrm, ic);
          faceN.copy(nA).add(nB).add(nC).multiplyScalar(1 / 3).normalize().transformDirection(mesh.matrixWorld);
        } else {
          faceN.copy(b).sub(a).cross(nC.copy(c).sub(a)).normalize();
        }
        if (!isFinite(faceN.x) || faceN.lengthSq() < 0.5) { used.add(t); continue; }
        let surface = extractConnectedFaceRect(mesh, t, faceN.clone());
        if (!surface) surface = extractSurfaceRect(mesh, faceN.clone(), centroid.clone());
        if (!surface) { used.add(t); continue; }
        if (Array.isArray(surface.triIndices) && surface.triIndices.length) {
          for (const vt of surface.triIndices) used.add(vt);
        } else { used.add(t); }
        const key = structureFaceKeyOf(surface.normal, surface.center, rootUpm);
        if (!reps.has(key)) {
          reps.set(key, surface);
          if (reps.size >= MAX_PLANES) break;
        }
      }
      if (reps.size >= MAX_PLANES) break;
    }
    for (const surface of reps.values()) {
      faceItems.push({ surface, surfaceType: classifySurface(surface.normal[1]), rule: null });
    }
  }

  // 内外判定用の寸法（床面の内側/外側 塗り分けに使う）。
  const splitBox = new THREE.Box3().setFromObject(root);
  const splitSize = splitBox.getSize(new THREE.Vector3());
  const splitDiag = splitSize.length() || 1000;
  const splitUpm = splitSize.y > 100 ? 1000 : 1;

  // 各面に仕上げを割り当て（setFinish はテクスチャ先読み後にまとめて実行）。
  const pending: { key: string; surface: any; materialId: string; material: DsmtMaterialSnapshot; regions?: FinishRegion[] }[] = [];
  let planes = 0;
  for (const { surface: rect, surfaceType, rule } of faceItems) {
    if (!rect) continue;
    const key = structureFaceKeyOf(rect.normal, rect.center, rootUpm);

    // 床タイプの面は、壁の内外で「床材／外床材」に塗り分ける（ラベルの有無に関わらず）。
    if (surfaceType === "floor") {
      const { inside, outside } = splitFloorRegions(rect, meshes, splitDiag, splitUpm);
      if (inside.length && outside.length) {
        pending.push({ key: `${key}#in`, surface: rect, materialId: resolved.floor.materialId, material: resolved.floor.material, regions: inside });
        pending.push({ key: `${key}#out`, surface: rect, materialId: resolved.outerFloor.materialId, material: resolved.outerFloor.material, regions: outside });
        counts.floor++;
        planes++;
        continue;
      }
      if (outside.length && !inside.length) {
        pending.push({ key, surface: rect, materialId: resolved.outerFloor.materialId, material: resolved.outerFloor.material });
        counts.floor++;
        planes++;
        continue;
      }
      // 全面が屋内 → 下のデフォルト（床材）へ。
    }

    const r = resolved[rule ? rule : surfaceType];
    // 内装壁は FL〜CL に切り詰める（手動クリック時と同じ）。key はクランプ前の面で
    // 計算済みなので、過去に貼った同じ面の仕上げをそのまま上書きできる。
    pending.push({ key, surface: clampWallSurfaceToCeiling(rect), materialId: r.materialId, material: r.material });
    counts[surfaceType]++;
    planes++;
  }

  if (!planes) return hasDrawn ? drawnOnlyResult() : { ok: false, reason: "面の矩形を抽出できませんでした", ...empty };

  // ── テクスチャを先読みしてから一括適用＋スイープ開始 ──
  // 先読みしないと、ラインが走り終わる頃に新素材が読み込まれ「最後に一斉切替」に見える。
  await prefetchTextures([
    resolved.floor.material,
    resolved.wall.material,
    resolved.ceiling.material,
    resolved.outerWall.material,
    resolved.outerFloor.material,
  ]);

  const setFinish = useSurfaceFinishStore.getState().setFinish;
  for (const f of pending) setFinish(f);

  // ── 天井→壁→床へ斜めに這う青いスキャンライン演出を開始 ──
  {
    const box = new THREE.Box3().setFromObject(root);
    // 前線の向き: 上向き(y+) + しっかり斜め(x/z)。dir·p が大きい＝天井側で先に出る。
    const dir = new THREE.Vector3(-0.85, 1, -0.55).normalize();
    let mn = Infinity, mx = -Infinity;
    const xs = [box.min.x, box.max.x];
    const ys = [box.min.y, box.max.y];
    const zs = [box.min.z, box.max.z];
    const p = new THREE.Vector3();
    for (const x of xs) for (const y of ys) for (const z of zs) {
      const d = p.set(x, y, z).dot(dir);
      if (d < mn) mn = d;
      if (d > mx) mx = d;
    }
    const width = Math.max((mx - mn) * 0.06, 1e-3);
    // 走る速度を一定にする: 所要時間 = 距離 ÷ 速度。
    // 距離(mn〜mx)は実寸へ換算(mm/m自動判定)し、一定速度 SPEED_MPS[m/s] で割る。
    const upm = box.getSize(new THREE.Vector3()).y > 100 ? 1000 : 1; // mm/m 自動判定
    const spanMeters = (mx - mn) / upm;
    const SPEED_MPS = 6; // 前線の走行速度（メートル/秒）
    const durationMs = Math.min(3000, Math.max(800, (spanMeters / SPEED_MPS) * 1000));
    useMaterialSweepStore.getState().startSweep({
      durationMs,
      color: "#5b9dff",
      dir: [dir.x, dir.y, dir.z],
      min: mn,
      max: mx,
      width,
    });
  }

  // 実際に面が付いた種別だけを集計（texture有無の内訳）。
  const usedTypes = (Object.keys(counts) as SurfaceType[]).filter((t) => counts[t] > 0);
  const texturedTypes = usedTypes.filter((t) => resolved[t].textured).map((t) => SURFACE_JP[t]);
  const solidTypes = usedTypes.filter((t) => !resolved[t].textured).map((t) => SURFACE_JP[t]);

  return { ok: true, styleLabel: style.label, counts, planes, texturedTypes, solidTypes };
}
