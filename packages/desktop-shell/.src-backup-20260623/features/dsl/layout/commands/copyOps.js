// src/features/layout/commands/copyOps.js

// ✅ 安全なID生成（ブラウザ/環境差の吸収）
function createId(prefix = "item") {
    try {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return `${prefix}_${crypto.randomUUID()}`;
        }
    } catch { }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ✅ position/rotation/scale の標準化（配列で統一）
function toVec3Array(v, fallback = [0, 0, 0]) {
    if (Array.isArray(v) && v.length >= 3) return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
    return fallback.slice();
}

/**
 * 選択中 items を複製して payload を返す（副作用なし）
 *
 * @param {Object} args
 * @param {Array} args.items - 正規化済み items（{id, transform:{position/rotation/scale}...}）
 * @param {Array} args.selectedIds - 選択中ID配列
 * @param {Array} [args.offset] - [dx,dy,dz]
 * @param {String} [args.idPrefix] - 生成IDのprefix
 * @returns {{ clones: Array, nextSelectedIds: Array }}
 */
export function buildCopyPayload({ items, selectedIds, offset = [0.2, 0, 0.2], idPrefix = "item" }) {
    const baseItems = Array.isArray(items) ? items : [];
    const sel = Array.isArray(selectedIds) ? selectedIds.filter(Boolean) : [];
    if (baseItems.length === 0 || sel.length === 0) {
        return { clones: [], nextSelectedIds: [] };
    }

    const map = new Map(baseItems.map((it) => [it?.id, it]));
    const clones = [];
    const nextSelectedIds = [];

    const [dx, dy, dz] = toVec3Array(offset, [0, 0, 0]);

    for (const id of sel) {
        const src = map.get(id);
        if (!src) continue;

        const newId = createId(idPrefix);

        // 🔸 src を “浅いコピー” しつつ transform だけ丁寧に作る
        const prevT = src.transform || {};
        const pos = toVec3Array(prevT.position, [0, 0, 0]);
        const rot = toVec3Array(prevT.rotation, [0, 0, 0]);
        const scl = toVec3Array(prevT.scale, [1, 1, 1]);

        const cloned = {
            ...src,
            id: newId,
            transform: {
                ...prevT,
                position: [pos[0] + dx, pos[1] + dy, pos[2] + dz],
                rotation: rot, // そのまま
                scale: scl,    // そのまま
            },
        };

        clones.push(cloned);
        nextSelectedIds.push(newId);
    }

    return { clones, nextSelectedIds };
}
