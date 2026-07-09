// PwaInstallProvider — 「ダッシュボードへ」等のアプリ入口を押したときに
// 「アプリとして開く（独立ウィンドウ＝ブラウザのバーなし）／ブラウザで続ける」を
// 選ばせるダイアログを提供する。
//
// 仕組み:
//   - index.html の早期スクリプトが `beforeinstallprompt` を捕まえて
//     window.__deferredInstallPrompt に保持し、'pwa:installable' を発火する。
//   - インストール可能（Chromium かつ未導入）なときだけ選択ダイアログを出す。
//     非対応ブラウザ / 既に導入済み / 既にスタンドアロン起動中 はそのまま /workspace へ。
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Button, FormControlLabel, Checkbox, Box,
} from "@mui/material";

const Ctx = createContext(null);
const DISMISS_KEY = "sekkeiya:pwa-install-dismissed";
const APP_TARGET = "/workspace";

function detectStandalone() {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.matchMedia?.("(display-mode: minimal-ui)")?.matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

export function PwaInstallProvider({ children }) {
  const navigate = useNavigate();
  const [canInstall, setCanInstall] = useState(() => !!window.__deferredInstallPrompt);
  const [isStandalone, setIsStandalone] = useState(detectStandalone());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);

  useEffect(() => {
    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => { setCanInstall(false); setDialogOpen(false); };
    window.addEventListener("pwa:installable", onInstallable);
    window.addEventListener("pwa:installed", onInstalled);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onDisplay = () => setIsStandalone(detectStandalone());
    mq?.addEventListener?.("change", onDisplay);
    return () => {
      window.removeEventListener("pwa:installable", onInstallable);
      window.removeEventListener("pwa:installed", onInstalled);
      mq?.removeEventListener?.("change", onDisplay);
    };
  }, []);

  const goWorkspace = useCallback(() => navigate(APP_TARGET), [navigate]);

  // 主要CTAから呼ぶ。原則として常に選択ダイアログを出す。
  //   - 既にスタンドアロン起動中（=アプリ内）ならダイアログ不要 → そのまま遷移
  //   - 「次回から表示しない」を選んだユーザーはそのまま遷移
  // それ以外は canInstall の真偽に関わらずダイアログ表示。
  //   canInstall=true  → 本物のインストールプロンプト
  //   canInstall=false → 既にインストール済み/非対応。起動方法を案内（ブラウザ継続も可）
  const requestGoToApp = useCallback(() => {
    if (isStandalone) return goWorkspace();
    if (localStorage.getItem(DISMISS_KEY) === "1") return goWorkspace();
    setDialogOpen(true);
  }, [isStandalone, goWorkspace]);

  const handleInstall = useCallback(async () => {
    const ev = window.__deferredInstallPrompt;
    setDialogOpen(false);
    if (!ev) return goWorkspace();
    try {
      ev.prompt();
      await ev.userChoice; // accepted / dismissed どちらでも続行
    } catch {
      /* noop */
    }
    window.__deferredInstallPrompt = null;
    setCanInstall(false);
    goWorkspace();
  }, [goWorkspace]);

  const handleContinue = useCallback(() => {
    if (dontAsk) {
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    }
    setDialogOpen(false);
    goWorkspace();
  }, [dontAsk, goWorkspace]);

  return (
    <Ctx.Provider value={{ canInstall, isStandalone, requestGoToApp }}>
      {children}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: "#111", color: "#fff", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          どちらで開きますか？
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <DialogContentText sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.5 }}>
            {canInstall
              ? "「Webアプリで開く」を選ぶと、ブラウザのバーが消えた独立ウィンドウで起動します。"
              : "アプリはインストール済みです。独立ウィンドウで使うにはアドレスバーの「アプリで開く」からも起動できます。"}
          </DialogContentText>

          {/* ボタン群（説明文より大きく目立たせる） */}
          <Box sx={{ mt: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Button
              onClick={handleInstall}
              variant="contained"
              fullWidth
              sx={{
                textTransform: "none", fontWeight: 800, fontSize: 16, py: 1.7, borderRadius: 2,
                background: "linear-gradient(135deg,#7C3AED,#2563EB)",
                "&:hover": { background: "linear-gradient(135deg,#6D28D9,#1D4ED8)" },
              }}
            >
              Webアプリで開く
            </Button>
            <Button
              onClick={handleContinue}
              variant="outlined"
              fullWidth
              sx={{
                textTransform: "none", fontWeight: 700, fontSize: 15, py: 1.4, borderRadius: 2,
                color: "#fff", borderColor: "rgba(255,255,255,0.25)",
                "&:hover": { borderColor: "rgba(255,255,255,0.5)", bgcolor: "rgba(255,255,255,0.05)" },
              }}
            >
              ブラウザで続ける
            </Button>
          </Box>

          <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={dontAsk}
                  onChange={(e) => setDontAsk(e.target.checked)}
                  sx={{ color: "rgba(255,255,255,0.5)", "&.Mui-checked": { color: "#7C3AED" } }}
                />
              }
              label={<span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>次回から表示しない</span>}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function usePwaInstall() {
  return (
    useContext(Ctx) || {
      canInstall: false,
      isStandalone: false,
      // プロバイダ外フォールバック（通常到達しない）
      requestGoToApp: () => { window.location.assign(APP_TARGET); },
    }
  );
}
