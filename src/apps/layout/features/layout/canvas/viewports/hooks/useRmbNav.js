import { useEffect, useRef, useState, useCallback } from "react";

export function useRmbNav({ active, onNavActiveChange }) {
    const rmbRef = useRef(false);
    const [isNavActive, setIsNavActive] = useState(false);

    const setRmb = useCallback(
        (next) => {
            const v = !!next;
            if (rmbRef.current === v) return;
            rmbRef.current = v;
            setIsNavActive(v);
            onNavActiveChange?.(v);
        },
        [onNavActiveChange]
    );

    useEffect(() => {
        if (!active) return;
        const up = (e) => e.button === 2 && setRmb(false);
        const blur = () => setRmb(false);
        window.addEventListener("pointerup", up);
        window.addEventListener("blur", blur);
        return () => {
            window.removeEventListener("pointerup", up);
            window.removeEventListener("blur", blur);
        };
    }, [active, setRmb]);

    return { rmbRef, isNavActive, setRmb };
}
