import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import AnalysisPage from '../AnalysisPage';

jest.mock('axios');

const baseAnalysis = {
  video: { originalName: 'match.mp4' },
  summary: { totalPlayers: 5, matchDuration: 90, highlightedMoments: [] },
  playerData: [],
  heatmapData: { grid: [] },
  actions: [
    { type: 'shot', playerId: '1', frameNumber: 10, confidence: 0.6 },
    { type: 'shot', playerId: '2', frameNumber: 20, confidence: 0.6 },
    { type: 'pass', playerId: '1', frameNumber: 30, confidence: 0.5 },
    { type: 'tackle', playerId: '3', frameNumber: 40, confidence: 0.5 },
    { type: 'interception', playerId: '4', frameNumber: 50, confidence: 0.5 },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/analysis/vid1']}>
      <Routes>
        <Route path="/analysis/:videoId" element={<AnalysisPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('AnalysisPage action breakdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a per-type count badge for each action type present', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/analysis/')) return Promise.resolve({ data: baseAnalysis });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Actions detected: 5')).toBeInTheDocument());
    expect(screen.getByText('2 shots')).toBeInTheDocument();
    expect(screen.getByText('1 pass')).toBeInTheDocument();
    expect(screen.getByText('1 tackle')).toBeInTheDocument();
    expect(screen.getByText('1 interception')).toBeInTheDocument();
  });

  it('renders no breakdown badges when there are no actions', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/analysis/')) return Promise.resolve({ data: { ...baseAnalysis, actions: [] } });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Actions detected: 0')).toBeInTheDocument());
    expect(screen.queryByText(/shot/i)).not.toBeInTheDocument();
  });
});
