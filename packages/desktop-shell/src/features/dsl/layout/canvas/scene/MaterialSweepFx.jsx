// MaterialSweepFx — マテリアル自動付与時の「面ごとに這う青いスキャンライン」演出ドライバ。
// 共有進行度 uSweepProgress(0→1) を ease で進めるだけ。線そのものは各面のシェーダ・グローが描く。

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useMaterialSweepStore, sweepUniforms } from "../../services/materialSweep";

// easeInOutCubic
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export default function MaterialSweepFx() {
  const sweep = useMaterialSweepStore((s) => s.sweep);
  const clear = useMaterialSweepStore((s) => s.clear);
  // demand frameloop の viewport でもスイープが回るよう自前で再描画要求する。
  const invalidate = useThree((s) => s.invalidate);
  const tokenRef = useRef(-1);
  const startRef = useRef(0);

  useFrame((state) => {
    if (!sweep) {
      sweepUniforms.uSweepActive.value = 0;
      return;
    }
    invalidate();
    const now = state.clock.getElapsedTime();
    if (tokenRef.current !== sweep.token) {
      tokenRef.current = sweep.token;
      startRef.current = now;
    }
    const dur = (sweep.durationMs || 1300) / 1000;
    const p = Math.min(1, Math.max(0, (now - startRef.current) / dur));
    sweepUniforms.uSweepActive.value = 1;
    sweepUniforms.uSweepProgress.value = ease(p);

    if (p >= 1) {
      // ここで active=0 にすると、prevMat 除去(次フレームのeffect)までの1フレームだけ
      // 旧素材が全面表示に戻ってチラつく。active=1/progress=1 のまま clear() し、
      // active=0 は次フレーム（sweep=null時）に落とす（その頃 prevMat は除去済み）。
      clear();
    }
  });

  return null;
}
