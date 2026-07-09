// controllers/ は共通して **Canvas 内で useThree / useFrame を使い、DOMや3D世界に“副作用”を起こす層
// AlignPointerController：Align時の 入力（位置記録＋確定クリック）
// 役割
// Align中の“ポインタ位置（NDC）”を安定して追跡し、クリックで確定を発火する入力コントローラ。
// Alignの挙動の根っこは「ポインタの向いている位置に対して AlignFollower が追従し、クリックで確定する」です。
// その“クリックと位置記録”を担うのがこれ。
// 責務
// window に対して pointermove / pointerdown を張る
// （Canvasのレイアウト変更・最大化・分割でも追従が崩れないため）
// gl.domElement の getBoundingClientRect() を使って
// clientX/Y → NDC(-1..1) に変換
// lastNdcRef.current = {x,y,t} に記録（Follower が読む）
// 左クリックで onConfirm() を呼ぶ（= commitAlign など）
// Snap中は特殊：
// クリック位置に依存させない確定（どこをクリックしても確定）
// lastNdcRef を更新しない（“クリックした瞬間のズレ”対策）
// 機能
// Align中にマウスを動かしたら、追従ターゲットが更新される
// クリックした瞬間に確定できる（1フレーム遅延を潰す）
// resize/scroll でも rect 更新してズレを防ぐ
// なぜ controller？
// window イベントや DOM rect を扱う副作用
// Canvasの中で起きてる AlignFollower（useFrame）と“入力”を橋渡しする層だから

import React, { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

export default function AlignPointerController({
  enabled,
  onConfirm,
  lastNdcRef,
  isNavActive = false,
  getSnapActive,
}) {
  const { gl } = useThree();
  const rectRef = useRef(null);
  const rafIdRef = useRef(0);
  const lastEvRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    if (isNavActive) return;

    const el = gl?.domElement;
    if (!el) return;

    const updateRect = () => {
      rectRef.current = el.getBoundingClientRect();
    };
    updateRect();

    const ro = new ResizeObserver(updateRect);
    ro.observe(el);

    const toNdc = (clientX, clientY) => {
      const rect = rectRef.current || el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      return { x, y };
    };

    const flush = () => {
      rafIdRef.current = 0;
      const ev = lastEvRef.current;
      if (!ev) return;

      const { x, y } = toNdc(ev.clientX, ev.clientY);
      if (x < -1 || x > 1 || y < -1 || y > 1) return;

      lastNdcRef.current = { x, y, t: performance.now() };
    };

    const onMove = (ev) => {
      lastEvRef.current = ev;
      if (!rafIdRef.current) rafIdRef.current = requestAnimationFrame(flush);
    };

    const onDown = (ev) => {
      if (ev.button !== 0) return;

      const snapOn = typeof getSnapActive === "function" ? !!getSnapActive() : false;

      // ✅ Snap中はクリック位置に依存せず確定
      if (snapOn) {
        ev.preventDefault?.();
        ev.stopPropagation?.();
        ev.stopImmediatePropagation?.();
        onConfirm?.();
        return;
      }

      const { x, y } = toNdc(ev.clientX, ev.clientY);
      if (x < -1 || x > 1 || y < -1 || y > 1) return;

      ev.preventDefault?.();
      ev.stopPropagation?.();
      ev.stopImmediatePropagation?.();

      // ✅ クリック座標を必ず反映（1フレーム遅延を潰す）
      lastNdcRef.current = { x, y, t: performance.now() };

      onConfirm?.();
    };

    const onResize = () => updateRect();

    window.addEventListener("pointermove", onMove, { passive: true, capture: true });
    window.addEventListener("pointerdown", onDown, { passive: false, capture: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      ro.disconnect();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    };
  }, [enabled, isNavActive, gl, onConfirm, lastNdcRef, getSnapActive]);

  return null;
}
