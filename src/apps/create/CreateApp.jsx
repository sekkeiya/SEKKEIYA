import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { ErrorBoundary } from "@create/shared/components/ErrorBoundary";
import FurnitureDashboard from "@create/pages/FurnitureDashboard";
import CreateDashboardPage from "@create/pages/create/CreateDashboardPage";

// AppLayout/ProtectedRouteは廃止 — 親(main App.jsx)のAppLayoutが提供する
export default function CreateApp() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        {/* dashboard = 家具ブラウザ (Desktop版 DscDashboard に対応) */}
        <Route path="dashboard"   element={<FurnitureDashboard />} />
        <Route path="dashboard/*" element={<FurnitureDashboard />} />
        {/* studio = AI造作生成 (Desktop版 DscStudio に対応) */}
        <Route path="studio"      element={<CreateDashboardPage />} />
        <Route path="studio/*"    element={<CreateDashboardPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
