// 通常モデルに付ける「常時ループ」アニメーションの仕様。
// gimmick(クリック開閉) とは別軸の、展示物のように動き続ける演出。
// 保存先: asset.extendedMetadata.anim。S.Model / S.Layout 双方で同じ spec を使う。

export type LoopAnimType = 'rotate' | 'move';

export interface LoopAnimSpec {
  type: LoopAnimType;
  axis: 'x' | 'y' | 'z';
  /** rotate: 回転速度（度/秒）。 */
  speedDeg?: number;
  /** move: 振幅（mm、±方向に往復）。 */
  distance?: number;
  /** move: 1往復の周期（秒）。 */
  period?: number;
}

export function isLoopAnim(a: any): a is LoopAnimSpec {
  return !!a && (a.type === 'rotate' || a.type === 'move');
}
