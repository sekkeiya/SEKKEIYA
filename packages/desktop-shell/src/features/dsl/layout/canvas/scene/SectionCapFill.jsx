// SectionCapFill — 断面クリップで切られた躯体（床/壁/天井など）の「切り口」を黒く塗りつぶす。
// three.js の clipping-stencil 手法：躯体ジオメトリの前面/裏面でステンシルを増減し、
// その断面平面に置いた黒いキャップ板をステンシル≠0 の所だけ描く。
// 空洞（部屋）は塗らず、ソリッドが切られた断面だけが黒くなる（薄板/ソリッド両対応）。
//
// 【遅延対策の要】SINGLE レイアウトでは vp_top/persp/front/right の4 Canvas が常時マウントされ、
// 非アクティブは display:none + frameloop="demand" で描画されない。以前はキャップ用マテリアルを
// useFrame 内で遅延生成していたため「アクティブなビューでしか」生成されず、縦/側面 ⇄ 横/正面 を
// 初切替した瞬間に、そのコンテキストで 2N+1 個のステンシル/キャップ用シェーダがまとめて初コンパイル
// され 5〜7秒フリーズしていた。
// → 本実装ではキャップ群を「enabled になった時点で useEffect（全ビューポートで走る）で一度だけ生成」し、
//   さらにそのコンテキストで gl.compileAsync して事前コンパイルする。compileAsync は明示的なGL呼び出し
//   なので display:none のコンテキストでも実行される。軸切替は visibility のトグルだけなので即時。
import React, { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useMaterialViewStore } from "../../store/useMaterialViewStore";
import { useHeightSetupStore } from "../../store/useHeightSetupStore";

const CAP_COLOR = 0x0a0a0a;
const AXES = ["y", "x", "z"]; // renderOrder 順（各軸が独立にステンシル→キャップ→clear する）

const DEBUG = false; // true にすると devtools console にビルド/コンパイル時間を出す

function makeStencilMat(side, op) {
  const m = new THREE.MeshBasicMaterial();
  m.depthWrite = false; m.depthTest = false; m.colorWrite = false; m.stencilWrite = true;
  m.stencilFunc = THREE.AlwaysStencilFunc; m.side = side;
  m.stencilFail = op; m.stencilZFail = op; m.stencilZPass = op;
  return m;
}

