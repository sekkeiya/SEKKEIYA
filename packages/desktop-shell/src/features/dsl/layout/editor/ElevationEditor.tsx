// ElevationEditor — 壁/床/天井の「展開図」を2Dで表示し、矩形範囲を指定して
// その領域にマテリアルを貼る（部分仕上げ）。メインの3Dカメラには触れない安全な2D編集。
//
// 面ローカル座標: u（横, surface中心原点, ワールド単位）, v（縦, 上向き）。
// 画面ピクセル ↔ 面ローカルは単純なアフィン変換。

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { ELEVATION_WIDTH } from "../store/useElevationEditorStore";
import { useSurfaceFinishStore, finishRects, rectsTouch, unionArea, type FinishRegion, type SurfaceFinish } from "../store/useSurfaceFinishStore";
import { unionRing, polygonToRects, normalizeRects, dragVertex, dragEdge, edgeIsHorizontal, type Pt } from "../lib/rectilinear";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useMaterialFaceStore, surfaceKeyOf } from "../store/useMaterialFaceStore";
import { useAppStore } from "../../../../store/useAppStore";
import { subscribeProjectMaterials } from "../../../dsmt/api/dsmtQueries";
import { materialToSnapshot } from "../../../shared/material/useMaterialBinding";

const ACCENT = "#ec407a";
const CANVAS_MAX = 420; // 展開図の最大ピクセル幅/高さ（カラム内）
// 寸法目盛のための余白（px）
const ML = 36, MT = 10, MR = 14, MB = 28;

// 調整バーのピル型ボタン共通スタイル
const pillSx = {
  display: "flex", alignItems: "center", justifyContent: "center",
  minWidth: 22, height: 22, px: 0.5, borderRadius: 999, cursor: "pointer",
  fontSize: 12, fontWeight: 700, color: "var(--brand-fg)", userSelect: "none",
  bgcolor: "rgb(var(--brand-fg-rgb) / 0.08)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.15)",
  "&:hover": { bgcolor: "rgba(236,64,122,0.3)", borderColor: ACCENT },
} as const;

// 同素材グループのキー（素材ID＋和集合バウンディングボックス由来で安定）。
const groupKey = (surfKey: string, materialId: string, rects: FinishRegion[]) => {
  const q = (n: number) => Math.round(n);
  const u0 = Math.min(...rects.map((r) => r.u0)), u1 = Math.max(...rects.map((r) => r.u1));
  const v0 = Math.min(...rects.map((r) => r.v0)), v1 = Math.max(...rects.map((r) => r.v1));
  const mid = materialId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `${surfKey}#g_${mid}_${q(u0)}_${q(v0)}_${q(u1)}_${q(v1)}`;
};

// rect b が rect a に完全に内包されるか（マージ時の重複除去用）。
const rectContains = (a: FinishRegion, b: FinishRegion) =>
  a.u0 <= b.u0 && a.u1 >= b.u1 && a.v0 <= b.v0 && a.v1 >= b.v1;

// グループ内の冗長な矩形（他に完全内包されるもの）を取り除く。
const dedupeRects = (rects: FinishRegion[]): FinishRegion[] => {
  const out: FinishRegion[] = [];
  rects.forEach((r) => {
    if (rects.some((o) => o !== r && rectContains(o, r) && !(rectContains(r, o) && rects.indexOf(o) > rects.indexOf(r)))) return;
    out.push(r);
  });
  return out;
};

