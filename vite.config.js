// vite.config.js (SEKKEIYA)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { 
      "@": path.resolve(__dirname, "./src"),
      "sekkeiya-global-panel": path.resolve(__dirname, "./packages/global-panel/src"),
    },
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
      },

      // 3DSL (5175) を /app/layout 配下に見せる
      "/app/layout": {
        target: "http://localhost:5175",
        changeOrigin: true,
        ws: true,
      },

      // 3DSC (5176) を /app/create 配下に見せる
      "/app/create": {
        target: "http://localhost:5176",
        changeOrigin: true,
        ws: true,
      },

      // 3DSP (5177) を /app/presents 配下に見せる
      "/app/presents": {
        target: "http://localhost:5177",
        changeOrigin: true,
        ws: true,
      },

      // 3DSB (5179) を /app/books 配下に見せる
      "/app/books": {
        target: "http://localhost:5179",
        changeOrigin: true,
        ws: true,
      },

      // 3DSQ (5178) を /app/quest 配下に見せる
      "/app/quest": {
        target: "http://localhost:5178",
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true, // ✅ Clean dist before merging child apps
  },

});