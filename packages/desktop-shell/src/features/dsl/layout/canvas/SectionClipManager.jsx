import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useMaterialViewStore } from "../store/useMaterialViewStore";
import { useElevationMarkerStore } from "../store/useElevationMarkerStore";

// 断面の切断位置を示す矩形フレーム（塗り＋外枠ライン）。
// どの軸でどこを切っているか一目で分かるように、軸色で可視化する。
function CutPlaneFrame({ w, h, color }) {
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
    </>
  );
}

// passive: クリップ面の「書き込み」を行わず、他のビューポートが設定した面をそのまま使う。
//   2画面表示ではマテリアル実体が左右のシーンで共有される（gltf.scene.clone() はマテリアルを
//   複製しない）ため、両ペインが別々の面を書くと毎フレーム奪い合い、needsUpdate による
//   シェーダ再コンパイルが多発する。そこで書き込み役は図面ペイン（右）に一本化し、
//   平面ペイン（左）は passive にする。
export default function SectionClipManager({ isTopView = false, passive = false }) {
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

  // 断面フレームのサイズ（シーン範囲に合わせる。未取得時は安全な既定値）。
  const frameHalfXZ = Math.max(sceneExtentXZ || 0, sceneMaxY || 0, 3);
  const frameW      = frameHalfXZ * 2.2;
  const frameTopY   = Math.max(sceneMaxY || 0, 3) * 1.05;

  const lastUpdateRef = useRef(0);

  // Stable plane objects — constants are mutated in useEffect below
  // Y plane (height): show y ≤ sectionClipHeight  → normal=(0,-1,0), const=sectionClipHeight
  const clipPlaneY = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionClipHeight), []);
  // X plane (left-right): show x ≤ sectionClipX   → normal=(-1,0,0), const=sectionClipX
  const clipPlaneX = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionClipX), []);
  // Z plane (front-back): show z ≤ sectionClipZ   → normal=(0,0,-1),  const=sectionClipZ
  const clipPlaneZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), sectionClipZ), []);

  // 展開図ビュー: 表示範囲を「部屋の内側ボックス」に制限する（断面図との違い）。
  //   視線軸の手前=マーカー位置 / 奥・左右=ゾーン境界＋壁厚 / 上下=床〜天井。
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
    // near: 視点の背面側を消す → keep s*(p−m) ≥ 0
    planes.push(new THREE.Plane(ax.clone().multiplyScalar(s), -s * m));
    // far: 対象壁の外側で切る → keep s*p ≤ s*edge
    const farEdge = axis === "x" ? (s > 0 ? b.maxX : b.minX) : (s > 0 ? b.maxZ : b.minZ);
    planes.push(new THREE.Plane(ax.clone().multiplyScalar(-s), s * farEdge));
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
  useEffect(() => {
    if (!isSectionClipEnabled || passive) return;
    lastUpdateRef.current = -Infinity;
    try { applyClipToSubtree(scene); } catch { /* noop */ }
    invalidate();
  }, [activePlanes, isSectionClipEnabled, passive, applyClipToSubtree, scene, invalidate]);

  useFrame((state) => {
    if (!isSectionClipEnabled || passive) return;

    const now = state.clock.elapsedTime;
    if (now - lastUpdateRef.current < 0.25) return;
    lastUpdateRef.current = now;

    applyClipToSubtree(scene);
  });

  if (!isSectionClipEnabled) return null;

  return (
    <group userData={{ isSectionRef: true }}>
      {/* Y (高さ) 断面フレーム — 水平。色は緑（スライダーと一致） */}
      {sectionClipYEnabled && (
        <group position={[0, sectionClipHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <CutPlaneFrame w={frameW} h={frameW} color="#a5d6a7" />
        </group>
      )}
      {/* X (左右) 断面フレーム — YZ 平面。色は赤。Top では非表示。 */}
      {!isTopView && sectionClipXEnabled && (
        <group position={[sectionClipX, frameTopY / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <CutPlaneFrame w={frameW} h={frameTopY} color="#ef9a9a" />
        </group>
      )}
      {/* Z (前後) 断面フレーム — XY 平面。色は青。Top では非表示。 */}
      {!isTopView && sectionClipZEnabled && (
        <group position={[0, frameTopY / 2, sectionClipZ]} rotation={[0, 0, 0]}>
          <CutPlaneFrame w={frameW} h={frameTopY} color="#90caf9" />
        </group>
      )}
    </group>
  );
}
