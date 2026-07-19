import React, { useState } from 'react';
import VideoUpload from '../components/VideoUpload';
import VideoList from '../components/VideoList';
import DashboardSummary from '../components/DashboardSummary';
import './Home.css';

const Home = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="home">
      <header className="header">
        <h1>Scout Bridge Analytics</h1>
        <p>Analyze player performance from match highlights</p>
      </header>
      <main>
        <DashboardSummary refreshTrigger={refreshTrigger} />
        <VideoUpload onUploadSuccess={handleUploadSuccess} />
        <VideoList refreshTrigger={refreshTrigger} key={refreshTrigger} />
      </main>
    </div>
  );
};

export default Home;
