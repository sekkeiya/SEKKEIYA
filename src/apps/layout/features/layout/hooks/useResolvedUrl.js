// src/features/layout/components/MainArea/hooks/useResolvedUrl.js
import { useEffect, useMemo, useRef, useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@layout/shared/lib/firebase/config";

/**
 * ✅ URL解決（強化版・安定版）:
 * - https は原則そのまま返す
 * - gs:// / storage fullPath は getDownloadURL で解決
 * - Firebase Storage っぽい https なのに token が無い場合は getDownloadURL で再解決（403対策）
 * - 失敗時は一定時間リトライしない（無限ループ防止）
 * - version が 0 のときはキャッシュバスターを付けない（チラつき防止）
 *
 * ✅ 重要（UX改善）:
 * - raw が変わっても、解決が終わるまで「直前の resolved」を保持する（真っ黒を減らす）
 * - cache / inflight は module-scope にして、タブ切替（再マウント）でも保持する
 *
 * ✅ React18 StrictMode 対策:
 * - effect が 2回走っても requestId で最新だけ setState
 */

// =========================
// ✅ module-scope caches（タブ切替でも保持）
// =========================
const URL_CACHE = new Map(); // key -> { value, ts, ok }
const URL_INFLIGHT = new Map(); // key -> Promise<string>
const FAIL_CACHE = new Map(); // failKey -> { ts }

// TTL（任意。長めでOK）
const OK_TTL_MS = 10 * 60 * 1000; // 10min
const FAIL_TTL_MS = 10 * 1000; // 10s

function now() {
    return Date.now();
}
function isExpired(entry, ttl) {
    if (!entry) return true;
    return now() - entry.ts > ttl;
}

function isHttpUrl(s) {
    return /^https?:\/\//i.test(s);
}

function isFirebaseStorageHttpUrl(s) {
    if (!isHttpUrl(s)) return false;
    try {
        const u = new URL(s);
        const host = u.hostname || "";
        const path = u.pathname || "";
        const hostLike =
            host.includes("firebasestorage.googleapis.com") ||
            host.includes("storage.googleapis.com");
        const pathLike = path.includes("/o/");
        return hostLike && pathLike;
    } catch {
        return false;
    }
}

function hasTokenParam(s) {
    if (!isHttpUrl(s)) return false;
    try {
        const u = new URL(s);
        return u.searchParams.has("token");
    } catch {
        return false;
    }
}

export function useResolvedUrl(raw, version = 0, options = {}) {
    const { keepPrevious = true } = options;

    const rawTrim = useMemo(() => String(raw || "").trim(), [raw]);

    const [resolved, setResolved] = useState("");

    // ✅ “直前の解決済みURL” を必ず保持（真っ黒防止の要）
    const lastResolvedRef = useRef("");

    // ✅ 最新リクエストだけ setState
    const reqIdRef = useRef(0);

    // ✅ resolved が更新されたら必ず lastResolvedRef も更新（依存配列問題を根絶）
    useEffect(() => {
        if (resolved) lastResolvedRef.current = resolved;
    }, [resolved]);

    useEffect(() => {
        const r = rawTrim;
        const myReqId = ++reqIdRef.current;
        let alive = true;

        const appendVer = (u) => {
            if (!version) return u;
            const sep = u.includes("?") ? "&" : "?";
            return `${u}${sep}v=${version}`;
        };

        // raw が空 → 明示クリア
        if (!r) {
            lastResolvedRef.current = "";
            setResolved("");
            return () => {
                alive = false;
            };
        }

        const key = `${r}__${version}`;

        // ✅ キャッシュがあれば即返す
        const cached = URL_CACHE.get(key);
        if (cached && cached.ok === true && !isExpired(cached, OK_TTL_MS)) {
            if (alive && reqIdRef.current === myReqId) {
                setResolved(cached.value);
            }
            return () => {
                alive = false;
            };
        }

        // ✅ 直近失敗は一定時間スキップ
        const failKey = `${r}__FAIL`;
        const failed = FAIL_CACHE.get(failKey);
        if (failed && !isExpired(failed, FAIL_TTL_MS)) {
            // keepPrevious=true なら何もしない（現状維持）
            if (!keepPrevious) setResolved("");
            return () => {
                alive = false;
            };
        } else {
            FAIL_CACHE.delete(failKey);
        }

        // ✅ raw変更時も “空にしない”
        if (!keepPrevious) {
            lastResolvedRef.current = "";
            setResolved("");
        }
        // keepPrevious=true の場合は setResolved しない（今の表示を維持）

        async function run() {
            try {
                const isHttp = isHttpUrl(r);
                const isFsHttp = isFirebaseStorageHttpUrl(r);
                const hasToken = hasTokenParam(r);

                // --------------------
                // 1) http(s)
                // --------------------
                if (isHttp) {
                    // ✅ Storageっぽいのに token が無い → getDownloadURLで正規化（403対策）
                    if (isFsHttp && !hasToken) {
                        let p = URL_INFLIGHT.get(key);
                        if (!p) {
                            // ref(storage, https://.../o/...) は SDK が対応している（パス/URLをref化）
                            p = getDownloadURL(ref(storage, r));
                            URL_INFLIGHT.set(key, p);
                        }

                        const url = await p;
                        URL_INFLIGHT.delete(key);

                        const out = appendVer(url);
                        URL_CACHE.set(key, { value: out, ts: now(), ok: true });

                        if (alive && reqIdRef.current === myReqId) {
                            setResolved(out);
                        }
                        return;
                    }

                    // 通常の https はそのまま
                    const out = appendVer(r);
                    URL_CACHE.set(key, { value: out, ts: now(), ok: true });

                    if (alive && reqIdRef.current === myReqId) {
                        setResolved(out);
                    }
                    return;
                }

                // --------------------
                // 2) gs:// or fullPath
                // --------------------
                let p = URL_INFLIGHT.get(key);
                if (!p) {
                    p = getDownloadURL(ref(storage, r));
                    URL_INFLIGHT.set(key, p);
                }

                const url = await p;
                URL_INFLIGHT.delete(key);

                const out = appendVer(url);
                URL_CACHE.set(key, { value: out, ts: now(), ok: true });

                if (alive && reqIdRef.current === myReqId) {
                    setResolved(out);
                }
            } catch (e) {
                URL_INFLIGHT.delete(key);
                FAIL_CACHE.set(failKey, { ts: now() });

                // ✅ keepPrevious=true なら “現状維持”
                if (alive && reqIdRef.current === myReqId) {
                    if (!keepPrevious) setResolved("");
                    // keepPrevious=true の場合は setResolvedしない
                }
            }
        }

        run();

        return () => {
            alive = false;
        };
    }, [rawTrim, version, keepPrevious]);

    // ✅ ここが超重要：解決中でも “前のURL” を返す（BaseGlbが外れない）
    return resolved || (keepPrevious ? lastResolvedRef.current : "");
}
