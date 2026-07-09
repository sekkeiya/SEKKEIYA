// src/features/layout/components/MainArea/hooks/useViewportControls.js
import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useViewportUiStore } from "../store/viewportUiStore";

/**
 * Rhino/Twinmotion風の操作レイヤー（安定版 v4）
 *
 * - W/S: カメラが見ている方向へ前進/後退（Y成分も含む）
 * - A/D: 左右（水平ストレイフ / worldUp基準）
 * - Q/E: 上下（ローカルup）
 *
 * - RMB drag: 見回し（yaw/pitch） ※PointerLock対応（画面端で止まらない）
 * - Shift + RMB drag: パン
 * - F: 選択へフォーカス
 *
 * - RMB中 + ホイール: 移動速度倍率を調整（speedMultiplier）
 *
 * ✅ 重要:
 * - 「選択したらカメラ/targetを寄せる」挙動はデフォルトでOFF（Rhino寄せ）
 * - Fキーでのみフォーカスする
 *
 * ✅ 今回の変更:
 * - mouseEnabled / keyboardEnabled を分離し、非アクティブなビューでもドラッグ等を開始できるように修正
 * - WASDQE 移動は「RMB押下中のみ」有効（ATなどのショートカットと競合しない）
 * - 左ドラッグ（OrbitControls）の「余韻（慣性）」を無効化するため、
 *   OrbitControls.enableDamping を常に false にする
 *
 * ✅ 追加:
 * - Gizmo 操作中（hover or drag）は、この hook 側のカメラ操作を完全停止する
 *   → Gizmo で矢印ドラッグ中にカメラが回る問題の根治
 */
