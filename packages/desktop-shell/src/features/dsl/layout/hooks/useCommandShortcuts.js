// src/features/layout/components/MainArea/hooks/useCommandShortcuts.js
import { useEffect, useRef, useCallback } from "react";

/**
 * Rhino風 “2キーコマンド” ショートカット
 * 例: A→T = AT（AlignTop）
 *
 * - RMB中は無効（カメラ操作優先）
 * - テキスト入力中は無効
 * - Aの後、一定時間内に2文字目が来たら確定
 * - IME環境でも壊れにくいように e.code（KeyA/KeyT）を優先
 */
export function useCommandShortcuts({
    enabled = true,
    navActive = false,
    onCommand,
    timeoutMs = 650,
}) {
    const ref = useRef({ first: "", ts: 0 });

    const clear = useCallback(() => {
        ref.current.first = "";
        ref.current.ts = 0;
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const isTextInput = (el) => {
            if (!el) return false;
            const tag = String(el.tagName || "").toLowerCase();
            return tag === "input" || tag === "textarea" || el.isContentEditable;
        };

        const normalizeCode = (e) => {
            // e.code: "KeyA" "KeyT" ... / "Digit1" etc.
            const code = String(e.code || "");
            if (code.startsWith("Key")) return code.slice(3).toLowerCase(); // "A" -> "a"
            return "";
        };

        const onKeyDown = (e) => {
            if (!enabled) return;
            if (navActive) return; // ✅ ナビ中は無効
            if (isTextInput(document.activeElement)) return;
            if (e.repeat) return;

            const k = normalizeCode(e);
            if (!k) return;

            const s = ref.current;

            // 1文字目: A
            if (k === "a") {
                s.first = "a";
                s.ts = performance.now();
                return; // ここでは邪魔しない
            }

            // 2文字目（A の後）
            if (s.first === "a") {
                const dt = performance.now() - (s.ts || 0);
                clear();

                if (dt <= timeoutMs) {
                    const map = { t: "AT", b: "AB", l: "AL", r: "AR", h: "AH", v: "AV" };
                    const cmd = map[k];
                    if (cmd) {
                        e.preventDefault(); // ✅ コマンド確定時だけ止める
                        try {
                            onCommand?.(cmd);
                        } catch {
                            // ignore
                        }
                    }
                }
            }
        };

        const onBlur = () => clear();
        const onVisibility = () => {
            if (document.visibilityState !== "visible") clear();
        };

        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("blur", onBlur);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [enabled, navActive, onCommand, timeoutMs, clear]);

    return { clear };
}
