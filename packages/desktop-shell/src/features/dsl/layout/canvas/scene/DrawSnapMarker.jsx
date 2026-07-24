// DrawSnapMarker — 作図中に「今どこへ吸着しているか」を示すマーカー。
//   何に吸着したか分からないままだと、意図しない位置で線が確定してしまうため、
//   吸着している間だけ小さな印とラベル（通り芯 X1 / 壁芯 など）を出す。
//   点への吸着＝四角、線への吸着＝丸、で形を分けて一目で区別できるようにする。
import React from "react";
import { Html, Line } from "@react-three/drei";

const COLOR = {
  point: "#f59e0b",      // 端点 = オレンジ（いちばん強い吸着）
  axisCross: "#f59e0b",  // 通り芯の交点も点扱い
  axis: "#0369a1",       // 通り芯の線 = 青
  wall: "#16a34a",       // 壁芯 = 緑
  slabEdge: "#16a34a",   // 床の辺 = 緑
};

/**
 * snap: resolveDrawSnap の戻り値（kind が null なら何も描かない）
 * y: 平面図で描く高さ（作図プレーンの少し上）
 * size: マーカーの半径(world)
 */
export default function DrawSnapMarker({ snap, y = 0, size = 90 }) {
  if (!snap || !snap.kind) return null;
  const col = COLOR[snap.kind] || "#0369a1";
  const { x, z } = snap;
  const isPoint = snap.kind === "point" || snap.kind === "axisCross";

  // 点＝四角、線＝ひし形（丸だと他のハンドルと紛らわしいため形で分ける）
  const pts = isPoint
    ? [
        [x - size, y, z - size], [x + size, y, z - size],
        [x + size, y, z + size], [x - size, y, z + size],
        [x - size, y, z - size],
      ]
    : [
        [x, y, z - size], [x + size, y, z],
        [x, y, z + size], [x - size, y, z],
        [x, y, z - size],
      ];

  return (
    <group>
      {/* renderOrder は group ではなく Line 自身に付ける（three.js は親から継承しない）。
          付けないと既定 0 のまま＝床面(9980)や壁ポシェ(9990)より先に描かれて埋もれる。 */}
      <Line points={pts} color={col} lineWidth={1.8} transparent opacity={0.95} depthTest={false} renderOrder={9995} userData={{ ignoreClipping: true }} />
      {snap.label && (
        <Html position={[x, y, z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              transform: `translate(${size ? 18 : 0}px, -22px)`,
              padding: "1px 6px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 800,
              whiteSpace: "nowrap",
              color: "#fff",
              background: col,
              boxShadow: "0 1px 3px rgba(15,23,42,0.35)",
              fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
            }}
          >
            {snap.label}
          </div>
        </Html>
      )}
    </group>
  );
}
