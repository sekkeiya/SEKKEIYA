import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { isLoopAnim, type LoopAnimSpec } from './loopAnim';

/**
 * targetRef の group/object を毎フレーム動かす「常時ループ」アニメ。
 * rotate: 指定軸まわりに speedDeg/秒 で回転し続ける（単位非依存）。
 * move:   指定軸方向に distance(mm)*unit を振幅として period 秒周期で往復。
 *   unit = ターゲットのローカル単位→mm 換算（S.Layout は 1、メートルGLBは 0.001 など）。
 */
export function LoopAnimator({
  targetRef,
  anim,
  unit = 1,
  enabled = true,
}: {
  targetRef: React.MutableRefObject<any>;
  anim?: LoopAnimSpec | null;
  unit?: number;
  /** false の間はアニメを止め、ターゲットを基準位置/回転へ戻す（編集中は静止させる用途）。 */
  enabled?: boolean;
}) {
  const t = useRef(0);
  // 開始時の基準（軸・位置・回転）。無効化時にここへ戻す。
  const baseRef = useRef<{ axis: 'x' | 'y' | 'z'; pos: number; rot: number } | null>(null);

  useFrame((_, dt) => {
    const g = targetRef.current;
    const active = !!g && isLoopAnim(anim) && enabled;

    if (!active) {
      // 停止：基準位置/回転へ戻して状態をクリア（編集モードで静止）
      if (g && baseRef.current) {
        g.position[baseRef.current.axis] = baseRef.current.pos;
        g.rotation[baseRef.current.axis] = baseRef.current.rot;
      }
      baseRef.current = null;
      t.current = 0;
      return;
    }

    const axis = (anim!.axis || 'y') as 'x' | 'y' | 'z';
    // 開始 or 軸変更時に基準を捕捉
    if (!baseRef.current || baseRef.current.axis !== axis) {
      baseRef.current = { axis, pos: g.position[axis], rot: g.rotation[axis] };
      t.current = 0;
    }

    const d = Math.min(dt, 0.05);
    if (anim!.type === 'rotate') {
      const rad = ((Number(anim!.speedDeg) || 30) * Math.PI) / 180;
      g.rotation[axis] += rad * d;
    } else {
      t.current += d;
      const period = Math.max(0.2, Number(anim!.period) || 3);
      const amp = (Number(anim!.distance) || 100) * unit;
      g.position[axis] = baseRef.current.pos + Math.sin((t.current / period) * Math.PI * 2) * amp;
    }
  });

  return null;
}
