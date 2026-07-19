import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardPage from './pages/DashboardPage';
import Home from './pages/Home';
import AnalysisPage from './pages/AnalysisPage';
import TeamsPage from './pages/TeamsPage';
import PlayersPage from './pages/PlayersPage';
import './App.css';

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <div className="App">
          <NavBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analysis/:videoId" element={<AnalysisPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/players" element={<PlayersPage />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
