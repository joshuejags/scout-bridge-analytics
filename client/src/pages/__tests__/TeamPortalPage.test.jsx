import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import TeamPortalPage from '../TeamPortalPage';

jest.mock('axios');

describe('TeamPortalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: {
        summary: {
          totalTeams: 4,
          totalPlayers: 52,
          totalVideos: 7,
          analyzedVideos: 5,
        },
        topTeams: [
          {
            _id: 't1',
            name: 'Blue FC',
            rosterCount: 24,
            ownedVideoCount: 3,
            opponentVideoCount: 1,
            description: 'Possession-first side.',
            lastVideo: { _id: 'v1', originalName: 'blue-gold.mp4', status: 'analyzed' },
          },
        ],
        recentMatches: [
          {
            _id: 'v1',
            originalName: 'blue-gold.mp4',
            status: 'analyzed',
            team: { name: 'Blue FC' },
            opponentTeam: { name: 'Gold FC' },
          },
        ],
      },
    });
  });

  it('renders squad metrics and recent match context', async () => {
    render(
      <MemoryRouter>
        <TeamPortalPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Squad intelligence, match context/i)).toBeInTheDocument();
    expect(screen.getByText('Blue FC')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open squads' })).toHaveAttribute('href', '/teams');
  });
});
