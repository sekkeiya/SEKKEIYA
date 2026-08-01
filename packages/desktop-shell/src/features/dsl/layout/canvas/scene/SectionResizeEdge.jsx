// SectionResizeEdge — 断面ビューのリサイズ操作を「切り口（黒バー）の辺」で受ける。
//   点のハンドルではなく辺全体を掴めるので当たり判定が広く、中心の移動ギズモとも重ならない。
//   ホバーで辺に直交する resize カーソルへ変え、左ドラッグでサイズを変える（平面図の
//   SlabEditController の辺ドラッグと同じ操作感）。
//
//   見た目は「ホバー中とドラッグ中だけ」細いハイライト線を出す。常時何かを描くと、
//   切り口の輪郭や移動ギズモと混ざって図面が読みにくくなるため。
//
//   座標系: 断面は視線軸に直交する鉛直面。
//     sideAxis="x"（FRONT・Z を見る）… 画面横 = world X、面は z = planeAt
//     sideAxis="z"（RIGHT・X を見る）… 画面横 = world Z、面は x = planeAt
import React, { useState } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useHoverCursor } from "./useHoverCursor";

const HILITE = "#38bdf8";

export default function SectionResizeEdge({
  sideAxis,
  /** 視線軸上の断面位置（world）。切り口の面に乗せる。 */
  planeAt,
  /** 横方向の範囲（world）。 */
  loH,
  hiH,
  /** 縦方向の範囲（world）。 */
  y0,
  y1,
  /** "top" | "bottom" | "left" | "right" */
  edge,
  onPointerDown,
  /** 当たり判定の帯の幅（world）。呼び手が画面 px から換算して渡す。 */
  thickness,
  /** この辺をドラッグ中か。ドラッグ中はポインタが外れてもハイライトを残す。 */
  active = false,
}) {
  const [hovered, setHovered] = useState(false);
  const cursorApi = useHoverCursor();
  const shown = hovered || active;

  const isHorizontal = edge === "top" || edge === "bottom";
  const cursor = isHorizontal ? "ns-resize" : "ew-resize";

  // 帯の中心と大きさ（局所の [横, 縦]）。
  const h = edge === "left" ? loH : edge === "right" ? hiH : (loH + hiH) / 2;
  const y = edge === "top" ? y1 : edge === "bottom" ? y0 : (y0 + y1) / 2;
  const w = isHorizontal ? Math.abs(hiH - loH) : thickness;
  const hgt = isHorizontal ? thickness : Math.abs(y1 - y0);

  // world 位置。横方向の軸は sideAxis、奥行きは断面の面上。
  const pos = sideAxis === "x" ? [h, y, planeAt] : [planeAt, y, h];
  // PlaneGeometry は XY 面（+Z 向き）。sideAxis="z" のときは横方向を world Z へ向ける。
  const rot = sideAxis === "x" ? [0, 0, 0] : [0, Math.PI / 2, 0];

  // ハイライト線（辺そのもの）の両端。
  const a = sideAxis === "x"
    ? (isHorizontal ? [loH, y, planeAt] : [h, y0, planeAt])
    : (isHorizontal ? [planeAt, y, loH] : [planeAt, y0, h]);
  const b = sideAxis === "x"
    ? (isHorizontal ? [hiH, y, planeAt] : [h, y1, planeAt])
    : (isHorizontal ? [planeAt, y, hiH] : [planeAt, y1, h]);

  return (
    <group>
      {/* 当たり判定の帯（透明）。常に存在するので、見えていなくても掴める。 */}
      <mesh
        position={pos}
        rotation={rot}
        renderOrder={10001}
        onPointerDown={onPointerDown}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); cursorApi.set(cursor); }}
        onPointerOut={() => { setHovered(false); cursorApi.clear(); }}
      >
        <planeGeometry args={[w, hgt]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {shown && (
        <Line points={[a, b]} color={HILITE} lineWidth={2.4} transparent opacity={0.95} depthTest={false} />
      )}
    </group>
  );
}
