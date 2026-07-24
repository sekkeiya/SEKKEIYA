// RoomCreateController — 「自動部屋作成」ツールのクリック受け。
//   構えている間だけ透明プレーンを敷き、平面図のクリック地点から壁で囲われた範囲を
//   検出して部屋を作る（検出本体は utils/roomAutoCreate）。
//   床スラブの有無・出所（作図 / Rhino 等の GLB 躯体）に依存しない。
//   ほかの選択ハンドラ（壁・床・通り芯・寸法）は isDrawToolActive() 経由でこのツール中は
//   クリックを素通しするので、プレーンまでイベントが届く。
import React, { useCallback, useEffect } from "react";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useRoomCreateToolStore } from "../../store/useRoomCreateToolStore";
import { createRoomAtPoint } from "../../utils/roomAutoCreate";
import { useHoverCursor } from "./useHoverCursor";

export default function RoomCreateController({ enabled = true }) {
  const active = useRoomCreateToolStore((s) => s.active) && enabled;
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const isMm = (sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;
  const cursorApi = useHoverCursor();

  // ツールを畳んだらカーソルを戻す
  useEffect(() => {
    if (!active) cursorApi.clear();
  }, [active, cursorApi]);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return; // 左クリックのみ（右クリックは取消系の操作に残す）
    e.stopPropagation();
    const res = createRoomAtPoint({ x: e.point.x / k, z: e.point.z / k });
    if (!res.ok && res.message) {
      // 失敗理由はその場で知らせる（成功時は部屋とゾーン・展開記号が見えるので何も出さない）
      window.alert(res.message);
    }
  }, [k]);

  if (!active) return null;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, gridHeightMm * k, 0]}
      onPointerDown={handlePointerDown}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={() => cursorApi.set("crosshair")}
      onPointerOut={() => cursorApi.clear()}
    >
      <planeGeometry args={[100000, 100000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}
