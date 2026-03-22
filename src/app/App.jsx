import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/app/providers/AuthProvider";
import LandingLayout from "@/shared/layout/LandingLayout";
import AppLayout from "@/shared/layout/AppLayout";
import LandingPage from "@/pages/LandingPage";
import DashboardHome from "@/pages/DashboardHome";
import ProjectHomePlaceholder from "@/pages/ProjectHomePlaceholder";
import DrivePage from "@/features/drive/DrivePage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import LogoutPage from "@/pages/LogoutPage";
import ProjectBoardIframePage from "@/pages/ProjectBoardIframePage";
import BoardManagementPage from "@/pages/BoardManagementPage";
import ConnectionsPage from "@/pages/ConnectionsPage";

// 外部 (3DSS等) へのリダイレクト。
// React RouterのSPA遷移を抜け出してハードリロードすることで、
// ViteのプロキシやFirebase HostingのRewriteを発火させる。
function ExternalAppRedirect({ matchPrefix }) {
  const loc = useLocation();

  useEffect(() => {
    if (!loc.pathname.startsWith(matchPrefix)) return;
    
    // 無限リロード防止（3DSSなどの別サーバーがダウンしている場合への対策）
    const storageKey = "redir_count_" + matchPrefix;
    const count = parseInt(sessionStorage.getItem(storageKey) || "0", 10);
    
    if (count > 1) {
      // 一定回数以上リロードが続いたらエラーメッセージを表示して停止
      document.body.innerHTML = `
        <div style="font-family: sans-serif; padding: 40px; text-align: center; color: #fff; background: #111; min-height: 100vh;">
          <h2>⚠️ サーバー接続エラー</h2>
          <p><strong>${matchPrefix}</strong> に対応する開発サーバー（例：3DSSのポート5174）が起動していません。</p>
          <p>別のターミナルで該当アプリの <code>npm run dev</code> を立ち上げてから、リロードしてください。</p>
          <button onclick="sessionStorage.removeItem('${storageKey}'); window.location.reload();" style="margin-top:20px; padding: 10px 20px; cursor: pointer;">再試行</button>
        </div>
      `;
      return;
    }
    
    sessionStorage.setItem(storageKey, count + 1);

    // クエリパラメータから _sw_reload 等のゴミを消して純粋なURLにする
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.location.assign(cleanUrl);
  }, [loc.pathname, loc.hash, matchPrefix]);

  return null;
}

export default function App() {
  // ✅ あなたのEmulatorは5002（スクショ）
  const HOSTING_ORIGIN = "http://127.0.0.1:5000";

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing Pages */}
          <Route path="/" element={<LandingLayout />}>
            <Route index element={<LandingPage />} />
          </Route>

          {/* Dashboard App Pages */}
          <Route path="/dashboard" element={<AppLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="drive" element={<DrivePage />} />
            <Route path="projects/:id" element={<ProjectHomePlaceholder />} />
            <Route path="boards" element={<BoardManagementPage />} />
            <Route path="connections" element={<ConnectionsPage />} />
          </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/logout" element={<LogoutPage />} />

      {/* Embedded Project Board for cross-app iframe sharing */}
      <Route path="/embed/board/:boardId" element={<ProjectBoardIframePage />} />

      {/* ✅ 重要：/app/share を * で潰さない */}
      <Route
        path="/app/share/*"
        element={<ExternalAppRedirect matchPrefix="/app/share" />}
      />

      {/* （将来）layout/presents も同様に */}
      <Route
        path="/app/layout/*"
        element={<ExternalAppRedirect matchPrefix="/app/layout" />}
      />
      <Route
        path="/app/presents/*"
        element={<ExternalAppRedirect matchPrefix="/app/presents" />}
      />

      {/* ✅ 404は / に戻してOK（ただし /app/... は上で捕まえる） */}
      <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}