export function useViewportControls({
    camera,
    domElement,
    orbitRef,
    enabled = true,
    mouseEnabled,
    keyboardEnabled,

    // selection
    getSelectedObject,
    selectedKey,

    // tuning (base)
    moveSpeed = 3.0,
    verticalSpeed = 3.0,
    lookSpeed = 0.003,
    panSpeed = 0.002,
    panMultiplier = 1.0,

    // RMB pointer lock — Tauri (WebView2) が必ずブラウザ通知を出すため無効化
    enablePointerLock = false,

    // speed tuning
    speedWheelStep = 0.12,
    speedMinMul = 0.2,
    speedMaxMul = 12.0,

    // ✅ NEW: WASD移動はRMB中だけ有効（デフォルトtrue）
    wasdRequiresRmb = true,

    // ✅ NEW: 選択時にOrbitのtargetを自動追従させるか
    // Rhinoっぽくするなら false 推奨（Fだけでフォーカス）
    autoPivotOnSelect = false,

    // ✅ NEW: OrbitControls の “余韻” を消す（damping無効化）
    disableOrbitDamping = true,

    // Ortho専用のWASDズーム感度
    zoomKeySpeed = 2.2,

    // ✅ NEW: 右ドラッグでパン移動を強制するオプション（Layoutモード等で使用）
    forcePanOnRmb = false,

    // ✅ NEW: 右ドラッグ=軌道回転 / Shift+右=パン / Ctrl+右=ズーム（3DSC互換）
    rmbOrbit = false,

    // optional
    onSpeedChange, // (multiplier:number) => void
}) {
    const isMouseEnabled = mouseEnabled ?? enabled;
    const isKeyboardEnabled = keyboardEnabled ?? enabled;

    const zoomCursorUrl = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="rgba(255,255,255,0.8)" stroke="black" stroke-width="2"/><line x1="26" y1="26" x2="31" y2="31" stroke="black" stroke-width="4" stroke-linecap="round"/><g stroke="black" stroke-width="2"><line x1="16" y1="8" x2="16" y2="14"/><line x1="13" y1="11" x2="19" y2="11"/><line x1="13" y1="21" x2="19" y2="21"/></g></svg>') 12 12, ns-resize`;

    const stateRef = useRef({
        keys: new Set(),
        rmb: false,
        shift: false,
        lastX: 0,
        lastY: 0,
        yaw: 0,
        pitch: 0,

        orbitWasEnabled: true,
        moving: false,

        pointerId: null,
        orbitDist: 6,

        requestedPointerLock: false,

        speedMul: 1.0,

        // ✅ rmbOrbit モード用: ポインターを横取りしたかどうか
        capturedRmb: false,

        // ✅ 純粋なオービット（球面座標回転）で横取りしたか
        //    true のとき endRmb で syncOrbitTargetToCameraLook をスキップする
        isOrbitCapture: false,
    });

    // ✅ Gizmoが効いてる間はナビ停止（hoverでも止める）
    const isGizmoActive = useCallback(() => {
        try {
            const st = useViewportUiStore.getState();
            return typeof st.isGizmoActive === "function" ? !!st.isGizmoActive() : false;
        } catch {
            return false;
        }
    }, []);

    const clearKeys = useCallback(() => {
        const s = stateRef.current;
        s.keys.clear();
        s.shift = false;
    }, []);

    const isPointerLocked = useCallback(() => {
        return document.pointerLockElement === domElement;
    }, [domElement]);

    const getYawPitchFromCamera = useCallback(() => {
        if (!camera) return { yaw: 0, pitch: 0 };
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
        return { yaw: euler.y, pitch: euler.x };
    }, [camera]);

    /**
     * ✅ OrbitControls の “余韻（damping）” を殺す
     * - 左ドラッグ後にスーッと動くのは enableDamping が原因
     */
    useEffect(() => {
        const oc = orbitRef?.current;
        if (!oc) return;
        
        // Reactのpropによる強制同期は回避しつつ、ここで状態更新
        if (!stateRef.current.rmb) {
            oc.enabled = isMouseEnabled;
        }

        if (!isMouseEnabled) return;

        if (disableOrbitDamping) {
            oc.enableDamping = false;
            oc.dampingFactor = 0;
        }

        oc.update();
    }, [isMouseEnabled, orbitRef, disableOrbitDamping]);

    /**
     * OrbitControls の target を選択物体中心へ（※自動呼び出しはOFF推奨）
     */
    const updateOrbitPivotToSelected = useCallback(() => {
        const obj = getSelectedObject?.();
        if (!obj || !orbitRef?.current) return;

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        orbitRef.current.target.copy(center);
        orbitRef.current.update();
    }, [orbitRef, getSelectedObject]);

    /**
     * ✅ 選択時に target を寄せる（autoPivotOnSelect が true のときだけ）
     */
    useEffect(() => {
        if (!isMouseEnabled) return;
        if (!autoPivotOnSelect) return;
        updateOrbitPivotToSelected();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMouseEnabled, autoPivotOnSelect, selectedKey]);

    /**
     * Fキー：完全フォーカス
     */
    const focusSelected = useCallback(() => {
        const obj = getSelectedObject?.();
        if (!obj || !camera) return;

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) * 0.6;

        if (orbitRef?.current) {
            orbitRef.current.target.copy(center);
            orbitRef.current.update();
        }

        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const back = dir.multiplyScalar(-1);

        const dist = Math.max(1.2, radius * 2.2);
        camera.position.copy(center.clone().add(back.multiplyScalar(dist)));

        camera.rotation.order = "YXZ";
        camera.rotation.z = 0;

        camera.updateProjectionMatrix();
    }, [camera, orbitRef, getSelectedObject]);

    /**
     * RMB終了時：カメラの向いている方向へ target を合わせ直す
     */
    const syncOrbitTargetToCameraLook = useCallback(() => {
        const oc = orbitRef?.current;
        if (!oc || !camera) return;

        const s = stateRef.current;

        let dist = Number.isFinite(s.orbitDist) ? s.orbitDist : camera.position.distanceTo(oc.target);
        if (!Number.isFinite(dist)) dist = 6;
        dist = Math.max(0.75, dist);

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);

        oc.target.copy(camera.position).add(forward.multiplyScalar(dist));
        oc.update();
    }, [orbitRef, camera]);

    // -------------------------
    // key events
    // -------------------------
    useEffect(() => {
        if (!isKeyboardEnabled) return;

        const isTextInput = (el) => {
            if (!el) return false;
            const tag = String(el.tagName || "").toLowerCase();
            return tag === "input" || tag === "textarea" || el.isContentEditable;
        };

        const onKeyDown = (e) => {
            if (!isKeyboardEnabled) return;
            if (isTextInput(document.activeElement)) return;

            // ✅ Gizmoがアクティブなら、Nav系ショートカットは一切触らない
            if (isGizmoActive()) return;

            const s = stateRef.current;

            if (e.key === "Shift") s.shift = true;

            if (e.key === "f" || e.key === "F") {
                e.preventDefault();
                focusSelected();
                return;
            }

            const k = e.key.toLowerCase();
            const isMoveKey = ["w", "a", "s", "d", "q", "e"].includes(k);
            if (isMoveKey) {
                // ✅ RMB中だけWASDQEを“カメラ移動”として扱う（競合回避）
                if (wasdRequiresRmb && !s.rmb) {
                    // RMBが押されてない時は、preventDefaultもしない（AT等に回せる）
                    return;
                }
                e.preventDefault();
                s.keys.add(k);
            }
        };

        const onKeyUp = (e) => {
            const s = stateRef.current;
            if (e.key === "Shift") s.shift = false;

            const k = e.key.toLowerCase();
            // ✅ RMB要件の有無に関係なく、離したら必ず解除（キー詰まり防止）
            s.keys.delete(k);
        };

        const onBlur = () => clearKeys();
        const onVisibility = () => {
            if (document.visibilityState !== "visible") clearKeys();
        };

        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("keyup", onKeyUp, { passive: true });
        window.addEventListener("blur", onBlur);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [isKeyboardEnabled, focusSelected, clearKeys, wasdRequiresRmb, isGizmoActive]);

    // -------------------------
    // RMB終了処理（復帰）
    // -------------------------
    const endRmb = useCallback(
        (reason = "unknown") => {
            const s = stateRef.current;
            if (!s.rmb) return;

            const wasCaptured = s.capturedRmb;      // RMBでポインターを横取りしたか
            const wasOrbitCapture = s.isOrbitCapture; // 球面座標オービットで横取りしたか
            s.rmb = false;
            s.isZoomDrag = false;
            s.capturedRmb = false;
            s.isOrbitCapture = false;

            // ✅ RMB終了で移動キーを停止（Shiftはキーボードで押し続けている場合があるので保持）
            s.keys.clear();

            try {
                if (domElement) {
                    domElement.style.cursor = "";
                    // 横取りしていた場合のみ解放
                    if (wasCaptured && s.pointerId != null) {
                        domElement.releasePointerCapture?.(s.pointerId);
                    }
                }
            } catch {
                // ignore
            }
            s.pointerId = null;

            if (enablePointerLock && document.pointerLockElement) {
                try {
                    document.exitPointerLock?.();
                } catch {
                    // ignore
                }
            }
            s.requestedPointerLock = false;

            if (orbitRef?.current) {
                if (disableOrbitDamping) {
                    orbitRef.current.enableDamping = false;
                    orbitRef.current.dampingFactor = 0;
                }

                // OrbitControlsを無効化していた場合のみ復元
                if (wasCaptured) {
                    // オービット横取りの場合は target をそのまま維持する
                    // （球面座標回転で target は変えていないため、上書き不要）
                    // FPS ルックの場合のみ target を再同期する
                    if (!wasOrbitCapture) {
                        syncOrbitTargetToCameraLook();
                    }
                    orbitRef.current.enabled = true;
                }
                orbitRef.current.update();
            }
        },
        [clearKeys, domElement, enablePointerLock, orbitRef, syncOrbitTargetToCameraLook, disableOrbitDamping]
    );

    // -------------------------
    // mouse events（RMB drag = look / Shift+RMB = pan）
    // + RMB + wheel = speed
    // -------------------------
    useEffect(() => {
        if (!isMouseEnabled || !domElement || !camera) return;

        const el = domElement;

        const onContextMenu = (e) => {
            e.preventDefault();
        };

        const onPointerDown = (e) => {
            if (!isMouseEnabled) return;

            // ✅ GizmoがアクティブならRMB開始もしない（安全）
            if (isGizmoActive()) return;

            if (e.button === 2) {
                const s = stateRef.current;

                // Shiftの実際のキーボード状態をイベントから同期（endRmbでkeys.clearしても保持される）
                s.shift = e.shiftKey;

                // ── rmbOrbit モード: 右=軌道回転 / Shift+右=パン / Ctrl+右=ズーム ──
                // ✅ 全ケースで自前キャプチャ + Pointer Lock を要求（無限ドラッグ対応）
                if (rmbOrbit) {
                    s.rmb = true;
                    s.lastX = e.clientX;
                    s.lastY = e.clientY;
                    s.isZoomDrag = e.ctrlKey;

                    // 常にこのフックが横取りして処理する（OrbitControls には委譲しない）
                    s.capturedRmb = true;
                    s.pointerId = e.pointerId;

                    // 純粋なオービット（修飾キーなし）かどうかをフラグで記録
                    // → endRmb で syncOrbitTargetToCameraLook をスキップするため
                    s.isOrbitCapture = !e.shiftKey && !e.ctrlKey;

                    if (orbitRef?.current) {
                        s.orbitWasEnabled = orbitRef.current.enabled;
                        orbitRef.current.enabled = false;
                        // オービット半径を保存（pan/zoom にも使用）
                        const d = camera.position.distanceTo(orbitRef.current.target);
                        s.orbitDist = Number.isFinite(d) ? d : 6;
                    }

                    el.setPointerCapture?.(e.pointerId);
                    e.preventDefault();

                    // ✅ Pointer Lock 要求 → カーソルが画面端で止まらなくなる
                    if (enablePointerLock && !isPointerLocked()) {
                        try {
                            s.requestedPointerLock = true;
                            el.requestPointerLock?.();
                        } catch {
                            // ignore – フォールバックで clientX delta を使用
                        }
                    }

                    // カーソル: Ctrl=虫眼鏡, それ以外=つかむ手
                    el.style.cursor = e.ctrlKey ? zoomCursorUrl : "grabbing";
                    return; // 従来処理をスキップ
                }

                // ── 従来モード (FPS ルックアラウンド / forcePanOnRmb) ──
                const isOrtho = camera && camera.isOrthographicCamera;

                if (!isOrtho && !forcePanOnRmb) {
                    const yp = getYawPitchFromCamera();
                    s.yaw = yp.yaw;
                    s.pitch = yp.pitch;

                    camera.rotation.order = "YXZ";
                    camera.rotation.z = 0;
                }

                if (orbitRef?.current) {
                    const d = camera.position.distanceTo(orbitRef.current.target);
                    s.orbitDist = Number.isFinite(d) ? d : 6;
                }

                s.rmb = true;
                s.lastX = e.clientX;
                s.lastY = e.clientY;
                s.pointerId = e.pointerId;
                s.isZoomDrag = e.ctrlKey;
                s.capturedRmb = true; // 従来モードは常に横取り

                if (orbitRef?.current) {
                    s.orbitWasEnabled = orbitRef.current.enabled;
                    orbitRef.current.enabled = false;
                }

                if (s.isZoomDrag) {
                    el.style.cursor = zoomCursorUrl;
                } else if (isOrtho || forcePanOnRmb) {
                    el.style.cursor = "grabbing";
                }

                el.setPointerCapture?.(e.pointerId);

                if (enablePointerLock && !isOrtho && !forcePanOnRmb && !s.isZoomDrag && !isPointerLocked()) {
                    try {
                        s.requestedPointerLock = true;
                        el.requestPointerLock?.();
                    } catch {
                        // ignore
                    }
                }

                e.preventDefault();
            }
        };

        const onPointerUp = (e) => {
            if (e.button === 2) endRmb("pointerup");
        };
        const onPointerCancel = () => endRmb("pointercancel");

        const onPointerMove = (e) => {
            const s = stateRef.current;
            if (!s.rmb) return;
            // rmbOrbit で横取りしていない場合は OrbitControls に委譲（何もしない）
            if (!s.capturedRmb) return;

            // ✅ Gizmoがアクティブになったら即停止（ドラッグ中にhoverが変わる事故も潰す）
            if (isGizmoActive()) {
                console.log("[useViewportControls] gizmo became active during drag");
                endRmb("gizmo-active");
                return;
            }

            const locked = enablePointerLock && isPointerLocked();
            const dx = locked ? e.movementX : e.clientX - s.lastX;
            const dy = locked ? e.movementY : e.clientY - s.lastY;

            if (!locked) {
                s.lastX = e.clientX;
                s.lastY = e.clientY;
            }

            const isOrtho = camera && camera.isOrthographicCamera;
            
            if (s.isZoomDrag) {
                // dy > 0 (マウス下)で縮小、dy < 0 (マウス上)で拡大
                if (isOrtho) {
                    camera.zoom = Math.max(0.01, camera.zoom * Math.pow(0.985, dy));
                    camera.updateProjectionMatrix();
                } else {
                    if (orbitRef?.current) {
                        const target = orbitRef.current.target;
                        const toCamera = new THREE.Vector3().subVectors(camera.position, target);
                        let dist = toCamera.length();
                        
                        // マウス上下で対数的に距離をスケーリング (dy>0で遠ざかる、dy<0で近づく)
                        // Dolly factor
                        const scale = Math.pow(0.995, -dy);
                        dist = Math.max(0.1, dist * scale);
                        
                        // カメラ位置を更新 (ターゲットから新しい距離の位置へ)
                        if (toCamera.lengthSq() > 0.00001) {
                            camera.position.copy(target).addScaledVector(toCamera.normalize(), dist);
                            orbitRef.current.update();
                        }
                    } else {
                        // フォールバック: orbitRefがない場合は単純に前進/後退
                        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                        const moveAmount = -dy * Math.max(1, s.orbitDist) * 0.005;
                        camera.position.addScaledVector(forward, moveAmount);
                    }
                }
                return;
            }

            if (s.shift || isOrtho || forcePanOnRmb) {
                let effectivePanSpeed = panSpeed;
                if (isOrtho) {
                    const safeZoom = Math.max(0.01, camera.zoom);
                    effectivePanSpeed = panSpeed * (100 / safeZoom);
                } else if (orbitRef?.current) {
                    const targetDist = camera.position.distanceTo(orbitRef.current.target);
                    const fovRad = (camera.fov || 50) * Math.PI / 180;
                    const clientHeight = el.clientHeight || window.innerHeight || 1000;
                    effectivePanSpeed = (2 * targetDist * Math.tan(fovRad / 2)) / clientHeight;
                }
                effectivePanSpeed *= panMultiplier;

                if (forcePanOnRmb) {
                    // XZ Plane (Ground) Panning for Layout Mode
                    const forward = new THREE.Vector3();
                    camera.getWorldDirection(forward);
                    forward.y = 0;
                    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
                    forward.normalize();
                    
                    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                    
                    // dy > 0 means dragging down, which means move camera FORWARD
                    // dx > 0 means dragging right, which means move camera LEFT
                    camera.position.addScaledVector(right, -dx * effectivePanSpeed);
                    camera.position.addScaledVector(forward, dy * effectivePanSpeed);

                    if (orbitRef?.current) {
                        orbitRef.current.target.addScaledVector(right, -dx * effectivePanSpeed);
                        orbitRef.current.target.addScaledVector(forward, dy * effectivePanSpeed);
                        orbitRef.current.update();
                    }
                } else {
                    // Default Camera-Plane Panning
                    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
                    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
                    
                    camera.position.addScaledVector(right, -dx * effectivePanSpeed);
                    camera.position.addScaledVector(up, dy * effectivePanSpeed);

                    if (orbitRef?.current) {
                        orbitRef.current.target.addScaledVector(right, -dx * effectivePanSpeed);
                        orbitRef.current.target.addScaledVector(up, dy * effectivePanSpeed);
                        orbitRef.current.update();
                    }
                }
                return;
            }

            // ✅ rmbOrbit モード: 球面座標でオービット（OrbitControls 相当・Pointer Lock 対応）
            if (rmbOrbit) {
                const oc = orbitRef?.current;
                if (!oc) return;

                const offset = new THREE.Vector3().subVectors(camera.position, oc.target);
                const spherical = new THREE.Spherical().setFromVector3(offset);

                // theta = 水平（方位角）、phi = 垂直（仰角）
                spherical.theta -= dx * lookSpeed;
                spherical.phi   -= dy * lookSpeed;

                // 真上・真下をクランプして反転防止
                spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
                spherical.makeSafe();

                offset.setFromSpherical(spherical);
                camera.position.copy(oc.target).add(offset);
                camera.lookAt(oc.target);
                return;
            }

            s.yaw -= dx * lookSpeed;
            s.pitch -= dy * lookSpeed;

            const lim = Math.PI / 2 - 0.01;
            s.pitch = Math.max(-lim, Math.min(lim, s.pitch));

            camera.rotation.order = "YXZ";
            camera.rotation.y = s.yaw;
            camera.rotation.x = s.pitch;
            camera.rotation.z = 0;
        };

        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

        const onWheel = (e) => {
            const s = stateRef.current;
            if (!s.rmb) return;

            // ✅ Gizmoがアクティブなら速度変更もしない
            if (isGizmoActive()) return;

            e.preventDefault();

            const dy = e.deltaY || 0;
            const direction = dy > 0 ? -1 : 1;

            const mul = 1 + speedWheelStep * direction;
            const next = clamp(s.speedMul * mul, speedMinMul, speedMaxMul);

            s.speedMul = Number(next.toFixed(4));

            if (typeof onSpeedChange === "function") {
                try {
                    onSpeedChange(s.speedMul);
                } catch {
                    // ignore
                }
            }
        };

        el.addEventListener("contextmenu", onContextMenu, { passive: false });
        el.addEventListener("pointerdown", onPointerDown, { passive: false });
        el.addEventListener("pointerup", onPointerUp, { passive: false });
        el.addEventListener("pointercancel", onPointerCancel, { passive: false });
        el.addEventListener("pointermove", onPointerMove, { passive: true });
        el.addEventListener("wheel", onWheel, { passive: false });

        const onWindowMouseUp = (ev) => {
            if (ev.button === 2) endRmb("window-mouseup");
        };
        const onWindowPointerUp = (ev) => {
            if (ev.button === 2) endRmb("window-pointerup");
        };
        const onWindowBlur = () => endRmb("window-blur");

        window.addEventListener("mouseup", onWindowMouseUp, { passive: true });
        window.addEventListener("pointerup", onWindowPointerUp, { passive: true });
        window.addEventListener("blur", onWindowBlur);

        const onPointerLockChange = () => {
            const s = stateRef.current;
            if (enablePointerLock && s.rmb && !isPointerLocked()) {
                endRmb("pointerlockchange-unlocked");
            }
        };
        document.addEventListener("pointerlockchange", onPointerLockChange);

        return () => {
            el.removeEventListener("contextmenu", onContextMenu);
            el.removeEventListener("pointerdown", onPointerDown);
            el.removeEventListener("pointerup", onPointerUp);
            el.removeEventListener("pointercancel", onPointerCancel);
            el.removeEventListener("pointermove", onPointerMove);
            el.removeEventListener("wheel", onWheel);

            window.removeEventListener("mouseup", onWindowMouseUp);
            window.removeEventListener("pointerup", onWindowPointerUp);
            window.removeEventListener("blur", onWindowBlur);

            document.removeEventListener("pointerlockchange", onPointerLockChange);
        };
    }, [
        isKeyboardEnabled,
        isMouseEnabled,
        domElement,
        camera,
        orbitRef,
        lookSpeed,
        panSpeed,
        enablePointerLock,
        isPointerLocked,
        getYawPitchFromCamera,
        endRmb,
        speedWheelStep,
        speedMinMul,
        speedMaxMul,
        onSpeedChange,
        isGizmoActive,
        forcePanOnRmb,
        rmbOrbit,
    ]);

    // -------------------------
    // WASDQE移動（requestAnimationFrame）
    // -------------------------
    useEffect(() => {
        if (!enabled || !camera) return;

        let raf = 0;
        let last = performance.now();

        const tick = (now) => {
            raf = requestAnimationFrame(tick);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            // ✅ Gizmoがアクティブなら移動しない
            if (isGizmoActive()) return;

            const s = stateRef.current;

            // ✅ RMB中だけ移動（保険。keydown側で抑えてるが二重で安全）
            if (wasdRequiresRmb && !s.rmb) return;

            const keys = s.keys;
            const wantsMove = keys.size > 0;
            if (!wantsMove) return;

            // ✅ Shiftキーによる加速 (x3.0)
            const shiftMul = s.shift ? 3.0 : 1.0;
            const mul = (Number.isFinite(s.speedMul) ? s.speedMul : 1.0) * shiftMul;

            const sp = moveSpeed * mul;
            const vsp = verticalSpeed * mul;

            // forward は “カメラが見ている方向” をそのまま使う（Y成分含む）
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
            forward.normalize();

            // A/D は水平ストレイフ（worldUp基準）
            const worldUp = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(forward, worldUp);
            if (right.lengthSq() < 1e-8) {
                right.set(1, 0, 0);
            } else {
                right.normalize();
            }

            const v = new THREE.Vector3();
            const isOrtho = camera.isOrthographicCamera;

            if (isOrtho) {
                // OrthographicCameraの場合、W/Sは近接・寄引ではなく Zoom（倍率変更）で表現する
                if (keys.has("w") || keys.has("s")) {
                    const dir = keys.has("w") ? 1 : -1;
                    const zoomMulAct = Math.exp(zoomKeySpeed * dir * dt * 0.6);
                    const zoomMin = 5;
                    const zoomMax = 250;
                    const nextZoom = Math.max(zoomMin, Math.min(zoomMax, camera.zoom * zoomMulAct));
                    camera.zoom = Number(nextZoom.toFixed(4));
                    camera.updateProjectionMatrix();
                }
            } else {
                if (keys.has("w")) v.add(forward);
                if (keys.has("s")) v.sub(forward);
            }

            if (keys.has("d")) v.add(right);
            if (keys.has("a")) v.sub(right);

            // Q/E はカメラの上方向（ローカルup）に移動
            const upSign = (keys.has("q") ? 1 : 0) + (keys.has("e") ? -1 : 0);
            const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            if (camUp.lengthSq() < 1e-8) camUp.set(0, 1, 0);
            camUp.normalize();

            if (v.lengthSq() > 0) {
                const zFactor = isOrtho ? (1 / Math.max(0.0001, camera.zoom)) : 1.0;
                v.normalize().multiplyScalar(sp * dt * zFactor);
                camera.position.add(v);
            }



            if (upSign !== 0) {
                const zFactor = isOrtho ? (1 / Math.max(0.0001, camera.zoom)) : 1.0;
                camera.position.addScaledVector(camUp, upSign * vsp * dt * zFactor);
            }

            if (orbitRef?.current) {
                orbitRef.current.target.add(v);
                if (upSign !== 0) {
                    const zFactor = isOrtho ? (1 / Math.max(0.0001, camera.zoom)) : 1.0;
                    orbitRef.current.target.addScaledVector(camUp, upSign * vsp * dt * zFactor);
                }
            }
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [enabled, camera, orbitRef, moveSpeed, verticalSpeed, wasdRequiresRmb, isGizmoActive, zoomKeySpeed]);

    return {
        focusSelected,
        updateOrbitPivotToSelected,
        getNavActive: () => !!stateRef.current.rmb,
    };
}