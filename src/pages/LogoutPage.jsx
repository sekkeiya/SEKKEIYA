// src/pages/LogoutPage.jsx
import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/shared/config/firebase";

// ✅ return_to を安全に解釈する（open redirect対策）
const getSafeReturnTo = (search) => {
  const params = new URLSearchParams(search);
  const rt = params.get("return_to") || "/";

  // 1) 同一オリジンのパスはOK
  if (rt.startsWith("/")) return rt;

  // 2) フルURLは許可originだけ通す（DEV含む）
  const allowedOrigins = new Set([
    window.location.origin, // SEKKEIYA自身（本番/開発）
    "http://localhost:5000", // 3DSS dev
    "http://localhost:5175", // SEKKEIYA dev（念のため）
  ]);

  try {
    const u = new URL(rt);
    if (allowedOrigins.has(u.origin)) return u.toString();
  } catch {}

  return "/";
};

export default function LogoutPage() {
  const location = useLocation();

  useEffect(() => {
    (async () => {
      const returnTo = getSafeReturnTo(location.search);
      try {
        await signOut(auth);
      } finally {
        window.location.assign(returnTo);
      }
    })();
  }, [location.search]);

  return null;
}