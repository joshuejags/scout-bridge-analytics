import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import EmailVerificationBanner from './components/EmailVerificationBanner';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardPage from './pages/DashboardPage';
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
import AnalysisPage from './pages/AnalysisPage';
import TeamsPage from './pages/TeamsPage';
import PlayersPage from './pages/PlayersPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

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
            </Routes>
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;
