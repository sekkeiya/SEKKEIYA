// Web entry point for the embedded desktop shell.
//
// This is the desktop App.tsx tree MINUS:
//   - the outer <BrowserRouter> (the host web app already provides one)
//   - the Tauri-native lifecycle effects (global shortcuts, screen capture,
//     Rhino polling, setup_ai_drive, window title) — all no-ops on web
//   - the ?standalone / ?capture child-window branches (desktop-only)
//
// View switching inside the shell is driven by useAppStore.currentMainView
// (see AppContent), NOT by URL routes, so mounting this under a single catch-all
// web route (/workspace/*) is sufficient.
import MainLayout from './layouts/MainLayout';
import { WorkspaceProvider } from './shared/layout/workspace/WorkspaceContext';
import AuthGuard from './components/Auth/AuthGuard';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { GlobalLaunchOverlay } from './components/GlobalLaunchOverlay';
import { SetupGate } from './components/SetupGate';
import { AppContent, GlobalModals, GlobalLoader } from './App';

export default function DesktopShellWeb() {
  return (
    <ErrorBoundary>
      <AuthGuard>
        <SetupGate>
          <WorkspaceProvider>
            <MainLayout>
              <AppContent />
              <GlobalModals />
              <GlobalLoader />
              <GlobalLaunchOverlay />
            </MainLayout>
          </WorkspaceProvider>
        </SetupGate>
      </AuthGuard>
    </ErrorBoundary>
  );
}
