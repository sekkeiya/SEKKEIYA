import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { theme } from "./shared/styles/theme";
import { AuthProvider } from "@layout/features/auth/AuthContext";
import "./shared/styles/global.css";

// Initialize the global panel singleton with our Firestore instance
import { db } from "@layout/shared/lib/firebase/config";
import { setGlobalDb } from "@sekkeiya/global-panel";
setGlobalDb(db);


const isDev = import.meta.env.DEV;

// ✅ 古い Service Worker が残っていてキャッシュ事故（真っ白画面）を防ぐための強制解除
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch((err) => console.log("SW unregister failed", err));
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename="/app/layout/">
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
