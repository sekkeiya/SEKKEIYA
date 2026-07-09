// controllers/ は共通して **Canvas 内で useThree / useFrame を使い、DOMや3D世界に“副作用”を起こす層
// 役割
// Material Pick（スポイト）中だけカーソルをスポイトにする UIフィードバック担当。
// 責務
// gl.domElement.style.cursor を url("/cursors/eyedropper.png") ... に切り替える
// 終了時に必ず戻す
// 機能
// 「今は“選択”ではなく“素材を拾う”モード」だとユーザーに伝える
// MaterialPickController とセットで使うとUXが成立する
// なぜ controller？
// これも Canvas DOM を触る副作用だから（useThree必須）。

import React, { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export default function MaterialCursorBinder({ enabled }) {
  const { gl } = useThree();

  useEffect(() => {
    const el = gl?.domElement;
    if (!el) return;

    if (enabled) {
      el.style.cursor = 'url("/cursors/eyedropper.png") 16 16, crosshair';
    } else {
      el.style.cursor = "";
    }

    return () => {
      if (!el) return;
      el.style.cursor = "";
    };
  }, [enabled, gl]);

  return null;
}