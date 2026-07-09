// src/features/layout/components/MainArea/utils/viewportUtils.js

/**
 * Rhino風 Viewport types
 */
export const VIEW_TYPES = {
    PERSPECTIVE: "perspective",
    TOP: "top",
    FRONT: "front",
    RIGHT: "right",
};

/**
 * Rhino風 Layout modes
 */
export const LAYOUT_MODES = {
    SINGLE: "single",
    SPLIT: "split",
    TRIPLE: "triple",
    QUAD: "quad",
};

export function clampNumber(v, min, max) {
    const n = Number(v);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
}

// グリッドスナップ
export function snapToStep(v, step) {
    const s = Number(step);
    if (!s || !Number.isFinite(s) || s <= 0) return v;
    return Math.round(v / s) * s;
}

/**
 * ✅ Topビューでの配置最適化（Y-up 想定）
 * - 床は XZ
 * - Top では X/Z 平面で動かす
 * - 高さ（Y）は勝手に変えない
 *
 * axisConstraint:
 *  - "x": Xだけ動かす（= Z固定）
 *  - "z": Zだけ動かす（= X固定）
 */
export function optimizeTopPlacement({
    transform,
    currentPos = [0, 0, 0],
    lockToGround = true,

    // ✅ Y-up: 地面は Y=0
    groundY = 0,

    axisConstraint = "none", // "x" | "z" | "none"
    snapEnabled = false,
    snapStep = 0.5,
}) {
    const t = transform || {};
    const pos = Array.isArray(t.position) ? [...t.position] : [...currentPos];
    while (pos.length < 3) pos.push(0);

    // ✅ Topは X/Z 平面を動かす
    // axisConstraint === "x" → Z固定（Xだけ動く）
    if (axisConstraint === "x") pos[2] = currentPos?.[2] ?? pos[2];
    // axisConstraint === "z" → X固定（Zだけ動く）
    else if (axisConstraint === "z") pos[0] = currentPos?.[0] ?? pos[0];

    if (snapEnabled) {
        pos[0] = snapToStep(pos[0], snapStep); // X
        pos[2] = snapToStep(pos[2], snapStep); // Z
    }

    // ✅ Y-up: 高さはY。lockToGround時はYを維持（または地面に固定）
    if (lockToGround) {
        const keepY = Number.isFinite(currentPos?.[1]) ? currentPos[1] : groundY;
        pos[1] = Number.isFinite(pos[1]) ? pos[1] : keepY;
    }

    return { ...t, position: pos };
}

/**
 * ✅ Ortho preset（Y-up / X右 / Y上 / Z奥）
 *
 * - TOP  : +Y から見下ろす（床 XZ）
 * - FRONT: +Z から原点を見る（正面）
 * - RIGHT: +X から原点を見る（右側面）
 */
export function getOrthoPreset(type) {
    const dist = 90;
    const zoom = 50;

    if (type === VIEW_TYPES.TOP) {
        // 右 +X / 上 -Z（Rhinoっぽく「上が奥」になりやすい）
        return { position: [0, dist, 0], up: [0, 0, -1], target: [0, 0, 0], zoom: 50 };
    }

    if (type === VIEW_TYPES.FRONT) {
        // 正面：+Z から見る（上は +Y）
        return { position: [0, 0, dist], up: [0, 1, 0], target: [0, 0, 0], zoom: 50 };
    }

    if (type === VIEW_TYPES.RIGHT) {
        // 右：+X から見る（上は +Y）
        return { position: [dist, 0, 0], up: [0, 1, 0], target: [0, 0, 0], zoom: 50 };
    }

    // Perspective初期
    return { position: [dist, dist * 0.8, dist], up: [0, 1, 0], target: [0, 0, 0], zoom: 35 };
}

export function optimizeTopPlacementPreview({
    transform,
    currentPos = [0, 0, 0],
    lockToGround = true,
    groundY = 0,
    axisConstraint = "none",
}) {
    const t = transform || {};
    const pos = Array.isArray(t.position) ? [...t.position] : [...currentPos];
    while (pos.length < 3) pos.push(0);

    // axis constraint は効かせる（見た目として重要）
    if (axisConstraint === "x") pos[2] = currentPos?.[2] ?? pos[2];
    else if (axisConstraint === "z") pos[0] = currentPos?.[0] ?? pos[0];

    // ❌ snap はしない
    // ❌ step rounding もしない

    if (lockToGround) {
        const keepY = Number.isFinite(currentPos?.[1]) ? currentPos[1] : groundY;
        pos[1] = keepY;
    }

    return { ...t, position: pos };
}
