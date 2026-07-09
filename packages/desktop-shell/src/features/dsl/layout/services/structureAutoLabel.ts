/**
 * 躯体の自動ラベリング（3Dスキャン）
 *
 * 読み込み済みの躯体（layoutSceneRef.baseRoot）の全平面を検出し、
 *   - 法線Y成分で 床(+Y) / 天井(-Y) / 壁(水平) を判定
 *   - 壁は「面の前方(+法線方向)へレイを飛ばし、内部に当たれば内壁 / 何も無ければ外壁」で内/外を判定
 * して useStructureLabelStore に一括マージする。
 *
 * 面の束ね方(surfaceKeyOf)・矩形抽出(extractSurfaceRect)は手動クリック／自動マテリアルと同一なので、
 * 後から手動で1面だけ直しても整合する。
 */
import * as THREE from "three";
import { layoutSceneRef } from "./layoutSceneRef";
import { structureFaceKeyOf, classifySurface } from "../store/useMaterialFaceStore";
import { extractSurfaceRect, extractConnectedFaceRect } from "../canvas/viewports/controllers/FacePickController";
import { scanFloors } from "../canvas/tools/walkthrough/floorScan";
import {
  useStructureLabelStore,
  type StructureLabel,
  type StructureSemantic,
} from "../store/useStructureLabelStore";

const MAX_PLANES = 600;

export interface AutoLabelResult {
  ok: boolean;
  reason?: string;
  counts: Record<StructureSemantic, number>;
}

