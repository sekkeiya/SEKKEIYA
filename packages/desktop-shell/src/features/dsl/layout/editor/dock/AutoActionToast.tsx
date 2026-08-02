// AutoActionToast.jsx
// 「自動○○」アクション（ボトムバーのホバー実行など）の即時フィードバック。
// useAutoActionStore.toast を監視し、tick が増えるたびに表示し直す。
import { useEffect, useState } from "react";
import { Snackbar, Alert } from "@mui/material";
import { useAutoActionStore, type AutoActionResult } from "../../store/useAutoActionStore";

// store の toast フィールドと同じ形（AutoActionState は非 export のためここで再掲）
type ToastState = { severity: AutoActionResult["severity"]; msg: string; tick: number };

export default function AutoActionToast() {
  const toast = useAutoActionStore((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ToastState | null>(null);

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
      // zIndex: Snackbar の既定は 1400。本番プレビュー（zIndex 2000 の全画面オーバーレイ）から
      // 自動アクションを実行したときに結果が裏に隠れるため、その上に出す。
      sx={{ bottom: { xs: 90, sm: 90 }, zIndex: 2600 }}
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
