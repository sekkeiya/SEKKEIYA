import { useCallback, useEffect, useRef, useState } from "react";
import { createSnapEngine } from "@layout/features/layout/utils/snapEngine.js";

export function useSnapEngine({ snapEnabled }) {
    // ✅ Shift key (temporary snap)
    const [shiftSnap, setShiftSnap] = useState(false);
    const shiftSnapRef = useRef(false);

    const getSnapActive = useCallback(() => {
        return !!(snapEnabled || shiftSnapRef.current);
    }, [snapEnabled]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key !== "Shift") return;
            if (!shiftSnapRef.current) {
                shiftSnapRef.current = true;
                setShiftSnap(true);
            }
        };
        const onKeyUp = (e) => {
            if (e.key !== "Shift") return;
            if (shiftSnapRef.current) {
                shiftSnapRef.current = false;
                setShiftSnap(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onKeyUp);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onKeyUp);
        };
    }, []);

    // ✅ Snap Engine (single instance)
    const snapEngineRef = useRef(null);
    if (!snapEngineRef.current) {
        snapEngineRef.current = createSnapEngine({
            getActive: () => !!(snapEnabled || shiftSnapRef.current),
            engage: 0.6,
            release: 1.2,
            switchMargin: 0.003,
            timeLockMs: 200,
            speedSlow: 999,
            speedFast: 2.0,
            engageFast: 0.34,
            releaseFast: 0.58,
        });
    }

    const clearSnapLocks = useCallback(() => {
        snapEngineRef.current?.clear?.();
    }, []);

    // ✅ Snap UI info (per axis)
    const lastSnapUiRef = useRef({ x: null, y: null, z: null });

    const snapAxisValue = useCallback((raw, axis) => {
        const out = snapEngineRef.current?.snap?.(raw, axis) ?? raw;

        if (axis === "x" || axis === "y" || axis === "z") {
            const snapped = Math.abs(out - raw) > 1e-6;
            lastSnapUiRef.current[axis] = snapped ? out : null;
        }
        return out;
    }, []);

    return {
        shiftSnap,
        shiftSnapRef,
        getSnapActive,
        snapEngineRef,
        clearSnapLocks,
        lastSnapUiRef,
        snapAxisValue,
    };
}
