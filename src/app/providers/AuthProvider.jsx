import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/shared/config/firebase";
import { AuthContext } from "@/features/auth/context/AuthContext";
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthLoading(false);

      if (u) {
        localStorage.setItem("sekkeiya_auth_state", "1");
      } else {
        localStorage.removeItem("sekkeiya_auth_state");
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({ user, authLoading }), [user, authLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
