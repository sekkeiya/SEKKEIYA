/**
 * 自動ライティング・パイプライン v1
 *
 * 設計メモ:
 *  - 自動マテリアル（autoMaterialPipeline.ts）と同じく、ウォークスルー左上の
 *    フローティングメニューから呼ばれ、クリックのたびにムードを循環する。
 *  - 室内ジオメトリは BaseGlb.jsx が確定した値を流用する:
 *      sceneMaxY   = 天井高（シーン単位。mmスケール GLB なら mm）
 *      sceneExtentXZ = XZ 半幅（シーン単位）。部屋は原点中心・床 Y=0 に正規化済み。
 *  - 生成したライトは pinned=false。ユーザーがピン留めしたライトは保持し、
 *    それ以外を replaceUnpinnedLights で置換する（useLightingStore）。
 *  - ライトの実体生成は store の createLight に集約（型デフォルトを共有）。
 *
 * v1 スコープ: 4 ムード（昼光 / 夕景 / 間接照明 / 展示）をルールベースで配置。
 *  - 自動ラベリング済みなら床/天井ラベルの実矩形から「内側フットプリント」を求め、
 *    その中心・X/Z 別半幅・天井高に沿ってグリッド配灯する（非対称/非正方の部屋に追従）。
 *    未ラベル時は sceneExtentXZ による原点中心の正方領域へフォールバック。
 * 次段: 窓ラベル連動の採光方向、プロジェクト保存。
 */
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useLightingStore, createLight, type LightConfig } from "../store/useLightingStore";
import { useStructureLabelStore } from "../store/useStructureLabelStore";
import type { SurfaceRect } from "../store/useMaterialFaceStore";

export type AutoLightingMoodKey = "daylight" | "evening" | "indirect" | "showroom";

export const AUTO_LIGHTING_MOODS: Record<AutoLightingMoodKey, { label: string }> = {
  daylight: { label: "昼光" },
  evening: { label: "夕景" },
  indirect: { label: "間接照明" },
  showroom: { label: "展示" },
};

// ─── 室内ジオメトリの解決 ───────────────────────────────────────────
// ライトは「内側フットプリント」に最適配置する。自動ラベリング済みなら
// 床（無ければ天井）ラベルの実矩形から内側 AABB を求め、中心・X/Z 別半幅・
// 天井高を割り出す（→ 非対称/非正方の部屋にも追従、外壁を除外）。
// 未ラベル時は従来どおり sceneExtentXZ による原点中心の正方領域へフォールバック。
interface RoomGeom {
  /** シーン単位→メートル換算係数（mmスケールなら 1000、mスケールなら 1） */
  U: number;
  /** 天井 Y（シーン単位） */
  ceilingY: number;
  /** 内側フットプリント中心（シーン単位） */
  centerX: number;
  centerZ: number;
  /** 内側フットプリントの X/Z 別半幅（シーン単位） */
  halfX: number;
  halfZ: number;
  /** 構造ラベルから内側形状を導けたか（演出ではなく配置の質を変える） */
  labeled: boolean;
}

/** 面矩形の四隅の XZ 座標を返す（床/天井面の水平範囲の算出用）。 */
function rectCornersXZ(s: SurfaceRect): Array<[number, number]> {
  const [cx, , cz] = s.center;
  const ux = (s.uAxis[0] * s.width) / 2, uz = (s.uAxis[2] * s.width) / 2;
  const vx = (s.vAxis[0] * s.height) / 2, vz = (s.vAxis[2] * s.height) / 2;
  return [
    [cx - ux - vx, cz - uz - vz],
    [cx + ux - vx, cz + uz - vz],
    [cx - ux + vx, cz - uz + vz],
    [cx + ux + vx, cz + uz + vz],
  ];
}

