// src/features/layout/components/MainArea/hooks/useMarqueeSelection.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export function useMarqueeSelection({
    enabled = true,
    rootRef,
    orbitRef,
    objectsRef,
    onPickIds, // (ids:string[], e:PointerEvent) => void
    onPickId,  // (id:string|null, e:PointerEvent) => void
    dragThreshold = 6,
    minRect = 6,
    disableOrbitDuringPending = true,
    getIsBlocked = null, // () => boolean
}) {
    const [marquee, setMarquee] = useState(null);

    // ✅ stateとは別にrefでも保持（確定時に “最新” を安全に参照）
    const marqueeRef = useRef(null);

    // ✅ “待機中のドラッグ候補”
    const pendingRef = useRef(null);
    const draggingRef = useRef(false);

    const isActive = !!marquee;

    const toRect = useCallback((m) => {
        if (!m) return null;
        const x = Math.min(m.x0, m.x1);
        const y = Math.min(m.y0, m.y1);
        const w = Math.abs(m.x1 - m.x0);
        const h = Math.abs(m.y1 - m.y0);
        return { x, y, w, h };
    }, []);

    const marqueeRect = useMemo(() => toRect(marquee), [marquee, toRect]);

    const restoreOrbitFrom = useCallback(
        (p) => {
            if (!disableOrbitDuringPending) return;
            const orbit = orbitRef?.current;
            if (!orbit) return;
            if (p?.orbitWasEnabled) orbit.enabled = true;
        },
        [orbitRef, disableOrbitDuringPending]
    );

    const cancel = useCallback(() => {
        const el = rootRef?.current;
        const p = pendingRef.current;

        if (el && p?.pointerId != null) {
            try {
                el.releasePointerCapture?.(p.pointerId);
            } catch { }
        }

        restoreOrbitFrom(p);

        pendingRef.current = null;
        draggingRef.current = false;

        marqueeRef.current = null;
        setMarquee(null);
    }, [rootRef, restoreOrbitFrom]);

    // ✅ enabled=false になった瞬間に “pendingも含めて” 必ずキャンセル
    useEffect(() => {
        if (enabled) return;
        if (pendingRef.current || marqueeRef.current || marquee) cancel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // Escキャンセル
    useEffect(() => {
        if (!enabled) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") cancel();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [enabled, cancel]);

    // =========================
    // ✅ marquee確定（refから読む）
    // =========================
    const pickByMarquee = useCallback(
        (e) => {
            const el = rootRef?.current;
            if (!el) return;

            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const m = marqueeRef.current;
            const r = toRect(m);
            if (!r || r.w < minRect || r.h < minRect) return;

            const cam = orbitRef?.current?.object;
            if (!cam) return;

            const hits = [];

            objectsRef?.current?.forEach?.((obj, id) => {
                if (!obj) return;

                const v = new THREE.Vector3();
                obj.getWorldPosition(v);
                v.project(cam);

                // カメラ視錐台の奥行き外（背面・遠方クリップ外）のオブジェクトを除外
                if (v.z < -1 || v.z > 1) return;

                const sx = ((v.x + 1) / 2) * rect.width;
                const sy = ((1 - v.y) / 2) * rect.height;

                if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) {
                    hits.push(id);
                }
            });

            // 第3引数: 確定した矩形とカメラ等のコンテキスト。
            // 消費側で追加のヒットテスト（壁・床など中心点判定に向かない対象）に使う。
            const ctx = { rect: r, camera: cam, width: rect.width, height: rect.height };
            if (typeof onPickIds === "function") onPickIds(hits, e, ctx);
            else if (typeof onPickId === "function") onPickId(hits[0] ?? null, e, ctx);
        },
        [rootRef, orbitRef, objectsRef, toRect, minRect, onPickIds, onPickId]
    );

    // =========================
    // pointer handlers
    // =========================
    const onPointerDown = useCallback(
        (e) => {
            // Plain LMB drag activates marquee (OrbitControls LEFT is null, no conflict)
            if (!enabled || e.button !== 0 || !rootRef?.current) return;

            // ✅ “その瞬間” blocked なら pending を作らない
            if (typeof getIsBlocked === "function" && getIsBlocked()) return;

            const b = rootRef.current.getBoundingClientRect();
            const x = e.clientX - b.left;
            const y = e.clientY - b.top;

            let orbitWasEnabled = false;
            if (disableOrbitDuringPending && orbitRef?.current) {
                orbitWasEnabled = orbitRef.current.enabled !== false;
                orbitRef.current.enabled = false;
            }

            pendingRef.current = {
                pointerId: e.pointerId,
                x0: x,
                y0: y,
                started: false,
                orbitWasEnabled,
            };

            // ✅ これが本命：
            // Gizmo は “pointerdown直後” に store を立てることが多い（同一tick後半/次フレーム等）
            // → microtask + rAF で再判定して、Gizmoだったら即キャンセル
            const pid = e.pointerId;

            queueMicrotask(() => {
                const p = pendingRef.current;
                if (!p || p.pointerId !== pid || p.started) return;
                if (typeof getIsBlocked === "function" && getIsBlocked()) cancel();
            });

            requestAnimationFrame(() => {
                const p = pendingRef.current;
                if (!p || p.pointerId !== pid || p.started) return;
                if (typeof getIsBlocked === "function" && getIsBlocked()) cancel();
            });
        },
        [enabled, rootRef, orbitRef, disableOrbitDuringPending, getIsBlocked, cancel]
    );

    const onPointerMove = useCallback(
        (e) => {
            const p = pendingRef.current;
            if (!enabled || !p || !rootRef?.current) return;

            // ✅ 途中で Gizmo 操作が始まったら、その瞬間に marquee を殺す
            if (typeof getIsBlocked === "function" && getIsBlocked()) {
                cancel();
                return;
            }

            // ✅ 対象pointer以外は無視
            if (p.pointerId != null && e.pointerId != null && e.pointerId !== p.pointerId) return;

            // ✅ 左ボタンが押されてないなら pending を捨てる
            const leftDown = (e.buttons & 1) === 1;
            if (!leftDown) {
                cancel();
                return;
            }

            const b = rootRef.current.getBoundingClientRect();
            const x = e.clientX - b.left;
            const y = e.clientY - b.top;

            const dist = Math.hypot(x - p.x0, y - p.y0);

            if (!p.started && dist >= dragThreshold) {
                // ✅ start直前にも blocked を再チェック（保険）
                if (typeof getIsBlocked === "function" && getIsBlocked()) {
                    cancel();
                    return;
                }

                p.started = true;
                draggingRef.current = true;

                e.preventDefault();
                e.stopPropagation();

                try {
                    rootRef.current.setPointerCapture?.(p.pointerId);
                } catch { }

                const next = { x0: p.x0, y0: p.y0, x1: x, y1: y };
                marqueeRef.current = next;
                setMarquee(next);
                return;
            }

            if (p.started) {
                e.preventDefault();
                e.stopPropagation();

                const next = marqueeRef.current
                    ? { ...marqueeRef.current, x1: x, y1: y }
                    : { x0: p.x0, y0: p.y0, x1: x, y1: y };

                marqueeRef.current = next;
                setMarquee(next);
            }
        },
        [enabled, rootRef, dragThreshold, cancel, getIsBlocked]
    );

    const onPointerUp = useCallback(
        (e) => {
            const p = pendingRef.current;
            const el = rootRef?.current;

            // ✅ pointerが違うなら無視
            if (p?.pointerId != null && e.pointerId != null && e.pointerId !== p.pointerId) return;

            if (el && p?.started && p.pointerId != null) {
                try {
                    el.releasePointerCapture?.(p.pointerId);
                } catch { }
            }

            const wasDragging = !!p?.started;
            restoreOrbitFrom(p);

            pendingRef.current = null;
            draggingRef.current = false;

            if (wasDragging) {
                e.preventDefault();
                e.stopPropagation();

                const saved = marqueeRef.current;
                marqueeRef.current = null;
                setMarquee(null);

                queueMicrotask(() => {
                    marqueeRef.current = saved;
                    try {
                        pickByMarquee(e);
                    } finally {
                        marqueeRef.current = null;
                    }
                });
            }
        },
        [rootRef, pickByMarquee, restoreOrbitFrom]
    );

    // enabled が false になった瞬間に pending / dragging を殺す
    useEffect(() => {
        if (!enabled) cancel();
    }, [enabled, cancel]);

    // ✅ pending / marquee がある間、毎フレーム blocked を監視して即 kill
    useEffect(() => {
        if (!enabled) return;
        if (typeof getIsBlocked !== "function") return;

        let raf = 0;

        const tick = () => {
            // pending または marquee 実行中だけ監視（常時回さない）
            const hasWork = !!pendingRef.current || !!marqueeRef.current || !!marquee;
            if (!hasWork) return;

            if (getIsBlocked()) {
                cancel();
                return;
            }

            raf = requestAnimationFrame(tick);
        };

        // 監視開始（pending が生まれた直後から効く）
        raf = requestAnimationFrame(tick);

        return () => {
            if (raf) cancelAnimationFrame(raf);
        };
    }, [enabled, getIsBlocked, cancel, marquee]);

    // ✅ pending中は window でも move/up を拾う
    useEffect(() => {
        if (!enabled) return;

        const shouldHandle = () => !!pendingRef.current;

        const moveWrap = (ev) => {
            if (!shouldHandle()) return;
            onPointerMove(ev);
        };
        const upWrap = (ev) => {
            if (!shouldHandle()) return;
            onPointerUp(ev);
        };
        const cancelWrap = () => {
            if (!shouldHandle()) return;
            cancel();
        };

        window.addEventListener("pointermove", moveWrap, { capture: true });
        window.addEventListener("pointerup", upWrap, { capture: true });
        window.addEventListener("pointercancel", upWrap, { capture: true });
        window.addEventListener("blur", cancelWrap);

        return () => {
            window.removeEventListener("pointermove", moveWrap, true);
            window.removeEventListener("pointerup", upWrap, true);
            window.removeEventListener("pointercancel", upWrap, true);
            window.removeEventListener("blur", cancelWrap);
        };
    }, [enabled, onPointerMove, onPointerUp, cancel]);

    return {
        marqueeRect,
        isMarqueeActive: isActive,
        cancel,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: cancel,
        },
    };
}