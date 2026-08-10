import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import PlayerComparison from './PlayerComparison';

jest.mock('axios');

describe('PlayerComparison', () => {
  it('renders a premium multi-match comparison view with trend snapshots', async () => {
    axios.get.mockResolvedValue({
      data: [
        {
          player: { _id: 'player-1', name: 'Luca Rossi', team: { name: 'City FC' }, jerseyNumber: 10 },
          matchesPlayed: 3,
          totalDistanceCovered: 9600,
          averageDistancePerMatch: 3200,
          averageSpeed: 6.2,
          totalSprints: 14,
          averageSprintsPerMatch: 4.7,
          totalActions: 82,
          verifiedTracks: 19,
          actions: { shot: 6, pass: 54, tackle: 11, interception: 11 },
          matches: [
            { video: { originalName: 'Match 1' }, distanceCovered: 3000, actionCount: 25 },
            { video: { originalName: 'Match 2' }, distanceCovered: 3400, actionCount: 30 },
          ],
          trendSeries: {
            distance: [{ label: 'Match 1', value: 3000 }, { label: 'Match 2', value: 3400 }],
            actions: [{ label: 'Match 1', value: 25 }, { label: 'Match 2', value: 30 }],
            sprints: [{ label: 'Match 1', value: 4 }, { label: 'Match 2', value: 5 }],
          },
        },
      ],
    });

    render(<PlayerComparison playerIds={['player-1']} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('Trend snapshot')).toBeInTheDocument());
    expect(screen.getByText('Multi-match scouting view')).toBeInTheDocument();
    expect(screen.getByText('Side-by-side stat matrix')).toBeInTheDocument();
  });
});
