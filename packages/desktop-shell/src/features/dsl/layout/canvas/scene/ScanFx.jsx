// ScanFx — 自動ラベリングの「3Dスキャン」演出。
// X→Y→Z の順に、発光する断面スラブが躯体を流れる（レントゲン的）。
// バウンディングのワイヤーフレームを「X線フレーム」として薄く重ね、走査中の没入感を出す。
// useScanFxStore.startScan(box) で起動。完了で自動停止。

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useScanFxStore } from "../../services/scanFx";

export default function ScanFx() {
  const token = useScanFxStore((s) => s.token);
  const box = useScanFxStore((s) => s.box);
  const config = useScanFxStore((s) => s.config);
  const stop = useScanFxStore((s) => s.stop);

  // 非アクティブな viewport は frameloop="demand" のため、何も再描画要求しないと
  // useFrame が回らずスキャン演出が止まる。スキャン中は自前で invalidate して回す。
  const invalidate = useThree((s) => s.invalidate);

  // 経過は dt の積算ではなく「最初のフレームの時刻」を基準にしたウォールクロックで測る。
  // demand モードでアイドル後に開始すると初回 dt が巨大になり、積算だと一瞬で終端を
  // 超えてしまう（＝演出が一瞬で終わる）。基準時刻方式なら開始位置が必ず 0 から始まる。
  const startRef = useRef(null);
  const slabRef = useRef(null);
  const coreRef = useRef(null);
  const wireRef = useRef(null);

  // 新トークンで基準時刻リセット＋スキャン開始フレームをキック（demand 対策）
  useEffect(() => { startRef.current = null; if (box) invalidate(); }, [token, box, invalidate]);

  const geom = useMemo(() => {
    if (!box) return null;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return { size, center, min: box.min.clone() };
  }, [box]);

  const wireGeom = useMemo(() => {
    if (!geom) return null;
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(geom.size.x, geom.size.y, geom.size.z));
  }, [geom]);
  useEffect(() => () => { wireGeom?.dispose?.(); }, [wireGeom]);

  useFrame((state) => {
    if (!box || !geom || !slabRef.current) return;
    const now = state.clock.getElapsedTime() * 1000;
    if (startRef.current == null) startRef.current = now; // 最初の描画フレームを 0 とする
    const t = now - startRef.current;
    const A = config.axisDurationMs, G = config.gapMs;
    const cycle = A + G;
    const total = A * 3 + G * 2;
    if (t >= total + 240) { stop(); return; }
    // demand モードでも次フレームを確実に描画させる（box が null になれば自然に停止）。
    invalidate();

    const axis = Math.min(2, Math.floor(t / cycle));
    const local = t - axis * cycle;
    // イーズイン/アウトで端から端へ
    const raw = Math.min(1, Math.max(0, local / A));
    const prog = raw * raw * (3 - 2 * raw); // smoothstep
    const inSweep = local <= A;

    const { size, center, min } = geom;
    const maxDim = Math.max(size.x, size.y, size.z);
    const thin = maxDim * 0.014 + 1e-4;
    const pad = 1.06;

    const slab = slabRef.current;
    const core = coreRef.current;
    if (axis === 0) {
      slab.scale.set(thin, size.y * pad, size.z * pad);
      slab.position.set(min.x + size.x * prog, center.y, center.z);
    } else if (axis === 1) {
      slab.scale.set(size.x * pad, thin, size.z * pad);
      slab.position.set(center.x, min.y + size.y * prog, center.z);
    } else {
      slab.scale.set(size.x * pad, size.y * pad, thin);
      slab.position.set(center.x, center.y, min.z + size.z * prog);
    }
    if (core) { core.scale.copy(slab.scale).multiplyScalar(0.34); core.scale[["x", "y", "z"][axis]] = thin * 0.5; core.position.copy(slab.position); }

    // 走査中はくっきり、間(gap)はフェードアウト
    const fade = inSweep ? 1 : Math.max(0, 1 - (local - A) / Math.max(1, G));
    const pulse = 0.78 + 0.22 * Math.sin(t * 0.03);
    if (slab.material) slab.material.opacity = 0.4 * fade * pulse;
    if (core?.material) core.material.opacity = 0.9 * fade * pulse;
    if (wireRef.current?.material) {
      wireRef.current.material.opacity = 0.18 + 0.22 * Math.abs(Math.sin(t * 0.006));
    }
  });

  if (!box || !geom) return null;
  const { size, center } = geom;

  return (
    <group renderOrder={9998}>
      {/* X線フレーム（バウンディング） */}
      <lineSegments ref={wireRef} geometry={wireGeom} position={[center.x, center.y, center.z]}>
        <lineBasicMaterial color={config.color} transparent opacity={0.3} depthTest={false} depthWrite={false} />
      </lineSegments>

      {/* 断面スラブ（広いグロー） */}
      <mesh ref={slabRef} renderOrder={9999}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 断面のコア（明るい中心線） */}
      <mesh ref={coreRef} renderOrder={10000}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={"#ffffff"}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
