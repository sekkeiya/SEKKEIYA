// src/features/dsl/layout/canvas/scene/LandscapeBackdrop.jsx
// Twinmotion 風の Vegetation → Landscapes → Flat 相当のシーン環境。
// useEnvironmentStore の landscape preset に応じて、HDR Environment と
// テクスチャ地面（半径200m の円盤）を表示する。
//
// 単位系メモ:
//  - 3DSL の世界座標は mm（BaseGlb.jsx が床 Y=0 / XZ 中央揃え）
//  - ground 円盤を Y=-0.02mm に置く（既存 catcher Y=-0.05 より上）
//
// 品質メモ:
//  - 1024px procedural canvas
//  - 多層 (大ブロブ / 中クラスタ / 細部) 構成
//  - 高さフィールドから Normal Map を生成して meshStandardMaterial.normalMap に流す
//  - canvases は preset 単位でキャッシュ（重い生成を再利用）
import React, { useMemo, useCallback, useEffect } from "react";
import * as THREE from "three";
import { Environment } from "@react-three/drei";
import { useEnvironmentStore } from "../../store/useEnvironmentStore";
import { useUiPropertiesSelectionStore } from "../../store/uiPropertiesSelectionStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";

const GROUND_RADIUS_MM = 200000; // 200m
const GROUND_Y_MM = -0.02;
const SKY_RADIUS_MM = 800000;

const TEX_SIZE = 1024;

// Fog: 遠方の地面を Sky 色にフェードして horizon の seam を解消する。
// 単位は mm。near = 30m / far = 240m で建物 (5–15m) には影響させず、
// 地面端 (200m) を十分にフォグ域に入れる。
const FOG_NEAR_MM = 30000;
const FOG_FAR_MM = 240000;

// 各 skyPreset の horizon 近似色（fog 色として使う）
const FOG_COLOR_BY_SKY = {
  park: "#b8c8d4",
  sunset: "#dca080",
  dawn: "#d4c4a8",
  night: "#1a2030",
  forest: "#9cae84",
  city: "#b0b4b8",
  apartment: "#a8a39c",
  studio: "#bcbcbc",
  warehouse: "#a4a4a0",
  lobby: "#b0aca0",
};

