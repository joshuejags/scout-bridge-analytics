import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import PlayersPage from '../PlayersPage';
import PlayerComparisonPage from '../PlayerComparisonPage';

jest.mock('axios');

const players = [
  { _id: 'p1', name: 'Sam Striker', team: null, position: 'Forward', jerseyNumber: 9 },
  { _id: 'p2', name: 'Danny Defender', team: null, position: 'Defender', jerseyNumber: 4 },
];

const comparisonData = [
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

describe('PlayersPage player comparison selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes('/teams')) return Promise.resolve({ data: [] });
      if (url.includes('/players/compare')) return Promise.resolve({ data: comparisonData });
      return Promise.resolve({ data: players });
    });
  });

  it('does not show a compare bar until a player is selected', async () => {
    render(
      <MemoryRouter>
        <PlayersPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Sam Striker')).toBeInTheDocument());
    expect(screen.queryByText(/^\d+ players? selected$/i)).not.toBeInTheDocument();
  });

  it('enables Compare only once two or more players are selected', async () => {
    render(
      <MemoryRouter>
        <PlayersPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Sam Striker')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    expect(screen.getByText('1 player selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();

    await userEvent.click(checkboxes[1]);
    expect(screen.getByText('2 players selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeEnabled();
  });

  it('opens the comparison panel when Compare is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/players']}>
        <Routes>
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/compare" element={<PlayerComparisonPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Sam Striker')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));

    expect(await screen.findByRole('heading', { name: /player comparison/i })).toBeInTheDocument();
    expect(await screen.findByText('Danny Defender')).toBeInTheDocument();
  });

  it('clears the selection when Clear is clicked', async () => {
    render(
      <MemoryRouter>
        <PlayersPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Sam Striker')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    expect(screen.getByText('1 player selected')).toBeInTheDocument();

    const clearButtons = screen.getAllByRole('button', { name: 'Clear' });
    await userEvent.click(clearButtons[1]);
    expect(screen.queryByText(/^\d+ players? selected$/i)).not.toBeInTheDocument();
  });
});
