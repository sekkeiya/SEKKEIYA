import { useEffect, useRef } from 'react';
import type { FC, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LoopAnimator } from '../../../shared/walkthrough/LoopAnimator';
import type { LoopAnimSpec } from '../../../shared/walkthrough/loopAnim';

const AXIS_VEC: Record<string, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

function findNodeByName(root: THREE.Object3D | null, name?: string) {
  if (!root || !name) return null;
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name && o.name.toLowerCase() === String(name).toLowerCase()) found = o;
  });
  return found;
}

export interface GimmickPlaybackController {
  id: string;
  label: string;
  toggle: () => void;
}

export interface GimmickPlaybackProps {
  /** ギミック（ヒンジ/スライド/クリップ）の対象（呼び出し側で既にクローン済みのシーングラフ。共有 GLTF キャッシュには触れない）。 */
  target: THREE.Object3D;
  animations: THREE.AnimationClip[];
  gimmicks: any[];
  anim?: LoopAnimSpec | null;
  /**
   * 常時アニメ（LoopAnimator）の書き込み先。呼び出し側（DetailViewport）が `target` を
   * 包む親 group を用意して渡す。`v2`（DssWalkthroughViewer）の `animRef` group と同じ考え方で、
   * ギミック（ヒンジ/スライド）が書き込む `target` 側とは別の Object3D にすることで、
   * 常時アニメとギミックが同一 Object3D へ毎フレーム二重に書き込んで取り合う
   * （どちらかが上書きされて止まる/ちらつく）事故を防ぐ。pivot 未指定のギミックは
   * `target` 自身を書き換えるため、ここを `target` と同じにしてはいけない。
   */
  animGroupRef: MutableRefObject<THREE.Object3D | null>;
  /**
   * false の間はヒンジ/スライド/クリップの毎フレーム更新と常時アニメを止める
   * （セクションが画面外のときに GPU を無駄に使わないため。呼び出し側の
   * IntersectionObserver 監視結果を渡す想定）。省略時は常時有効。
   */
  enabled?: boolean;
  onReady: (ctls: GimmickPlaybackController[]) => void;
  onToggle: (id: string, open: boolean) => void;
}

/**
 * S.Model 詳細画面「セクション4: アニメ」の3D側ロジック。
 *
 * `DssWalkthroughViewer.tsx` の `MultiGimmickRunner` から、独自 Canvas・独自 GLB 読み込み・
 * 独自クローンを除いた「クリックで開閉するギミック（ヒンジ/スライド/クリップ）＋常時アニメ」
 * だけを移植したもの。DssWalkthroughViewer 自体は他画面で使われているため変更しない
 * （このファイルが新しい移植先）。
 *
 * `target` は呼び出し側（DetailViewport の ViewportModel）が既にクローンしたシーングラフを
 * そのまま渡す想定。ここでは新たにクローンしない（クローンの責務は呼び出し側に一本化する）。
 */
