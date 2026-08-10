import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import EmailVerificationBanner from './components/EmailVerificationBanner';
import UploadModal from './components/UploadModal';
import CommandPalette from './components/CommandPalette';
import RoleGuard from './components/RoleGuard';
import WorkspaceLayout from './components/WorkspaceLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import LoadingSpinner from './components/LoadingSpinner';
import { initializePWA } from './utils/pwaManager';
import './App.css';

// Route-level code splitting: each page ships as its own chunk, loaded on
// first visit instead of all being bundled into the initial download.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const Home = lazy(() => import('./pages/Home'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const TeamAnalyticsPage = lazy(() => import('./pages/TeamAnalyticsPage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const PlayerComparisonPage = lazy(() => import('./pages/PlayerComparisonPage'));
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage'));
const AdminPortalPage = lazy(() => import('./pages/AdminPortalPage'));
const ScoutPortalPage = lazy(() => import('./pages/ScoutPortalPage'));
const SavedReportsPage = lazy(() => import('./pages/SavedReportsPage'));
const SearchWorkspacePage = lazy(() => import('./pages/SearchWorkspacePage'));
const TeamPortalPage = lazy(() => import('./pages/TeamPortalPage'));
const PlayerPortalPage = lazy(() => import('./pages/PlayerPortalPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
// Phase 5 new pages
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const NotificationCenterPage = lazy(() => import('./pages/NotificationCenterPage'));
const OrganizationSettingsPage = lazy(() => import('./pages/OrganizationSettingsPage'));
const BillingHistoryPage = lazy(() => import('./pages/BillingHistoryPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));

// The "/" route is public: a signed-out visitor sees the marketing
// LandingPage (interactive sections, no login wall) while a signed-in
// user sees their real Home dashboard. Unlike ProtectedRoute, this never
// redirects — it just picks which page to render at the same URL.
const RootRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }
  return isAuthenticated ? (
    <WorkspaceLayout>
      <Home />
    </WorkspaceLayout>
  ) : (
    <LandingPage />
  );
};

const ShellRoute = ({ children, allowedRoles }) => (
  <ProtectedRoute>
    <RoleGuard allowedRoles={allowedRoles}>
      <WorkspaceLayout>{children}</WorkspaceLayout>
    </RoleGuard>
  </ProtectedRoute>
);

const AppChrome = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="App">
      {(!isAuthenticated || loading) && <NavBar />}
      <EmailVerificationBanner />
      <UploadModal />
      <CommandPalette />
      {children}
    </div>
  );
};

function App() {
  // Initialize PWA on app load
  useEffect(() => {
    initializePWA();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <UploadProvider>
          <ErrorBoundary>
            <AppChrome>
              <Suspense fallback={<LoadingSpinner fullScreen message="Loading..." />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/" element={<RootRoute />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ShellRoute>
                        <DashboardPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <ShellRoute allowedRoles={['admin']}>
                        <AdminPortalPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/scouting"
                    element={
                      <ShellRoute allowedRoles={['admin', 'scout']}>
                        <ScoutPortalPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ShellRoute>
                        <SavedReportsPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/search"
                    element={
                      <ShellRoute>
                        <SearchWorkspacePage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/team-portal"
                    element={
                      <ShellRoute allowedRoles={['admin', 'team']}>
                        <TeamPortalPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/player-portal"
                    element={
                      <ShellRoute allowedRoles={['admin', 'player']}>
                        <PlayerPortalPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/analysis/:videoId"
                    element={
                      <ShellRoute>
                        <AnalysisPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/teams"
                    element={
                      <ShellRoute>
                        <TeamsPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/teams/:teamId/analytics"
                    element={
                      <ShellRoute>
                        <TeamAnalyticsPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/players"
                    element={
                      <ShellRoute>
                        <PlayersPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/players/compare"
                    element={
                      <ShellRoute>
                        <PlayerComparisonPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/players/:playerId"
                    element={
                      <ShellRoute>
                        <PlayerProfilePage />
                      </ShellRoute>
                    }
                  />
                  {/* Phase 5: Subscription & Billing Routes */}
                  <Route
                    path="/subscription"
                    element={
                      <ShellRoute>
                        <SubscriptionPage />
                      </ShellRoute>
                    }
                  />
                  <Route
                    path="/billing-history"
                    element={
                      <ShellRoute>
                        <BillingHistoryPage />
                      </ShellRoute>
                    }
                  />
                  {/* Phase 5: Notifications Route */}
                  <Route
                    path="/notifications"
                    element={
                      <ShellRoute>
                        <NotificationCenterPage />
                      </ShellRoute>
                    }
                  />
                  {/* Phase 5: Organization Settings Route */}
                  <Route
                    path="/organization-settings"
                    element={
                      <ShellRoute>
                        <OrganizationSettingsPage />
                      </ShellRoute>
                    }
                  />
                  {/* Phase 5: Admin Dashboard Route */}
                  <Route
                    path="/admin/dashboard"
                    element={
                      <ShellRoute allowedRoles={['admin']}>
                        <AdminDashboardPage />
                      </ShellRoute>
                    }
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AppChrome>
          </ErrorBoundary>
        </UploadProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
