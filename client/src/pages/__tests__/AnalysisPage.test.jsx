import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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

describe('AnalysisPage player stats table', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const playerData = [
    {
      trackId: '1',
      playerId: { _id: 'p1', name: 'Sam Striker' },
      jerseyNumber: 9,
      teamColor: 'red',
      verified: true,
      statistics: { distanceCovered: 1500, averageSpeed: 5.2, sprintCount: 4, activationArea: 'Center' },
    },
    {
      trackId: '2',
      playerId: null,
      jerseyNumber: null,
      teamColor: 'blue',
      verified: false,
      statistics: { distanceCovered: 900, averageSpeed: 3.8, sprintCount: 1, activationArea: 'Left' },
    },
  ];

  it('renders player stats as a real table with a header row and one row per player', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/analysis/')) return Promise.resolve({ data: { ...baseAnalysis, playerData } });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const table = screen.getByRole('table');
    expect(within(table).getByText('Player')).toBeInTheDocument();
    expect(within(table).getByText('Distance (m)').tagName).toBe('TH');

    expect(within(table).getByText('Sam Striker')).toBeInTheDocument();
    expect(within(table).getByText('Unidentified (track 2)')).toBeInTheDocument();

    // Every stat row renders inside an actual <tr>, not a stacked div list.
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(1 + playerData.length); // header + 2 players
  });

  it('shows a fallback message instead of an empty table when there is no player data', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/analysis/')) return Promise.resolve({ data: { ...baseAnalysis, playerData: [] } });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('No player data in this analysis.')).toBeInTheDocument());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('wraps the table in a scrollable container so a long roster does not grow the page unbounded', async () => {
    const manyPlayers = Array.from({ length: 30 }, (_, i) => ({
      trackId: String(i),
      playerId: null,
      jerseyNumber: i,
      teamColor: 'red',
      verified: false,
      statistics: { distanceCovered: 100 * i, averageSpeed: 4, sprintCount: i, activationArea: 'Center' },
    }));
    axios.get.mockImplementation((url) => {
      if (url.includes('/analysis/'))
        return Promise.resolve({ data: { ...baseAnalysis, playerData: manyPlayers } });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const wrap = screen.getByRole('table').closest('.player-stats-table-wrap');
    expect(wrap).not.toBeNull();
    expect(within(wrap).getAllByRole('row')).toHaveLength(1 + manyPlayers.length);
  });
});

describe('AnalysisPage tactical shape panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const tacticalData = {
    teams: [
      {
        teamColor: 'red',
        playerCount: 8,
        shape: { width: 45.2, depth: 20.1, compactness: 12.4, sampledFrames: 300 },
        formation: { lineCount: 3, lineup: [4, 3, 1] },
      },
      {
        teamColor: 'blue',
        playerCount: 7,
        shape: { width: 40.0, depth: 18.5, compactness: 11.0, sampledFrames: 280 },
        formation: { lineCount: 2, lineup: [4, 3] },
      },
    ],
  };

  it('renders a card per team with its shape metrics and formation lineup', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/analysis/')) return Promise.resolve({ data: { ...baseAnalysis, tacticalData } });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Tactical shape')).toBeInTheDocument());
    expect(screen.getByText(/red \(8 players\)/i)).toBeInTheDocument();
    expect(screen.getByText(/blue \(7 players\)/i)).toBeInTheDocument();
    expect(screen.getByText('Width: 45.2 m')).toBeInTheDocument();
    expect(screen.getByText('3 lines (4-3-1)')).toBeInTheDocument();
    expect(screen.getByText('2 lines (4-3)')).toBeInTheDocument();
  });

  it('omits the tactical panel entirely when tacticalData has no teams', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/analysis/'))
        return Promise.resolve({ data: { ...baseAnalysis, tacticalData: { teams: [] } } });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Actions detected: 5')).toBeInTheDocument());
    expect(screen.queryByText('Tactical shape')).not.toBeInTheDocument();
  });

  it('omits the tactical panel when tacticalData is entirely absent (older analyses)', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/analysis/')) return Promise.resolve({ data: baseAnalysis });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Actions detected: 5')).toBeInTheDocument());
    expect(screen.queryByText('Tactical shape')).not.toBeInTheDocument();
  });
});