function resolveRoomGeom(): RoomGeom {
  const st = useEditorModeStore.getState();
  const rawMaxY = st.sceneMaxY;
  // sceneMaxY > 100 を mm スケール GLB の目印とする（spot 等の既存デフォルトと同じ判定）。
  const mm = rawMaxY > 100;
  const U = mm ? 1000 : 1;
  const sceneCeilingY = rawMaxY > 0 && rawMaxY !== 10 ? rawMaxY : 2.7 * U;
  const rawExtent = st.sceneExtentXZ;
  const sceneHalf = rawExtent > 0 && rawExtent !== 10 ? rawExtent : 3.0 * U;

  // 構造ラベルから内側フットプリントを試みる。
  const labels = Object.values(useStructureLabelStore.getState().labels || {});
  const floors = labels.filter((l) => l.semantic === "floor").map((l) => l.surface);
  const ceilings = labels.filter((l) => l.semantic === "ceiling").map((l) => l.surface);
  // 床優先（実際の歩行面＝内側地面）。無ければ天井で代用。
  const footprintSurfaces = floors.length ? floors : ceilings;

  if (footprintSurfaces.length) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of footprintSurfaces) {
      for (const [x, z] of rectCornersXZ(s)) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
    }
    if (isFinite(minX) && maxX > minX && maxZ > minZ) {
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;
      // 迷子の面でフットプリントが暴れないよう、半幅はシーン全体の 1.3 倍までにクランプ。
      const cap = sceneHalf * 1.3;
      const halfX = Math.min((maxX - minX) / 2, cap);
      const halfZ = Math.min((maxZ - minZ) / 2, cap);
      // 天井高は実績のある sceneMaxY を使う（=BaseGlb が算出した躯体上端）。
      // ラベルの中心 Y は床/天井の法線向きや座標系差で不安定なため垂直配置には使わない。
      // ラベルは XZ フットプリント（内側範囲）の特定にのみ用いる。
      return { U, ceilingY: sceneCeilingY, centerX, centerZ, halfX, halfZ, labeled: true };
    }
  }

  // フォールバック: 原点中心の正方領域。
  return { U, ceilingY: sceneCeilingY, centerX: 0, centerZ: 0, halfX: sceneHalf, halfZ: sceneHalf, labeled: false };
}

/**
 * 天井面に NxNz のグリッド点を作る（シーン単位の [x,y,z]）。
 * 内側フットプリント中心からの矩形に沿わせ、壁際を避けるため使用域は半幅の 60% に制限。
 * X/Z それぞれの広さに応じて分割数を変える（細長い部屋は長辺に多く配灯）。
 */
function ceilingGrid(geom: RoomGeom): Array<[number, number, number]> {
  const { ceilingY, U, centerX, centerZ, halfX, halfZ } = geom;
  const usableX = Math.max(halfX * 0.6, 0.5 * U);
  const usableZ = Math.max(halfZ * 0.6, 0.5 * U);
  const spacing = 2.0 * U; // ~2m 間隔
  const axisCount = (usable: number) => Math.min(3, Math.max(1, Math.round((usable * 2) / spacing) + 1));
  const nx = axisCount(usableX);
  const nz = axisCount(usableZ);
  const coord = (center: number, usable: number, n: number, i: number) =>
    n === 1 ? center : center - usable + 2 * usable * (i / (n - 1));
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      pts.push([coord(centerX, usableX, nx, i), ceilingY, coord(centerZ, usableZ, nz, j)]);
    }
  }
  // 中心に近い順に並べる。シャドウ予算（先頭から消費）と差し色 slice(0,N) が、
  // 部屋の中央＝家具が集まりやすい位置のスポットに優先的に当たるようにする。
  pts.sort(
    (a, b) =>
      (a[0] - centerX) ** 2 + (a[2] - centerZ) ** 2 - ((b[0] - centerX) ** 2 + (b[2] - centerZ) ** 2)
  );
  return pts;
}

// シャドウを落とすライト総数の上限。GPU のテクスチャユニット上限（一般に 16）を
// 超えるとシャドウマップが全て破綻して影が一切出なくなるため、家具/壁テクスチャと
// 共存できるよう数灯に制限する。超過分は castShadow=false の「フィル」スポットにする。
const MAX_SHADOW_CASTERS = 4;

