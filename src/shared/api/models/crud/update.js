// src/utils/services/models/crud/update.js
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/* ===================== サニタイズ / 正規化 ===================== */

// Firestore が弾くキー（空/アンダースコアのみ/両端が __）
const isIllegalKey = (k) => k === "" || /^_+$/.test(k) || /^__.*__$/.test(k);

/** 配列も含めて深くサニタイズ（undefined/違法キーを除去） */
const pruneForFirestore = (val) => {
    if (val === null || typeof val !== "object") return val;

    if (Array.isArray(val)) {
        return val.map(pruneForFirestore).filter((e) => e !== undefined);
    }

    const out = Object.create(null);
    for (const [k, v] of Object.entries(val)) {
        if (isIllegalKey(k)) continue;
        if (v === undefined) continue;
        out[k] = pruneForFirestore(v);
    }
    return out;
};

const toNumberOrNull = (v) => {
    if (v === "" || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** フィールドごとの値の最終整形 */
const normalizeFieldValue = (field, value) => {
    if (field === "price") return toNumberOrNull(value);

    if (field === "size" && value && typeof value === "object") {
        return pruneForFirestore({
            width: toNumberOrNull(value.width),
            depth: toNumberOrNull(value.depth),
            height: toNumberOrNull(value.height),
            sh: toNumberOrNull(value.sh),
        });
    }

    return typeof value === "object" ? pruneForFirestore(value) : value;
};

const valueSignature = (v) =>
    v && typeof v === "object" ? JSON.stringify(v) : String(v);

/* ===================== 内部状態 ===================== */

const _state = new Map();             // key -> { timer, inWindow, latestArgs }
const _lastWritten = new Map();       // key -> last signature
const _publicExistsCache = new Map(); // modelId -> boolean

const _makeKey = ({ userId, modelId, field }) => `${userId}:${modelId}:${field}`;

function _getState(key) {
    if (!_state.get(key)) _state.set(key, { timer: null, inWindow: false, latestArgs: null });
    return _state.get(key);
}
function _clearTimer(s) {
    if (s?.timer) clearTimeout(s.timer);
    s.timer = null;
}

/* ===================== payload ビルド（単体/バッチ対応） ===================== */

function buildPayloadAndSignature(field, value) {
    // __batch__ は { field1: val1, field2: val2, ... } の形で来る想定
    if (field === "__batch__" && value && typeof value === "object") {
        const bag = Object.create(null);
        for (const [k, v] of Object.entries(value)) {
            if (isIllegalKey(k)) continue;
            let nv = normalizeFieldValue(k, v);
            if (nv === undefined) nv = null;
            bag[k] = nv;
        }
        const clean = pruneForFirestore(bag);
        const sig = valueSignature(clean);
        return {
            payload: { ...clean, updatedAt: serverTimestamp() },
            signature: sig,
            isBatch: true,
        };
    }

    // 通常フィールド
    let clean = normalizeFieldValue(field, value);
    if (clean === undefined) clean = null;
    const sig = valueSignature(clean);
    return {
        payload: { [field]: clean, updatedAt: serverTimestamp() },
        signature: sig,
        isBatch: false,
    };
}

/* ===================== 実際の書き込み ===================== */

async function _safeUpdate(ref, payload, dbg) {
    try {
        await updateDoc(ref, payload);
    } catch (e) {
        console.error("[updateDoc failed]", dbg, e?.message || e);
        throw e;
    }
}

async function _applyUpdate(args) {
    const {
        userId,
        modelId,
        field,
        value,
        selectedPage,
        boardId = null,
        boardType = null,
    } = args || {};

    if (!userId || !modelId || !field) {
        console.error("[update] missing arg:", { userId, modelId, field });
        return;
    }

    const { payload, signature, isBatch } = buildPayloadAndSignature(field, value);

    const key = _makeKey({ userId, modelId, field });
    if (_lastWritten.get(key) === signature) return; // 同値スキップ

    // 1) users/{uid}/models/{id}
    const userModelRef = doc(db, "users", userId, "models", modelId);
    await _safeUpdate(
        userModelRef,
        payload,
        { where: "users/<uid>/models/<id>", field, payload }
    );

    // 2) 公開側 models/{id} が存在すれば同期（存在チェックはキャッシュ）
    const publicModelRef = doc(db, "models", modelId);
    const known = _publicExistsCache.get(modelId);
    try {
        if (known === true) {
            await _safeUpdate(
                publicModelRef,
                payload,
                { where: "models/<id>", field, payload }
            );
        } else if (known === undefined) {
            const snap = await getDoc(publicModelRef);
            const exists = snap.exists();
            _publicExistsCache.set(modelId, exists);
            if (exists) {
                await _safeUpdate(
                    publicModelRef,
                    payload,
                    { where: "models/<id>", field, payload }
                );
            }
        }
    } catch {
        // 公開側の権限エラーなどは非致命
    }

    // 3) Boards 経由の編集（参照 or コピー先）
    if (selectedPage === "boardspage" && boardId && boardType) {
        let savedModelRef = null;
        if (boardType === "myBoards") {
            savedModelRef = doc(db, "users", userId, "myBoards", boardId, "models", modelId);
        } else if (boardType === "teamBoards") {
            savedModelRef = doc(db, "teamBoards", boardId, "models", modelId);
        }

        if (savedModelRef) {
            try {
                const snap = await getDoc(savedModelRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data?.modelRef?.path) {
                        const originRef = doc(db, data.modelRef.path);
                        await _safeUpdate(
                            originRef,
                            payload,
                            { where: data.modelRef.path, field, payload }
                        );
                    } else {
                        await _safeUpdate(
                            savedModelRef,
                            payload,
                            { where: "(board saved model)", field, payload }
                        );
                    }
                }
            } catch (e) {
                console.error("[update] boardspage write failed:", e?.message);
            }
        }
    }

    _lastWritten.set(key, signature || (isBatch ? "__batch__" : ""));
}

/* ===================== パブリック API ===================== */

export async function updateModelField(
    args,
    { delay = 350, leading = true, trailing = true } = {}
) {
    const key = _makeKey(args);
    const s = _getState(key);
    s.latestArgs = args;

    if (!s.inWindow) {
        s.inWindow = true;
        try {
            if (leading) await _applyUpdate(args);
        } catch (e) {
            console.error("[updateModelField] leading failed:", e?.message);
        }
        _clearTimer(s);
        s.timer = setTimeout(async () => {
            s.inWindow = false;
            const latest = s.latestArgs;
            if (trailing && latest) {
                try {
                    await _applyUpdate(latest);
                } catch (e) {
                    console.error("[updateModelField] trailing failed:", e?.message);
                }
            }
            _clearTimer(s);
        }, delay);
        return;
    }

    _clearTimer(s);
    s.timer = setTimeout(async () => {
        s.inWindow = false;
        const latest = s.latestArgs;
        if (trailing && latest) {
            try {
                await _applyUpdate(latest);
            } catch (e) {
                console.error("[updateModelField] trailing failed:", e?.message);
            }
        }
        _clearTimer(s);
    }, delay);
}

export async function updateModelFieldNow(args) {
    const key = _makeKey(args);
    const s = _getState(key);
    _clearTimer(s);
    s.inWindow = false;
    try {
        await _applyUpdate(args);
    } catch (e) {
        console.error("[updateModelFieldNow] failed:", e?.message);
    }
}