export function autoLabelStructure(): AutoLabelResult {
  const counts: Record<StructureSemantic, number> = { floor: 0, outer_floor: 0, inner_wall: 0, outer_wall: 0, ceiling: 0, roof: 0 };
  const root = layoutSceneRef.baseRoot as THREE.Object3D | null;
  if (!root) return { ok: false, reason: "躯体モデルが読み込まれていません", counts };

  const meshes: THREE.Mesh[] = [];
  root.traverse((o: any) => {
    if (!o?.isMesh || !o.geometry) return;
    if (o.userData?.replacedByUnion) return; // Union で退避した元メッシュは除外
    // 自前で追加した補助メッシュ（平面図ポシェの黒塗り/仕上げオーバーレイ）は躯体面ではない。
    // これらは壁ジオメトリの複製なので、含めると「変な壁」が二重に検出される。
    if (o.userData?.isSectionFill || o.userData?.isSurfaceFinish) return;
    meshes.push(o);
  });
  if (!meshes.length) return { ok: false, reason: "躯体メッシュが見つかりません", counts };

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const diag = size.length() || 1000;
  const upm = size.y > 100 ? 1000 : 1;

  // 面を「連結成分（地続きの同一平面）」単位で列挙する。
  // 旧方式（平面署名で全体一括束ね）は、CAD の三角分割や段差・継ぎ目で 1 枚の壁が
  // 複数平面に割れて過剰に分裂したり、離れた同一平面が混ざったりした。
  // 連結成分なら「1 枚の壁＝1 面」になり、存在しない/重複した面が大幅に減る。
  type Rep = { surface: any; normal: THREE.Vector3; point: THREE.Vector3 };
  const reps = new Map<string, Rep>();

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
    const used = new Set<number>(); // 連結成分に取り込んだ三角形は再処理しない

    for (let t = 0; t < triCount; t++) {
      if (used.has(t)) continue;
      const ia = idx ? idx.getX(t * 3) : t * 3;
      const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

      a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);
      centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);

      // seed 三角形の法線ヒント（頂点法線優先、無ければ幾何法線）
      if (nrm) {
        nA.fromBufferAttribute(nrm, ia);
        nB.fromBufferAttribute(nrm, ib);
        nC.fromBufferAttribute(nrm, ic);
        faceN.copy(nA).add(nB).add(nC).multiplyScalar(1 / 3).normalize().transformDirection(mesh.matrixWorld);
      } else {
        faceN.copy(b).sub(a).cross(nC.copy(c).sub(a)).normalize();
      }
      if (!isFinite(faceN.x) || faceN.lengthSq() < 0.5) { used.add(t); continue; }

      // 連結成分の面矩形（はみ出さない実領域）。失敗時は従来の同一平面束ねへフォールバック。
      let surface = extractConnectedFaceRect(mesh, t, faceN.clone());
      if (!surface) surface = extractSurfaceRect(mesh, faceN.clone(), centroid.clone());
      if (!surface) { used.add(t); continue; }
      // この成分の三角形を処理済みに（無ければ seed のみ）
      if (Array.isArray(surface.triIndices) && surface.triIndices.length) {
        for (const vt of surface.triIndices) used.add(vt);
      } else {
        used.add(t);
      }

      const key = structureFaceKeyOf(surface.normal, surface.center, upm);
      if (!reps.has(key)) {
        reps.set(key, {
          surface,
          normal: new THREE.Vector3(surface.normal[0], surface.normal[1], surface.normal[2]),
          point: new THREE.Vector3(surface.center[0], surface.center[1], surface.center[2]),
        });
        if (reps.size >= MAX_PLANES) break;
      }
    }
    if (reps.size >= MAX_PLANES) break;
  }

  const ray = new THREE.Raycaster();
  const eps = 0.02 * upm;
  // 120mm: 面の前方に躯体がこれ未満で接していれば「2つのソリッドの接合面/内部面」とみなす。
  // 実在する部屋は通常これより広いので、内部のニセ面（存在しない面）だけを除外できる。
  const INTERNAL_GAP = 0.12 * upm;
  // 0.01m² 未満の極小面（スライバ/端面）は躯体面ではないとみなして除外。
  const MIN_AREA = (0.1 * upm) * (0.1 * upm);
  // モデルの垂直中点。これより下にある「天井（下向き面）」は最下層スラブの裏面（地面裏）→ラベル不要。
  const midY = (box.min.y + box.max.y) / 2;

  // 面の中心から +法線方向に飛ばし、最も近い躯体ヒットまでの距離（自分自身は無視）。
  // ヒット無し=開放(=外側) は Infinity を返す。
  const forwardDistance = (centerArr: number[], normalArr: number[]): number => {
    const n = new THREE.Vector3(normalArr[0], normalArr[1], normalArr[2]).normalize();
    const o = new THREE.Vector3(centerArr[0], centerArr[1], centerArr[2]).addScaledVector(n, eps);
    ray.set(o, n);
    ray.far = diag;
    const hits = ray.intersectObjects(meshes, true);
    for (const h of hits) if (h.distance > eps * 1.5) return h.distance;
    return Infinity;
  };

  // ── フットプリント内外判定（②）：点が建物の中（壁で囲まれた内部）にあるか ──
  // 水平方向の交差パリティで判定。指定方向へ飛ばし、縦面(壁)を横切った回数が奇数なら内部。
  // 両面ジオメトリの同位置ヒットはまとめて1回と数える。レイ1本の「当たり有無」より頑健で、
  // 段付き/凹型の外壁の外向きレイが別棟に当たっても、点自体は外＝外壁と正しく判定できる。
  const mergeTol = Math.max(0.01 * upm, 1e-3);
  const crossingsAlong = (origin: THREE.Vector3, dir: THREE.Vector3): number => {
    ray.set(origin, dir);
    ray.far = diag * 2;
    const hits = ray.intersectObjects(meshes, true);
    let count = 0;
    let lastD = -Infinity;
    for (const h of hits) {
      let ny = 1;
      if (h.face) ny = h.face.normal.clone().transformDirection(h.object.matrixWorld).y;
      if (Math.abs(ny) >= 0.5) continue; // 床/天井(横面)は壁の交差に数えない
      if (h.distance - lastD < mergeTol) continue; // 同位置(両面)の重複ヒットは1回に統合
      lastD = h.distance;
      count++;
    }
    return count;
  };
  const DIRS = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];
  const isInsideFootprint = (px: number, py: number, pz: number): boolean => {
    const o = new THREE.Vector3(px, py, pz);
    let insideVotes = 0;
    for (const d of DIRS) if (crossingsAlong(o, d) % 2 === 1) insideVotes++;
    // 多数決。同数(2)は外側寄り＝ソリッドマスが全外壁になるようにする。
    return insideVotes >= 3;
  };

  // ── ゼロ厚/裏面の重複除去（存在しない面対策の主軸） ──
  // GLB が両面（裏面あり）だと、1枚の壁が「外向き(外壁)」と「内向き(裏面=ニセ内壁)」の
  // 2レコードになる。同一平面・逆法線のペアを検出し、より開放側（外向き）の1枚だけ残す。
  const dropped = new Set<string>();
  for (const [key, rep] of reps.entries()) {
    if (dropped.has(key)) continue;
    if (Math.abs(rep.normal.y) > 0.4) continue; // 壁のみ対象（床/天井スラブは温存）
    const oppKey = structureFaceKeyOf(
      [-rep.normal.x, -rep.normal.y, -rep.normal.z],
      [rep.point.x, rep.point.y, rep.point.z],
      upm
    );
    if (oppKey === key || !reps.has(oppKey) || dropped.has(oppKey)) continue;
    const other = reps.get(oppKey)!;
    const dThis = forwardDistance([rep.point.x, rep.point.y, rep.point.z], [rep.normal.x, rep.normal.y, rep.normal.z]);
    const dOther = forwardDistance([other.point.x, other.point.y, other.point.z], [other.normal.x, other.normal.y, other.normal.z]);
    // より開放側（前方が空いている＝外向き）を残し、もう一方（裏面）を捨てる。
    dropped.add(dOther > dThis ? key : oppKey);
  }

  // ── 階（1F/2F…）検出: 床スキャンの水平レベルから「階の境界」を得る ──
  // levels 昇順。階数 = レベル間のギャップ数（最上面=屋根は階数に数えない）。
  let levels: number[] = [];
  try {
    levels = (scanFloors({ colliders: meshes }).levels || []).slice().sort((p, q) => p - q);
  } catch {
    levels = [];
  }
  const storyCount = Math.max(1, levels.length - 1);
  const storyOf = (y: number, isCeiling: boolean): number => {
    if (levels.length < 2) return 1;
    const yy = isCeiling ? y - 0.02 * upm : y; // 天井は直下の階に属させる
    let i = 0;
    for (let k = 0; k < levels.length - 1; k++) if (yy >= levels[k] - 0.05 * upm) i = k;
    return Math.min(i + 1, storyCount);
  };

  const labels: Record<string, StructureLabel> = {};

  for (const [key, rep] of reps.entries()) {
    if (dropped.has(key)) continue;
    const rect = rep.surface;
    if (!rect) continue;
    // 極小面は除外（存在しない面/端面のノイズ）
    if (rect.width * rect.height < MIN_AREA) continue;
    const base = classifySurface(rect.normal[1]); // floor / ceiling / wall

    let semantic: StructureSemantic;
    let collision = true;
    if (base === "floor") {
      // 床：8方位レイで周囲が壁で囲まれていれば屋内床、開けていれば外床。
      const oc = rect.center;
      const originY = oc[1] + eps * 4;
      const N = 8;
      const dir = new THREE.Vector3();
      let blocked = 0;
      for (let k = 0; k < N; k++) {
        const ang = (k / N) * Math.PI * 2;
        dir.set(Math.cos(ang), 0, Math.sin(ang));
        const o = new THREE.Vector3(oc[0], originY, oc[2]).addScaledVector(dir, eps);
        ray.set(o, dir);
        ray.far = diag;
        const hits = ray.intersectObjects(meshes, true);
        if (hits.some((h) => h.distance > eps * 2)) blocked++;
      }
      semantic = blocked >= 6 ? "floor" : "outer_floor";
    } else if (base === "ceiling") {
      if (rect.center[1] < midY) continue; // 最下層スラブの裏面（地面裏）は不要
      semantic = "ceiling";
      collision = false;
    } else {
      // 壁：まず内部接合面（密着＝存在しない内部面）を除外。
      const dF = forwardDistance(rect.center, rect.normal);
      if (dF < INTERNAL_GAP) continue;
      // 外向き側の隣接空間が建物内部か外部か（フットプリント内外）で内/外を判定。
      const nrm = new THREE.Vector3(rect.normal[0], rect.normal[1], rect.normal[2]).normalize();
      const probe = new THREE.Vector3(rect.center[0], rect.center[1], rect.center[2])
        .addScaledVector(nrm, 0.05 * upm);
      semantic = isInsideFootprint(probe.x, probe.y, probe.z) ? "inner_wall" : "outer_wall";
    }

    const story = storyOf(rect.center[1], semantic === "ceiling");
    const k2 = structureFaceKeyOf(rect.normal, rect.center, upm);
    labels[k2] = { semantic, collision, surface: rect, story };
    counts[semantic]++;
  }

  if (!Object.keys(labels).length) return { ok: false, reason: "面を抽出できませんでした", counts };

  useStructureLabelStore.getState().mergeLabels(labels);
  return { ok: true, counts };
}