// ─── ムードごとのライト生成 ─────────────────────────────────────────
function buildMoodLights(mood: AutoLightingMoodKey, geom: RoomGeom): LightConfig[] {
  const { ceilingY, U } = geom;
  const lights: LightConfig[] = [];

  // シャドウ予算カウンタ（directional もシャドウを使うため共有）。
  let shadowBudget = MAX_SHADOW_CASTERS;
  const takeShadow = (): boolean => {
    if (shadowBudget > 0) { shadowBudget -= 1; return true; }
    return false;
  };

  const spotAt = (
    pos: [number, number, number],
    color: string,
    intensity: number,
    name: string
  ): LightConfig =>
    createLight("spot", {
      name,
      color,
      intensity,
      position: pos,
      targetPosition: [pos[0], 0, pos[2]], // 真下を照らす
      angle: Math.PI / 5,
      penumbra: 0.5,
      decay: 2,
      spotDistance: ceilingY * 2.2,
      // シャドウ予算内のスポットのみ影を落とす。残りはフィル光。
      castShadow: takeShadow(),
    });

  switch (mood) {
    case "daylight": {
      // 自然な昼の光: 青みのある空光 + 高角度の太陽
      lights.push(
        createLight("hemisphere", { name: "Daylight Sky", color: "#eaf2ff", groundColor: "#c9b89c", intensity: 0.75 }),
        createLight("directional", {
          name: "Daylight Sun", color: "#fff6e0", intensity: 1.5,
          azimuth: 52, elevation: 58, castShadow: takeShadow(),
        })
      );
      break;
    }
    case "evening": {
      // 夕景: 低角度の暖色サン + 暖色スポットの差し色 + 控えめな空光
      lights.push(
        createLight("hemisphere", { name: "Dusk Sky", color: "#ffd9b0", groundColor: "#5a4a3a", intensity: 0.4 }),
        createLight("directional", {
          name: "Dusk Sun", color: "#ff9d5c", intensity: 1.1,
          azimuth: 248, elevation: 14, castShadow: takeShadow(),
        })
      );
      const grid = ceilingGrid(geom);
      // 差し色は中心寄りの最大2灯に絞る
      grid.slice(0, 2).forEach((p, i) => lights.push(spotAt(p, "#ffb070", 1.8, `Warm Accent ${i + 1}`)));
      break;
    }
    case "indirect": {
      // 間接照明: 強い指向光なし、天井ダウンライトのグリッドで柔らかく
      lights.push(
        createLight("hemisphere", { name: "Soft Fill", color: "#fff0d8", groundColor: "#4a4036", intensity: 0.32 })
      );
      ceilingGrid(geom).forEach((p, i) => lights.push(spotAt(p, "#ffdca0", 2.6, `Downlight ${i + 1}`)));
      break;
    }
    case "showroom": {
      // 展示: 中立色で均一に明るく。天井 rect パネルのグリッド + 弱いフィル。
      lights.push(
        createLight("hemisphere", { name: "Showroom Fill", color: "#ffffff", groundColor: "#9aa0a8", intensity: 0.5 }),
        createLight("directional", {
          name: "Showroom Key", color: "#ffffff", intensity: 0.7,
          azimuth: 45, elevation: 65, castShadow: takeShadow(),
        })
      );
      // パネルは内側フットプリントの短辺に合わせる（細長い部屋で過大にならない）。
      const panelSize = Math.max((Math.min(geom.halfX, geom.halfZ) / U) * 0.7, 1.2); // m
      ceilingGrid(geom).forEach((p, i) =>
        lights.push(
          createLight("rect", {
            name: `Ceiling Panel ${i + 1}`,
            color: "#ffffff",
            intensity: 4.5,
            rectPosition: [p[0], ceilingY * 0.98, p[2]],
            rectRotationX: -90, // 下向き
            width: panelSize,
            height: panelSize,
          })
        )
      );
      break;
    }
  }

  return lights;
}

/**
 * 自動ライティング実行（即時）。ムードを指定して、ピン留め以外のライトを置換する。
 * 戻り値: 生成したライト数（呼び出し側のログ/UI用）。
 */
export function autoApplyLighting(mood: AutoLightingMoodKey): number {
  const geom = resolveRoomGeom();
  const generated = buildMoodLights(mood, geom);
  useLightingStore.getState().replaceUnpinnedLights(generated);
  return generated.length;
}

// ─── シネマティック・リビール演出 ───────────────────────────────────
// 「一度シーンを落とし → 環境光/太陽がふわっと立ち上がり → ダウンライトが
//  中央から外へ一灯ずつ点灯していく」という映像的な点灯シーケンス。
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
// なめらかな S 字（slow-in / slow-out）。点灯・暗転を「ふわっと」見せるための主イージング。
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

