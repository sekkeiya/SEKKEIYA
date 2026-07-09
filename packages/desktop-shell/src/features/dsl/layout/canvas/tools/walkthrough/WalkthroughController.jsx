// WalkthroughController.jsx
//
// Phase 1: 一人称・三人称ウォークスルー
//
// - "first": PointerLock + WASD + マウス視点
// - "third": Unreal Engine 風の三人称
//     * マウスドラッグでカメラを旋回（スプリングアーム）
//     * WASD はカメラ基準で移動、キャラは進行方向へ滑らかに向き直る（Orient to Movement）
//     * カメラはスムーズ追従（ラグ）＋壁衝突で内側に寄る
//
// スタートピン (walkthroughStartPin) があればそこから開始。
// キャラクター (walkthroughCharacter) で目線高さ・アバター寸法が変わる。
// mm / メートルスケール両対応 (sceneMaxY > 100 → mm)。

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

import { Suspense } from "react";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { useWalkthroughGalleryStore } from "../../../store/walkthroughGalleryStore";
import { walkthroughShared } from "./walkthroughShared";
import WalkthroughAvatar from "./WalkthroughAvatar.jsx";
import WalkthroughAvatarModel from "./WalkthroughAvatarModel.jsx";

// ── 定数 ──────────────────────────────────────────────────────
const WALK_SPEED_MPS  = 1.4;
const RUN_SPEED_MPS   = 3.2;
const PLAYER_RADIUS_M = 0.3;
const GRAVITY_MPS2    = 9.8;
const JUMP_SPEED_MPS  = 4.0;   // ジャンプ初速（約0.8mの高さ）
const STEP_HEIGHT_M   = 0.45;  // この高さ以下の段差は壁とみなさず乗り越える（階段/上がり框/小上がり）
const FLOOR_NORMAL_MIN = 0.5;

const CAM3_DIST_M     = 4.0;   // 三人称：スプリングアーム長
const CAM3_PITCH_DEF  = 0.32;  // 既定の仰角（ラジアン）
const CAM3_PITCH_MIN  = 0.02;
const CAM3_PITCH_MAX  = 1.30;
const MOUSE_YAW_SENS  = 0.0045;
const MOUSE_PITCH_SENS = 0.0035;
const FP_PITCH_MAX    = 1.45;  // 一人称：上下の見上げ/見下ろし制限（ラジアン, ~83°）
const CAM_LAG_K       = 12;    // カメラ追従の速さ（大きいほど機敏）
const AVATAR_TURN_K   = 12;    // キャラの向き直りの速さ

// ── ユーティリティ ────────────────────────────────────────────
function worldNormalY(hit) {
  if (!hit?.face) return 1;
  return hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y;
}

function castFloor(x, z, colliders) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 1e6, z), new THREE.Vector3(0, -1, 0));
  const hits = colliders.length ? ray.intersectObjects(colliders, true) : [];
  return hits.find((h) => Math.abs(worldNormalY(h)) > FLOOR_NORMAL_MIN) || hits[0] || null;
}

/**
 * 進行方向に「段差(step)より高い壁」があるか判定する。
 * 足元(groundY)から step だけ上の高さで水平にレイを飛ばし、縦面(壁)に当たれば true。
 * 段差以下のもの（階段の蹴上げ・小上がり）はこの高さに達しないので false ＝ 乗り越え可
 * （床スナップが自動で持ち上げる）。
 * @param footPos 足元位置 {x, y(=groundY), z}
 */
function wallAboveStep(footPos, move, colliders, radius, step, ray) {
  if (!colliders.length) return false;
  const dist = Math.hypot(move.x, move.z);
  if (dist < 1e-6) return false;
  const dir = new THREE.Vector3(move.x, 0, move.z).normalize();
  const origin = new THREE.Vector3(footPos.x, footPos.y + step, footPos.z);
  ray.set(origin, dir);
  ray.far = dist + radius;
  const hits = ray.intersectObjects(colliders, true);
  return !!hits.find((h) => h.face && Math.abs(worldNormalY(h)) < FLOOR_NORMAL_MIN);
}

