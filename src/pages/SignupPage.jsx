import React, { useMemo, useState, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  linkWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth, db } from "@/shared/config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = useMemo(() => getSafeReturnTo(location.search), [location.search]);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      const goReturnTo = () => {
        if (typeof returnTo === "string" && (returnTo.startsWith("http") || returnTo.startsWith("/app/"))) {
          window.location.assign(returnTo);
          return;
        }
        navigate(returnTo, { replace: true });
      };

      const saveUserDoc = async (u) => {
        try {
          await setDoc(
            doc(db, "users", u.uid),
            {
              uid: u.uid,
              email: u.email,
              displayName: username || u.displayName || "",
              createdAt: serverTimestamp(),
              app: "sekkeiya",
            },
            { merge: true }
          );
        } catch (e2) {
          console.warn("[Signup] failed to create users doc:", e2);
        }
      };

      const sendVerification = async (u) => {
        try {
          await sendEmailVerification(u, {
            url: `${window.location.origin}/app/share/auth/verify-finish`,
            handleCodeInApp: false,
          });
        } catch (e3) {
          console.warn("[Signup] failed to send verification email:", e3);
        }
      };

      try {
        // ゲスト（匿名）ユーザーの場合はアカウント連携（データ引き継ぎ）
        if (auth.currentUser?.isAnonymous) {
          const credential = EmailAuthProvider.credential(email, password);
          try {
            await linkWithCredential(auth.currentUser, credential);
            if (username) {
              await updateProfile(auth.currentUser, { displayName: username });
            }
            await saveUserDoc(auth.currentUser);
            await sendVerification(auth.currentUser);
            goReturnTo();
            return;
          } catch (linkErr) {
            if (
              linkErr.code === "auth/credential-already-in-use" ||
              linkErr.code === "auth/email-already-in-use"
            ) {
              setError(
                "このメールアドレスは既に別のアカウントで使われています。ログインページからログインしてください。"
              );
            } else {
              throw linkErr;
            }
            setLoading(false);
            return;
          }
        }

        // 通常の新規アカウント作成
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (username) {
          await updateProfile(cred.user, { displayName: username });
        }
        await saveUserDoc(cred.user);
        await sendVerification(cred.user);
        goReturnTo();
      } catch (err) {
        console.error(err);
        setError(
          "アカウント作成に失敗しました。メールアドレスが既に使われている可能性があります。"
        );
      } finally {
        setLoading(false);
      }
    },
    [email, password, username, navigate, returnTo]
  );

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 64px)",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 4,
      }}
    >
      <Paper elevation={2} sx={{ width: "100%", maxWidth: 420, p: 3, borderRadius: 3 }}>
        <Stack spacing={2.2} component="form" onSubmit={onSubmit}>
          <Box>
            <Typography variant="h5" fontWeight={800}>
              アカウント作成
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
              SEKKEIYA アカウントを作成します
            </Typography>
          </Box>

          {auth.currentUser?.isAnonymous && (
            <Alert severity="info">
              ゲストとして使用中のデータはそのまま引き継がれます。
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="ユーザー名（任意）"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="nickname"
            fullWidth
          />

          <TextField
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            fullWidth
          />

          <TextField
            label="パスワード（6文字以上）"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            fullWidth
          />

          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : "作成して続行"}
          </Button>

          <Button
            variant="text"
            onClick={() => {
              const to = `/login?return_to=${encodeURIComponent(returnTo)}`;
              navigate(to);
            }}
            disabled={loading}
          >
            すでにアカウントを持っています
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}