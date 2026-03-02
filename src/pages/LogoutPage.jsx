// src/pages/LogoutPage.jsx
import React, { useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/config/firebase/config";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      try {
        await signOut(auth);
      } finally {
        window.location.assign("/");
      }
    })();
  }, []);

  return null;
}