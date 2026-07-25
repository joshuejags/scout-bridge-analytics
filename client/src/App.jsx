import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import EmailVerificationBanner from './components/EmailVerificationBanner';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

// Route-level code splitting: each page ships as its own chunk, loaded on
// first visit instead of all being bundled into the initial download.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const Home = lazy(() => import('./pages/Home'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// The "/" route is public: a signed-out visitor sees the marketing
// LandingPage (interactive sections, no login wall) while a signed-in
// user sees their real Home dashboard. Unlike ProtectedRoute, this never
// redirects — it just picks which page to render at the same URL.
const RootRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }
  return isAuthenticated ? <Home /> : <LandingPage />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <div className="App">
            <NavBar />
            <EmailVerificationBanner />
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
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analysis/:videoId"
                  element={
                    <ProtectedRoute>
                      <AnalysisPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teams"
                  element={
                    <ProtectedRoute>
                      <TeamsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/players"
                  element={
                    <ProtectedRoute>
                      <PlayersPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;
