import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

const LayoutApp       = lazy(() => import("@/apps/layout/LayoutApp"));
const CreateApp       = lazy(() => import("@/apps/create/CreateApp"));
const PresentsApp     = lazy(() => import("@/apps/presents/PresentsApp"));
const ShapeSearchApp  = lazy(() => import("@/apps/share/ShapeSearchApp"));

// Embedded desktop shell — full post-login parity with the Tauri desktop app.
const DesktopShellWeb = lazy(() => import("@desktop/DesktopShellWeb"));
import RequireAuth from "@/app/guards/RequireAuth";
import { db, storage } from "@/shared/config/firebase";
import { setGlobalDb, setGlobalStorage } from "@sekkeiya/global-panel";

// ✅ 起動時に一回だけ Global DB/Storage を初期化
setGlobalDb(db);
setGlobalStorage(storage);
import { AuthProvider } from "@/app/providers/AuthProvider";
import { ProjectProvider } from "@/app/providers/ProjectProvider";
import { PwaInstallProvider } from "@/shared/pwa/PwaInstallProvider";
import LandingLayout from "@/shared/layout/LandingLayout";
import AppLayout from "@/shared/layout/AppLayout";
import SubAppShell from "@/shared/layout/SubAppShell";
import LandingPage from "@/pages/LandingPage";
import ProductLP from "@/pages/ProductLP";
import PublishedSitePage from "@/pages/PublishedSitePage";
import DemoEntryPage from "@/pages/DemoEntryPage";
import ClipPage from "@/pages/ClipPage";
import AboutPage from "@/pages/AboutPage";
import ServicesPage from "@/pages/ServicesPage";
import DashboardHome from "@/pages/DashboardHome";
import ProjectWebsiteLayout from "@/pages/project-website/ProjectWebsiteLayout";
import DrivePage from "@/features/drive/DrivePage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import LogoutPage from "@/pages/LogoutPage";

import ProjectManagementPage from "@/pages/ProjectManagementPage";
import ConnectionsPage from "@/pages/ConnectionsPage";

import PublicMarketplace from "@/pages/PublicMarketplace";
import InOSMarketplace from "@/pages/InOSMarketplace";
import GalleryPage from "@/pages/GalleryPage";
import VisionPage from "@/pages/VisionPage";
import PricingPage from "@/pages/PricingPage";

// Phase 13 Articles & Admin implementation imports
import ArticlesListPage from "@/pages/ArticlesListPage";
import ArticleDetailPage from "@/pages/ArticleDetailPage";
import CommunityArticlePage from "@/pages/CommunityArticlePage";
import BlogArticleBySlugPage from "@/pages/BlogArticleBySlugPage";

import AdminLayout from "@/shared/layout/AdminLayout";
import AdminGuard from "@/shared/components/guards/AdminGuard";
import GuestUpgradeBanner from "@/shared/components/auth/GuestUpgradeBanner";
import OnboardingOverlay from "@/features/onboarding/OnboardingOverlay";
// ✅ 記事/コンテンツ戦略/カテゴリの管理はデスクトップ版 S.Blog（公式ブログモード）へ集約。
// Web admin からは撤去済み（AdminArticlesList / AdminArticleEditor / AdminStrategyPage / AdminCategoriesPage）。
import AdminChat from "@/pages/admin/AdminChat";
import AdminDonationsPage from "@/pages/admin/AdminDonationsPage";
import AdminRevenuePage from "@/pages/admin/AdminRevenuePage";
import TokushohoPage from "@/pages/legal/TokushohoPage";
import PrivacyPolicyPage from "@/pages/legal/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/legal/TermsOfServicePage";
import SupportPage from "@/pages/SupportPage";

const AppLoading = () => null;

// 単一セグメント `/:handle`。`@user` = 公開アカウントサイト（マーケ用 chrome なし）。
// それ以外は従来どおり製品 LP（LandingLayout の chrome 付き）。
function TopSlug() {
  const { handle } = useParams();
  if ((handle || "").startsWith("@")) return <PublishedSitePage kind="account" />;
  return <LandingLayout><ProductLP /></LandingLayout>;
}

// 2 セグメント `/:handle/:projectSlug`。`@user/slug` = 公開プロジェクトサイト。
function TopSlugProject() {
  const { handle } = useParams();
  if ((handle || "").startsWith("@")) return <PublishedSitePage kind="project" />;
  return <Navigate to="/" replace />;
}

