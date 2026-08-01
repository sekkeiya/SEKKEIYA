import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useMaterialViewStore } from "../store/useMaterialViewStore";
import { useElevationMarkerStore } from "../store/useElevationMarkerStore";
import { useSceneObjectRegistryStore } from "../store/sceneObjectRegistryStore";
import { useWallStore } from "../store/useWallStore";
import { useGridAxisStore } from "../store/useGridAxisStore";
import { useBuildingSpecStore } from "../store/useBuildingSpecStore";
import { useSectionLinesStore } from "../store/useSectionLinesStore";
import { measureXZBounds } from "../utils/planBounds";
import { sectionFrameSpan } from "../utils/sectionFrame";

// 断面の切断位置を示す矩形フレーム（塗り＋外枠ライン）。
// どの軸でどこを切っているか一目で分かるように、軸色で可視化する。
function CutPlaneFrame({ w, h, color, label }) {
  const pts = useMemo(() => {
    const hw = w / 2, hh = h / 2;
    return [[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0], [-hw, -hh, 0]];
  }, [w, h]);
  return (
    <>
      <mesh raycast={() => null} userData={{ ignoreClipping: true }}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={pts} color={color} lineWidth={1.6} transparent opacity={0.85} depthTest={false} />
      {/* 何を切っている枠かを示すラベル。枠の角に置く（中央だと建物に重なって読めない）。
          Html はカメラを向くので、枠の回転に関わらず文字は水平のまま読める。 */}
      {label && (
        <Html position={[-w / 2, h / 2, 0]} center zIndexRange={[17, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 0.2, whiteSpace: "nowrap",
              color: "#0f172a", background: "rgba(255,255,255,0.92)",
              border: `1.5px solid ${color}`, borderRadius: 4, padding: "1px 6px",
              fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)", userSelect: "none",
            }}
          >
            {label}
          </div>
        </Html>
      )}
    </>
  );
}