function resolveWallCollision(from, move, colliders, radius, ray) {
  if (!colliders.length) return;
  const dist = Math.hypot(move.x, move.z);
  if (dist < 1e-6) return;
  const dir = new THREE.Vector3(move.x, 0, move.z).normalize();
  const origin = new THREE.Vector3(from.x, from.y - radius * 2, from.z);
  ray.set(origin, dir);
  ray.far = dist + radius;
  const hits = ray.intersectObjects(colliders, true);
  const wall = hits.find((h) => Math.abs(worldNormalY(h)) < FLOOR_NORMAL_MIN);
  if (!wall?.face) return;
  const n = wall.face.normal.clone().transformDirection(wall.object.matrixWorld);
  n.y = 0;
  if (n.lengthSq() < 1e-6) return;
  n.normalize();
  const flat = new THREE.Vector3(move.x, 0, move.z);
  const into = flat.dot(n);
  if (into < 0) { flat.addScaledVector(n, -into); move.x = flat.x; move.z = flat.z; }
}

// 最短経路で角度を補間（-π..π を考慮）
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

// ── メインコンポーネント ─────────────────────────────────────
export default function WalkthroughController({ active = false }) {
  const { camera, gl } = useThree();

  const sceneMaxY     = useEditorModeStore((s) => s.sceneMaxY);
  const startPin      = useEditorModeStore((s) => s.walkthroughStartPin);
  const viewMode      = useEditorModeStore((s) => s.walkthroughViewMode);
  const character     = useEditorModeStore((s) => s.walkthroughCharacter);
  const unitsPerMeter = sceneMaxY > 100 ? 1000 : 1;

  const tuning = useMemo(() => ({
    eyeHeight  : character.eyeM    * unitsPerMeter,
    bodyHeight : character.heightM * 0.62 * unitsPerMeter, // 三人称カメラの注視点高さ
    headHeight : character.heightM * 0.92 * unitsPerMeter, // カメラピボット高さ
    walk       : WALK_SPEED_MPS  * unitsPerMeter,
    run        : RUN_SPEED_MPS   * unitsPerMeter,
    radius     : PLAYER_RADIUS_M * unitsPerMeter,
    gravity    : GRAVITY_MPS2    * unitsPerMeter,
    jump       : JUMP_SPEED_MPS  * unitsPerMeter,
    step       : STEP_HEIGHT_M   * unitsPerMeter + 0.02 * unitsPerMeter, // 段差許容＋わずかな余裕
    cam3Dist   : CAM3_DIST_M     * unitsPerMeter,
  }), [character.eyeM, character.heightM, unitsPerMeter]);

  // ── 共有状態（ref） ──────────────────────────────────────
  const playerPos    = useRef(new THREE.Vector3()); // 足元 XZ + 床 Y
  const camYawRef    = useRef(0);                    // スプリングアームの yaw
  const camPitchRef  = useRef(CAM3_PITCH_DEF);       // スプリングアームの pitch
  const fpYawRef     = useRef(0);                    // 一人称：視点の yaw
  const fpPitchRef   = useRef(0);                    // 一人称：視点の pitch
  const avatarYawRef = useRef(0);                    // キャラの向き
  const velY         = useRef(0);
  const groundedRef  = useRef(true);   // 接地中か（ジャンプ可否）
  const prevSpaceRef = useRef(false);  // Space のエッジ検出（押しっぱなし連射防止）
  const keys         = useRef(new Set());
  const rayRef       = useRef(new THREE.Raycaster());
  const smoothCamPos = useRef(new THREE.Vector3());
  const camSnapRef   = useRef(false); // 入場直後は補間せずスナップ
  const avatarGroup  = useRef(null);
  const locomotionRef = useRef("idle"); // "idle" | "walk" | "run"（アバターのアニメ切替用）

  // ── プレイヤー位置の共有（近接判定用） ────────────────────
  useEffect(() => {
    walkthroughShared.active = active;
    return () => { walkthroughShared.active = false; };
  }, [active]);

  // ── 入力（WASD / Shift / Arrow）─────────────────────────
  useEffect(() => {
    if (!active) return;
    const down = (e) => {
      const k = e.key.toLowerCase();
      // ギャラリー表示中は ← / → をギャラリー切替に譲り、移動には使わない
      if ((k === "arrowleft" || k === "arrowright") && useWalkthroughGalleryStore.getState().panel) return;
      // q/e/c/control はフライモードの上下移動に使用
      if (["w","a","s","d","q","e","c","shift","control"," ","arrowup","arrowdown","arrowleft","arrowright"].includes(k))
        keys.current.add(k);
    };
    const up   = (e) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    window.addEventListener("blur",    blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup",   up);
      window.removeEventListener("blur",    blur);
      keys.current.clear();
    };
  }, [active]);

  // ── 入場時の初期配置 ────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    velY.current = 0;
    groundedRef.current = true;
    prevSpaceRef.current = keys.current.has(" ");
    camera.up.set(0, 1, 0); // 他ビューの up=(0,0,-1) 引き継ぎによるロールを防ぐ
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];

    // クロージャの startPin より直接ストア読みで確実に最新値を取得
    const pin = useEditorModeStore.getState().walkthroughStartPin;
    let sx = camera.position.x, sz = camera.position.z;
    let initYaw = 0;
    const hasPinOverride = pin != null;
    if (pin) {
      sx = pin.x; sz = pin.z;
      initYaw = (pin.yawDeg ?? 0) * (Math.PI / 180);
    }

    let floorHit = castFloor(sx, sz, colliders);
    if (!floorHit && colliders.length && !hasPinOverride) {
      // スタートピンがない場合のみ部屋中心へフォールバック
      const box = new THREE.Box3();
      colliders.forEach((c) => box.expandByObject(c));
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        sx = center.x; sz = center.z;
        floorHit = castFloor(sx, sz, colliders);
      }
    }
    const groundY = floorHit ? floorHit.point.y : 0;

    playerPos.current.set(sx, groundY, sz);
    camYawRef.current = initYaw;
    avatarYawRef.current = initYaw;
    camPitchRef.current = CAM3_PITCH_DEF;
    fpYawRef.current = initYaw;
    fpPitchRef.current = 0;
    camSnapRef.current = true; // 三人称は最初のフレームでスナップ

    if (viewMode === "first") {
      camera.position.set(sx, groundY + tuning.eyeHeight, sz);
      camera.lookAt(sx + Math.sin(initYaw), groundY + tuning.eyeHeight, sz + Math.cos(initYaw));
    } else if (viewMode === "fly") {
      // フライ開始：目線高さよりやや上から
      const y = groundY + tuning.eyeHeight + 0.5 * unitsPerMeter;
      camera.position.set(sx, y, sz);
      camera.lookAt(sx + Math.sin(initYaw), y, sz + Math.cos(initYaw));
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 視点ルック：右ドラッグでカメラを旋回（一人称・三人称 共通） ─────────
  //   右ボタンドラッグ中は Pointer Lock を掛けることで
  //   ・マウスカーソルを非表示
  //   ・画面端で止まらず「無限に」見渡せる（movementX/Y を使用）
  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    let dragging = false;

    const applyLook = (mx, my) => {
      if (viewMode === "first" || viewMode === "fly") {
        fpYawRef.current  -= mx * MOUSE_YAW_SENS;
        fpPitchRef.current = Math.max(-FP_PITCH_MAX, Math.min(FP_PITCH_MAX, fpPitchRef.current - my * MOUSE_PITCH_SENS));
      } else {
        // ★ Unreal 風：右ドラッグ→右を向く（yaw を減算）
        camYawRef.current  -= mx * MOUSE_YAW_SENS;
        camPitchRef.current = Math.max(CAM3_PITCH_MIN, Math.min(CAM3_PITCH_MAX, camPitchRef.current + my * MOUSE_PITCH_SENS));
      }
    };

    const onDown = (e) => {
      if (e.button !== 2) return; // 右ボタンのみ
      dragging = true;
      // requestPointerLock は Promise を返すため、ロック解除直後の連続要求で出る
      // SecurityError を握りつぶす（未処理 Promise 例外を防ぐ）。
      try {
        const p = el.requestPointerLock?.();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch { /* noop */ }
    };
    const onMove = (e) => {
      if (!dragging) return;
      applyLook(e.movementX || 0, e.movementY || 0);
    };
    const onUp = (e) => {
      if (!dragging) return;
      if (e.button !== undefined && e.button !== 2) return;
      dragging = false;
      try { if (document.pointerLockElement === el) document.exitPointerLock?.(); } catch { /* noop */ }
    };
    const onLockChange = () => {
      // 外部要因（Esc 等）でロックが外れたらドラッグ終了
      if (document.pointerLockElement !== el) dragging = false;
    };
    const onContext = (e) => { e.preventDefault(); }; // 右クリックメニュー抑止

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerlockchange", onLockChange);
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerlockchange", onLockChange);
      el.removeEventListener("contextmenu", onContext);
      if (document.pointerLockElement === el) { try { document.exitPointerLock?.(); } catch { /* noop */ } }
    };
  }, [active, viewMode, gl.domElement]);

  // ── モード切替時の位置同期 ───────────────────────────────
  const prevViewMode = useRef(viewMode);
  useEffect(() => {
    if (!active) return;
    if (prevViewMode.current === viewMode) return;
    prevViewMode.current = viewMode;
    groundedRef.current = true;
    prevSpaceRef.current = keys.current.has(" "); // fly の上昇でSpace保持中なら誤ジャンプ防止
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    const groundY = castFloor(playerPos.current.x, playerPos.current.z, colliders)?.point.y ?? 0;

    // 現在のカメラの向きから yaw/pitch を取得（どのモードからの遷移でも頑健）
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const curYaw = Math.atan2(camDir.x, camDir.z);
    const curPitch = Math.asin(Math.max(-1, Math.min(1, camDir.y)));

    if (viewMode === "first") {
      // → 一人称：床上の目線高さにスナップ（水平視点）
      fpYawRef.current = curYaw;
      fpPitchRef.current = 0;
      camera.position.set(playerPos.current.x, groundY + tuning.eyeHeight, playerPos.current.z);
      camera.lookAt(
        playerPos.current.x + Math.sin(curYaw),
        groundY + tuning.eyeHeight,
        playerPos.current.z + Math.cos(curYaw)
      );
      velY.current = 0;
    } else if (viewMode === "fly") {
      // → フライ：現在のカメラ位置・向きをそのまま維持して自由飛行へ
      fpYawRef.current = curYaw;
      fpPitchRef.current = Math.max(-FP_PITCH_MAX, Math.min(FP_PITCH_MAX, curPitch));
      playerPos.current.set(camera.position.x, groundY, camera.position.z);
      velY.current = 0;
    } else {
      // → 三人称：一人称/フライの向きをスプリングアーム yaw に引き継ぐ
      playerPos.current.set(camera.position.x, groundY, camera.position.z);
      camYawRef.current = curYaw;
      avatarYawRef.current = camYawRef.current;
      camSnapRef.current = true;
      velY.current = 0;
    }
  }, [viewMode, active, tuning.eyeHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 毎フレーム ───────────────────────────────────────────
  const fwdV  = useRef(new THREE.Vector3());
  const rgtV  = useRef(new THREE.Vector3());
  const moveV = useRef(new THREE.Vector3());
  const pivot = useRef(new THREE.Vector3());
  const desiredCam = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    if (!active) return;
    // 他ビュー（Top など）の up=(0,0,-1) を引き継いでいると lookAt がロール
    // （画面が傾く）を起こすため、ウォークスルー中は常に上方向を垂直に固定する。
    if (camera.up.x !== 0 || camera.up.y !== 1 || camera.up.z !== 0) {
      camera.up.set(0, 1, 0);
    }
    const dt = Math.min(rawDt, 0.05);
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    const k = keys.current;

    // ── フライモード：重力・床・壁衝突なしの自由飛行 ──
    //   WASD = 視線方向（pitch 込み）/ 横移動、Space・E = 上昇、C・Q・Ctrl = 下降、Shift = 加速
    if (viewMode === "fly") {
      const yawF = fpYawRef.current;
      const cpF  = Math.cos(fpPitchRef.current);
      const look = fwdV.current.set(Math.sin(yawF) * cpF, Math.sin(fpPitchRef.current), Math.cos(yawF) * cpF);
      rgtV.current.set(-Math.cos(yawF), 0, Math.sin(yawF));

      moveV.current.set(0, 0, 0);
      if (k.has("w") || k.has("arrowup"))    moveV.current.add(look);
      if (k.has("s") || k.has("arrowdown"))  moveV.current.sub(look);
      if (k.has("d") || k.has("arrowright")) moveV.current.add(rgtV.current);
      if (k.has("a") || k.has("arrowleft"))  moveV.current.sub(rgtV.current);
      if (k.has(" ") || k.has("q"))                       moveV.current.y += 1;
      if (k.has("c") || k.has("e") || k.has("control"))   moveV.current.y -= 1;

      locomotionRef.current = "idle";
      if (moveV.current.lengthSq() > 1e-6) {
        const fast = k.has("shift");
        const speed = (fast ? tuning.run : tuning.walk) * dt;
        moveV.current.normalize().multiplyScalar(speed);
        camera.position.add(moveV.current);
        playerPos.current.set(camera.position.x, playerPos.current.y, camera.position.z);
      }
      velY.current = 0;

      camera.lookAt(
        camera.position.x + Math.sin(yawF) * cpF,
        camera.position.y + Math.sin(fpPitchRef.current),
        camera.position.z + Math.cos(yawF) * cpF
      );
      walkthroughShared.playerPos.copy(playerPos.current);
      walkthroughShared.yaw = fpYawRef.current;
      return;
    }

    // 移動の基準 yaw（一人称は視点 yaw、三人称はスプリングアーム）
    let yaw;
    if (viewMode === "first") {
      yaw = fpYawRef.current;
    } else {
      yaw = camYawRef.current;
    }
    fwdV.current.set(Math.sin(yaw), 0, Math.cos(yaw));
    rgtV.current.set(-Math.cos(yaw), 0, Math.sin(yaw));

    moveV.current.set(0, 0, 0);
    if (k.has("w") || k.has("arrowup"))    moveV.current.add(fwdV.current);
    if (k.has("s") || k.has("arrowdown"))  moveV.current.sub(fwdV.current);
    if (k.has("d") || k.has("arrowright")) moveV.current.add(rgtV.current);
    if (k.has("a") || k.has("arrowleft"))  moveV.current.sub(rgtV.current);

    const moving = moveV.current.lengthSq() > 1e-6;
    const running = moving && k.has("shift");
    locomotionRef.current = moving ? (running ? "run" : "walk") : "idle";
    if (moving) {
      const speed = (running ? tuning.run : tuning.walk) * dt;
      moveV.current.normalize().multiplyScalar(speed);

      // 段差判定：足元(groundY)から step だけ上に壁が無ければ「乗り越え可能な段差」とみなし
      // 壁衝突をスキップ → 進入後に床スナップが自動で持ち上げる（階段・小上がり対応）。
      // step より高い壁のときだけ衝突で滑らせる。
      const footX = viewMode === "first" ? camera.position.x : playerPos.current.x;
      const footZ = viewMode === "first" ? camera.position.z : playerPos.current.z;
      const blocked = wallAboveStep(
        { x: footX, y: playerPos.current.y, z: footZ },
        moveV.current, colliders, tuning.radius, tuning.step, rayRef.current
      );

      if (viewMode === "first") {
        if (blocked) resolveWallCollision(camera.position, moveV.current, colliders, tuning.radius, rayRef.current);
        camera.position.x += moveV.current.x;
        camera.position.z += moveV.current.z;
        playerPos.current.x = camera.position.x;
        playerPos.current.z = camera.position.z;
      } else {
        if (blocked) resolveWallCollision(playerPos.current, moveV.current, colliders, tuning.radius, rayRef.current);
        playerPos.current.x += moveV.current.x;
        playerPos.current.z += moveV.current.z;
        // Orient to Movement：キャラを進行方向へ滑らかに向ける
        const targetYaw = Math.atan2(moveV.current.x, moveV.current.z);
        const t = 1 - Math.exp(-AVATAR_TURN_K * dt);
        avatarYawRef.current = lerpAngle(avatarYawRef.current, targetYaw, t);
      }
    }

    // ── ジャンプ（一人称・三人称）。接地中に Space のエッジ（押した瞬間）で上方初速 ──
    const spaceDown = k.has(" ");
    if (spaceDown && !prevSpaceRef.current && groundedRef.current) {
      velY.current = tuning.jump;
      groundedRef.current = false;
    }
    prevSpaceRef.current = spaceDown;

    // 重力 + 床スナップ
    const refPos = viewMode === "first" ? camera.position : playerPos.current;
    velY.current -= tuning.gravity * dt;
    refPos.y += velY.current * dt;

    rayRef.current.set(
      new THREE.Vector3(refPos.x, refPos.y + 50 * unitsPerMeter, refPos.z),
      new THREE.Vector3(0, -1, 0)
    );
    const hits = colliders.length ? rayRef.current.intersectObjects(colliders, true) : [];
    const floorHit = hits.find((h) => Math.abs(worldNormalY(h)) > FLOOR_NORMAL_MIN);
    const groundY = floorHit ? floorHit.point.y : 0;

    if (viewMode === "first") {
      const minY = groundY + tuning.eyeHeight;
      if (camera.position.y <= minY) { camera.position.y = minY; velY.current = 0; groundedRef.current = true; }
      else groundedRef.current = false;
      playerPos.current.y = groundY;

      // 視点ルックを適用（yaw + pitch）。右ドラッグで更新された fpYaw/fpPitch を反映。
      const cp = Math.cos(fpPitchRef.current);
      camera.lookAt(
        camera.position.x + Math.sin(fpYawRef.current) * cp,
        camera.position.y + Math.sin(fpPitchRef.current),
        camera.position.z + Math.cos(fpYawRef.current) * cp
      );
    } else {
      if (playerPos.current.y <= groundY) { playerPos.current.y = groundY; velY.current = 0; groundedRef.current = true; }
      else groundedRef.current = false;

      // アバターの transform を更新
      if (avatarGroup.current) {
        avatarGroup.current.position.copy(playerPos.current);
        avatarGroup.current.rotation.y = avatarYawRef.current;
      }

      // ── スプリングアーム：ピボット（キャラ頭部付近）周りにカメラ配置 ──
      pivot.current.set(
        playerPos.current.x,
        playerPos.current.y + tuning.headHeight,
        playerPos.current.z
      );
      const cy = camYawRef.current, cp = camPitchRef.current;
      const dist = tuning.cam3Dist;
      desiredCam.current.set(
        pivot.current.x - Math.sin(cy) * dist * Math.cos(cp),
        pivot.current.y + Math.sin(cp) * dist,
        pivot.current.z - Math.cos(cy) * dist * Math.cos(cp)
      );

      // カメラ壁衝突（スプリングアーム collision test）：ピボット→desired の間に壁があれば内側へ
      const armDir = desiredCam.current.clone().sub(pivot.current);
      const armLen = armDir.length();
      if (armLen > 1e-6) {
        armDir.normalize();
        rayRef.current.set(pivot.current, armDir);
        rayRef.current.far = armLen;
        const camHits = colliders.length ? rayRef.current.intersectObjects(colliders, true) : [];
        if (camHits.length) {
          const margin = tuning.radius * 0.6;
          const d = Math.max(margin, camHits[0].distance - margin);
          desiredCam.current.copy(pivot.current).addScaledVector(armDir, d);
        }
      }

      // スムーズ追従（ラグ）。入場直後はスナップ。
      if (camSnapRef.current) {
        smoothCamPos.current.copy(desiredCam.current);
        camSnapRef.current = false;
      } else {
        const a = 1 - Math.exp(-CAM_LAG_K * dt);
        smoothCamPos.current.lerp(desiredCam.current, a);
      }
      camera.position.copy(smoothCamPos.current);
      camera.lookAt(
        playerPos.current.x,
        playerPos.current.y + tuning.bodyHeight,
        playerPos.current.z
      );
    }

    // 近接判定の基準点（プレイヤー足元）と向きを共有
    walkthroughShared.playerPos.copy(playerPos.current);
    walkthroughShared.yaw = viewMode === "first" ? fpYawRef.current : avatarYawRef.current;
  });

  if (!active) return null;

  return (
    <>
      {viewMode === "third" && (
        <group ref={avatarGroup}>
          {character.glbUrl ? (
            <Suspense
              fallback={
                <WalkthroughAvatar
                  color={character.color}
                  heightM={character.heightM}
                  shoulderM={character.shoulderM}
                  unitsPerMeter={unitsPerMeter}
                />
              }
            >
              <WalkthroughAvatarModel
                url={character.glbUrl}
                heightM={character.heightM}
                unitsPerMeter={unitsPerMeter}
                locomotionRef={locomotionRef}
              />
            </Suspense>
          ) : (
            <WalkthroughAvatar
              color={character.color}
              heightM={character.heightM}
              shoulderM={character.shoulderM}
              unitsPerMeter={unitsPerMeter}
            />
          )}
        </group>
      )}
    </>
  );
}