export default function App() {
  // ✅ あなたのEmulatorは5002（スクショ）
  const HOSTING_ORIGIN = "http://127.0.0.1:5000";

  return (
    <AuthProvider>
      <BrowserRouter>
        <ProjectProvider>
          <PwaInstallProvider>
          <Routes>
            {/* Landing Pages */}
            <Route path="/" element={<LandingLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="articles" element={<ArticlesListPage />} />
              <Route path="articles/u/:uid/:slug" element={<CommunityArticlePage />} />
              <Route path="articles/:slug" element={<ArticleDetailPage />} />
              <Route path="marketplace" element={<PublicMarketplace />} />
              {/* 製品LP（子アプリ1つにつき1枚）。/products 単体は Marketplace（全製品一覧）へ */}
              <Route path="products" element={<Navigate to="/marketplace" replace />} />
              <Route path="products/:slug" element={<ProductLP />} />
              <Route path="gallery" element={<GalleryPage />} />
              <Route path="vision" element={<VisionPage />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="legal/privacy" element={<PrivacyPolicyPage />} />
              <Route path="legal/terms" element={<TermsOfServicePage />} />
              <Route path="legal/tokushoho" element={<TokushohoPage />} />
            </Route>

            {/* Sandbox / DEMO Entry */}
            <Route path="/demo" element={<DemoEntryPage />} />
            <Route path="/demo/:appId" element={<DemoEntryPage />} />

            {/* S.Library ブックマーク受信（ブラウザ拡張のポップアップが開く） */}
            <Route path="/clip" element={<ClipPage />} />

            {/* ===== 旧Webダッシュボード/プロジェクトUIは廃止 =====
                ログイン後は Desktop 版と完全一致させるため、旧 AppLayout 系
                (`/dashboard`, `/projects`) を desktop-shell (`/workspace`) へ集約。
                各所の navigate('/dashboard') / navigate('/projects') もここで吸収される。
                旧UIに戻したい場合は下の Navigate を元の <Route element={<AppLayout/>}> 群へ戻す。 */}
            <Route path="/dashboard/*" element={<Navigate to="/workspace" replace />} />
            <Route path="/projects/*" element={<Navigate to="/workspace" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/logout" element={<LogoutPage />} />

            {/* ✅ Phase 13: Admin Module */}
            <Route path="/admin" element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/revenue" replace />} />
                <Route path="chat" element={<AdminChat />} />
                {/* 記事・Content Strategy・カテゴリはデスクトップ版 S.Blog（公式ブログ）へ集約済み。
                    旧 /admin/articles・/admin/strategy・/admin/categories は下の catch-all で / に戻る。 */}
                <Route path="revenue" element={<AdminRevenuePage />} />
                <Route path="donations" element={<AdminDonationsPage />} />
              </Route>
            </Route>

            {/* Sub-apps (統合済み — sekkeiyaのAppLayout + WorkspaceTabBarでラップ) */}

            {/* 3DSS — Shape Search */}
            <Route path="/app/share" element={<AppLayout hideMainSidebar={true} />}>
              <Route path="*" element={
                <SubAppShell>
                  <Suspense fallback={<AppLoading />}><ShapeSearchApp /></Suspense>
                </SubAppShell>
              } />
            </Route>

            <Route path="/app/layout" element={<AppLayout hideMainSidebar={true} />}>
              <Route path="*" element={
                <SubAppShell>
                  <Suspense fallback={<AppLoading />}><LayoutApp /></Suspense>
                </SubAppShell>
              } />
            </Route>
            <Route path="/app/create" element={<AppLayout hideMainSidebar={true} />}>
              <Route path="*" element={
                <SubAppShell>
                  <Suspense fallback={<AppLoading />}><CreateApp /></Suspense>
                </SubAppShell>
              } />
            </Route>
            <Route path="/app/presents" element={<AppLayout hideMainSidebar={true} />}>
              <Route path="*" element={
                <SubAppShell>
                  <Suspense fallback={<AppLoading />}><PresentsApp /></Suspense>
                </SubAppShell>
              } />
            </Route>

            {/* ===== Embedded Desktop Shell (post-login parity) ===== */}
            {/* useAppStore.currentMainView drives internal view switching, so a
                single catch-all suffices. Kept at /workspace/* during rollout so
                the legacy /app/* sub-apps remain available for A/B comparison. */}
            <Route
              path="/workspace/*"
              element={
                <RequireAuth>
                  <Suspense fallback={<AppLoading />}>
                    <DesktopShellWeb />
                  </Suspense>
                </RequireAuth>
              }
            />

            {/* ブランドURLの公開ブログ記事 /:handle/blog/:slug（@あり/なし両対応）。
                静的 "blog" セグメントで /:handle/:projectSlug より優先マッチする。 */}
            <Route path="/:handle/blog/:slug" element={<BlogArticleBySlugPage />} />

            {/* ===== 公開サイト（アカウント/プロジェクト） ===== */}
            {/* `/@username` と `/@username/{slug}`。製品 LP との単一/2セグメント枠も兼ねる。 */}
            <Route path="/:handle" element={<TopSlug />} />
            <Route path="/:handle/:projectSlug" element={<TopSlugProject />} />

            {/* ✅ 404は / に戻してOK（ただし /app/... は上で捕まえる） */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <GuestUpgradeBanner />
          <OnboardingOverlay />
          </PwaInstallProvider>
        </ProjectProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}