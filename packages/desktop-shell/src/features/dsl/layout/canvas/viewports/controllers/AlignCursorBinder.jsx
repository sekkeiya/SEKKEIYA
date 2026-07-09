// controllers/ は共通して **Canvas 内で useThree / useFrame を使い、DOMや3D世界に“副作用”を起こす層
// 役割：AlignモードだけCanvasのカーソルをcrosshairにするUIフィードバック担当
// 責務：
// ・gl.domElement.style.cursorをenabledに応じて切り替える
// ・unmount / disable時に必ずもとに戻す（後片付け）
// 機能：
// ・Alignが有効なとき「狙って配置するモードだ」と視覚的に伝える
// ・3D処理やAlign計算は一切しない（見た目だけ）
// なぜcontroller?
// useThree()が必要で、CanvasのDOM（gl.domElement）に触る副作用だから

import React, { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export default function AlignCursorBinder({ enabled }) {
  const { gl } = useThree();

  useEffect(() => {
    const el = gl?.domElement;
    if (!el) return;

    if (enabled) el.style.cursor = "crosshair";
    else el.style.cursor = "";

    return () => {
      if (!el) return;
      el.style.cursor = "";
    };
  }, [enabled, gl]);

  return null;
}