export const GimmickPlayback: FC<GimmickPlaybackProps> = ({ target, animations, gimmicks, anim, animGroupRef, enabled, onReady, onToggle }) => {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const hingesRef = useRef<any[]>([]);
  const slidesRef = useRef<any[]>([]);
  const opensRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const list = Array.isArray(gimmicks) ? gimmicks.filter((g) => g && (g.type === 'hinge' || g.type === 'clip' || g.type === 'slide')) : [];
    if (!target || !list.length) {
      onReady([]);
      return;
    }

    const mixer = new THREE.AnimationMixer(target);
    mixerRef.current = mixer;
    const names: string[] = (animations || []).map((a) => a.name);
    const hinges: any[] = [];
    const slides: any[] = [];
    const controls: GimmickPlaybackController[] = [];
    opensRef.current = {};

    // mm → ローカル単位換算（GLB がメートルなら ×0.001 相当）
    const box = new THREE.Box3().setFromObject(target);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const mmPerUnit = maxDim > 0 && maxDim < 20 ? 1000 : 1;

    for (const g of list) {
      const id = g.id;
      opensRef.current[id] = false;
      if (g.type === 'clip') {
        const openName = g.openClip || names.find((n) => /open|door/i.test(n)) || names[0];
        const closeName = g.closeClip || names.find((n) => /close/i.test(n));
        const openClip = animations.find((a) => a.name === openName) || animations[0];
        const closeClip = closeName ? animations.find((a) => a.name === closeName) : null;
        const playOnce = (clip: THREE.AnimationClip | null | undefined, ts = 1) => {
          if (!clip) return;
          const act = mixer.clipAction(clip);
          act.reset();
          act.loop = THREE.LoopOnce;
          act.clampWhenFinished = true;
          act.timeScale = ts;
          if (ts < 0) act.time = clip.duration;
          act.enabled = true;
          act.play();
        };
        const toggle = () => {
          if (!opensRef.current[id]) {
            if (closeClip) mixer.clipAction(closeClip).stop();
            playOnce(openClip, 1);
            opensRef.current[id] = true;
          } else {
            if (closeClip) {
              if (openClip) mixer.clipAction(openClip).stop();
              playOnce(closeClip, 1);
            } else {
              playOnce(openClip, -1);
            }
            opensRef.current[id] = false;
          }
          onToggle(id, opensRef.current[id]);
        };
        controls.push({ id, label: g.label || 'ドア', toggle });
      } else if (g.type === 'slide') {
        const node = findNodeByName(target, g.pivot) || target;
        const axisKey = (g.axis || 'y').toLowerCase();
        const dist = (Number(g.distance) || 100) / mmPerUnit;
        const sl = { node, axisKey, base: (node.position as any)[axisKey], dist, t: 0, target: 0, speed: 2.2 };
        slides.push(sl);
        const toggle = () => {
          sl.target = sl.target > 0.5 ? 0 : 1;
          opensRef.current[id] = sl.target > 0.5;
          onToggle(id, opensRef.current[id]);
        };
        controls.push({ id, label: g.label || '動かす', toggle });
      } else {
        const node = findNodeByName(target, g.pivot) || target;
        const axis = AXIS_VEC[(g.axis || 'y').toLowerCase()] || AXIS_VEC.y;
        const openRad = ((Number(g.openDeg) || 90) * Math.PI) / 180;
        const h = { node, axis, baseQuat: node.quaternion.clone(), openRad, t: 0, target: 0, speed: 2.2 };
        hinges.push(h);
        const toggle = () => {
          h.target = h.target > 0.5 ? 0 : 1;
          opensRef.current[id] = h.target > 0.5;
          onToggle(id, opensRef.current[id]);
        };
        controls.push({ id, label: g.label || 'ドア', toggle });
      }
    }
    hingesRef.current = hinges;
    slidesRef.current = slides;
    onReady(controls);
    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      hingesRef.current = [];
      slidesRef.current = [];
      opensRef.current = {};
      onReady([]);
    };
    // onReady/onToggle は呼び出し側で毎レンダー作られるクロージャのため意図的に依存から外す
    // （MultiGimmickRunner の元実装と同じ判断）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, gimmicks, animations]);

  useFrame((_, dt) => {
    if (enabled === false) return;
    const d = Math.min(dt, 0.05);
    if (mixerRef.current) mixerRef.current.update(d);
    for (const h of hingesRef.current) {
      const dir = h.target - h.t;
      if (Math.abs(dir) > 1e-4) {
        h.t += Math.sign(dir) * Math.min(Math.abs(dir), h.speed * d);
        h.t = Math.max(0, Math.min(1, h.t));
        const q = new THREE.Quaternion().setFromAxisAngle(h.axis, h.openRad * h.t);
        h.node.quaternion.copy(h.baseQuat).multiply(q);
      }
    }
    for (const sl of slidesRef.current) {
      const dir = sl.target - sl.t;
      if (Math.abs(dir) > 1e-4) {
        sl.t += Math.sign(dir) * Math.min(Math.abs(dir), sl.speed * d);
        sl.t = Math.max(0, Math.min(1, sl.t));
        sl.node.position[sl.axisKey] = sl.base + sl.dist * sl.t;
      }
    }
  });

  // 常時アニメ（展示用ループ）。target ではなく animGroupRef（target の親 group）を動かす
  // ——v2 と同じく常時アニメとギミックの書き込み先を親子で分離し、同一 Object3D への
  // 二重書き込みを防ぐ（本ファイル先頭の GimmickPlaybackProps.animGroupRef のコメント参照）。
  // enabled=false のときは LoopAnimator 自身が基準位置へ戻して停止する。
  return <LoopAnimator targetRef={animGroupRef} anim={anim} unit={0.001} enabled={enabled !== false} />;
};
