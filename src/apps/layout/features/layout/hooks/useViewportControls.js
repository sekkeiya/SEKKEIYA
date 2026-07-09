// src/features/layout/components/MainArea/hooks/useViewportControls.js
import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useViewportUiStore } from "@layout/features/layout/store/viewportUiStore";

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

    // selection
    getSelectedObject,
    selectedKey,

    // tuning (base)
    moveSpeed = 3.0,
    verticalSpeed = 3.0,
    lookSpeed = 0.003,
    panSpeed = 0.002,

    // RMB pointer lock
    enablePointerLock = true,

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

    // optional
    onSpeedChange, // (multiplier:number) => void
}) {
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
        if (!enabled) return;
        const oc = orbitRef?.current;
        if (!oc) return;

        if (disableOrbitDamping) {
            oc.enableDamping = false;
            oc.dampingFactor = 0;
        }

        oc.update();
    }, [enabled, orbitRef, disableOrbitDamping]);

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
        if (!enabled) return;
        if (!autoPivotOnSelect) return;
        updateOrbitPivotToSelected();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, autoPivotOnSelect, selectedKey]);

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
        if (!enabled) return;

        const isTextInput = (el) => {
            if (!el) return false;
            const tag = String(el.tagName || "").toLowerCase();
            return tag === "input" || tag === "textarea" || el.isContentEditable;
        };

        const onKeyDown = (e) => {
            if (!enabled) return;
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
    }, [enabled, focusSelected, clearKeys, wasdRequiresRmb, isGizmoActive]);

    // -------------------------
    // RMB終了処理（復帰）
    // -------------------------
    const endRmb = useCallback(
        (reason = "unknown") => {
            const s = stateRef.current;
            if (!s.rmb) return;

            s.rmb = false;

            // ✅ RMB終了で必ず移動停止（押しっぱなし事故防止）
            clearKeys();

            try {
                if (domElement && s.pointerId != null) domElement.releasePointerCapture?.(s.pointerId);
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

                syncOrbitTargetToCameraLook();
                orbitRef.current.enabled = true;
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
        if (!enabled || !domElement || !camera) return;

        const el = domElement;

        const onContextMenu = (e) => {
            e.preventDefault();
        };

        const onPointerDown = (e) => {
            if (!enabled) return;

            // ✅ GizmoがアクティブならRMB開始もしない（安全）
            if (isGizmoActive()) return;

            if (e.button === 2) {
                const s = stateRef.current;

                const yp = getYawPitchFromCamera();
                s.yaw = yp.yaw;
                s.pitch = yp.pitch;

                camera.rotation.order = "YXZ";
                camera.rotation.z = 0;

                if (orbitRef?.current) {
                    const d = camera.position.distanceTo(orbitRef.current.target);
                    s.orbitDist = Number.isFinite(d) ? d : 6;
                }

                s.rmb = true;
                s.lastX = e.clientX;
                s.lastY = e.clientY;
                s.pointerId = e.pointerId;

                if (orbitRef?.current) {
                    s.orbitWasEnabled = orbitRef.current.enabled;
                    orbitRef.current.enabled = false;
                }

                el.setPointerCapture?.(e.pointerId);

                if (enablePointerLock && !isPointerLocked()) {
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

            // ✅ Gizmoがアクティブになったら即停止（ドラッグ中にhoverが変わる事故も潰す）
            if (isGizmoActive()) {
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

            if (s.shift) {
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

                camera.position.addScaledVector(right, -dx * panSpeed);
                camera.position.addScaledVector(up, dy * panSpeed);

                if (orbitRef?.current) {
                    orbitRef.current.target.addScaledVector(right, -dx * panSpeed);
                    orbitRef.current.target.addScaledVector(up, dy * panSpeed);
                    orbitRef.current.update();
                }
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
        enabled,
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

            const mul = Number.isFinite(s.speedMul) ? s.speedMul : 1.0;
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

            if (keys.has("w")) v.add(forward);
            if (keys.has("s")) v.sub(forward);

            if (keys.has("d")) v.add(right);
            if (keys.has("a")) v.sub(right);

            // Q/E はカメラの上方向（ローカルup）に移動
            const upSign = (keys.has("q") ? 1 : 0) + (keys.has("e") ? -1 : 0);
            const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            if (camUp.lengthSq() < 1e-8) camUp.set(0, 1, 0);
            camUp.normalize();

            if (v.lengthSq() > 0) {
                v.normalize().multiplyScalar(sp * dt);
                camera.position.add(v);
            }

            if (upSign !== 0) {
                camera.position.addScaledVector(camUp, upSign * vsp * dt);
            }

            if (orbitRef?.current) {
                orbitRef.current.target.add(v);
                if (upSign !== 0) orbitRef.current.target.addScaledVector(camUp, upSign * vsp * dt);
            }
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [enabled, camera, orbitRef, moveSpeed, verticalSpeed, wasdRequiresRmb, isGizmoActive]);

    return {
        focusSelected,
        updateOrbitPivotToSelected,
        getNavActive: () => !!stateRef.current.rmb,
    };
}