// ─── Ground shader: マクロ変動でタイル感を分断 ──────────────────────────────
// `onBeforeCompile` で MeshStandardMaterial にワールド位置ベースの低周波ノイズを
// 注入し、タイル UV と独立した大スケールの明暗ムラを乗せる。
// `antiTile=true` のときは map / normalMap を 2 サンプル (UV と回転オフセット UV)
// 取って world-space ノイズで blend し、タイルの繰り返しを溶かす。
function setupGroundShader(shader, antiTile) {
  // ── Vertex: vWorldPos varying を出す ──
  shader.vertexShader =
    "varying vec3 vWorldPos;\n" + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
    vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
  );

  // ── Fragment: ノイズ関数と macro 適用 ──
  shader.fragmentShader = `varying vec3 vWorldPos;

float gHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float gVNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(gHash21(i), gHash21(i + vec2(1.0, 0.0)), u.x),
    mix(gHash21(i + vec2(0.0, 1.0)), gHash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float gFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * gVNoise(p);
    p *= 2.13;
    a *= 0.5;
  }
  return v;
}
// 2-sample stochastic blend factor (0..1)
float gAntiTileBlend(vec3 wp) {
  return smoothstep(0.18, 0.82, gFbm(wp.xz * 0.00008));
}
` + shader.fragmentShader;

  // map_fragment 置換: 1) antiTile なら 2 サンプル blend / 2) マクロ変動を乗算
  const sampleCode = antiTile
    ? `
      // ── Anti-tile: 2 サンプル (UV と 30° 回転＋オフセット UV) を world ノイズで blend
      vec2 _uvA = vMapUv;
      mat2 _rotB = mat2(0.866, -0.5, 0.5, 0.866);
      vec2 _uvB = _rotB * vMapUv + vec2(0.317, 0.731);
      vec4 _colA = texture2D(map, _uvA);
      vec4 _colB = texture2D(map, _uvB);
      float _blendT = gAntiTileBlend(vWorldPos);
      vec4 sampledDiffuseColor = mix(_colA, _colB, _blendT);
      `
    : `
      vec4 sampledDiffuseColor = texture2D(map, vMapUv);
      `;

  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `
    #ifdef USE_MAP
      ${sampleCode}
      diffuseColor *= sampledDiffuseColor;
    #endif

    // ワールド位置ベースの大スケールマクロ変動（タイル UV と無相関）
    vec2 wpMacro = vWorldPos.xz * 0.000018;
    float macro = gFbm(wpMacro);
    diffuseColor.rgb *= mix(0.7, 1.25, macro);

    // 細かい明暗ムラ
    float macro2 = gVNoise(vWorldPos.xz * 0.00008);
    diffuseColor.rgb *= mix(0.88, 1.1, macro2);
    `
  );

  // antiTile のとき normal map も 2 サンプル blend
  if (antiTile) {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #ifdef TANGENTSPACE_NORMALMAP
        mat2 _rotBN = mat2(0.866, -0.5, 0.5, 0.866);
        vec3 _nA = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
        vec3 _nB = texture2D(normalMap, _rotBN * vNormalMapUv + vec2(0.317, 0.731)).xyz * 2.0 - 1.0;
        float _bTN = gAntiTileBlend(vWorldPos);
        vec3 mapN = mix(_nA, _nB, _bTN);
        mapN.xy *= normalScale;
        #ifdef USE_TANGENT
          normal = normalize(vTBN * mapN);
        #else
          normal = normalize(tbn * mapN);
        #endif
      #endif
      `
    );
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function newCanvas(size = TEX_SIZE) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return { canvas: c, ctx: c.getContext("2d"), size };
}

// 高さフィールド (Float32Array, 0..1) を作るユーティリティ
function newHeightField(size = TEX_SIZE) {
  return new Float32Array(size * size);
}

// 加法的にドロップ。フェードはガウシアン風（cos^2 by distance）
function addHeightBlob(heights, size, cx, cy, radius, amplitude) {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(size - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(size - 1, Math.ceil(cy + radius));
  const r2 = radius * radius;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const t = 1 - d2 / r2;
      heights[y * size + x] += amplitude * t * t;
    }
  }
}

// 細かい点状の高さ
function addHeightSpike(heights, size, cx, cy, amplitude) {
  const ix = Math.round(cx);
  const iy = Math.round(cy);
  if (ix < 0 || ix >= size || iy < 0 || iy >= size) return;
  heights[iy * size + ix] += amplitude;
}

// 高さフィールド → Normal Map canvas
function heightToNormalCanvas(heights, size, strength = 2.5) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    const yT = (y - 1 + size) % size;
    const yB = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xL = (x - 1 + size) % size;
      const xR = (x + 1) % size;
      const dx =
        (heights[y * size + xR] - heights[y * size + xL]) * strength;
      const dy =
        (heights[yB * size + x] - heights[yT * size + x]) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1 / len;
      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeTexture(canvas, repeats) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeats, repeats);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeNormalTexture(canvas, repeats) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeats, repeats);
  tex.anisotropy = 16;
  // Normal map は線形空間
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ─── Terrain canvas builders ────────────────────────────────────────────────
// 各々 { albedoCanvas, normalCanvas, normalScale } を返す

function buildGrass() {
  const { canvas: albedo, ctx, size } = newCanvas();
  const heights = newHeightField(size);

  // 1) ベース: 緑のグラデで自然なムラ
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#3f6c2c");
  grad.addColorStop(0.5, "#4f7a3a");
  grad.addColorStop(1, "#436d2d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 2) 大スケールの色斑 (radial gradient で柔らかいムラ)
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 60 + Math.random() * 200;
    const dark = Math.random() < 0.55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (dark) {
      g.addColorStop(0, `rgba(28,55,20,${0.18 + Math.random() * 0.18})`);
    } else {
      g.addColorStop(0, `rgba(125,160,80,${0.18 + Math.random() * 0.18})`);
    }
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    addHeightBlob(heights, size, x, y, r * 0.7, dark ? -0.18 : 0.18);
  }

  // 3) 中スケールの草クラスタ (色＋微高さ)
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2.5 + Math.random() * 7;
    const lit = Math.random();
    let color;
    if (lit < 0.35) color = `rgba(38,62,22,${0.45 + Math.random() * 0.25})`;
    else if (lit < 0.75) color = `rgba(75,115,55,${0.4 + Math.random() * 0.25})`;
    else color = `rgba(135,165,85,${0.35 + Math.random() * 0.25})`;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    addHeightBlob(heights, size, x, y, r * 1.6, 0.12);
  }

  // 4) 細部: 草の葉 (短いストローク)
  const bladeCount = 60000;
  for (let i = 0; i < bladeCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 1.5 + Math.random() * 4.5;
    const angle = (Math.random() - 0.5) * 0.5;

    // 色を細かく分散させる
    const lit = Math.random();
    let color;
    if (lit < 0.15) color = `rgba(28,52,18,${0.55 + Math.random() * 0.3})`; // 影
    else if (lit < 0.55) color = `rgba(60,100,42,${0.5 + Math.random() * 0.3})`;
    else if (lit < 0.88) color = `rgba(105,150,72,${0.45 + Math.random() * 0.3})`;
    else if (lit < 0.97) color = `rgba(155,180,100,${0.4 + Math.random() * 0.3})`;
    else color = `rgba(190,200,130,${0.35 + Math.random() * 0.25})`; // 黄色ハイライト

    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5 + Math.random() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(angle) * len, y - Math.cos(angle) * len);
    ctx.stroke();

    addHeightSpike(heights, size, x, y, 0.04 + Math.random() * 0.08);
  }

  // 5) 微小なハイライト（葉先の輝き）
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(220,235,170,${0.25 + Math.random() * 0.4})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const normalCanvas = heightToNormalCanvas(heights, size, 2.4);
  return { albedoCanvas: albedo, normalCanvas, normalScale: 1.0 };
}

function buildDirt() {
  const { canvas: albedo, ctx, size } = newCanvas();
  const heights = newHeightField(size);

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#6e4f30");
  grad.addColorStop(0.5, "#7a5a3a");
  grad.addColorStop(1, "#5e4528");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 大きな不規則ブロブ
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 30 + Math.random() * 120;
    const dark = Math.random() < 0.65;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, dark
      ? `rgba(45,30,18,${0.25 + Math.random() * 0.2})`
      : `rgba(150,115,75,${0.18 + Math.random() * 0.15})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    addHeightBlob(heights, size, x, y, r * 0.7, dark ? -0.18 : 0.12);
  }

  // 小石・破片
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 1 + Math.random() * 3;
    const h = 1 + Math.random() * 3;
    const gray = 50 + Math.random() * 90;
    ctx.fillStyle = `rgba(${gray},${gray - 8},${gray - 15},${0.5 + Math.random() * 0.3})`;
    ctx.fillRect(x, y, w, h);
    addHeightSpike(heights, size, x, y, 0.18);
  }

  // ノイズドット
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const lit = Math.random();
    const color = lit < 0.5
      ? `rgba(60,40,25,${0.2 + Math.random() * 0.25})`
      : `rgba(140,105,70,${0.18 + Math.random() * 0.2})`;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  const normalCanvas = heightToNormalCanvas(heights, size, 2.2);
  return { albedoCanvas: albedo, normalCanvas, normalScale: 0.85 };
}

