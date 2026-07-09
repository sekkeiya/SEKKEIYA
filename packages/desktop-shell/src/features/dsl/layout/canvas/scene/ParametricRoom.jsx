// src/features/dsl/layout/canvas/scene/ParametricRoom.jsx
// データ駆動（パラメトリック）の躯体ルーム。
// roomSpec { widthMm, depthMm, heightMm, wallThicknessMm } から床 + 四方の壁を
// ライブ描画する。BaseGlb と同じく baseMeshes / sceneMaxY / sceneExtentXZ を外へ通知し、
// Raycast・スナップ・断面クリップなどの既存パイプラインと互換にする。
import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useEditorModeStore } from "../../store/useEditorModeStore";

export const DEFAULT_ROOM_SPEC = {
  widthMm: 10000,
  depthMm: 10000,
  heightMm: 3000,
  wallThicknessMm: 100,
};

export function normalizeRoomSpec(spec) {
  const s = spec || {};
  return {
    widthMm: clamp(Number(s.widthMm) || DEFAULT_ROOM_SPEC.widthMm, 1000, 100000),
    depthMm: clamp(Number(s.depthMm) || DEFAULT_ROOM_SPEC.depthMm, 1000, 100000),
    heightMm: clamp(Number(s.heightMm) || DEFAULT_ROOM_SPEC.heightMm, 1000, 20000),
    wallThicknessMm: clamp(Number(s.wallThicknessMm) || DEFAULT_ROOM_SPEC.wallThicknessMm, 20, 1000),
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export default function ParametricRoom({ spec, onLoaded, isTopView = false }) {
  const groupRef = useRef(null);
  const setSceneMaxY = useEditorModeStore((s) => s.setSceneMaxY);
  const setSceneExtentXZ = useEditorModeStore((s) => s.setSceneExtentXZ);

  const { widthMm: W, depthMm: D, heightMm: H, wallThicknessMm: T } = useMemo(
    () => normalizeRoomSpec(spec),
    [spec?.widthMm, spec?.depthMm, spec?.heightMm, spec?.wallThicknessMm]
  );

  // 共有マテリアル（床・壁）
  const floorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xeae6df, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide }),
    []
  );
  // 立体表示（パース/アイソメ）用の壁マテリアル
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xf5f1ea, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide }),
    []
  );
  // 平面図ポシェ用：無光源の真っ黒。depthTest 無効＋最前面描画で、
  // 断面クリップや壁高さに左右されず常にトップビューで黒く表示される。
  const fillMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
    []
  );
  useEffect(() => () => { floorMat.dispose(); wallMat.dispose(); fillMat.dispose(); }, [floorMat, wallMat, fillMat]);

  // 壁の定義（床上面 y=0 から天井 y=H まで）
  // 床は外寸 W×D。壁は床フットプリントの「内側」に収める（外面を床端に合わせる）ことで、
  // 平面図のポシェ（黒い壁帯）が暗い背景に溶けず、明るい床の上にきちんと表示される。
  const walls = useMemo(() => {
    const ix = W / 2 - T / 2; // 壁芯（外面を床端に合わせるための内側オフセット）
    const iz = D / 2 - T / 2;
    return [
      { name: "wall_north", size: [W, H, T], pos: [0, H / 2, -iz] },
      { name: "wall_south", size: [W, H, T], pos: [0, H / 2, iz] },
      { name: "wall_west", size: [T, H, D], pos: [-ix, H / 2, 0] },
      { name: "wall_east", size: [T, H, D], pos: [ix, H / 2, 0] },
    ];
  }, [W, D, H, T]);

  // isTopView は呼び出し側（このビューポートが真上＝Top か）から受け取る。
  // → Top のときだけ壁を黒く塗りつぶし、Perspective では塗りつぶさない。

  // 壁の平面フットプリント（ポシェ用の黒い面）— 床直上に水平配置。
  const sectionFills = useMemo(() => {
    const ix = W / 2 - T / 2;
    const iz = D / 2 - T / 2;
    return [
      { name: "fill_north", size: [W, T], pos: [0, -iz] },
      { name: "fill_south", size: [W, T], pos: [0, iz] },
      { name: "fill_west", size: [T, D], pos: [-ix, 0] },
      { name: "fill_east", size: [T, D], pos: [ix, 0] },
    ];
  }, [W, D, T]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.updateMatrixWorld(true);

    // baseMeshes 収集（Raycast はヒット後に法線で壁/床を判定する既存仕様に合わせる）
    const baseMeshes = [];
    g.traverse((o) => {
      if (!o?.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.userData.isStructuralBase = true;
      baseMeshes.push(o);
    });

    // 断面クリップ・スライダー用に高さ/XZ 範囲をストアへ
    setTimeout(() => {
      setSceneMaxY(H);
      setSceneExtentXZ(Math.max(W, D) / 2);
    }, 0);

    if (typeof onLoaded === "function") {
      try { onLoaded({ root: g, snap: { baseMeshes } }); } catch {}
    }
    return () => {
      if (typeof onLoaded === "function") {
        try { onLoaded(null); } catch {}
      }
    };
  }, [W, D, H, T, onLoaded, setSceneMaxY, setSceneExtentXZ]);

  return (
    <group ref={groupRef} name="parametric-room">
      {/* 床（上面を y=0 に） */}
      <mesh position={[0, -T / 2, 0]} castShadow receiveShadow material={floorMat} name="floor" userData={{ isStructuralBase: true }}>
        <boxGeometry args={[W, T, D]} />
      </mesh>
      {/* 四方の壁（立体） */}
      {walls.map((w) => (
        <mesh
          key={w.name}
          position={w.pos}
          castShadow
          receiveShadow
          material={wallMat}
          name={w.name}
          userData={{ isStructuralBase: true }}
        >
          <boxGeometry args={w.size} />
        </mesh>
      ))}

      {/* 平面図ポシェ：トップビューのみ、壁フットプリントを床直上に黒く塗る（断面表現） */}
      {isTopView && (
        <group name="section-fills">
          {sectionFills.map((f) => (
            <mesh
              key={f.name}
              position={[f.pos[0], 20, f.pos[1]]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={fillMat}
              name={f.name}
              renderOrder={9999}
              raycast={() => null}
              userData={{ isSectionFill: true }}
            >
              <planeGeometry args={f.size} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
