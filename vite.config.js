import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";


// Embedded desktop shell (packages/desktop-shell) — Tauri-native modules are
// replaced with web-safe stubs so the same source runs in the browser.
const tauriShim = (name) =>
  path.resolve(__dirname, `./packages/desktop-shell/src/tauri-shims/${name}.ts`);

// Desktop-only heavy libs（オンデバイスML・3D CAD）は Web では動的 import() が到達しないため
// 空スタブへ振ってビルドを通す（Web 版に不要な巨大バンドルを含めない）。
const nativeEmptyStub = tauriShim("native-empty");

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "firebase",
        "@firebase/app",
        "@firebase/firestore",
        "@firebase/auth",
        "zustand",
        "react-router-dom",
        "@emotion/react",
        "@emotion/styled",
        "@mui/material",
        "three",
        "@react-three/fiber",
        "framer-motion",
      ],
      alias: {
        // Desktop shell package source
        "@desktop": path.resolve(__dirname, "./packages/desktop-shell/src"),

        // ── Tauri web stubs (must precede "@" so they win for @tauri-apps/*) ──
        "@tauri-apps/api/core": tauriShim("api-core"),
        "@tauri-apps/api/app": tauriShim("api-app"),
        "@tauri-apps/api/event": tauriShim("api-event"),
        "@tauri-apps/api/window": tauriShim("api-window"),
        "@tauri-apps/api/webviewWindow": tauriShim("api-webviewWindow"),
        "@tauri-apps/api/path": tauriShim("api-path"),
        "@tauri-apps/plugin-fs": tauriShim("plugin-fs"),
        "@tauri-apps/plugin-dialog": tauriShim("plugin-dialog"),
        "@tauri-apps/plugin-shell": tauriShim("plugin-shell"),
        "@tauri-apps/plugin-opener": tauriShim("plugin-opener"),
        "@tauri-apps/plugin-global-shortcut": tauriShim("plugin-global-shortcut"),
        "@tauri-apps/plugin-notification": tauriShim("plugin-notification"),
        "@tauri-apps/plugin-deep-link": tauriShim("plugin-deep-link"),

        // ── Desktop-only heavy libs → 空スタブ（Web では未到達の動的import） ──
        "@huggingface/transformers": nativeEmptyStub,
        "rhino3dm": nativeEmptyStub,

        "@": path.resolve(__dirname, "./src"),
        "@sekkeiya/global-panel": path.resolve(__dirname, "./packages/global-panel/src"),
        // Sub-app aliases (replaces each app's own "@" alias)
        "@layout": path.resolve(__dirname, "./src/apps/layout"),
        "@create": path.resolve(__dirname, "./src/apps/create"),
        "@presents": path.resolve(__dirname, "./src/apps/presents"),
        "@share": path.resolve(__dirname, "./src/apps/share"),
      },
    },
    optimizeDeps: {
      exclude: ["@sekkeiya/global-panel"],
      include: [
        "react",
        "react-dom/client",
        "react-router-dom",
        "@mui/material",
        "@mui/icons-material",
        "@emotion/react",
        "@emotion/styled",
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "zustand"
      ]
    },

    server: {
      port: 5173,
      strictPort: true,
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});