function buildConcrete() {
  const { canvas: albedo, ctx, size } = newCanvas();
  const heights = newHeightField(size);

  ctx.fillStyle = "#9c9c9c";
  ctx.fillRect(0, 0, size, size);

  // 細かいノイズ (image data 直接操作)
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // シミ
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 20 + Math.random() * 70;
    const tint = 55 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${tint},${tint},${tint},${0.06 + Math.random() * 0.08})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    addHeightBlob(heights, size, x, y, r * 0.5, -0.04);
  }

  // 微細なクラック
  ctx.strokeStyle = "rgba(40,40,40,0.18)";
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 35; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.5) * 60;
      ctx.lineTo(x, y);
      addHeightSpike(heights, size, x, y, -0.15);
    }
    ctx.stroke();
  }

  // 全体的に細かい高さノイズ
  for (let i = 0; i < 20000; i++) {
    addHeightSpike(heights, size, Math.random() * size, Math.random() * size, (Math.random() - 0.5) * 0.04);
  }

  const normalCanvas = heightToNormalCanvas(heights, size, 1.0);
  return { albedoCanvas: albedo, normalCanvas, normalScale: 0.35 };
}

function buildStone() {
  const { canvas: albedo, ctx, size } = newCanvas();
  const heights = newHeightField(size);

  ctx.fillStyle = "#8a8580";
  ctx.fillRect(0, 0, size, size);

  // 不規則多角形の石模様
  const stones = 120;
  for (let i = 0; i < stones; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 18 + Math.random() * 60;
    const gray = 95 + Math.floor(Math.random() * 80);
    ctx.fillStyle = `rgba(${gray},${gray - 6},${gray - 14},${0.4 + Math.random() * 0.3})`;
    ctx.beginPath();
    const sides = 5 + Math.floor(Math.random() * 5);
    for (let s = 0; s < sides; s++) {
      const ang = (s / sides) * Math.PI * 2 + Math.random() * 0.3;
      const rr = r * (0.65 + Math.random() * 0.45);
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    addHeightBlob(heights, size, x, y, r * 0.75, gray > 130 ? 0.35 : -0.15);
  }

  // 目地 (暗線)
  ctx.strokeStyle = "rgba(35,32,28,0.6)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      ctx.lineTo(x, y);
      addHeightSpike(heights, size, x, y, -0.4);
    }
    ctx.stroke();
  }

  // 微細ノイズ
  for (let i = 0; i < 30000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const gray = 80 + Math.random() * 80;
    ctx.fillStyle = `rgba(${gray},${gray},${gray - 5},${0.15 + Math.random() * 0.2})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const normalCanvas = heightToNormalCanvas(heights, size, 3.0);
  return { albedoCanvas: albedo, normalCanvas, normalScale: 1.3 };
}

function buildSnow() {
  const { canvas: albedo, ctx, size } = newCanvas();
  const heights = newHeightField(size);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#f4f8fc");
  grad.addColorStop(1, "#dfe7ef");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 青みの陰影パッチ
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 30 + Math.random() * 130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(170,195,225,${0.08 + Math.random() * 0.1})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    addHeightBlob(heights, size, x, y, r * 0.5, 0.1);
  }

  // 雪の起伏
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 6;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    addHeightBlob(heights, size, x, y, r * 1.4, 0.12);
  }

  // キラキラ粒
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${0.6 + Math.random() * 0.4})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const normalCanvas = heightToNormalCanvas(heights, size, 1.8);
  return { albedoCanvas: albedo, normalCanvas, normalScale: 0.5 };
}

function buildWater() {
  const { canvas: albedo, ctx, size } = newCanvas();
  const heights = newHeightField(size);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#4e90b4");
  grad.addColorStop(1, "#235878");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 波線（多層）
  for (let layer = 0; layer < 3; layer++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + layer * 0.04})`;
    ctx.lineWidth = 0.8 + layer * 0.3;
    const freq = 0.04 + layer * 0.02;
    const amp = 2 + layer * 1.5;
    for (let i = 0; i < 90; i++) {
      const baseY = (i / 90) * size + Math.random() * 5;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 0; x < size; x += 4) {
        const yy = baseY + Math.sin(x * freq + i * 0.5 + layer) * amp;
        ctx.lineTo(x, yy);
        addHeightSpike(heights, size, x, yy, 0.05);
      }
      ctx.stroke();
    }
  }

  // 反射ハイライト
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(220,235,255,${0.1 + Math.random() * 0.15})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const normalCanvas = heightToNormalCanvas(heights, size, 1.4);
  return { albedoCanvas: albedo, normalCanvas, normalScale: 0.6 };
}