export default function ElevationEditor() {
  // 開閉は Material モードに連動（モードに入ると常時表示、面未選択ならプレースホルダ）
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const face = useMaterialFaceStore((s) => s.selectedFace);
  const open = editorMode === "material";
  const surface = face?.surface || null;
  const surfaceType = face?.surfaceType || "wall";

  const finishes = useSurfaceFinishStore((s) => s.finishes);
  const setFinish = useSurfaceFinishStore((s) => s.setFinish);
  const removeFinish = useSurfaceFinishStore((s) => s.removeFinish);
  const updateFinish = useSurfaceFinishStore((s) => s.updateFinish);

  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const unitsPerMeter = sceneMaxY > 100 ? 1000 : 1;
  const projectId = useAppStore((s) => s.activeProjectId);

  const [materials, setMaterials] = useState<any[]>([]);
  const [activeMat, setActiveMat] = useState<any>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // 選択中のリージョン（拡縮・サイズ調整の対象）と、ドラッグ中のサイズ調整プレビュー
  const [selKey, setSelKey] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ key: string; rects: FinishRegion[] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // 素材ピッカーの高さ（上端ドラッグで可変）。既定は3列目の半分まで見える高さ。
  const [pickerHeight, setPickerHeight] = useState(248);
  const startPickerResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = pickerHeight;
    const onMove = (ev: PointerEvent) => {
      setPickerHeight(Math.min(520, Math.max(110, startH + (startY - ev.clientY))));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    if (!projectId || !open) return;
    const unsub = subscribeProjectMaterials(projectId, setMaterials);
    return () => unsub();
  }, [projectId, open]);

  // 選択中リージョンを Delete / Backspace で削除（入力欄フォーカス中は無視）。
  useEffect(() => {
    if (!selKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      removeFinish(selKey);
      setSelKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selKey, removeFinish]);

  // 表示スケール（ワールド単位→px）。面の縦横比を保ったまま CANVAS_MAX に収める。
  const view = useMemo(() => {
    if (!surface) return null;
    const W = surface.width, H = surface.height;
    const scale = Math.min(CANVAS_MAX / W, CANVAS_MAX / H);
    return { W, H, pxW: W * scale, pxH: H * scale, scale };
  }, [surface]);

  if (!open) return null; // Material モード以外は非表示（幅0）

  // Material モードだが面未選択 → プレースホルダのカラム
  if (!surface || !view) {
    return (
      <Box sx={{ width: ELEVATION_WIDTH, flexShrink: 0, height: "100%", bgcolor: "var(--brand-bg)", borderLeft: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", display: "flex", flexDirection: "column" }}>
        <Box sx={{ px: 3, py: 1.5, borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.08)" }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "var(--brand-fg)" }}>展開図</Typography>
        </Box>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
          <Typography sx={{ fontSize: 13, color: "rgb(var(--brand-fg-rgb) / 0.5)", textAlign: "center", lineHeight: 1.7 }}>
            左の3Dで床・壁・天井をクリックすると<br />その面の展開図がここに表示されます。
          </Typography>
        </Box>
      </Box>
    );
  }

  const surfKey = surfaceKeyOf(surface.normal, surface.center);
  const surfFinishes = Object.values(finishes).filter((f) => f.key.startsWith(surfKey));
  // 矩形を持つ仕上げ（部分領域。面全体は除く）
  const partialFinishes = surfFinishes.filter((f) => finishRects(f).length > 0);
  // この面で使用中の素材ID（ピッカーに✔表示）
  const usedMatIds = new Set(surfFinishes.map((f) => f.materialId));

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  // px(svg左上原点・余白込み) → 面ローカル(u: 中心原点右+, v: 中心原点上+)。面外はクランプ。
  const pxToLocal = (px: number, py: number) => ({
    u: clamp(((px - ML) / view.pxW) * view.W - view.W / 2, -view.W / 2, view.W / 2),
    v: clamp(view.H / 2 - ((py - MT) / view.pxH) * view.H, -view.H / 2, view.H / 2),
  });
  // 面ローカル → px（リージョン描画用、余白込み）
  const localToPx = (u: number, v: number) => ({
    x: ML + ((u + view.W / 2) / view.W) * view.pxW,
    y: MT + ((view.H / 2 - v) / view.H) * view.pxH,
  });

  const svgPoint = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!activeMat) { setSelKey(null); return; } // 素材未選択時の素のクリックは選択解除
    const p = svgPoint(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = svgPoint(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };
  // 同素材で重なる/隣接する既存仕上げを集めて1グループに統合する（純計算）。
  // selfKeys は統合対象から除外する自分自身のキー。
  const computeMerge = (seedRects: FinishRegion[], materialId: string, selfKeys: string[]) => {
    const tol = view.W * 0.01; // 隣接許容（面幅の約1%）
    const sameMat = surfFinishes.filter(
      (f) => f.materialId === materialId && finishRects(f).length > 0 && !selfKeys.includes(f.key)
    );
    const groupRects: FinishRegion[] = [...seedRects];
    const mergedKeys: string[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of sameMat) {
        if (mergedKeys.includes(f.key)) continue;
        const fr = finishRects(f);
        if (fr.some((rr) => groupRects.some((gr) => rectsTouch(gr, rr, tol)))) {
          groupRects.push(...fr);
          mergedKeys.push(f.key);
          changed = true;
        }
      }
    }
    return { rects: dedupeRects(groupRects), mergedKeys };
  };

  const onUp = () => {
    if (!drag || !activeMat) { setDrag(null); return; }
    const a = pxToLocal(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1));
    const b = pxToLocal(Math.max(drag.x0, drag.x1), Math.max(drag.y0, drag.y1));
    const u0 = Math.min(a.u, b.u), u1 = Math.max(a.u, b.u);
    const v0 = Math.min(a.v, b.v), v1 = Math.max(a.v, b.v);
    setDrag(null);
    if (Math.abs(u1 - u0) < view.W * 0.02 || Math.abs(v1 - v0) < view.H * 0.02) return; // 小さすぎる
    const newRect: FinishRegion = { u0, u1, v0, v1 };

    // 作成時の自動マージ → 直線多角形として正規化（重なりのない矩形列に）
    const { rects: cleaned, mergedKeys } = computeMerge([newRect], activeMat.id, []);
    const canonical = normalizeRects(cleaned);
    const baseFinish: SurfaceFinish | null = mergedKeys.length ? finishes[mergedKeys[0]] : null;
    mergedKeys.forEach((k) => removeFinish(k));
    const newKey = groupKey(surfKey, activeMat.id, canonical);
    setFinish({
      key: newKey,
      surface,
      region: null,
      regions: canonical,
      materialId: activeMat.id,
      material: baseFinish?.material || materialToSnapshot(activeMat),
      scale: baseFinish?.scale,
      rotation: baseFinish?.rotation,
    });
    setSelKey(newKey); // 作成直後に選択（拡縮・調整できるように）
  };

  const dragRect = drag ? {
    x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1),
    w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0),
  } : null;

  // 結合後の外形（直線多角形）を頂点／辺中点ドラッグでサイズ変更する共通処理。
  // transform: (元リング, snap済u, snap済v) => 新リング。確定時に矩形分解＋他グループ統合。
  const startRingDrag = (
    e: React.PointerEvent, f: any, ring: Pt[],
    transform: (ring: Pt[], u: number, v: number) => Pt[],
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const oldKey: string = f.key;
    const rect = svgRef.current!.getBoundingClientRect();

    // スナップ候補：面端・中心・1mグリッド・他グループの頂点
    const uCand: number[] = [-view.W / 2, 0, view.W / 2];
    const vCand: number[] = [-view.H / 2, 0, view.H / 2];
    for (let k = 0; k <= Math.floor(view.W / unitsPerMeter); k++) uCand.push(-view.W / 2 + k * unitsPerMeter);
    for (let k = 0; k <= Math.floor(view.H / unitsPerMeter); k++) vCand.push(-view.H / 2 + k * unitsPerMeter);
    partialFinishes.forEach((o) => {
      if (o.key === oldKey) return;
      unionRing(finishRects(o)).forEach((p) => { uCand.push(p.u); vCand.push(p.v); });
    });
    const thr = 9 / view.scale; // 約9pxでスナップ
    const snap = (val: number, cands: number[]) => {
      let best = val, bd = thr;
      for (const c of cands) { const d = Math.abs(c - val); if (d < bd) { bd = d; best = c; } }
      return best;
    };

    let curRing = ring;
    const onWinMove = (ev: PointerEvent) => {
      const loc = pxToLocal(ev.clientX - rect.left, ev.clientY - rect.top);
      curRing = transform(ring, snap(loc.u, uCand), snap(loc.v, vCand));
      setResizing({ key: oldKey, rects: polygonToRects(curRing) });
    };
    const onWinUp = () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      setResizing(null);
      const nextRects = polygonToRects(curRing);
      if (nextRects.length === 0) { removeFinish(oldKey); setSelKey(null); return; }
      // サイズ変更で他の同素材グループに重なった/隣接したら統合する。
      const { rects: merged, mergedKeys } = computeMerge(nextRects, f.materialId, [oldKey]);
      const canonical = normalizeRects(merged);
      removeFinish(oldKey);
      mergedKeys.forEach((k) => removeFinish(k));
      const newKey = groupKey(surfKey, f.materialId, canonical);
      setFinish({ ...f, key: newKey, region: null, regions: canonical });
      setSelKey(newKey);
    };
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
  };

  const startVertexDrag = (e: React.PointerEvent, f: any, ring: Pt[], vertexIndex: number) =>
    startRingDrag(e, f, ring, (rg, u, v) => dragVertex(rg, vertexIndex, u, v));

  const startEdgeDrag = (e: React.PointerEvent, f: any, ring: Pt[], edgeIndex: number) => {
    startRingDrag(e, f, ring, (rg, u, v) => dragEdge(rg, edgeIndex, u, v));
  };

  // #4 選択リージョンのテクスチャ拡縮・ランダム（向き）。
  const selFinish = selKey ? finishes[selKey] : null;
  const adjustScale = (mult: number) => {
    if (!selKey || !selFinish) return;
    const next = Math.min(8, Math.max(0.25, (selFinish.scale || 1) * mult));
    updateFinish(selKey, { scale: Number(next.toFixed(3)) });
  };
  const commitScale = (text: string) => {
    if (!selKey) return;
    const v = parseFloat(text);
    if (isNaN(v)) return;
    updateFinish(selKey, { scale: Number(Math.min(8, Math.max(0.25, v)).toFixed(3)) });
  };
  const randomizeFinish = () => {
    if (!selKey || !selFinish) return;
    // 90度刻みの回転＋微小スケール揺らぎで「繰り返し感」を崩す
    const rots = [0, 90, 180, 270];
    const rot = rots[Math.floor((selFinish.rotation ? selFinish.rotation / 90 + 1 : 1)) % 4];
    const jitter = 0.85 + ((selFinish.scale || 1) % 0.3);
    updateFinish(selKey, { rotation: rot, scale: Number(Math.min(8, Math.max(0.25, jitter)).toFixed(3)) });
  };

  // 1mごとの目盛数
  const meterTicksW = Math.floor(view.W / unitsPerMeter);
  const meterTicksH = Math.floor(view.H / unitsPerMeter);
  // 1m あたりのピクセル（テクスチャタイル基準）と、リージョン→pattern id
  const mPx = unitsPerMeter * view.scale;
  const patId = (k: string) => `epat_${k.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const albedoOf = (f: any) => f?.material?.maps?.albedo as string | undefined;
  // 表示用：仕上げごとに矩形リストを展開（頂点ドラッグ中はプレビュー矩形に差し替え）。
  const displayFinishes = partialFinishes.map((f) => {
    const rects = resizing && resizing.key === f.key ? resizing.rects : finishRects(f);
    return { f, rects, ring: unionRing(rects) };
  });

  return (
    <Box sx={{
      // 実レイアウトのカラム（メインが縮む可変レイアウト）。右端の Properties サイドバーは別。
      width: ELEVATION_WIDTH, flexShrink: 0, height: "100%",
      bgcolor: "var(--brand-bg)", borderLeft: "1px solid rgb(var(--brand-fg-rgb) / 0.1)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* ヘッダー */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, py: 1.5, borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.08)" }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "var(--brand-fg)" }}>展開図 — {surfaceType === "floor" ? "床" : surfaceType === "ceiling" ? "天井" : "壁"}</Typography>
        <Typography sx={{ fontSize: 12, color: "rgb(var(--brand-fg-rgb) / 0.5)" }}>
          {(view.W / unitsPerMeter).toFixed(2)} m × {(view.H / unitsPerMeter).toFixed(2)} m
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12, color: activeMat ? ACCENT : "rgb(var(--brand-fg-rgb) / 0.5)" }}>
          {activeMat ? `「${activeMat.title}」を範囲ドラッグで貼る` : "下から素材を選んでください"}
        </Typography>
      </Box>

      {/* 選択中リージョンの調整バー（拡縮・ランダム） */}
      {selFinish && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, py: 0.75, borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.08)", bgcolor: "rgba(236,64,122,0.08)" }}>
          <Box sx={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: albedoOf(selFinish) ? `center/cover url(${albedoOf(selFinish)})` : (selFinish.material?.params?.baseColor || "#888"), border: "1px solid rgb(var(--brand-fg-rgb) / 0.25)" }} />
          <Typography sx={{ fontSize: 11.5, color: "var(--brand-fg)", maxWidth: 120 }} noWrap>{selFinish.material?.title || "素材"}</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10.5, color: "rgb(var(--brand-fg-rgb) / 0.55)" }}>拡縮</Typography>
          <Box onClick={() => adjustScale(1 / 1.25)} sx={pillSx}>−</Box>
          <Box
            component="input"
            type="number"
            step={0.05}
            min={0.25}
            max={8}
            key={selFinish.scale || 1}
            defaultValue={(selFinish.scale || 1).toFixed(2)}
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { commitScale(e.currentTarget.value); e.currentTarget.blur(); }
            }}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => commitScale(e.target.value)}
            sx={{
              width: 46, height: 22, textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--brand-fg)",
              bgcolor: "light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))", border: "1px solid rgb(var(--brand-fg-rgb) / 0.2)", borderRadius: 1,
              outline: "none", MozAppearance: "textfield",
              "&:focus": { borderColor: ACCENT },
              "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
            }}
          />
          <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.7)" }}>×</Typography>
          <Box onClick={() => adjustScale(1.25)} sx={pillSx}>＋</Box>
          <Box onClick={randomizeFinish} sx={{ ...pillSx, px: 1.25, width: "auto" }}>ランダム</Box>
          <Box onClick={() => setSelKey(null)} sx={{ ...pillSx, color: "rgb(var(--brand-fg-rgb) / 0.6)" }}>×</Box>
        </Box>
      )}

      {/* 展開図キャンバス */}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", p: 2 }}>
        <svg
          ref={svgRef}
          width={view.pxW + ML + MR} height={view.pxH + MT + MB}
          style={{ cursor: activeMat ? "crosshair" : "default", touchAction: "none" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        >
          {/* テクスチャパターン定義（展開図にも実マテリアルを反映） */}
          <defs>
            {displayFinishes.filter(({ f }) => albedoOf(f)).map(({ f }) => {
              const tile = Math.max(8, mPx * (f.scale || 1));
              const rot = f.rotation || 0;
              return (
                <pattern key={patId(f.key)} id={patId(f.key)} patternUnits="userSpaceOnUse"
                  width={tile} height={tile} patternTransform={rot ? `rotate(${rot})` : undefined}>
                  <image href={albedoOf(f)} x={0} y={0} width={tile} height={tile} preserveAspectRatio="xMidYMid slice" />
                </pattern>
              );
            })}
            {activeMat?.maps?.albedo && (
              <pattern id="epat_active" patternUnits="userSpaceOnUse" width={Math.max(8, mPx)} height={Math.max(8, mPx)}>
                <image href={activeMat.maps.albedo} x={0} y={0} width={Math.max(8, mPx)} height={Math.max(8, mPx)} preserveAspectRatio="xMidYMid slice" />
              </pattern>
            )}
          </defs>

          {/* 面の背景 */}
          <rect x={ML} y={MT} width={view.pxW} height={view.pxH} fill="#3a3d42" stroke="rgb(var(--brand-fg-rgb) / 0.2)" rx={4} />

          {/* グリッド（1m） */}
          {Array.from({ length: meterTicksW }).map((_, i) => {
            const x = ML + ((i + 1) * unitsPerMeter / view.W) * view.pxW;
            return <line key={`gx${i}`} x1={x} y1={MT} x2={x} y2={MT + view.pxH} stroke="rgb(var(--brand-fg-rgb) / 0.08)" />;
          })}
          {Array.from({ length: meterTicksH }).map((_, i) => {
            const y = MT + ((i + 1) * unitsPerMeter / view.H) * view.pxH;
            return <line key={`gy${i}`} x1={ML} y1={y} x2={ML + view.pxW} y2={y} stroke="rgb(var(--brand-fg-rgb) / 0.08)" />;
          })}

          {/* 寸法目盛（下=幅, 左=高さ） */}
          {Array.from({ length: meterTicksW + 1 }).map((_, i) => {
            const x = ML + (i * unitsPerMeter / view.W) * view.pxW;
            return <text key={`tw${i}`} x={x} y={MT + view.pxH + 14} fill="rgb(var(--brand-fg-rgb) / 0.5)" fontSize={9} textAnchor="middle">{i}</text>;
          })}
          {Array.from({ length: meterTicksH + 1 }).map((_, i) => {
            // 下からの高さ（v=-H/2 が床）。i m を下から
            const y = MT + view.pxH - (i * unitsPerMeter / view.H) * view.pxH;
            return <text key={`th${i}`} x={ML - 6} y={y + 3} fill="rgb(var(--brand-fg-rgb) / 0.5)" fontSize={9} textAnchor="end">{i}</text>;
          })}
          {/* 総寸法 */}
          <text x={ML + view.pxW / 2} y={MT + view.pxH + 25} fill="rgb(var(--brand-fg-rgb) / 0.85)" fontSize={11} fontWeight={700} textAnchor="middle">
            {(view.W / unitsPerMeter).toFixed(2)} m
          </text>
          <text x={11} y={MT + view.pxH / 2} fill="rgb(var(--brand-fg-rgb) / 0.85)" fontSize={11} fontWeight={700} textAnchor="middle" transform={`rotate(-90, 11, ${MT + view.pxH / 2})`}>
            {(view.H / unitsPerMeter).toFixed(2)} m
          </text>

          {/* 既存仕上げ（同素材は1グループ＝結合された外形。頂点ドラッグでサイズ変更） */}
          {displayFinishes.map(({ f, rects, ring }) => {
            const isSel = selKey === f.key;
            const fillId = albedoOf(f) ? `url(#${patId(f.key)})` : null;
            const baseColor = f.material?.params?.baseColor || "#888";
            if (!ring.length) return null;
            // 外形ポリゴンの px パス（内部の継ぎ目は描かずパターンで連続表示）
            const pts = ring.map((p) => localToPx(p.u, p.v));
            const polyStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
            // 和集合バウンディングボックス（ラベル・削除ボタン配置用）
            const ub = {
              u0: Math.min(...rects.map((r) => r.u0)), u1: Math.max(...rects.map((r) => r.u1)),
              v0: Math.min(...rects.map((r) => r.v0)), v1: Math.max(...rects.map((r) => r.v1)),
            };
            const ubTL = localToPx(ub.u0, ub.v1), ubBR = localToPx(ub.u1, ub.v0);
            // ラベルは最大矩形の中央に置く（空きスペースに浮かないように）
            const big = rects.reduce((m, r) => ((r.u1 - r.u0) * (r.v1 - r.v0) > (m.u1 - m.u0) * (m.v1 - m.v0) ? r : m), rects[0]);
            const bigTL = localToPx(big.u0, big.v1), bigBR = localToPx(big.u1, big.v0);
            const bcx = (bigTL.x + bigBR.x) / 2, bcy = (bigTL.y + bigBR.y) / 2;
            const areaM2 = unionArea(rects) / (unitsPerMeter * unitsPerMeter);
            const HS = 6; // 頂点ハンドル半サイズ
            return (
              <g key={f.key}>
                {/* 塗り：矩形ごと（パターンは user space で連続するため継ぎ目なし）。枠線なし */}
                {rects.map((r, ri) => {
                  const tl = localToPx(r.u0, r.v1), br = localToPx(r.u1, r.v0);
                  return (
                    <rect key={ri} x={tl.x} y={tl.y} width={br.x - tl.x} height={br.y - tl.y}
                      fill={fillId || baseColor} fillOpacity={fillId ? 1 : 0.6}
                      style={{ cursor: "pointer" }}
                      onPointerDown={(e) => { e.stopPropagation(); setSelKey(f.key); }} />
                  );
                })}
                {/* 外形線（結合された1つの輪郭） */}
                <polygon points={polyStr} fill="none"
                  stroke={isSel ? ACCENT : "#fff"} strokeWidth={isSel ? 2 : 1} strokeOpacity={isSel ? 1 : 0.6}
                  strokeLinejoin="round" pointerEvents="none" />
                {/* 中央にマテリアル名＋面積（グループの実面積＝和集合） */}
                {(bigBR.x - bigTL.x) > 44 && (bigBR.y - bigTL.y) > 26 && (
                  <g pointerEvents="none" style={{ paintOrder: "stroke" }}>
                    <text x={bcx} y={bcy - 2} fill="#fff" fontSize={11} fontWeight={700}
                      textAnchor="middle" stroke="rgba(0,0,0,0.65)" strokeWidth={3.5} strokeLinejoin="round">
                      {f.material?.title || "素材"}
                    </text>
                    <text x={bcx} y={bcy + 12} fill="rgb(var(--brand-fg-rgb) / 0.92)" fontSize={9.5}
                      textAnchor="middle" stroke="rgba(0,0,0,0.65)" strokeWidth={3} strokeLinejoin="round">
                      {areaM2.toFixed(2)} ㎡
                    </text>
                  </g>
                )}
                {/* 選択時：外形の各頂点にハンドル＋バウンディングボックス寸法 */}
                {isSel && (
                  <>
                    <g pointerEvents="none">
                      <rect x={(ubTL.x + ubBR.x) / 2 - 26} y={ubBR.y + 4} width={52} height={15} rx={3} fill="rgba(0,0,0,0.7)" />
                      <text x={(ubTL.x + ubBR.x) / 2} y={ubBR.y + 15} fill="#fff" fontSize={10} fontWeight={700} textAnchor="middle">
                        {((ub.u1 - ub.u0) / unitsPerMeter).toFixed(2)} m
                      </text>
                      <rect x={ubTL.x - 30} y={(ubTL.y + ubBR.y) / 2 - 8} width={28} height={15} rx={3} fill="rgba(0,0,0,0.7)" />
                      <text x={ubTL.x - 16} y={(ubTL.y + ubBR.y) / 2 + 3} fill="#fff" fontSize={10} fontWeight={700} textAnchor="middle">
                        {((ub.v1 - ub.v0) / unitsPerMeter).toFixed(2)}
                      </text>
                    </g>
                    {/* 辺の中点ハンドル（辺を平行移動）— 円で表示 */}
                    {pts.map((p, ei) => {
                      const q = pts[(ei + 1) % pts.length];
                      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
                      const horiz = edgeIsHorizontal(ring, ei);
                      return (
                        <circle key={`e${ei}`} cx={mx} cy={my} r={HS - 1}
                          fill={ACCENT} stroke="#fff" strokeWidth={1.5}
                          style={{ cursor: horiz ? "ns-resize" : "ew-resize" }}
                          onPointerDown={(e) => startEdgeDrag(e, f, ring, ei)} />
                      );
                    })}
                    {/* 頂点ハンドル（角を移動）— 四角で表示 */}
                    {pts.map((p, vi) => (
                      <rect key={vi} x={p.x - HS} y={p.y - HS} width={HS * 2} height={HS * 2}
                        fill="#fff" stroke={ACCENT} strokeWidth={1.5} rx={2}
                        style={{ cursor: "move" }}
                        onPointerDown={(e) => startVertexDrag(e, f, ring, vi)} />
                    ))}
                  </>
                )}
                {/* グループ削除（和集合の右上） */}
                <foreignObject x={ubBR.x - 22} y={ubTL.y + 2} width={20} height={20}>
                  <div onPointerDown={(e) => { e.stopPropagation(); removeFinish(f.key); if (selKey === f.key) setSelKey(null); }}
                    style={{ cursor: "pointer", color: "var(--brand-fg)", background: "rgba(0,0,0,0.5)", borderRadius: 4, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>×</div>
                </foreignObject>
              </g>
            );
          })}

          {/* ドラッグ中の矩形 */}
          {dragRect && (
            <rect x={dragRect.x} y={dragRect.y} width={dragRect.w} height={dragRect.h}
              fill={activeMat?.maps?.albedo ? "url(#epat_active)" : (activeMat?.params?.baseColor || ACCENT)}
              fillOpacity={activeMat?.maps?.albedo ? 0.85 : 0.4} stroke={ACCENT} strokeDasharray="4 3" />
          )}
        </svg>
      </Box>

      {/* 素材ピッカー（上端ドラッグで高さ可変・縦スクロールグリッド） */}
      <Box sx={{ flexShrink: 0, borderTop: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", bgcolor: "light-dark(rgba(15,23,42,0.09), rgba(0,0,0,0.28))" }}>
        {/* リサイズハンドル */}
        <Box
          onPointerDown={startPickerResize}
          sx={{
            height: 12, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "ns-resize", touchAction: "none",
            "&:hover .grip": { background: ACCENT },
          }}
        >
          <Box className="grip" sx={{ width: 42, height: 4, borderRadius: 999, background: "rgb(var(--brand-fg-rgb) / 0.28)", transition: "background 0.12s" }} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pb: 0.75 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "rgb(var(--brand-fg-rgb) / 0.85)" }}>素材を選ぶ</Typography>
          <Box sx={{ flex: 1 }} />
          {activeMat ? (
            <Box onClick={() => setActiveMat(null)}
              sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25, borderRadius: 999, bgcolor: "rgba(236,64,122,0.18)", border: `1px solid ${ACCENT}`, cursor: "pointer" }}>
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", background: activeMat.thumbnailUrl ? `center/cover url(${activeMat.thumbnailUrl})` : activeMat.params?.baseColor || "#888" }} />
              <Typography sx={{ fontSize: 10.5, color: "var(--brand-fg)", maxWidth: 120 }} noWrap>{activeMat.title}</Typography>
              <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.7)" }}>×</Typography>
            </Box>
          ) : (
            <Typography sx={{ fontSize: 10.5, color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>選んで展開図にドラッグ＝部分／下部で面全体</Typography>
          )}
        </Box>
        <Box sx={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 1,
          alignContent: "start", gridAutoRows: "min-content",
          px: 2, pb: 1.5, height: pickerHeight, overflowY: "auto",
          "&::-webkit-scrollbar": { width: 8 },
          "&::-webkit-scrollbar-thumb": { background: "rgb(var(--brand-fg-rgb) / 0.12)", borderRadius: 8 },
        }}>
          {materials.length === 0 && <Typography sx={{ fontSize: 12, color: "rgb(var(--brand-fg-rgb) / 0.4)", gridColumn: "1 / -1" }}>このプロジェクトに素材がありません。S.Material で作成してください。</Typography>}
          {materials.map((m) => {
            const sel = activeMat?.id === m.id;
            const used = usedMatIds.has(m.id); // この面で使用中
            return (
              <Box key={m.id} onClick={() => setActiveMat(sel ? null : m)}
                sx={{
                  position: "relative",
                  textAlign: "center", cursor: "pointer", p: 0.75, borderRadius: 2,
                  border: `1px solid ${sel ? ACCENT : "rgb(var(--brand-fg-rgb) / 0.06)"}`,
                  bgcolor: sel ? "rgba(236,64,122,0.14)" : "rgb(var(--brand-fg-rgb) / 0.03)",
                  transition: "all 0.12s",
                  "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.08)", transform: "translateY(-1px)" },
                }}>
                {used && (
                  <Box sx={{
                    position: "absolute", top: 2, right: 2, zIndex: 1,
                    width: 17, height: 17, borderRadius: "50%", bgcolor: "#22c55e",
                    color: "var(--brand-fg)", fontSize: 11, fontWeight: 900, lineHeight: "17px",
                    border: "1.5px solid #0d0f16", boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  }}>✓</Box>
                )}
                <Box sx={{ width: 52, height: 52, mx: "auto", borderRadius: "50%", background: m.thumbnailUrl ? `center/cover url(${m.thumbnailUrl})` : `radial-gradient(circle at 33% 30%, #fff, ${m.params?.baseColor || "#888"} 62%, #111 92%)`, border: `1px solid ${used ? "#22c55e" : "rgb(var(--brand-fg-rgb) / 0.18)"}`, boxShadow: sel ? `0 0 0 2px ${ACCENT}` : "0 2px 5px rgba(0,0,0,0.35)" }} />
                <Typography sx={{ fontSize: 10, color: sel ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)", mt: 0.5, fontWeight: sel ? 700 : 400 }} noWrap>{m.title}</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
