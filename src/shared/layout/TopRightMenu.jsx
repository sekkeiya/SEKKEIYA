import React, { useState, useCallback } from "react";
import { Box, Button } from "@mui/material";
import { signOut } from "firebase/auth";
import { auth } from "@/shared/config/firebase";
import { BRAND } from "../ui/theme";
import DeleteAccountDialog from "../ui/DeleteAccountDialog";

export default function TopRightMenu({ user, onDashboardClick }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loginUrl = "https://sekkeiya.com/login?return_to=%2Fdashboard";
  const signupUrl = "https://sekkeiya.com/signup?return_to=%2Fdashboard";

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
