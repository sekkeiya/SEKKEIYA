// walkthroughShared.js
//
// ウォークスルーの「プレイヤー位置」をコンポーネント間で共有する軽量シングルトン。
// WalkthroughController が毎フレーム書き込み、WalkthroughInteractionController が
// 近接（プロキシミティ）判定の基準点として読む。
//   - 一人称 / フライ：カメラ足元
//   - 三人称：アバター（カメラはアバター後方にあるため、近接はアバター基準で判定する）
// zustand を使わない（毎フレーム更新で再レンダリングを避けるため）。

import * as THREE from "three";

export const walkthroughShared = {
  playerPos: new THREE.Vector3(),
  yaw: 0,        // 現在の向き（ラジアン）。ミニマップの矢印用。
  active: false,
};
