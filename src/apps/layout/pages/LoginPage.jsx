// src/pages/LoginPage.jsx
import React, { useMemo, useState, useCallback } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "@layout/shared/lib/firebase/config";
import { useAuthState } from "@layout/features/auth/useAuthState";

export default function LoginPage() {
  const { isAuthed, isLoading } = useAuthState();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const from = useMemo(() => {
    // PrivateRoute から来たときは state.from に元のパスが入る
    return location.state?.from || "/dashboard";
  }, [location.state]);

  // すでにログインしていたら戻す
  if (!isLoading && isAuthed) return <Navigate to={from} replace />;

  const handleGoogle = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      // 必要なら追加スコープ
      // provider.addScope("email");
      await signInWithPopup(auth, provider);
      // 成功したら上の Navigate により遷移される
    } catch (e) {
      console.error(e);
      setError(normalizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleEmail = useCallback(
    async (e) => {
      e.preventDefault();
      if (busy || isLoading) return;

      const mail = email.trim();
      if (!mail || !password) return;

      setError("");
      setBusy(true);
      try {
        await signInWithEmailAndPassword(auth, mail, password);
      } catch (e2) {
        console.error(e2);
        setError(normalizeAuthError(e2));
      } finally {
        setBusy(false);
      }
    },
    [email, password, busy, isLoading]
  );

  const disabled = busy || isLoading;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>ログイン</h2>
          <p style={{ opacity: 0.78, margin: "10px 0 0", lineHeight: 1.6 }}>
            S.Model のアカウント（Google / メール）でそのままログインできます。
          </p>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={disabled}
          style={{
            ...btnGhost,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.7 : 1,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={googleDot} />
            {busy ? "処理中..." : "Googleでログイン"}
          </span>
        </button>

        <div style={dividerRow}>
          <div style={dividerLine} />
          <div style={dividerText}>または</div>
          <div style={dividerLine} />
        </div>

        {/* Email/Password */}
        <form onSubmit={handleEmail} style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>
            メールアドレス
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              autoComplete="email"
              inputMode="email"
              disabled={disabled}
              style={{
                ...inputStyle,
                opacity: disabled ? 0.7 : 1,
              }}
            />
          </label>

          <label style={labelStyle}>
            パスワード
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              type="password"
              disabled={disabled}
              style={{
                ...inputStyle,
                opacity: disabled ? 0.7 : 1,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={disabled || !email.trim() || !password}
            style={{
              ...btnPrimary,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.7 : 1,
            }}
          >
            {busy ? "処理中..." : "メールでログイン"}
          </button>
        </form>

        {error ? (
          <div style={errorBox}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>ログインに失敗しました</div>
            <div style={{ whiteSpace: "pre-wrap", opacity: 0.95 }}>{error}</div>
          </div>
        ) : null}

        <div style={{ marginTop: 16, opacity: 0.86, fontSize: 13, lineHeight: 1.7 }}>
          アカウント作成は S.Model 側で行います：
          <a
            href="https://3dshapeshare3d.web.app/signup"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#9bb7ff", marginLeft: 6, textDecoration: "none", fontWeight: 800 }}
          >
            S.Modelで新規登録 →
          </a>
        </div>

        <div style={{ marginTop: 10 }}>
          <Link to="/home" style={{ color: "#9bb7ff", textDecoration: "none", fontWeight: 800 }}>
            ← Homeに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

/* =========================
 * styles
 * ========================= */

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  color: "#eaf0ff",
  background:
    "radial-gradient(900px 420px at 25% 15%, rgba(255,255,255,0.10) 0%, transparent 55%), linear-gradient(180deg, #050815 0%, #060a18 100%)",
};

const cardStyle = {
  width: "100%",
  maxWidth: 560,
  padding: 22,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(11,16,32,0.58)",
  backdropFilter: "blur(12px)",
  boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
};

const btnGhost = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "#eaf0ff",
  fontWeight: 800,
};

const btnPrimary = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "#2a68ff",
  color: "white",
  fontWeight: 900,
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  opacity: 0.86,
  fontWeight: 800,
  letterSpacing: 0.2,
};

const inputStyle = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "#eaf0ff",
  outline: "none",
};

const dividerRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 10,
  margin: "16px 0",
};

const dividerLine = {
  height: 1,
  background: "rgba(255,255,255,0.10)",
};

const dividerText = {
  fontSize: 12,
  opacity: 0.65,
  fontWeight: 800,
};

const googleDot = {
  width: 12,
  height: 12,
  borderRadius: 999,
  background:
    "conic-gradient(from 180deg, #34a853, #4285f4, #ea4335, #fbbc05, #34a853)",
  boxShadow: "0 0 0 3px rgba(255,255,255,0.06)",
};

const errorBox = {
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,120,120,0.35)",
  background: "rgba(255,0,0,0.08)",
  color: "#ffd4d4",
};

/* =========================
 * helpers
 * ========================= */

function normalizeAuthError(e) {
  const code = e?.code || "";
  switch (code) {
    case "auth/unauthorized-domain":
      return (
        "このドメインが Firebase Auth の承認済みドメインに入っていません（unauthorized-domain）。\n" +
        "Firebase Console > Authentication > 設定 > 承認済みドメイン を確認してください。"
      );
    case "auth/popup-closed-by-user":
      return "ログインがキャンセルされました（ポップアップが閉じられました）。";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。しばらく待ってから再試行してください。";
    case "auth/network-request-failed":
      return "ネットワークエラーです。通信状態を確認して再試行してください。";
    default:
      return e?.message || "ログインに失敗しました。";
  }
}
