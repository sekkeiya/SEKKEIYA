// スクロール連動カメラパス（B方式の核）。three の型に依存しないよう、
// 補間結果はプレーン配列で返し、適用側（SiteScroll3DScene）で camera にコピーする。
// 参照: .claude/skills/3d-scroll-website/references/realtime-3d.md

export interface CamKey {
  /** 進行度 0→1。この時点でのカメラ状態。配列は at 昇順で持つこと。 */
  at: number;
  /** カメラ位置 [x, y, z] */
  pos: [number, number, number];
  /** 注視点 [x, y, z] */
  look: [number, number, number];
}

/** 建築ウォークスルー既定パス：手前→室内へ寄り→最後に俯瞰。 */
export const DEFAULT_CAM_PATH: CamKey[] = [
  { at: 0.0, pos: [0, 2.2, 9], look: [0, 1.0, 0] },
  { at: 0.4, pos: [3, 1.6, 3.5], look: [0, 1.2, -1] },
  { at: 0.7, pos: [-2, 1.5, 1], look: [-1, 1.2, -3] },
  { at: 1.0, pos: [0, 6, 8], look: [0, 0, -2] },
];

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** scroller の現在スクロール進行度 0→1。 */
export function scrollProgress(scroller: HTMLElement): number {
  const max = scroller.scrollHeight - scroller.clientHeight;
  if (max <= 0) return 0;
  return clamp01(scroller.scrollTop / max);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface CamSample {
  pos: [number, number, number];
  look: [number, number, number];
}

/**
 * 進行度 progress に対応する {pos, look} を、パスのキーフレームから
 * easeInOutCubic で区間補間して返す。
 */
export function sampleCameraPath(path: CamKey[], progress: number): CamSample {
  if (path.length === 0) return { pos: [0, 2, 9], look: [0, 1, 0] };
  if (path.length === 1) return { pos: path[0].pos, look: path[0].look };

  const p = clamp01(progress);
  let a = path[0];
  let b = path[path.length - 1];
  for (let i = 0; i < path.length - 1; i++) {
    if (p >= path[i].at && p <= path[i + 1].at) {
      a = path[i];
      b = path[i + 1];
      break;
    }
  }
  const span = b.at - a.at || 1;
  const local = easeInOutCubic(clamp01((p - a.at) / span));

  return {
    pos: [
      lerp(a.pos[0], b.pos[0], local),
      lerp(a.pos[1], b.pos[1], local),
      lerp(a.pos[2], b.pos[2], local),
    ],
    look: [
      lerp(a.look[0], b.look[0], local),
      lerp(a.look[1], b.look[1], local),
      lerp(a.look[2], b.look[2], local),
    ],
  };
}