export default function SectionCapFill() {
  const { gl, scene, camera } = useThree();
  const enabledRaw = useEditorModeStore((s) => s.isSectionClipEnabled);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const matFp = useMaterialViewStore((s) => s.firstPerson);
  const heightActive = useHeightSetupStore((s) => s.active);
  const yEn = useEditorModeStore((s) => s.sectionClipYEnabled);
  const xEn = useEditorModeStore((s) => s.sectionClipXEnabled);
  const zEn = useEditorModeStore((s) => s.sectionClipZEnabled);
  const hPos = useEditorModeStore((s) => s.sectionClipHeight);
  const xPos = useEditorModeStore((s) => s.sectionClipX);
  const zPos = useEditorModeStore((s) => s.sectionClipZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);

  // SectionClipManager と同じ有効条件。
  const enabled = enabledRaw && editorMode !== "walkthrough" && !matFp && (editorMode !== "label" || heightActive);

  const rootRef = useRef();
  const builtRef = useRef({ key: "", items: [] });
  const lastCheckRef = useRef(0);
  const progRef = useRef(0); // 直近のコンパイル済みプログラム数（シェーダ初コンパイルのスパイク検知用）
  // アクティブビューの useFrame が躯体メッシュの変化を検知したら bump して再ビルドさせる。
  const [buildTick, setBuildTick] = useState(0);

  const collectSrcs = () => {
    const srcs = [];
    if (!scene) return srcs;
    scene.traverse((o) => {
      if (!o?.isMesh || !o.geometry) return;
      if (o.userData?.isSectionFill || o.userData?.isSurfaceFinish || o.userData?.replacedByUnion) return;
      if (o.userData?.isStructuralBase) srcs.push(o);
    });
    return srcs;
  };

  const capExtent = () =>
    Math.max((sceneExtentXZ || 0) * 1.4, (sceneMaxY || 0) * 1.4, (sceneMaxY || 0) > 100 ? 3000 : 3);

  // ── ビルド：enabled になった時点で全軸分のキャップ群を一度だけ生成し、このコンテキストで事前コンパイル。
  //    useEffect は frameloop/display に関係なく全ビューポートで走るので、非アクティブな
  //    vp_front 等のコンテキストでも enter 時にキャップ用シェーダがコンパイルされる。
  useEffect(() => {
    const group = rootRef.current;
    if (!group) return;
    if (!enabled) {
      if (group.children.length) { group.clear(); builtRef.current = { key: "", items: [] }; }
      return;
    }
    const srcs = collectSrcs();
    const half = capExtent();
    const capW = half * 2;
    const key = capW.toFixed(0) + "|" + srcs.map((s) => s.uuid).join(",");
    if (key === builtRef.current.key && group.children.length) return; // 既にビルド済み
    if (!srcs.length) return; // 躯体未ロード（後で buildTick で再試行）

    const t0 = DEBUG ? performance.now() : 0;
    group.clear();
    const items = [];
    AXES.forEach((axis, ai) => {
      const order = 9990 + ai * 4;
      const stencil = [];
      for (const src of srcs) {
        const mB = new THREE.Mesh(src.geometry, makeStencilMat(THREE.BackSide, THREE.IncrementWrapStencilOp));
        const mF = new THREE.Mesh(src.geometry, makeStencilMat(THREE.FrontSide, THREE.DecrementWrapStencilOp));
        [mB, mF].forEach((m) => { m.matrixAutoUpdate = false; m.renderOrder = order; m.userData.isSectionFill = true; });
        group.add(mB); group.add(mF);
        stencil.push({ src, mB, mF });
      }
      const capMat = new THREE.MeshBasicMaterial({ color: CAP_COLOR, side: THREE.DoubleSide });
      capMat.stencilWrite = true; capMat.stencilRef = 0; capMat.stencilFunc = THREE.NotEqualStencilFunc;
      capMat.stencilFail = THREE.ReplaceStencilOp; capMat.stencilZFail = THREE.ReplaceStencilOp; capMat.stencilZPass = THREE.ReplaceStencilOp;
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(capW, capW), capMat);
      cap.renderOrder = order + 1; cap.userData.isSectionFill = true; cap.matrixAutoUpdate = false;
      cap.onAfterRender = (renderer) => renderer.clearStencil();
      group.add(cap);
      items.push({ axis, stencil, cap, half });
    });
    builtRef.current = { key, items };

    // このコンテキストでキャップ用シェーダを事前コンパイル（display:none でも明示GL呼び出しは実行される）。
    // コンパイル対象に含めるため一旦すべて可視にしてからコンパイルし、可視/不可視は useFrame に委ねる。
    try {
      if (typeof gl.compileAsync === "function") {
        const tc = DEBUG ? performance.now() : 0;
        gl.compileAsync(group, camera).then(() => {
          if (DEBUG) console.log("[capfill] compileAsync", (performance.now() - tc).toFixed(0), "ms, srcs", srcs.length);
        }).catch(() => {});
      } else {
        gl.compile(group, camera);
      }
    } catch {}
    if (DEBUG) console.log("[capfill] build", srcs.length, "srcs", (performance.now() - t0).toFixed(1), "ms");
  }, [enabled, buildTick, scene, camera, gl, sceneMaxY, sceneExtentXZ]);

  // ── 毎フレーム：平面位置・キャップ位置・可視/不可視・行列同期（軽量）。アクティブビューのみ走る。
  useFrame((state) => {
    const group = rootRef.current;
    if (!group) return;
    if (!enabled) return;

    // シェーダ初コンパイルのスパイク検知（1フレームで >=4 本コンパイルされたら断面切替の主因＝シェーダ）。
    const info = gl.info && gl.info.programs;
    if (info) {
      const n = info.length;
      const prev = progRef.current || n;
      if (n - prev >= 4) console.log("[section-perf] shader programs", prev, "->", n, "(compile spike on section view)");
      progRef.current = n;
    }

    const items = builtRef.current.items;
    if (!items.length) return;

    // 躯体メッシュが変化（ロード/差し替え）したら再ビルドを要求。
    // 全シーン traverse は重いので ~2回/秒に間引く（行列同期は毎フレーム実施）。
    const now = state.clock.elapsedTime;
    if (now - lastCheckRef.current > 0.5) {
      lastCheckRef.current = now;
      const srcs = collectSrcs();
      const capW = capExtent() * 2;
      const key = capW.toFixed(0) + "|" + srcs.map((s) => s.uuid).join(",");
      if (key !== builtRef.current.key) { setBuildTick((t) => t + 1); return; }
    }

    const enabledOf = (a) => (a === "y" ? yEn : a === "x" ? xEn : zEn);
    const posOf = (a) => (a === "y" ? hPos : a === "x" ? xPos : zPos);

    for (const it of items) {
      const on = !!enabledOf(it.axis);
      const c = posOf(it.axis);
      const half = it.half;
      // キャップ位置/向き
      if (it.axis === "y") { it.cap.position.set(0, c, 0); it.cap.rotation.set(-Math.PI / 2, 0, 0); }
      else if (it.axis === "x") { it.cap.position.set(c, half * 0.5, 0); it.cap.rotation.set(0, Math.PI / 2, 0); }
      else { it.cap.position.set(0, half * 0.5, c); it.cap.rotation.set(0, 0, 0); }
      it.cap.updateMatrix();
      it.cap.visible = on;
      for (const sm of it.stencil) {
        sm.mB.visible = on; sm.mF.visible = on;
        if (on) { sm.mB.matrix.copy(sm.src.matrixWorld); sm.mF.matrix.copy(sm.src.matrixWorld); }
      }
    }

    gl.localClippingEnabled = true;
  });

  return <group ref={rootRef} userData={{ isSectionRef: true }} />;
}
