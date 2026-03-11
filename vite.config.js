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
        target: "http://127.0.0.1:5174",
        changeOrigin: true,
        ws: true,
      },

      // 3DSL (5175) を /app/layout 配下に見せる
      "/app/layout": {
        target: "http://127.0.0.1:5175",
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: false, // ✅ dist/app/* を消さない
  },

});