// passive: クリップ面の「書き込み」を行わず、他のビューポートが設定した面をそのまま使う。
//   2画面表示ではマテリアル実体が左右のシーンで共有される（gltf.scene.clone() はマテリアルを
//   複製しない）ため、両ペインが別々の面を書くと毎フレーム奪い合い、needsUpdate による
//   シェーダ再コンパイルが多発する。そこで書き込み役は図面ペイン（右）に一本化し、
//   平面ペイン（左）は passive にする。
export default function SectionClipManager({ isTopView = false, passive = false, is2DView = false }) {
  const { gl, scene, invalidate } = useThree();

  const sectionClipEnabledRaw = useEditorModeStore((s) => s.isSectionClipEnabled);
  const editorMode            = useEditorModeStore((s) => s.editorMode);
  const materialFirstPerson   = useMaterialViewStore((s) => s.firstPerson);
  // 一人称（ウォークスルー＝Preview / Material 見渡し）中は断面カットを無効化する。
  // 室内に入った視点で断面が効くと壁が消えてしまうため。
  // それ以外は editorMode に依らずビューポート設定（isSectionClipEnabled）に従う＝全モード統一。
  const isSectionClipEnabled  = sectionClipEnabledRaw && editorMode !== "walkthrough" && !materialFirstPerson;
  const sectionClipHeight    = useEditorModeStore((s) => s.sectionClipHeight);
  const sectionClipYEnabled  = useEditorModeStore((s) => s.sectionClipYEnabled);
  // Y クリップの向き。false=上を消す（平面図の見下ろし）/ true=下を消す（天井伏図の見上げ）
  const sectionClipYInvert   = useEditorModeStore((s) => s.sectionClipYInvert);
  const sectionClipXEnabled  = useEditorModeStore((s) => s.sectionClipXEnabled);
  const sectionClipX         = useEditorModeStore((s) => s.sectionClipX);
  const sectionClipZEnabled  = useEditorModeStore((s) => s.sectionClipZEnabled);
  const sectionClipZ         = useEditorModeStore((s) => s.sectionClipZ);
  const sectionViewFlip      = useEditorModeStore((s) => s.sectionViewFlip);
  const sceneMaxY            = useEditorModeStore((s) => s.sceneMaxY);
  const sceneExtentXZ        = useEditorModeStore((s) => s.sceneExtentXZ);

  // 断面フレームの範囲。
  //   ⚠️ sceneExtentXZ は BaseGlb / ParametricRoom でしか設定されない「原点からの半径」。
  //      S.Layout で作図しただけの建物では入らず、枠が最小値まで縮んで建物を覆えない。
  //      また原点中心に置くので、建物が原点からずれていると片側にはみ出す。
  //   そこで実測（躯体 GLB ＋ 作図した壁）と通り芯から範囲を出し、枠をその中心に置く。
  //   端は通り芯にそろえる（図面と同じ規則）が、建物より小さくはしない（utils/sectionFrame）。
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders);
  const walls         = useWallStore((s) => s.walls);
  const gridAxes      = useGridAxisStore((s) => s.axes);
  const glMm          = useBuildingSpecStore((s) => s.glMm);
  const fl0Mm         = useBuildingSpecStore((s) => s.fl0Mm);
  const sectionLines  = useSectionLinesStore((s) => s.lines);

  const isMm = (sceneMaxY || 0) > 100;
  const w = useCallback((mm) => (isMm ? mm : mm / 1000), [isMm]);

  const frame = useMemo(() => {
    const b = measureXZBounds(baseColliders, walls, w);
    // 実測できないうちは従来の原点中心・シーン範囲でフォールバックする。
    const half = Math.max(sceneExtentXZ || 0, sceneMaxY || 0, w(3000));
    const loX = b ? b.minX : -half, hiX = b ? b.maxX : half;
    const loZ = b ? b.minZ : -half, hiZ = b ? b.maxZ : half;
    const pad = w(1000);
    const gx = (gridAxes || []).filter((a) => a?.axis === "x").map((a) => w(a.pos));
    const gz = (gridAxes || []).filter((a) => a?.axis === "z").map((a) => w(a.pos));
    const [x0, x1] = sectionFrameSpan(gx, loX, hiX, pad);
    const [z0, z1] = sectionFrameSpan(gz, loZ, hiZ, pad);
    // 縦は GL 〜 建物頂部。GL は FL±0 からの相対なので fl0 を足す。
    const glW = w((fl0Mm || 0) + (glMm || 0));
    const topW = Math.max(b ? b.maxY : 0, sceneMaxY || 0, w(3000)) + pad;
    const y0 = Math.min(glW, 0);
    return {
      x0, x1, z0, z1, y0, y1: topW,
      cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, cy: (y0 + topW) / 2,
      wX: x1 - x0, wZ: z1 - z0, hY: topW - y0,
    };
  }, [baseColliders, walls, gridAxes, sceneExtentXZ, sceneMaxY, glMm, fl0Mm, w]);

  /** その位置にある断面線の名前を返す（「断面 A-A'」）。線が無ければ軸名で代用する。 */
  const labelFor = useCallback((axis, posWorld) => {
    // SectionLine.pos は sectionClipX/Z と同スケール（world）なので、そのまま比べる。
    const tol = w(200);
    const line = (sectionLines || []).find(
      (l) => l?.axis === axis && Math.abs((l.pos ?? 0) - posWorld) <= tol,
    );
    if (line?.name) return `断面 ${line.name}`;
    return axis === "x" ? "断面（左右 X）" : "断面（前後 Z）";
  }, [sectionLines, w]);

  const lastUpdateRef = useRef(0);

  // Stable plane objects — constants are mutated in useEffect below
  // Y plane (height): show y ≤ sectionClipHeight  → normal=(0,-1,0), const=sectionClipHeight
  const clipPlaneY = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionClipHeight), []);
  // X plane (left-right): show x ≤ sectionClipX   → normal=(-1,0,0), const=sectionClipX
  const clipPlaneX = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionClipX), []);
  // Z plane (front-back): show z ≤ sectionClipZ   → normal=(0,0,-1),  const=sectionClipZ
  const clipPlaneZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), sectionClipZ), []);

  // 展開図ビュー: 「記号位置で切った断面」を部屋の範囲（左右・上下）でクロップする。
  //   断面（A-A' 等）との違いはクロップの有無だけ。奥（far）は切らない——
  //   断面と同じく、見ている壁が不透明なので奥の部屋は自然に隠れる。
  //   far で切ると、そのクリップ面が奥の部屋の壁を輪切りにして黒い断口
  //   （SectionCapFill のポシェ）を作ってしまう＝「表示されるべきでない黒い壁」の正体。
  const elevViewActive = useElevationMarkerStore((s) => s.viewActive);
  const elevRoomBox = useElevationMarkerStore((s) => s.roomBox);
  const elevationPlanes = useMemo(() => {
    if (!elevViewActive || !elevRoomBox) return null;
    const b = elevRoomBox;
    const axis = sectionClipXEnabled ? "x" : "z";
    const s = sectionViewFlip ? 1 : -1; // 視線方向の符号（−Z/−X が既定）
    const m = axis === "x" ? sectionClipX : sectionClipZ; // マーカー（視点）位置
    const ax = axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const planes = [];
    // near: 視点の背面側を消す → keep s*(p−m) ≥ 0（断面の切断面と同じ）
    planes.push(new THREE.Plane(ax.clone().multiplyScalar(s), -s * m));
    // 横方向: 部屋の左右端で切る（隣室を消す）
    const o = axis === "x" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const oMin = axis === "x" ? b.minZ : b.minX;
    const oMax = axis === "x" ? b.maxZ : b.maxX;
    planes.push(new THREE.Plane(o.clone(), -oMin));                  // keep o ≥ min
    planes.push(new THREE.Plane(o.clone().multiplyScalar(-1), oMax)); // keep o ≤ max
    // 上下: 床〜天井
    planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -b.yMin)); // keep y ≥ 床
    planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), b.yMax)); // keep y ≤ 天井
    return planes;
  }, [elevViewActive, elevRoomBox, sectionClipXEnabled, sectionViewFlip, sectionClipX, sectionClipZ]);

  // Active plane array — rebuilt whenever enabled flags change.
  // Top（平面）ビューでは縦の断面（X=左右 / Z=前後）は無意味なので無視し、
  // 高さ断面（clipPlaneY）だけを適用する。これにより天井が抜けて採光され、真っ黒にならない。
  const activePlanes = useMemo(() => {
    if (!isSectionClipEnabled) return [];
    // 展開図（部屋ボックスあり）は専用の6面クリップで部屋の内側だけを表示
    if (!isTopView && elevationPlanes) return elevationPlanes;
    const result = [];
    if (sectionClipYEnabled) result.push(clipPlaneY);
    if (!isTopView) {
      if (sectionClipXEnabled) result.push(clipPlaneX);
      if (sectionClipZEnabled) result.push(clipPlaneZ);
    }
    return result;
  }, [isSectionClipEnabled, isTopView, sectionClipYEnabled, sectionClipXEnabled, sectionClipZEnabled,
      clipPlaneY, clipPlaneX, clipPlaneZ, elevationPlanes]);

  // Sync plane constants whenever cut positions change.
  // frameloop="demand" の viewport では値変更だけでは再描画されないため、invalidate() で再描画を要求する
  // （これが無いと操作後しばらく断面が反映されない＝効いていないように見える）。
  useEffect(() => {
    // 通常: 「高さ以下を残す」(normal −Y, const=+h)。反転（天井伏図）: 「高さ以上を残す」(normal +Y, const=−h)。
    clipPlaneY.normal.set(0, sectionClipYInvert ? 1 : -1, 0);
    clipPlaneY.constant = sectionClipYInvert ? -sectionClipHeight : sectionClipHeight;
    invalidate();
  }, [sectionClipHeight, sectionClipYInvert, clipPlaneY, invalidate]);

  // 向き反転（sectionViewFlip）: 通常は「pos 以下側を残す」（normal −1, const=pos）、
  // 反転時は「pos 以上側を残す」（normal +1, const=−pos）。A-A' の矢印向きと連動する。
  useEffect(() => {
    clipPlaneX.normal.set(sectionViewFlip ? 1 : -1, 0, 0);
    clipPlaneX.constant = sectionViewFlip ? -sectionClipX : sectionClipX;
    invalidate();
  }, [sectionClipX, sectionViewFlip, clipPlaneX, invalidate]);

  useEffect(() => {
    clipPlaneZ.normal.set(0, 0, sectionViewFlip ? 1 : -1);
    clipPlaneZ.constant = sectionViewFlip ? -sectionClipZ : sectionClipZ;
    invalidate();
  }, [sectionClipZ, sectionViewFlip, clipPlaneZ, invalidate]);

  // 軸の ON/OFF や有効化・ビュー種別変化でも即再描画。
  // さらに lastUpdateRef をリセットして、useFrame のスロットル(0.25s)を待たずに
  // 次フレームで即クリップを反映する（ビュー/軸切替で断面が出るまでの遅延を防ぐ）。
  useEffect(() => {
    lastUpdateRef.current = -Infinity;
    invalidate();
  }, [
    isSectionClipEnabled, isTopView, sectionClipYEnabled, sectionClipYInvert, sectionClipXEnabled, sectionClipZEnabled, invalidate,
  ]);

  // Enable/disable local clipping on the renderer
  // （localClippingEnabled は renderer 単位なので passive でも自分の canvas に設定する）
  useEffect(() => {
    gl.localClippingEnabled = isSectionClipEnabled;

    // When disabled: immediately scrub all planes from materials
    if (!isSectionClipEnabled && !passive) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          const clearPlanes = (mat) => {
            if (mat.clippingPlanes && mat.clippingPlanes.length > 0) {
              mat.clippingPlanes = [];
              mat.needsUpdate = true;
            }
          };
          if (Array.isArray(child.material)) {
            child.material.forEach(clearPlanes);
          } else {
            clearPlanes(child.material);
          }
        }
      });
    }
  }, [gl, scene, isSectionClipEnabled, passive]);

  // Robustly apply active planes to all (new) meshes ~4×/sec
  //
  // ignoreClipping が付いたオブジェクトは「その配下ごと」対象外にする（traverse ではなく
  // 自前の再帰で枝ごと刈る）。断面で切るのは躯体の話で、編集ハンドルのような UI ギズモは
  // 切ってはいけない: 壁・床の頂点ハンドルは掴みやすさのために壁の立体より上（＝平面図の
  // カット高さより上）へ浮かせてあるため、クリップを掛けると丸ごと消えてしまう。
  // マウントした瞬間のマテリアルにはまだ面が付いていないので、「選択した直後だけ見えて
  // 0.25秒後に消える」という挙動になっていた。
  const applyClipToSubtree = useCallback((obj) => {
    if (obj.userData?.ignoreClipping) return; // この枝は UI ギズモ等（断面の対象外）
    if (obj.isMesh && obj.material) {
      const applyPlanes = (mat) => {
        const current = mat.clippingPlanes;
        // Re-apply if length changed or planes differ
        if (!current || current.length !== activePlanes.length ||
            activePlanes.some((p, i) => current[i] !== p)) {
          mat.clippingPlanes = activePlanes.length > 0 ? activePlanes : [];
          // clipShadows は付けない。true にすると three.js がシャドウパス用に
          // 「クリップ版デプスマテリアル」を別途初コンパイルし、ビュー初切替時に数秒の
          // フリーズを招く（断面の立面ビューでシャドウのクリップは不要）。
          mat.clipShadows = false;
          mat.needsUpdate = true;
        }
      };
      if (Array.isArray(obj.material)) {
        obj.material.forEach(applyPlanes);
      } else {
        applyPlanes(obj.material);
      }
    }
    const kids = obj.children;
    for (let i = 0; i < kids.length; i++) applyClipToSubtree(kids[i]);
  }, [activePlanes]);

  // クリップ面の実体（activePlanes）が変わったら即・同期でマテリアルへ適用する。
  //   useFrame の 0.25s スロットルを待つと、展開図の6面クリップ（部屋ボックス）切替や
  //   展開⇄断面/立面の切替で「旧クリップのままの絵」が最大250ms見えてしまう
  //   （軸フラグが同じで上のリセット effect では検知できないケース: 展開A→展開C、
  //    展開→同軸の断面 等）。ビュー切替ディゾルブの不透明保持内に収めるため今適用する。
  //   ※ applyClipToSubtree 定義後に置く（TDZ 回避）。
  // このビューが「今は切る面を持たない」＝ activePlanes 空のときは、マテリアルへ書き込まない
  // （＝ passive 相当に振る舞う）。
  //   SINGLE レイアウトでは top/persp/front/right の4 Canvas が常時マウントされ、GLB の
  //   マテリアルは clone 間で共有される（gltf.scene.clone() はマテリアルを複製しない）。
  //   断面(X/Z)表示中、Top ビューは高さ(Y)断面しか扱わないので activePlanes が空になり、
  //   その空面を共有マテリアルへ焼くと、断面ペインが設定したクリップ面を消してしまう。
  //   クリップが消えると切り口の黒ポシェ(SectionCapFill のステンシル)は front/back が相殺して
  //   カウント0＝黒く塗られなくなる。これが effect の実行順しだいで起きるため、A-A'/B-B' 切替で
  //   黒塗りが出たり出なかったりしていた（本修正で空面書き込みを止めて安定させる）。
  //   ※ 断面を完全に無効化(!isSectionClipEnabled)したときの掃除は上の別 effect が担うので、
  //     ここで空面を書く必要はない。
  const shouldWrite = isSectionClipEnabled && !passive && activePlanes.length > 0;

  useEffect(() => {
    if (!shouldWrite) return;
    lastUpdateRef.current = -Infinity;
    try { applyClipToSubtree(scene); } catch { /* noop */ }
    invalidate();
  }, [activePlanes, shouldWrite, applyClipToSubtree, scene, invalidate]);

  useFrame((state) => {
    if (!shouldWrite) return;

    const now = state.clock.elapsedTime;
    if (now - lastUpdateRef.current < 0.25) return;
    lastUpdateRef.current = now;

    applyClipToSubtree(scene);
  });

  if (!isSectionClipEnabled) return null;
  // 2D 作図ビュー（平面/天井/断面/立面）では切断面フレームを出さない。クリップ自体（materialへの
  // 焼き込み）と切り口の黒ポシェ(SectionCapFill)は上のフック/別コンポーネントで効いているので、
  // ここで消すのは「どこを切っているか示す枠」だけ。枠は 3D（パース）でのみ表示する。
  if (is2DView) return null;

  return (
    <group userData={{ isSectionRef: true }}>
      {/* Y (高さ) 断面フレーム — 水平。色は緑（スライダーと一致） */}
      {sectionClipYEnabled && (
        <group position={[frame.cx, sectionClipHeight, frame.cz]} rotation={[-Math.PI / 2, 0, 0]}>
          <CutPlaneFrame
            w={frame.wX} h={frame.wZ} color="#a5d6a7"
            label={`断面高さ ${Math.round(isMm ? sectionClipHeight : sectionClipHeight * 1000)}mm`}
          />
        </group>
      )}
      {/* X (左右) 断面フレーム — YZ 平面。色は赤。Top では非表示。 */}
      {!isTopView && sectionClipXEnabled && (
        <group position={[sectionClipX, frame.cy, frame.cz]} rotation={[0, Math.PI / 2, 0]}>
          <CutPlaneFrame w={frame.wZ} h={frame.hY} color="#ef9a9a" label={labelFor("x", sectionClipX)} />
        </group>
      )}
      {/* Z (前後) 断面フレーム — XY 平面。色は青。Top では非表示。 */}
      {!isTopView && sectionClipZEnabled && (
        <group position={[frame.cx, frame.cy, sectionClipZ]} rotation={[0, 0, 0]}>
          <CutPlaneFrame w={frame.wX} h={frame.hY} color="#90caf9" label={labelFor("z", sectionClipZ)} />
        </group>
      )}
    </group>
  );
}
