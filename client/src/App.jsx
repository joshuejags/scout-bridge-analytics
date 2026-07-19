import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import AnalysisPage from './pages/AnalysisPage';
import TeamsPage from './pages/TeamsPage';
import PlayersPage from './pages/PlayersPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analysis/:videoId" element={<AnalysisPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/players" element={<PlayersPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