const TERRAIN_BUILDERS = {
  grass: buildGrass,
  dirt: buildDirt,
  concrete: buildConcrete,
  stone: buildStone,
  snow: buildSnow,
  water: buildWater,
};

// canvas キャッシュ（重い生成を preset 単位で再利用）
const CANVAS_CACHE = new Map();
function getTerrainCanvases(preset) {
  if (CANVAS_CACHE.has(preset)) return CANVAS_CACHE.get(preset);
  const builder = TERRAIN_BUILDERS[preset] || buildGrass;
  const data = builder();
  CANVAS_CACHE.set(preset, data);
  return data;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LandscapeBackdrop({ renderSubMode = "standard" }) {
  const landscapeStore = useEnvironmentStore((s) => s.landscape);
  // 「通常」表示では常に背景 None（影なし運用に合わせたクリーンな作業ビュー）。
  // 「Lighting」表示のときだけ Environment の設定（None/Flat）を反映する。
  const landscape = renderSubMode === "lighting" ? landscapeStore : "none";

  const flatVisible = useEnvironmentStore((s) => s.flatVisible);
  const flatPreset = useEnvironmentStore((s) => s.flatPreset);
  const flatColor = useEnvironmentStore((s) => s.flatColor);
  const flatRoughness = useEnvironmentStore((s) => s.flatRoughness);
  const flatTextureEnabled = useEnvironmentStore((s) => s.flatTextureEnabled);
  const flatTileScale = useEnvironmentStore((s) => s.flatTileScale);
  const flatAntiTile = useEnvironmentStore((s) => s.flatAntiTile);

  const skyVisible = useEnvironmentStore((s) => s.skyVisible);
  const skyPreset = useEnvironmentStore((s) => s.skyPreset);
  const skyBlur = useEnvironmentStore((s) => s.skyBlur);
  const skyResolution = useEnvironmentStore((s) => s.skyResolution);
  const skyBackgroundColor = useEnvironmentStore((s) => s.skyBackgroundColor);
  const noneBackgroundColor = useEnvironmentStore((s) => s.noneBackgroundColor);

  const selectLandscape = useUiPropertiesSelectionStore(
    (s) => s.selectLandscape
  );
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);

  const repeats = useMemo(() => {
    const base = (GROUND_RADIUS_MM * 2) / 1000;
    return Math.max(4, base * Math.max(0.05, flatTileScale));
  }, [flatTileScale]);

  // preset 単位で canvas をキャッシュ、tileScale 変更時は Texture だけ作り直し
  const textureSet = useMemo(() => {
    if (landscape !== "flat" || !flatTextureEnabled) return null;
    const data = getTerrainCanvases(flatPreset);
    return {
      map: makeTexture(data.albedoCanvas, repeats),
      normalMap: makeNormalTexture(data.normalCanvas, repeats),
      normalScale: data.normalScale ?? 1.0,
    };
  }, [landscape, flatPreset, flatTextureEnabled, repeats]);

  // Texture をクリーンアップ
  useEffect(() => {
    return () => {
      textureSet?.map?.dispose();
      textureSet?.normalMap?.dispose();
    };
  }, [textureSet]);

  const flatMetalness = flatPreset === "water" ? 0.35 : 0;

  // ── 地面マテリアル: onBeforeCompile でマクロ変動シェーダを注入 ──
  // flatAntiTile 変更時は shader 再コンパイルのため material を作り直す
  const groundMaterial = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.FrontSide });
    m.onBeforeCompile = (shader) => setupGroundShader(shader, flatAntiTile);
    return m;
  }, [flatAntiTile]);

  // material のクリーンアップ
  useEffect(() => {
    return () => groundMaterial.dispose();
  }, [groundMaterial]);

  // material のプロパティを store の値に同期
  useEffect(() => {
    const m = groundMaterial;
    m.map = textureSet?.map ?? null;
    m.normalMap = textureSet?.normalMap ?? null;
    if (textureSet) {
      m.normalScale.set(textureSet.normalScale, textureSet.normalScale);
    } else {
      m.normalScale.set(1, 1);
    }
    m.color.set(flatColor);
    m.roughness = flatRoughness;
    m.metalness = flatMetalness;
    // map/normalMap 自体の有無が変わった場合 shader 再コンパイルが必要
    m.needsUpdate = true;
  }, [groundMaterial, textureSet, flatColor, flatRoughness, flatMetalness]);

  // ── Fog: 地面遠端を Sky 色にフェードして horizon の seam を解消 ──
  const fogColor = skyVisible
    ? FOG_COLOR_BY_SKY[skyPreset] ?? "#b8c8d4"
    : skyBackgroundColor;

  const handleGroundClick = useCallback(
    (e) => {
      e.stopPropagation();
      selectLandscape("flat");
      setRightPanel("properties", true);
    },
    [selectLandscape, setRightPanel]
  );

  const handleSkyClick = useCallback(
    (e) => {
      e.stopPropagation();
      selectLandscape("sky");
      setRightPanel("properties", true);
    },
    [selectLandscape, setRightPanel]
  );

  // None: メインエリア背景を単色で塗る（色は Properties から設定可能）
  if (landscape === "none") {
    return <color attach="background" args={[noneBackgroundColor]} />;
  }

  if (landscape === "flat") {
    return (
      <>
        {/* Fog: 距離フェードで Sky との境界を自然に */}
        <fog attach="fog" args={[fogColor, FOG_NEAR_MM, FOG_FAR_MM]} />

        {skyVisible ? (
          <Environment
            key={`${skyPreset}-${skyResolution}`}
            preset={skyPreset}
            background
            blur={skyBlur}
            resolution={skyResolution}
          />
        ) : (
          <color attach="background" args={[skyBackgroundColor]} />
        )}

        <mesh
          onClick={handleSkyClick}
          renderOrder={-10}
          frustumCulled={false}
          userData={{ isEnvironmentBackdrop: true }}
        >
          <sphereGeometry args={[SKY_RADIUS_MM, 32, 16]} />
          <meshBasicMaterial
            side={THREE.BackSide}
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
            fog={false}
          />
        </mesh>

        {flatVisible && (
          <mesh
            position={[0, GROUND_Y_MM, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            renderOrder={-1}
            onClick={handleGroundClick}
            material={groundMaterial}
            userData={{ isEnvironmentBackdrop: true }}
          >
            <circleGeometry args={[GROUND_RADIUS_MM, 96]} />
          </mesh>
        )}
      </>
    );
  }

  return null;
}