function rafTween(durationMs: number, onUpdate: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      const t = clamp01((performance.now() - start) / durationMs);
      onUpdate(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

// 同時に複数回押された場合に古いアニメをキャンセルするためのトークン。
let revealToken = 0;

// 進行中のリビール演出をキャンセルする（Base 切替などで呼ぶ）。
// トークンを進めるだけで、走っている rAF ループは次フレームで自ら停止する。
export function cancelLightingReveal(): void {
  revealToken += 1;
}

// リビール優先度: 環境光(0) → 太陽/平行光(1) → スポット/面光源(2)。
function revealRank(type: string): number {
  if (type === "hemisphere") return 0;
  if (type === "directional") return 1;
  return 2; // spot / rect / neon
}
function lightXZ(l: LightConfig): [number, number] {
  const p = l.position ?? l.rectPosition ?? l.neonPosition;
  return p ? [p[0], p[2]] : [0, 0];
}

/**
 * 自動ライティング実行（演出つき）。即時版と同じ置換を、点灯アニメで見せる。
 * 戻り値: 生成したライト数。アニメは非同期に進行する。
 */
export function autoApplyLightingAnimated(mood: AutoLightingMoodKey): number {
  // reduce-motion 設定時、または rAF 不在時は即時版にフォールバック。
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced || typeof requestAnimationFrame === "undefined") {
    return autoApplyLighting(mood);
  }

  const myToken = ++revealToken;
  const geom = resolveRoomGeom();
  const generated = buildMoodLights(mood, geom);

  const ls = useLightingStore.getState();
  const prev = ls.lights;
  const pinned = prev.filter((l) => l.pinned);
  // ピン留めライトの本来の intensity（リビール後に戻す目標値）。
  const pinnedTargets = new Map(pinned.map((l) => [l.id, l.intensity ?? 1]));
  const darkFrom = new Map(prev.map((l) => [l.id, l.intensity ?? 0]));

  const DARK_MS = 560;
  const REVEAL_MS = 2100;

  // ── Phase A: 暗転（現在の全ライトを ~0 までなめらかにフェード）──
  rafTween(DARK_MS, (t) => {
    if (myToken !== revealToken) return;
    const k = 1 - smoothstep(t); // slow-in/slow-out で柔らかく落とす
    useLightingStore.getState().setIntensities(
      prev.map((l) => ({ id: l.id, intensity: (darkFrom.get(l.id) ?? 0) * k }))
    );
  }).then(() => {
    if (myToken !== revealToken) return;

    // ── Phase B: 入れ替え（新ライトは intensity 0 から開始）──
    useLightingStore.getState().replaceUnpinnedLights(
      generated.map((g) => ({ ...g, intensity: 0 }))
    );
    // ピン留めライトも 0 から立ち上げ直す（暗転で ~0 になっているが厳密に 0 へ）。
    useLightingStore.getState().setIntensities(pinned.map((l) => ({ id: l.id, intensity: 0 })));

    // ── Phase C: リビール（環境光→太陽→スポットを中央から外へ順次点灯）──
    const finalLights = useLightingStore.getState().lights; // [...pinned, ...generated]
    const genTargets = new Map(generated.map((g) => [g.id, g.intensity ?? 1]));
    const targetOf = (l: LightConfig) =>
      genTargets.has(l.id) ? genTargets.get(l.id)! : pinnedTargets.get(l.id) ?? l.intensity ?? 1;

    // 点灯順: ランク→中心からの距離（近い順）。スポットは中央から外へ。
    const order = [...finalLights].sort((a, b) => {
      const r = revealRank(a.type) - revealRank(b.type);
      if (r !== 0) return r;
      const [ax, az] = lightXZ(a);
      const [bx, bz] = lightXZ(b);
      return ax * ax + az * az - (bx * bx + bz * bz);
    });

    // 各ライトのタイムライン上の開始位置と長さ（0–1 正規化）。
    const pointish = order.filter((l) => revealRank(l.type) === 2);
    const M = Math.max(pointish.length, 1);
    // スポットの開始タイミングを広く分散させつつ、各灯のフェードを長く取って
    // 隣接灯と大きくオーバーラップさせる（＝硬いポップを避けて連続的に滲ませる）。
    const SPOT_START0 = 0.16;
    const SPOT_WINDOW = 0.42; // 最後のスポットが ~0.58 に開始
    const SPOT_SPAN = 0.42;   // 1灯あたりのフェード長（長め＝柔らかい）
    const slots = order.map((l) => {
      const target = targetOf(l);
      // 環境光・太陽は最初から長い時間をかけてゆっくり立ち上げ、ベースの明るさを作る。
      if (l.type === "hemisphere") return { id: l.id, target, start: 0.0, span: 0.8 };
      if (l.type === "directional") return { id: l.id, target, start: 0.06, span: 0.78 };
      const i = pointish.indexOf(l);
      const start = SPOT_START0 + (M > 1 ? i / (M - 1) : 0) * SPOT_WINDOW;
      return { id: l.id, target, start, span: SPOT_SPAN };
    });

    rafTween(REVEAL_MS, (t) => {
      if (myToken !== revealToken) return;
      useLightingStore.getState().setIntensities(
        slots.map((s) => {
          const lt = clamp01((t - s.start) / s.span);
          return { id: s.id, intensity: s.target * smootherstep(lt) }; // 柔らかいブルーム
        })
      );
    }).then(() => {
      if (myToken !== revealToken) return;
      // 最終値を厳密にターゲットへ揃える。
      useLightingStore.getState().setIntensities(order.map((l) => ({ id: l.id, intensity: targetOf(l) })));
    });
  });

  return generated.length;
}
