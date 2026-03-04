import React from "react";
import ReactDOM from "react-dom/client";

// ✅ 過去の Service Worker が残っている場合は強制解除（白画面キャッシュ対策）
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let r of registrations) r.unregister();
  });
}

import App from "@/app/App";
import './index.css'

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);