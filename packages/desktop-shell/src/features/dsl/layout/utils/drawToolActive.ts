// drawToolActive — 作図ツール（壁 / 床 / 寸法）を構えている最中かどうか。
//   構えている間、図面上のクリックは「作図の点を置く」ためのもの。壁・床・通り芯・寸法などの
//   選択ハンドラがクリックを横取りすると、点が置けず代わりに何かが選択されてしまう。
//   各ハンドラの冒頭でこれを見て、true なら「何もせず・stopPropagation もせず」に抜けること。
//   （stopPropagation してしまうと、奥にある作図用の透明プレーンへイベントが届かない）
import { useWallStore } from "../store/useWallStore";
import { useSlabStore } from "../store/useSlabStore";
import { useManualDimensionStore } from "../store/useManualDimensionStore";
import { useRoomCreateToolStore } from "../store/useRoomCreateToolStore";

export function isDrawToolActive(): boolean {
  try {
    if (useWallStore.getState().drawKind) return true;       // 内壁／外壁を作図中
    if (useSlabStore.getState().drawActive) return true;     // 床を作図中
    if (useManualDimensionStore.getState().drawActive) return true; // 手動寸法を作図中
    if (useRoomCreateToolStore.getState().active) return true; // 自動部屋作成を構えている
  } catch {
    /* ストア未初期化などは「作図していない」扱い */
  }
  return false;
}

/**
 * 同じ判定をコンポーネントから購読する版。
 * DOM の注記（drei の Html）はキャンバスより手前に乗るので、作図中は
 * pointerEvents を切らないとクリックがキャンバスまで届かない。その出し分けに使う。
 */
export function useDrawToolActive(): boolean {
  const wall = useWallStore((s) => s.drawKind);
  const slab = useSlabStore((s) => s.drawActive);
  const dim = useManualDimensionStore((s) => s.drawActive);
  const room = useRoomCreateToolStore((s) => s.active);
  return !!wall || !!slab || !!dim || !!room;
}
