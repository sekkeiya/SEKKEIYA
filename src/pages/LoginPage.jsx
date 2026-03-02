import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";

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

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const returnTo = useMemo(() => getSafeReturnTo(location.search), [location.search]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ 外部URLなら location、同一なら navigate
  const goReturnTo = useCallback(() => {
    if (typeof returnTo === "string" && returnTo.startsWith("http")) {
      window.location.assign(returnTo);
      return;
    }
    navigate(returnTo, { replace: true });
  }, [navigate, returnTo]);

  // ✅ Google redirectで戻ってきた結果を確定（1回だけ）
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await getRedirectResult(auth);
        // res が取れても取れなくてもOK（既にAuth状態は復元されることが多い）
        if (!cancelled && res?.user) {
          // ここで user が確定したケースは即遷移してよい
          goReturnTo();
        }
      } catch (e) {
        // redirect結果が無い/失敗しても、通常は onAuthStateChanged 側で user が入る
        // なので致命ではない
        console.warn("[LoginPage] getRedirectResult failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [goReturnTo]);

  // ✅ これが重要：ログイン済みならこのページに留まらず returnTo へ
  useEffect(() => {
    if (!user) return;
    goReturnTo();
  }, [user, goReturnTo]);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        await signInWithEmailAndPassword(auth, email, password);
        goReturnTo();
      } catch (err) {
        console.error(err);
        setError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
      } finally {
        setLoading(false);
      }
    },
    [email, password, goReturnTo]
  );

  const onGoogleLogin = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      // 任意：追加スコープやパラメータ
      provider.setCustomParameters({ prompt: "select_account" });

      // まず popup を試す（楽）
      await signInWithPopup(auth, provider);
      goReturnTo();
    } catch (e) {
      console.warn("[LoginPage] popup failed, fallback to redirect:", e);

      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(auth, provider);
        // redirectはページ遷移するのでここには戻らない
      } catch (e2) {
        console.error(e2);
        setError("Googleログインに失敗しました。しばらくしてから再度お試しください。");
        setLoading(false);
      }
      return;
    } finally {
      // popup成功時はここで解除されるが、redirectの場合はページが遷移するので問題なし
      setLoading(false);
    }
  }, [goReturnTo]);

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", px: 2, py: 4 }}>
      <Paper elevation={2} sx={{ width: "100%", maxWidth: 420, p: 3, borderRadius: 3 }}>
        <Stack spacing={2.2} component="form" onSubmit={onSubmit}>
          <Box>
            <Typography variant="h5" fontWeight={800}>
              ログイン
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
              SEKKEIYA アカウントでログインします
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {/* ✅ Google */}
          <Button
            type="button"
            variant="outlined"
            size="large"
            onClick={onGoogleLogin}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "GOOGLEでログイン"}
          </Button>

          <Divider sx={{ my: 0.5 }}>または</Divider>

          {/* Email */}
          <TextField
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            fullWidth
            disabled={loading}
          />

          <TextField
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            fullWidth
            disabled={loading}
          />

          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : "ログイン"}
          </Button>

          <Button
            variant="text"
            onClick={() => navigate(`/signup?return_to=${encodeURIComponent(returnTo)}`)}
            disabled={loading}
          >
            アカウント作成はこちら
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}