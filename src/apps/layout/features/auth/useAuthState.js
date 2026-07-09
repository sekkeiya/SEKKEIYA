import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@layout/shared/lib/firebase/config";

export function useAuthState() {
    const [user, setUser] = useState(undefined);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
        return () => unsub();
    }, []);

    return {
        user,
        isLoading: user === undefined,
        isAuthed: !!user,
    };
}
