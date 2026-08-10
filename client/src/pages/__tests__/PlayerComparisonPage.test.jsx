import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import PlayerComparisonPage from '../PlayerComparisonPage';

jest.mock('axios');

const sampleData = [
  {
    player: { _id: 'p1', name: 'Sam Striker', jerseyNumber: 9, team: { name: 'Home FC' } },
    matchesPlayed: 2,
    totalDistanceCovered: 3000,
    averageDistancePerMatch: 1500,
    averageSpeed: 6,
    totalSprints: 8,
    averageSprintsPerMatch: 4,
    actions: { pass: 1, shot: 1, tackle: 0, interception: 0 },
    totalActions: 2,
    verifiedTracks: 2,
  },
  {
    player: { _id: 'p2', name: 'Danny Defender', jerseyNumber: 4, team: { name: 'Away FC' } },
    matchesPlayed: 1,
    totalDistanceCovered: 1500,
    averageDistancePerMatch: 1500,
    averageSpeed: 6,
    totalSprints: 2,
    averageSprintsPerMatch: 2,
    actions: { pass: 0, shot: 0, tackle: 1, interception: 0 },
    totalActions: 1,
    verifiedTracks: 0,
  },
];

describe('PlayerComparisonPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: sampleData });
  });

  it('renders the comparison table for query string player ids', async () => {
    render(
      <MemoryRouter initialEntries={['/players/compare?ids=p1,p2']}>
        <Routes>
          <Route path="/players/compare" element={<PlayerComparisonPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Sam Striker')).toBeInTheDocument();
    expect(screen.getByText('Player Comparison')).toBeInTheDocument();
  });

  it('shows guidance when fewer than two players are provided', async () => {
    render(
      <MemoryRouter initialEntries={['/players/compare?ids=p1']}>
        <Routes>
          <Route path="/players/compare" element={<PlayerComparisonPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Choose at least two players.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to players/i })).toHaveAttribute('href', '/players');
  });
});
