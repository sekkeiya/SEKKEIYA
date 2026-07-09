// AutoActionToast.jsx
// 「自動○○」アクション（ボトムバーのホバー実行など）の即時フィードバック。
// useAutoActionStore.toast を監視し、tick が増えるたびに表示し直す。
import React, { useEffect, useState } from "react";
import { Snackbar, Alert } from "@mui/material";
import { useAutoActionStore } from "../../store/useAutoActionStore";

export default function AutoActionToast() {
  const toast = useAutoActionStore((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    setOpen(true);
  }, [toast?.tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ bottom: { xs: 90, sm: 90 } }}
    >
      <Alert
        severity={shown?.severity || "info"}
        variant="filled"
        onClose={() => setOpen(false)}
        sx={{ fontSize: 12.5 }}
      >
        {shown?.msg}
      </Alert>
    </Snackbar>
  );
}
