// src/features/layout/components/MainArea/hooks/useOrthoViewportControls.js
import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

/**
 * Orthographic（Top/Front/Right）専用の操作レイヤー
 *
 * ✅ Topビューの向きを固定：
 * - 右側が +X
 * - 上側が +Z
 * になるように camera.position / camera.up / lookAt を強制する
 */
export function useOrthoViewportControls({
    camera,
    domElement,
    orbitRef,
    enabled = true,

    // ✅ NEW: "top" | "front" | "right" など（SingleViewportCanvas から渡す）
    viewType = null,

    // selection
    getSelectedObject,
    selectedKey,

    // tuning
    moveSpeed = 85,
    panSpeed = 1.2,
    zoomWheelStep = 0.12,
    zoomMin = 5,
    zoomMax = 250,

    // keys zoom (W/S)
    zoomKeySpeed = 2.2,

    // speed tuning (RMB + wheel)
    speedWheelStep = 0.12,
    speedMinMul = 0.2,
    speedMaxMul = 12.0,

    // ✅ RMB中だけWASD
    wasdRequiresRmb = true,

    autoPanOnSelect = false,

    onZoomChange,
    onSpeedChange,
}) {
    const stateRef = useRef({
        keys: new Set(),
        rmb: false,
        lastX: 0,
        lastY: 0,
        pointerId: null,
        speedMul: 1.0,
    });

    const clearKeys = useCallback(() => {
        stateRef.current.keys.clear();
    }, []);

    const isTextInput = useCallback((el) => {
        if (!el) return false;
        const tag = String(el.tagName || "").toLowerCase();
        return tag === "input" || tag === "textarea" || el.isContentEditable;
    }, []);

    const clamp = useCallback((v, a, b) => Math.max(a, Math.min(b, v)), []);

    // =========================
    // ✅ Topビューの「+方向」を固定する（ここが本題）
    // - Top: 右が +X / 上が +Z になるようにする
    // =========================
    useEffect(() => {
        if (!enabled) return;
        if (!camera) return;

        const vt = String(viewType || "").toLowerCase();
        const controls = orbitRef?.current;

        if (vt === "top") {
            // target（OrbitControlsがあるならそのtarget）
            const target =
                controls?.target?.clone?.() ?? new THREE.Vector3(0, 0, 0);

            // ✅ 上方向を +Z に固定（これで「上側が＋」= +Z）
            camera.up.set(0, 0, 1);

            // ✅ Topは +Y 側から見下ろす（X-Z 平面が見える）
            // 位置がマイナス側に行っていると符号が反転しやすいので必ず +Y に寄せる
            const d = Math.max(5, camera.position.distanceTo(target) || 120);
            camera.position.set(target.x, target.y + d, target.z);

            // ✅ 姿勢を確定（これで「右側が＋」= +X が右）
            camera.lookAt(target);
            camera.updateMatrixWorld?.(true);
            camera.updateProjectionMatrix?.();

            if (controls) {
                controls.target.copy(target);
                controls.update?.();
            }
            return;
        }

        // front/right などは、必要ならここで同様に固定できる（今回はTopだけ）
    }, [enabled, camera, orbitRef, viewType]);

    const getBasis = useCallback(() => {
        if (!camera) {
            return {
                right: new THREE.Vector3(1, 0, 0),
                up: new THREE.Vector3(0, 1, 0),
            };
        }

        // camera の姿勢から right/up を取る（Orthoでも安定）
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
        return { right, up };
    }, [camera]);

    const applyZoomMul = useCallback(
        (mul) => {
            if (!camera) return;
            const next = clamp(camera.zoom * mul, zoomMin, zoomMax);
            camera.zoom = Number(next.toFixed(4));
            camera.updateProjectionMatrix();

            if (typeof onZoomChange === "function") {
                try {
                    onZoomChange(camera.zoom);
                } catch { }
            }
        },
        [camera, clamp, zoomMin, zoomMax, onZoomChange]
    );

    const focusSelected = useCallback(() => {
        const obj = getSelectedObject?.();
        const cam = camera;
        if (!obj || !cam) return;

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        if (orbitRef?.current) {
            orbitRef.current.target.copy(center);
            orbitRef.current.update();
        }

        const maxDim = Math.max(size.x, size.y, size.z);
        const safe = Math.max(0.001, maxDim);

        const desired = clamp(120 / safe, zoomMin, zoomMax);
        cam.zoom = desired;
        cam.updateProjectionMatrix();

        if (typeof onZoomChange === "function") {
            try {
                onZoomChange(cam.zoom);
            } catch { }
        }
    }, [camera, orbitRef, getSelectedObject, clamp, zoomMin, zoomMax, onZoomChange]);

    // 選択時の自動Pan（デフォルトOFF）
    useEffect(() => {
        if (!enabled) return;
        if (!autoPanOnSelect) return;
        if (!selectedKey) return;

        const obj = getSelectedObject?.();
        const controls = orbitRef?.current;
        const cam = camera;
        if (!obj || !controls || !cam) return;

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());

        const prevTarget = controls.target.clone();
        const delta = center.sub(prevTarget);

        cam.position.add(delta);
        controls.target.add(delta);
        controls.update();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, autoPanOnSelect, selectedKey]);

    // key events（WASDQE / F）
    useEffect(() => {
        if (!enabled) return;

        const onKeyDown = (e) => {
            if (!enabled) return;
            if (isTextInput(document.activeElement)) return;

            const s = stateRef.current;

            if (e.key === "f" || e.key === "F") {
                e.preventDefault();
                focusSelected();
                return;
            }

            const k = e.key.toLowerCase();
            const isMoveKey = ["w", "a", "s", "d", "q", "e"].includes(k);

            if (isMoveKey) {
                if (wasdRequiresRmb && !s.rmb) return;
                e.preventDefault();
                s.keys.add(k);
            }
        };

        const onKeyUp = (e) => {
            const s = stateRef.current;
            const k = e.key.toLowerCase();
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
    }, [enabled, isTextInput, focusSelected, clearKeys, wasdRequiresRmb]);

    // RMB pan + wheel zoom (+ RMB wheel speed)
    useEffect(() => {
        if (!enabled || !domElement || !camera) return;

        const el = domElement;

        try {
            el.style.touchAction = "none";
            el.style.overscrollBehavior = "contain";
        } catch { }

        const onContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const onPointerDown = (e) => {
            if (!enabled) return;
            if (e.button !== 2) return;

            const s = stateRef.current;
            s.rmb = true;
            s.lastX = e.clientX;
            s.lastY = e.clientY;
            s.pointerId = e.pointerId;

            if (orbitRef?.current) orbitRef.current.enabled = false;

            try {
                el.setPointerCapture?.(e.pointerId);
            } catch { }

            e.preventDefault();
            e.stopPropagation();
        };

        const endRmb = () => {
            const s = stateRef.current;
            if (!s.rmb) return;

            s.rmb = false;
            clearKeys();

            try {
                if (el && s.pointerId != null) el.releasePointerCapture?.(s.pointerId);
            } catch { }
            s.pointerId = null;

            if (orbitRef?.current) {
                orbitRef.current.enabled = true;
                orbitRef.current.update();
            }
        };

        const onPointerUp = (e) => {
            if (e.button === 2) endRmb();
        };
        const onPointerCancel = () => endRmb();

        const onPointerMove = (e) => {
            const s = stateRef.current;
            if (!s.rmb) return;

            const dx = e.clientX - s.lastX;
            const dy = e.clientY - s.lastY;
            s.lastX = e.clientX;
            s.lastY = e.clientY;

            const { right, up } = getBasis();

            const z = Number.isFinite(camera.zoom) ? camera.zoom : 1;
            const worldPerPx = panSpeed / Math.max(0.0001, z);

            const move = new THREE.Vector3();
            move.addScaledVector(right, -dx * worldPerPx);
            move.addScaledVector(up, dy * worldPerPx);

            camera.position.add(move);
            if (orbitRef?.current) {
                orbitRef.current.target.add(move);
                orbitRef.current.update();
            }

            e.stopPropagation();
        };

        const onWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const s = stateRef.current;

            if (s.rmb) {
                const dy = e.deltaY || 0;
                const direction = dy > 0 ? -1 : 1;
                const mul = 1 + speedWheelStep * direction;
                const next = clamp(s.speedMul * mul, speedMinMul, speedMaxMul);
                s.speedMul = Number(next.toFixed(4));

                if (typeof onSpeedChange === "function") {
                    try {
                        onSpeedChange(s.speedMul);
                    } catch { }
                }
                return;
            }

            const dy = e.deltaY || 0;
            const direction = dy > 0 ? -1 : 1;
            const mul = 1 + zoomWheelStep * direction;
            applyZoomMul(mul);
        };

        el.addEventListener("contextmenu", onContextMenu, { passive: false });
        el.addEventListener("pointerdown", onPointerDown, { passive: false });
        el.addEventListener("pointerup", onPointerUp, { passive: false });
        el.addEventListener("pointercancel", onPointerCancel, { passive: false });
        el.addEventListener("pointermove", onPointerMove, { passive: true });
        el.addEventListener("wheel", onWheel, { passive: false });

        const onWindowMouseUp = (ev) => {
            if (ev.button === 2) endRmb();
        };
        window.addEventListener("mouseup", onWindowMouseUp, { passive: true });
        window.addEventListener("blur", endRmb);

        return () => {
            el.removeEventListener("contextmenu", onContextMenu);
            el.removeEventListener("pointerdown", onPointerDown);
            el.removeEventListener("pointerup", onPointerUp);
            el.removeEventListener("pointercancel", onPointerCancel);
            el.removeEventListener("pointermove", onPointerMove);
            el.removeEventListener("wheel", onWheel);

            window.removeEventListener("mouseup", onWindowMouseUp);
            window.removeEventListener("blur", endRmb);
        };
    }, [
        enabled,
        domElement,
        camera,
        orbitRef,
        getBasis,
        panSpeed,
        zoomWheelStep,
        speedWheelStep,
        speedMinMul,
        speedMaxMul,
        clamp,
        applyZoomMul,
        onSpeedChange,
        clearKeys,
    ]);

    // WASDQE（RMB中だけ）
    useEffect(() => {
        if (!enabled || !camera) return;

        let raf = 0;
        let last = performance.now();

        const tick = (now) => {
            raf = requestAnimationFrame(tick);

            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            const s = stateRef.current;
            if (wasdRequiresRmb && !s.rmb) return;
            if (s.keys.size === 0) return;

            if (s.keys.has("w") || s.keys.has("s")) {
                const dir = s.keys.has("w") ? 1 : -1;
                const mul = Math.exp(zoomKeySpeed * dir * dt * 0.6);
                applyZoomMul(mul);
                return;
            }

            const { right, up } = getBasis();
            const v = new THREE.Vector3();

            if (s.keys.has("d")) v.add(right);
            if (s.keys.has("a")) v.sub(right);
            if (s.keys.has("q")) v.add(up);
            if (s.keys.has("e")) v.sub(up);

            if (v.lengthSq() < 1e-8) return;

            const z = Number.isFinite(camera.zoom) ? camera.zoom : 1;
            const zoomFactor = 1 / Math.max(0.0001, z);

            const mul = Number.isFinite(s.speedMul) ? s.speedMul : 1.0;
            v.normalize().multiplyScalar(moveSpeed * mul * dt * zoomFactor);

            camera.position.add(v);
            if (orbitRef?.current) {
                orbitRef.current.target.add(v);
                orbitRef.current.update();
            }
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [enabled, camera, orbitRef, moveSpeed, getBasis, zoomKeySpeed, applyZoomMul, wasdRequiresRmb]);

    return {
        focusSelected,
        getNavActive: () => !!stateRef.current.rmb,
    };
}
