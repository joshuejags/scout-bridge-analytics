import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import PlayerProfilePage from '../PlayerProfilePage';

jest.mock('axios');

const profile = {
  player: {
    _id: 'p1',
    name: 'Sam Striker',
    team: { name: 'United FC' },
    position: 'Forward',
    jerseyNumber: 9,
  },
  summary: {
    matchesPlayed: 4,
    totalDistanceCovered: 6800,
    averageDistancePerMatch: 1700,
    averageSpeed: 5.2,
    totalSprints: 18,
    averageSprintsPerMatch: 4.5,
    actions: { pass: 5, shot: 2, tackle: 1, interception: 0 },
    totalActions: 8,
    verifiedTracks: 3,
    matches: [],
  },
  recentMatches: [
    {
      analysisId: 'a1',
      video: { _id: 'v1', originalName: 'match-one.mp4', sport: 'soccer' },
      distanceCovered: 1700,
      actionCount: 3,
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/players/p1']}>
      <Routes>
        <Route path="/players/:playerId" element={<PlayerProfilePage />} />
      </Routes>
    </MemoryRouter>
  );

describe('PlayerProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: profile });
  });

  it('shows the player summary and recent matches', async () => {
    renderPage();

    expect(await screen.findByText('Sam Striker')).toBeInTheDocument();
    expect(screen.getByText('Matches analyzed')).toBeInTheDocument();
    expect(screen.getByText('United FC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view report/i })).toHaveAttribute('href', '/analysis/v1');
  });
});
