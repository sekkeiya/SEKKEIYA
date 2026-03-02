import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import LogoutPage from "./pages/LogoutPage";

/**
 * DevOnlyExternalRedirect
 * - Vite dev (localhost:517x) では Firebase Hosting の rewrite が効かない
 * - /app/share など “Hosting側で配信する別SPA” は Hosting Emulator にフル遷移させる
 *
 * 本番では /app/share/** は Hosting が 3DSS の index.html を返すので、
 * このコンポーネントが実行されるケースは基本ない（= OK）。
 */
function DevOnlyExternalRedirect({ toOrigin, matchPrefix }) {
  const loc = useLocation();

  useEffect(() => {
    // ✅ Vite dev判定（確実）
    const isViteDev = import.meta?.env?.DEV;
    if (!isViteDev) return;

    // ✅ 意図したパスだけリダイレクト（事故防止）
    if (!loc.pathname.startsWith(matchPrefix)) return;

    const target = `${toOrigin}${loc.pathname}${loc.search}${loc.hash}`;
    window.location.assign(target);
  }, [loc.pathname, loc.search, loc.hash, toOrigin, matchPrefix]);

  return null;
}

export default function App() {
  // ✅ あなたのEmulatorは5002（スクショ）
  const HOSTING_ORIGIN = "http://127.0.0.1:5000";

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/logout" element={<LogoutPage />} />

      {/* ✅ 重要：/app/share を * で潰さない */}
      <Route
        path="/app/share/*"
        element={
          <DevOnlyExternalRedirect
            toOrigin={HOSTING_ORIGIN}
            matchPrefix="/app/share"
          />
        }
      />

      {/* （将来）layout/presents も同様に */}
      <Route
        path="/app/layout/*"
        element={
          <DevOnlyExternalRedirect
            toOrigin={HOSTING_ORIGIN}
            matchPrefix="/app/layout"
          />
        }
      />
      <Route
        path="/app/presents/*"
        element={
          <DevOnlyExternalRedirect
            toOrigin={HOSTING_ORIGIN}
            matchPrefix="/app/presents"
          />
        }
      />

      {/* ✅ 404は / に戻してOK（ただし /app/... は上で捕まえる） */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}