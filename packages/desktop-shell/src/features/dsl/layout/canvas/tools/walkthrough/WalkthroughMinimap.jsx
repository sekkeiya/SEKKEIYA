// WalkthroughMinimap.jsx
//
// ウォークスルー中、画面右上に表示するミニマップ（2D・トップダウン）。
//   - 部屋の輪郭（baseColliders のバウンディング）
//   - 家具（sceneObjectRegistry の各オブジェクトを上から見た矩形）
//   - 現在のプレイヤー位置と向き（walkthroughShared）
// WebGL を使わず SVG オーバーレイで描画（コンテキスト枯渇を避ける）。

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useItemInfoRegistryStore } from "../../../store/itemInfoRegistryStore";
import { walkthroughShared } from "./walkthroughShared";

const W = 332; // SVG 幅（情報パネルの横幅に合わせる）
const H = 178; // SVG 高さ
const PAD = 14;

export default function WalkthroughMinimap() {
  // 情報パネルを開いている間はミニマップを隠し、その分パネルを大きく表示できるようにする。
  const infoOpen = useItemInfoRegistryStore((s) => !!s.openInfoId);

  const [snap, setSnap] = useState(null); // { bounds, rects, baseRects } 静的レイアウト
  const [player, setPlayer] = useState(null); // { x, z, yaw }

  const boundsRef = useRef(null);
  const baseRectsRef = useRef([]);
  const baseSigRef = useRef(null);

  // 部屋の輪郭＋家具矩形を算出（やや低頻度）。プレイヤーは毎フレーム更新。
  useEffect(() => {
    let raf = 0;
    let lastLayout = 0;
    let lastPlayer = 0;
    const tmpBox = new THREE.Box3();

    const computeLayout = (now) => {
      const reg = useSceneObjectRegistryStore.getState();
      const colliders = reg.baseColliders || [];

      // 部屋境界＋躯体（壁/床）の上面フットプリント：baseColliders が変わった時のみ再計算
      const sig = colliders.length + ":" + (colliders[0]?.uuid || "");
      if (sig !== baseSigRef.current || !boundsRef.current) {
        baseSigRef.current = sig;
        const box = new THREE.Box3();
        const baseRects = [];
        const mb = new THREE.Box3();
        colliders.forEach((c) => {
          box.expandByObject(c);
          // 天井は上面から見ると全面を覆い壁が隠れるので除外
          const nm = (c.name || "").toLowerCase();
          if (nm.includes("ceiling") || nm.includes("天井")) return;
          if (c.visible === false) return;
          mb.setFromObject(c);
          if (mb.isEmpty()) return;
          baseRects.push({ minX: mb.min.x, maxX: mb.max.x, minZ: mb.min.z, maxZ: mb.max.z });
        });
        boundsRef.current = box.isEmpty() ? null : box;
        baseRectsRef.current = baseRects;
      }
      const box = boundsRef.current;
      const baseRects = baseRectsRef.current;

      // 家具矩形
      const objs = reg.getAllObjects?.() || [];
      const rects = [];
      for (const o of objs) {
        tmpBox.setFromObject(o);
        if (tmpBox.isEmpty()) continue;
        rects.push({ minX: tmpBox.min.x, maxX: tmpBox.max.x, minZ: tmpBox.min.z, maxZ: tmpBox.max.z });
      }

      let bounds = box
        ? { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z }
        : null;
      // 部屋が無ければ家具範囲から推定
      if (!bounds && rects.length) {
        bounds = rects.reduce((a, r) => ({
          minX: Math.min(a.minX, r.minX), maxX: Math.max(a.maxX, r.maxX),
          minZ: Math.min(a.minZ, r.minZ), maxZ: Math.max(a.maxZ, r.maxZ),
        }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
      }
      setSnap(bounds ? { bounds, rects, baseRects } : null);
    };

    const tick = (now) => {
      if (now - lastLayout > 600) { lastLayout = now; computeLayout(now); }
      if (walkthroughShared.active && now - lastPlayer > 60) { // ~16Hz
        lastPlayer = now;
        setPlayer({
          x: walkthroughShared.playerPos.x,
          z: walkthroughShared.playerPos.z,
          yaw: walkthroughShared.yaw,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (infoOpen) return null;
  if (!snap || !snap.bounds) return null;

  const { bounds, rects, baseRects = [] } = snap;
  const spanX = Math.max(1e-3, bounds.maxX - bounds.minX);
  const spanZ = Math.max(1e-3, bounds.maxZ - bounds.minZ);
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanZ);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanZ * scale) / 2;
  const toX = (x) => offX + (x - bounds.minX) * scale;
  const toY = (z) => offY + (z - bounds.minZ) * scale;

  let arrow = null;
  if (player) {
    const px = toX(player.x);
    const py = toY(player.z);
    // 前方ベクトル（world (sinYaw, cosYaw) → svg (x∝x, y∝z)）
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    const fl = Math.hypot(fx, fz) || 1;
    const ux = fx / fl, uz = fz / fl;   // 単位前方
    const perpX = -uz, perpZ = ux;       // 直交方向
    const fmt = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
    const tip = fmt(px + ux * 12, py + uz * 12);
    const bl = fmt(px - ux * 5 + perpX * 6, py - uz * 5 + perpZ * 6);
    const br = fmt(px - ux * 5 - perpX * 6, py - uz * 5 - perpZ * 6);
    arrow = { px, py, tri: `${tip} ${bl} ${br}` };
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 52,
        right: 10,
        width: W,
        zIndex: 31,
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(8,12,22,0.78)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4f8cff", display: "inline-block" }} />
        MAP
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* 部屋の床 */}
        <rect
          x={toX(bounds.minX)} y={toY(bounds.minZ)}
          width={spanX * scale} height={spanZ * scale}
          fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2"
          rx="3"
        />
        {/* 躯体（壁・床など）の上面フットプリント。床のような大面積はうっすら、
            壁のような細い形状ははっきり描いて平面図のように見せる。 */}
        {baseRects.map((r, i) => {
          const w = Math.max(1, (r.maxX - r.minX) * scale);
          const h = Math.max(1, (r.maxZ - r.minZ) * scale);
          const areaRatio = ((r.maxX - r.minX) * (r.maxZ - r.minZ)) / (spanX * spanZ || 1);
          const isLarge = areaRatio > 0.6; // 床/天井相当
          return (
            <rect
              key={`b${i}`}
              x={toX(r.minX)} y={toY(r.minZ)}
              width={w} height={h}
              fill={isLarge ? "rgba(255,255,255,0.04)" : "rgba(180,200,240,0.35)"}
              stroke={isLarge ? "rgba(255,255,255,0.18)" : "rgba(210,225,255,0.85)"}
              strokeWidth={isLarge ? 0.8 : 1}
            />
          );
        })}
        {/* 家具 */}
        {rects.map((r, i) => (
          <rect
            key={i}
            x={toX(r.minX)} y={toY(r.minZ)}
            width={Math.max(1.5, (r.maxX - r.minX) * scale)}
            height={Math.max(1.5, (r.maxZ - r.minZ) * scale)}
            fill="rgba(120,150,200,0.5)" stroke="rgba(180,200,240,0.5)" strokeWidth="0.6" rx="1"
          />
        ))}
        {/* プレイヤー */}
        {arrow && (
          <>
            <circle cx={arrow.px} cy={arrow.py} r="8" fill="rgba(79,140,255,0.25)" />
            <polygon points={arrow.tri} fill="#4f8cff" stroke="#fff" strokeWidth="1" />
          </>
        )}
      </svg>
    </div>
  );
}
