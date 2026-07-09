import React from "react";
import ReactDOM from "react-dom/client";

// ✅ PWA: 最小 Service Worker を登録して「インストール可能」にする。
//   → beforeinstallprompt が発火し、ランディングの「アプリとして開きますか？」ダイアログが復活。
//   sw.js は HTML を一切キャッシュしないので、過去の白画面キャッシュ問題は再発しない。
//   （旧・壊れた SW があっても、この新 SW が置き換え＋旧キャッシュ削除で remediate する）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("[sw] register failed:", e);
    });
  });
}

// ✅ デプロイ後の「古い遅延チャンク取得失敗」を自動復旧する。
//   新デプロイでハッシュ付きチャンクが差し替わると、開きっぱなしのタブは
//   削除済みの旧チャンクを import しようとして白画面になる。
//   → 一度だけ自動リロードして最新の index.html を取り直す（ループ防止のセッションガード付き）。
{
  const RELOAD_KEY = "__chunk_reload__";
  const recover = (evt) => {
    try { evt?.preventDefault?.(); } catch { /* noop */ }
    if (sessionStorage.getItem(RELOAD_KEY)) return; // 1回だけ
    try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* noop */ }
    window.location.reload();
  };
  // Vite が遅延 import 失敗時に投げる専用イベント
  window.addEventListener("vite:preloadError", recover);
  // フォールバック: 動的 import 失敗の一般的なエラーも拾う
  const looksLikeChunkError = (m) =>
    /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically imported module/i.test(String(m || ""));
  window.addEventListener("error", (e) => { if (looksLikeChunkError(e?.message)) recover(e); });
  window.addEventListener("unhandledrejection", (e) => { if (looksLikeChunkError(e?.reason?.message || e?.reason)) recover(e); });
  // 正常起動できたらガードを解除（次回デプロイでも再度自動復旧できるように）
  window.addEventListener("load", () => {
    setTimeout(() => { try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* noop */ } }, 8000);
  });
}

import App from "@/app/App";
import './index.css'
import { HelmetProvider } from 'react-helmet-async';

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);