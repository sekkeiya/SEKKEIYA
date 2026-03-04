import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { signOut, deleteUser } from "firebase/auth";
import { auth } from "@/shared/config/firebase";
import { BRAND } from "./theme";

export default function DeleteAccountDialog({ open, onClose, user }) {
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteAccount = useCallback(async () => {
    if (!user) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteUser(auth.currentUser);
      window.location.assign("/");
    } catch (e) {
      console.error("[DeleteAccountDialog] deleteUser failed:", e);
      if (e.code === "auth/requires-recent-login") {
        setDeleteError("セキュリティのため、再度ログインしてからアカウントを削除してください。");
        setTimeout(async () => {
          await signOut(auth);
          window.location.assign("/");
        }, 3000);
      } else {
        setDeleteError("アカウント削除に失敗しました: " + e.message);
        setDeleteLoading(false);
      }
    }
  }, [user]);

  const handleClose = useCallback(() => {
    if (!deleteLoading) {
      onClose();
    }
  }, [deleteLoading, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        style: {
          backgroundColor: BRAND.bg,
          color: BRAND.text,
          border: `1px solid ${BRAND.line}`,
          borderRadius: 12,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>アカウントの削除</DialogTitle>
      <DialogContent>
        {deleteError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {deleteError}
          </Alert>
        )}
        <DialogContentText sx={{ color: BRAND.sub, mb: 1 }}>
          本当にアカウントを削除しますか？<br />
          この操作は取り消すことができず、すべてのデータが完全に削除されます。
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button
          onClick={handleClose}
          disabled={deleteLoading}
          sx={{ color: BRAND.sub }}
        >
          キャンセル
        </Button>
        <Button
          onClick={handleDeleteAccount}
          color="error"
          variant="contained"
          disabled={deleteLoading}
          startIcon={deleteLoading ? <CircularProgress size={16} /> : null}
          sx={{
            bgcolor: "#d32f2f",
            "&:hover": { bgcolor: "#c62828" },
          }}
        >
          削除する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
