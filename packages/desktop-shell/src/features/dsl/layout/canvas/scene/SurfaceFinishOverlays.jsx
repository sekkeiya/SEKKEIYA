// SurfaceFinishOverlays — 躯体面に貼った仕上げを「オーバーレイ板」で描画する。
// 躯体メッシュは非破壊。面ローカル矩形にテクスチャ付き plane を法線手前へ微オフセットして重ねる。
// タイリングは実寸（約1mタイル）で割って繰り返す。

import React, { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSurfaceFinishStore, finishRects } from "../../store/useSurfaceFinishStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { buildThreeMaterial } from "../../../../shared/material/applyMaterial";
import { applySweepToMaterial, useMaterialSweepStore } from "../../services/materialSweep";

// rAF タイムスタンプベースの簡易トゥイーン（Date.now 不使用）
function rafTween(durationMs, onUpdate) {
  return new Promise((resolve) => {
    let start = -1;
    const step = (now) => {
      if (start < 0) start = now;
      const t = Math.min(1, (now - start) / Math.max(1, durationMs));
      onUpdate(t);
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// 各矩形の UV を実寸タイリングに合わせてスケールする（1マテリアルで全矩形を
// 一貫タイル表示するため。テクスチャ repeat は (1,1) のままにする）。
function makeRectGeometry(w, h, tile) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  const ru = Math.max(0.25, w / tile);
  const rv = Math.max(0.25, h / tile);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  uv.needsUpdate = true;
  return g;
}

// 連結成分の実ポリゴン（ワールド座標の三角形群）からジオメトリを作る。
// 外接矩形だと三角形/傾斜面ではみ出す（＝存在しない面に見える）ため、面全体の仕上げは
// 実ポリゴンで描く。UV は面の u/v 軸へ射影して実寸タイリングに揃える。ワールド座標なので
// メッシュ側の position/quaternion は単位（identity）で描く。
function makePolyGeometry(tris, uAxis, vAxis, tile) {
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(tris);
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  const vcount = arr.length / 3;
  const uv = new Float32Array(vcount * 2);
  for (let i = 0; i < vcount; i++) {
    const x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
    uv[i * 2] = (x * uAxis.x + y * uAxis.y + z * uAxis.z) / tile;
    uv[i * 2 + 1] = (x * vAxis.x + y * vAxis.y + z * vAxis.z) / tile;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function FinishGroup({ finish, unitsPerMeter }) {
  const [mat, setMat] = useState(null);
  const [prevMat, setPrevMat] = useState(null); // 切替中だけ存在（旧素材）
  const scene = useThree((st) => st.scene);
  const gl = useThree((st) => st.gl);
  const sweepToken = useMaterialSweepStore((st) => st.sweep?.token ?? null);
  const matRef = useRef(null);
  const prevMatRef = useRef(null); // prevMat の参照（破棄ガード用）
  const firstRef = useRef(true);
  const wipeTokenRef = useRef(0);
  const prevMatIdRef = useRef(null);
  const s = finish.surface;
  const rects = finishRects(finish); // [] なら面全体
  const whole = rects.length === 0;

  const scale = finish.scale || 1;     // タイルの拡縮（大=タイル大→繰り返し少）
  const rotDeg = finish.rotation || 0;  // テクスチャ回転（度）

  // クリッピングによる縦ワイプを使うため localClipping を有効化
  useEffect(() => { if (gl) gl.localClippingEnabled = true; }, [gl]);

  // 全体スイープの開始/終了に同期した旧素材の退避・破棄。
  //  - 開始: 今表示中の素材を即「旧素材(invert=1=前線の下に残す)」へ退避。
  //          新素材は非同期生成なので、待つ間も既存マテリアルが消えない（一瞬外れる対策）。
  //  - 終了: 残していた旧素材を破棄。useLayoutEffect でコミット時に同期実行し、
  //          MaterialSweepFx が次フレームで uSweepActive=0 に落とす前に prevMat を確実に除去する。
  //          （パッシブ effect だと除去が1フレーム遅れ、旧素材が一瞬かぶって「チカッ」と点滅する）
  useLayoutEffect(() => {
    if (sweepToken != null) {
      const cur = matRef.current;
      if (cur) {
        cur.clippingPlanes = null;
        if (cur.userData?.__sweepInvert) cur.userData.__sweepInvert.value = 1;
        setPrevMat((p) => { if (p && p !== cur) p.dispose?.(); prevMatRef.current = cur; return cur; });
      }
    } else {
      setPrevMat((p) => { if (p) p.dispose?.(); prevMatRef.current = null; return null; });
    }
  }, [sweepToken]);

  // マテリアルは仕上げ単位で1つ。タイリングは UV 側で扱うため repeat は (1,1)。
  useEffect(() => {
    let cancelled = false;
    buildThreeMaterial(finish.material).then((m) => {
      if (cancelled) { m?.dispose?.(); return; }
      const rot = (rotDeg * Math.PI) / 180;
      ["map", "normalMap", "roughnessMap", "aoMap"].forEach((k) => {
        const t = m[k];
        if (t) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(1, 1);
          t.center.set(0.5, 0.5);
          t.rotation = rot;
          t.needsUpdate = true;
        }
      });
      // 金属マテリアル（真鍮/アルミ等）は反射する環境が無いと Lighting 表示で
      // 真っ黒になる。環境マップがあれば割り当て、無ければ金属度を下げる。
      if (scene?.environment) {
        m.envMap = scene.environment;
        m.envMapIntensity = 1.0;
      } else if ((m.metalness ?? 0) > 0.5) {
        m.metalness = 0.45;
        m.roughness = Math.min(1, (m.roughness ?? 0.5) + 0.1);
      }
      m.side = THREE.DoubleSide;
      // 天井→壁→床へ斜めに這うスキャンライン演出用 shader を注入（全面共有の前線で駆動）。
      applySweepToMaterial(m);
      m.needsUpdate = true;

      const old = matRef.current;
      // マテリアル自体が変わった時のみワイプ（回転/スケール調整では発火させない）
      const matChanged = prevMatIdRef.current !== finish.materialId;
      prevMatIdRef.current = finish.materialId;
      matRef.current = m;
      setMat(m);

      // 全体スキャンライン（自動付与ボタン）が走っている間は、面ごとの縦ワイプは抑制する。
      const globalSweeping = !!useMaterialSweepStore.getState().sweep;

      // 回転/スケール調整など（素材変更なし）の即時置換：旧素材を遅延破棄。
      // ただし旧素材が「前線の下に残している旧素材(prevMat)」のときは破棄しない。
      if (old && !firstRef.current && !matChanged && old !== prevMatRef.current) {
        const toDispose = old;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (toDispose !== matRef.current && toDispose !== prevMatRef.current) toDispose.dispose?.();
        }));
      }

      // ── 全体スイープ中の素材変更：白を挟まず 旧→新 をクロスフェード ──
      // 旧素材を「前線より下（未スキャン側）」に残し、新素材は前線から流入させる。
      if (old && !firstRef.current && matChanged && globalSweeping) {
        ++wipeTokenRef.current; // 進行中の手動ワイプがあれば無効化
        old.clippingPlanes = null;
        if (old.userData?.__sweepInvert) old.userData.__sweepInvert.value = 1; // 前線の下側を表示
        // 旧素材を残す。破棄はスイープ終了の effect（sweepToken=null）で行う。
        setPrevMat((p) => { if (p && p !== old && p !== m) p.dispose?.(); prevMatRef.current = old; return old; });
      }

      // ── 切替時：上から下へ「貼り替わる」縦ワイプ（単一面の手動切替のみ）──
      if (old && !firstRef.current && matChanged && !globalSweeping) {
        const token = ++wipeTokenRef.current;
        // 旧素材は上書き（前のワイプが残っていたら破棄）
        setPrevMat((p) => { if (p && p !== old && p !== m) p.dispose?.(); return old; });

        // 面の V 軸（world）。上向き成分が正になるよう向きを揃える。
        const vHat = new THREE.Vector3(...s.vAxis).normalize();
        if (vHat.y < 0) vHat.negate();
        const cV = vHat.dot(new THREE.Vector3(...s.center));
        const half = (s.height || 0) / 2;
        const margin = Math.max(1e-3, (s.height || 1) * 0.03);
        const hi = cV + half + margin; // 上端（開始：すべて旧）
        const lo = cV - half - margin; // 下端（終了：すべて新）

        const planeNew = new THREE.Plane(vHat.clone(), -hi);          // vHat·p >= h（上を表示）
        const planeOld = new THREE.Plane(vHat.clone().negate(), hi);  // vHat·p <= h（下を表示）
        m.clippingPlanes = [planeNew]; m.clipShadows = true; m.needsUpdate = true;
        old.clippingPlanes = [planeOld]; old.needsUpdate = true;

        rafTween(700, (t) => {
          if (token !== wipeTokenRef.current) return;
          const h = hi + (lo - hi) * easeInOut(t);
          planeNew.constant = -h;
          planeOld.constant = h;
        }).then(() => {
          if (token !== wipeTokenRef.current) return;
          m.clippingPlanes = null; m.clipShadows = false; m.needsUpdate = true;
          setPrevMat((p) => { if (p) p.dispose?.(); return null; });
        });
      }
      firstRef.current = false;
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [finish.materialId, finish.material, rotDeg, scene]);

  // アンマウント時に現行マテリアルを破棄
  useEffect(() => () => { matRef.current?.dispose?.(); }, []);

  const { quat, basis } = useMemo(() => {
    const u = new THREE.Vector3(...s.uAxis);
    const v = new THREE.Vector3(...s.vAxis);
    const n = new THREE.Vector3(...s.normal).normalize();
    const m4 = new THREE.Matrix4().makeBasis(u, v, n);
    const q = new THREE.Quaternion().setFromRotationMatrix(m4);
    return { quat: q, basis: { u, v, n } };
  }, [s]);

  // 矩形ごとのジオメトリ（UV を実寸タイルに合わせる）
  const tile = unitsPerMeter * scale;
  const identityQuat = useMemo(() => new THREE.Quaternion(), []);
  const quads = useMemo(() => {
    const u = basis.u, v = basis.v, n = basis.n;
    // 面全体かつ実ポリゴン(tris)があれば、はみ出さない実形状で描く。
    if (whole && Array.isArray(s.tris) && s.tris.length >= 9) {
      const lift = unitsPerMeter * 0.004;
      const geo = makePolyGeometry(s.tris, u, v, tile);
      const pos = n.clone().multiplyScalar(lift); // tris はワールド座標なので法線方向の微リフトのみ
      return [{ geo, pos, quat: identityQuat }];
    }
    const list = whole
      ? [{ w: s.width, h: s.height, cu: 0, cv: 0 }]
      : rects.map((r) => ({ w: Math.abs(r.u1 - r.u0), h: Math.abs(r.v1 - r.v0), cu: (r.u0 + r.u1) / 2, cv: (r.v0 + r.v1) / 2 }));
    return list.map((q, i) => {
      // 矩形ごとに僅かにリフトを増やして同一平面の z-fighting を回避
      const lift = unitsPerMeter * ((whole ? 0.004 : 0.008) + i * 0.0006);
      const pos = new THREE.Vector3(...s.center)
        .addScaledVector(u, q.cu)
        .addScaledVector(v, q.cv)
        .addScaledVector(n, lift);
      return { geo: makeRectGeometry(q.w, q.h, tile), pos, quat };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rects, whole, s, basis, tile, unitsPerMeter, quat, identityQuat]);

  // ジオメトリ破棄
  useEffect(() => () => quads.forEach((q) => q.geo.dispose()), [quads]);

  if (!mat) return null;
  return (
    <>
      {/* 切替中の旧素材（下側だけクリップ表示）。新素材が上から降りてくる。 */}
      {prevMat && quads.map((q, i) => (
        <mesh key={"old" + i} position={q.pos} quaternion={q.quat} renderOrder={whole ? 1 : 2} geometry={q.geo} receiveShadow userData={{ isSurfaceFinish: true }}>
          <primitive object={prevMat} attach="material" />
        </mesh>
      ))}
      {/* receiveShadow: オーバーレイ板が床/壁の実メッシュを覆うため、板自身が影を受けないと
          テクスチャ面に家具の影が一切出なくなる。板は躯体と同一平面なので castShadow は不要。
          userData.isSurfaceFinish: GLB extras 経由で Blender へ渡し、Cycles 側の「平面=ワークスペース
          グリッド」非表示フィルタ（厚みゼロ板を hide_render）に巻き込まれないようにする。 */}
      {quads.map((q, i) => (
        <mesh key={i} position={q.pos} quaternion={q.quat} renderOrder={whole ? 1 : 2} geometry={q.geo} receiveShadow userData={{ isSurfaceFinish: true }}>
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
    </>
  );
}

export default function SurfaceFinishOverlays() {
  const finishes = useSurfaceFinishStore((s) => s.finishes);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const unitsPerMeter = sceneMaxY > 100 ? 1000 : 1;
  return (
    <>
      {Object.values(finishes).map((f) => (
        <FinishGroup key={f.key} finish={f} unitsPerMeter={unitsPerMeter} />
      ))}
    </>
  );
}
