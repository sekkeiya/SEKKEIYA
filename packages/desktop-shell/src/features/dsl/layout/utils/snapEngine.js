// src/features/layout/components/MainArea/utils/snapEngine.js

/**
 * Snap Engine
 * - Hysteresis (engage/release)
 * - Time-lock (prevent jitter)
 * - Speed-adaptive thresholds
 *
 * ✅ Added:
 * - dynamicWalls: frame-by-frame wall candidates (raycast result)
 * - walls bucket: optional static walls
 * - wallPreferDist: if wall is within this dist, ALWAYS prefer wall
 * - wallPreferMargin: otherwise, if wall is close enough vs other, prefer wall
 *
 * ✅ Added for commit correctness:
 * - _lastFinalAnchor: last snap decision (axis/value/kind/dist/raw)
 */
export function createSnapEngine({
    getActive,

    // base thresholds
    engage = 0.25,
    release = 0.42,
    switchMargin = 0.003,
    timeLockMs = 200,

    // speed adaptation
    speedSlow = 0.2,
    speedFast = 2.0,
    engageFast = 0.34,
    releaseFast = 0.58,

    // ✅ wall preference tuning
    wallPreferDist = 0.18,   // 18cm以内なら「壁を強制優先」（ここを調整）
    wallPreferMargin = 0.03, // dist比較での壁優先マージン（3cm）
} = {}) {
    const locks = {
        x: { value: null, until: 0 },
        y: { value: null, until: 0 },
        z: { value: null, until: 0 },
    };

    const prev = {
        x: { t: 0, raw: null },
        y: { t: 0, raw: null },
        z: { t: 0, raw: null },
    };

    // candidates
    const candidatesAll = {
        x: [],
        y: [],
        z: [],
        walls: { x: [], y: [], z: [] }, // optional static walls
    };

    // ✅ dynamic walls (per-frame)
    const dynamicWalls = { x: [], y: [], z: [] };

    // ✅ last decision for commit (axis/value/kind/dist/raw)
    let _lastFinalAnchor = { axis: null, value: null, kind: null, dist: null, raw: null, t: 0 };

    const clamp01 = (t) => Math.max(0, Math.min(1, t));
    const lerp = (a, b, t) => a + (b - a) * t;

    function getSpeedAdaptive(axis, raw) {
        const now = performance.now();
        const p = prev[axis];

        const prevT = p.t || now;
        const dt = Math.max(1, now - prevT) / 1000;

        const prevRaw = p.raw;
        const speed = prevRaw == null ? 0 : Math.abs(raw - prevRaw) / dt;

        p.t = now;
        p.raw = raw;

        const tt = clamp01((speed - speedSlow) / (speedFast - speedSlow));
        return {
            engage: lerp(engage, engageFast, tt),
            release: lerp(release, releaseFast, tt),
            speed,
        };
    }

    function clear() {
        locks.x.value = locks.y.value = locks.z.value = null;
        locks.x.until = locks.y.until = locks.z.until = 0;

        prev.x.t = prev.y.t = prev.z.t = 0;
        prev.x.raw = prev.y.raw = prev.z.raw = null;

        dynamicWalls.x = [];
        dynamicWalls.y = [];
        dynamicWalls.z = [];

        _lastFinalAnchor = { axis: null, value: null, kind: null, dist: null, raw: null, t: 0 };
    }

    function setCandidatesAll(next) {
        candidatesAll.x = Array.isArray(next?.x) ? next.x : [];
        candidatesAll.y = Array.isArray(next?.y) ? next.y : [];
        candidatesAll.z = Array.isArray(next?.z) ? next.z : [];

        const w = next?.walls || null;
        candidatesAll.walls.x = Array.isArray(w?.x) ? w.x : [];
        candidatesAll.walls.y = Array.isArray(w?.y) ? w.y : [];
        candidatesAll.walls.z = Array.isArray(w?.z) ? w.z : [];
    }

    // ✅ per-frame update
    function setDynamicWalls(next) {
        dynamicWalls.x = Array.isArray(next?.x) ? next.x : dynamicWalls.x;
        dynamicWalls.y = Array.isArray(next?.y) ? next.y : dynamicWalls.y;
        dynamicWalls.z = Array.isArray(next?.z) ? next.z : dynamicWalls.z;
    }
    function clearDynamicWalls() {
        dynamicWalls.x = [];
        dynamicWalls.y = [];
        dynamicWalls.z = [];
    }

    function findNearest(raw, arr) {
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if (!Number.isFinite(c)) continue;
            const d = Math.abs(c - raw);
            if (d < bestDist) {
                bestDist = d;
                best = c;
            }
        }
        return best == null ? null : { value: best, dist: bestDist };
    }

    /**
     * ✅ choose best with wall preference
     * return: { value, dist, kind: "wall" | "obj" }
     */
    function pickBest(raw, axis) {
        const all = candidatesAll[axis] || [];

        // walls = static + dynamic
        const walls = [
            ...(candidatesAll.walls?.[axis] || []),
            ...(dynamicWalls?.[axis] || []),
        ];

        const nAll = findNearest(raw, all);
        const nWall = findNearest(raw, walls);

        if (!nAll && !nWall) return { value: raw, dist: Infinity, kind: null };
        if (!nAll) return { ...nWall, kind: "wall" };
        if (!nWall) return { ...nAll, kind: "obj" };

        // ✅ 1) 壁が一定距離以内なら “強制的に壁”
        if (nWall.dist <= wallPreferDist) return { ...nWall, kind: "wall" };

        // ✅ 2) それ以外は「壁が十分近いなら壁」(従来 + margin)
        if (nWall.dist <= nAll.dist + wallPreferMargin) return { ...nWall, kind: "wall" };

        return { ...nAll, kind: "obj" };
    }

    function snap(raw, axis) {
        if (axis !== "x" && axis !== "y" && axis !== "z") return raw;

        const slot = locks[axis];

        const active = typeof getActive === "function" ? !!getActive() : false;
        if (!active) {
            slot.value = null;
            slot.until = 0;

            _lastFinalAnchor = { axis, value: null, kind: null, dist: null, raw, t: performance.now() };
            return raw;
        }

        const now = performance.now();
        const lock = slot.value;

        const { engage: ENGAGE, release: RELEASE } = getSpeedAdaptive(axis, raw);
        const HARD_BREAK = RELEASE * 2.0;

        // 1) time-lock
        if (Number.isFinite(lock)) {
            const lockDist = Math.abs(lock - raw);
            if (now < slot.until) {
                if (lockDist > HARD_BREAK) {
                    slot.value = null;
                    slot.until = 0;
                } else {
                    _lastFinalAnchor = { axis, value: lock, kind: "lock", dist: lockDist, raw, t: now };
                    return lock;
                }
            }
        }

        // 2) best candidate
        const best = pickBest(raw, axis);
        const bestDist = best?.dist ?? Infinity;
        const bestVal = Number.isFinite(best?.value) ? best.value : raw;
        const bestKind = best?.kind ?? null;

        // 3) keep/switch lock
        if (Number.isFinite(lock)) {
            const lockDist = Math.abs(lock - raw);

            if (lockDist <= RELEASE) {
                if (bestDist + switchMargin < lockDist && bestDist <= ENGAGE) {
                    slot.value = bestVal;
                    slot.until = now + timeLockMs;

                    _lastFinalAnchor = { axis, value: bestVal, kind: bestKind, dist: bestDist, raw, t: now };
                    return bestVal;
                }

                _lastFinalAnchor = { axis, value: lock, kind: "lock", dist: lockDist, raw, t: now };
                return lock;
            }

            slot.value = null;
            slot.until = 0;
        }

        // 4) new lock
        if (bestDist <= ENGAGE) {
            slot.value = bestVal;
            slot.until = now + timeLockMs;

            _lastFinalAnchor = { axis, value: bestVal, kind: bestKind, dist: bestDist, raw, t: now };
            return bestVal;
        }

        _lastFinalAnchor = { axis, value: null, kind: null, dist: bestDist, raw, t: now };
        return raw;
    }

    function getNearest(raw, axis) {
        if (axis !== "x" && axis !== "y" && axis !== "z") return null;
        const best = pickBest(raw, axis);
        if (!best || !Number.isFinite(best.value)) return null;
        return best; // {value, dist, kind}
    }

    function getLock(axis) {
        const slot = locks[axis];
        return Number.isFinite(slot.value) ? slot.value : null;
    }

    function getLastFinalAnchor() {
        return _lastFinalAnchor;
    }

    return {
        clear,
        setCandidatesAll,

        setDynamicWalls,
        clearDynamicWalls,

        snap,
        getLock,
        getNearest,

        // ✅ NEW: commitAlign が参照する用
        getLastFinalAnchor,

        // debug
        _locks: locks,
        _candidates: candidatesAll,
        _dynamicWalls: dynamicWalls,
        _lastFinalAnchor, // ※参照用。更新は getLastFinalAnchor 推奨
    };
}
