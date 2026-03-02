// vite.config.js (SEKKEIYA)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },

  server: {
    port: 5173,
    strictPort: true,

    proxy: {
      // 3DSS (5174) を /app/share 配下に見せる
      "/app/share": {
        target: "http://localhost:5174",
        changeOrigin: true,
        ws: true,
        // ✅ /app/share を剥がして 5174 の / に渡す
        rewrite: (p) => p.replace(/^\/app\/share/, ""),
      },

      // 3DSL (5175) を /app/layout 配下に見せる
      "/app/layout": {
        target: "http://localhost:5175",
        changeOrigin: true,
        ws: true,
        // ✅ /app/layout を剥がして 5175 の / に渡す
        rewrite: (p) => p.replace(/^\/app\/layout/, ""),
      },
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: false, // ✅ dist/app/* を消さない
  },

});