import React, { useState, useCallback } from "react";
import { Box, Button } from "@mui/material";
import { signOut } from "firebase/auth";
import { auth } from "@/shared/config/firebase";
import { BRAND } from "../ui/theme";
import DeleteAccountDialog from "../ui/DeleteAccountDialog";

// 公式アカウントは hello@sekkeiya.com のみ。これ以外は Admin ボタン/管理画面へ遷移できない。
const ADMIN_EMAILS = [
  "hello@sekkeiya.com",
];

export function checkIsAdmin(user) {
  if (!user) return false;
  const adminUids = (import.meta.env.VITE_ADMIN_UIDS || "")
    .split(",").map(u => u.trim()).filter(Boolean);
  return (adminUids.length > 0 && adminUids.includes(user.uid))
    || ADMIN_EMAILS.includes(user.email);
}

export default function TopRightMenu({ user, onDashboardClick }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loginUrl = "/login?return_to=%2Fdashboard";
  const signupUrl = "/signup?return_to=%2Fdashboard";

  const onLogout = useCallback(async () => {
    try {
      await signOut(auth);
      window.location.assign("/");
    } catch (e) {
      console.error("[TopRightMenu] signOut failed:", e);
      window.location.assign("/");
    }
  }, []);

  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: { xs: 10, sm: 16 },
          right: { xs: 10, sm: 16 },
          display: "flex",
          gap: 1,
          zIndex: 20,
        }}
      >
        {user ? (
          <>
            {checkIsAdmin(user) && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => window.location.assign("/admin")}
                sx={{
                  color: "#c084fc",
                  borderColor: "rgba(192,132,252,0.45)",
                  bgcolor: "rgba(192,132,252,0.08)",
                  borderRadius: 999,
                  px: { xs: 1.4, sm: 2 },
                  minWidth: 0,
                  fontWeight: 700,
                  "&:hover": {
                    bgcolor: "rgba(192,132,252,0.15)",
                    borderColor: "#c084fc",
                  },
                }}
              >
                Admin
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={onDashboardClick}
              sx={{
                color: BRAND.text,
                borderColor: BRAND.line,
                bgcolor: "rgba(255,255,255,0.04)",
                borderRadius: 999,
                px: { xs: 1.4, sm: 2 },
                minWidth: 0,
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.08)",
                  borderColor: BRAND.line,
                },
              }}
            >
              ダッシュボード
            </Button>

            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => setDeleteDialogOpen(true)}
              sx={{
                color: "#f44336",
                borderColor: "rgba(244, 67, 54, 0.5)",
                bgcolor: "rgba(244, 67, 54, 0.05)",
                borderRadius: 999,
                px: { xs: 1.4, sm: 2 },
                minWidth: 0,
                "&:hover": {
                  bgcolor: "rgba(244, 67, 54, 0.1)",
                  borderColor: "#f44336",
                },
              }}
            >
              アカウント削除
            </Button>

            <Button
              variant="contained"
              size="small"
              onClick={onLogout}
              sx={{
                color: "#0b0f16",
                bgcolor: "rgba(255,255,255,0.88)",
                borderRadius: 999,
                px: { xs: 1.4, sm: 2 },
                minWidth: 0,
                "&:hover": { bgcolor: "rgba(255,255,255,0.95)" },
              }}
            >
              ログアウト
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={() => window.location.assign(loginUrl)}
              sx={{
                color: BRAND.text,
                borderColor: BRAND.line,
                bgcolor: "rgba(255,255,255,0.04)",
                borderRadius: 999,
                px: { xs: 1.4, sm: 2 },
                minWidth: 0,
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.08)",
                  borderColor: BRAND.line,
                },
              }}
            >
              サインイン
            </Button>

            <Button
              variant="contained"
              size="small"
              onClick={() => window.location.assign(signupUrl)}
              sx={{
                color: "#0b0f16",
                bgcolor: "rgba(255,255,255,0.88)",
                borderRadius: 999,
                px: { xs: 1.4, sm: 2 },
                minWidth: 0,
                "&:hover": { bgcolor: "rgba(255,255,255,0.95)" },
              }}
            >
              サインアップ
            </Button>
          </>
        )}
      </Box>

      {/* ===== Delete Account Dialog ===== */}
      <DeleteAccountDialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)} 
        user={user} 
      />
    </>
  );
}
