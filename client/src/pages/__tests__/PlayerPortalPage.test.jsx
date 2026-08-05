import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import PlayerPortalPage from '../PlayerPortalPage';

jest.mock('axios');

describe('PlayerPortalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: {
        summary: {
          totalPlayers: 18,
          trackedProfiles: 9,
          analyzedMatches: 6,
          verifiedTracks: 12,
        },
        featuredPlayers: [
          {
            player: {
              _id: 'p1',
              name: 'Sam Striker',
              position: 'Forward',
              jerseyNumber: 9,
              team: { name: 'United FC' },
            },
            summary: {
              matchesPlayed: 4,
              totalActions: 8,
              totalDistanceCovered: 6200,
            },
          },
        ],
        recentMatches: [
          {
            analysisId: 'a1',
            trackedPlayers: 13,
            actionCount: 24,
            video: { _id: 'v1', originalName: 'match-one.mp4', status: 'analyzed' },
          },
        ],
      },
    });
  });

  it('renders highlighted player profiles and recent reports', async () => {
    render(
      <MemoryRouter>
        <PlayerPortalPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Performance profiles and recent reports/i)).toBeInTheDocument();
    expect(screen.getByText('Sam Striker')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse profiles' })).toHaveAttribute('href', '/players');
    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/players/p1');
  });
});
