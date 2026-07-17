// useDrawnFinishMaterial — 作図した壁/床（useDrawnFinishStore の仕上げ）から three の
// マテリアルを作るフック。仕上げ未設定なら null を返し、呼び出し側は既定色にフォールバックする。
//   ・buildThreeMaterial は非同期（テクスチャのデコード）なので state で受ける。
//   ・選択中は素材ではなくハイライト色を優先したいので、呼び出し側で分岐する。
//   ・作った material は差し替え時／アンマウント時に破棄する。
import { useEffect, useState } from "react";
import { buildThreeMaterial } from "../../../../shared/material/applyMaterial";
import { useDrawnFinishStore } from "../../store/useDrawnFinishStore";

/**
 * @param {"interiorWall"|"exteriorWall"|"floor"} slot 仕上げスロット
 * @returns {THREE.Material|null}
 */
export function useDrawnFinishMaterial(slot) {
  const snap = useDrawnFinishStore((s) => s[slot]);
  const [mat, setMat] = useState(null);

  useEffect(() => {
    let alive = true;
    let built = null;
    if (!snap) {
      setMat(null);
      return () => {};
    }
    (async () => {
      try {
        built = await buildThreeMaterial(snap);
        if (!alive) { built?.dispose?.(); return; }
        setMat(built);
      } catch (e) {
        console.warn("[useDrawnFinishMaterial] build failed", e);
        if (alive) setMat(null);
      }
    })();
    return () => {
      alive = false;
      built?.dispose?.();
    };
  }, [snap]);

  return mat;
}
