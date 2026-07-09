// src/features/layout/components/MainArea/hooks/useObjectRegistry.js
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * itemId -> Object3D の registry を管理
 * - TransformGizmo に selectedObject を渡すための基盤
 */
export function useObjectRegistry(selectedItemId) {
    const objectMapRef = useRef(new Map());
    const [tick, setTick] = useState(0);

    const registerObject = useCallback((itemId, obj) => {
        if (!itemId) return;

        if (!obj) {
            objectMapRef.current.delete(itemId);
            setTick((n) => n + 1);
            return;
        }

        objectMapRef.current.set(itemId, obj);
        setTick((n) => n + 1);
    }, []);

    const selectedObject = useMemo(() => {
        if (!selectedItemId) return null;
        return objectMapRef.current.get(selectedItemId) ?? null;
    }, [selectedItemId, tick]);

    return { registerObject, selectedObject };
}
