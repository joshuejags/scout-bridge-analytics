import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import PlayerComparison from '../PlayerComparison';

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

describe('PlayerComparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and renders a side-by-side stats table for the selected players', async () => {
    axios.get.mockResolvedValueOnce({ data: sampleData });

    render(<PlayerComparison playerIds={['p1', 'p2']} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Sam Striker').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Danny Defender').length).toBeGreaterThan(0);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/players/compare'),
      expect.objectContaining({ params: { ids: 'p1,p2' } })
    );

    // Distance row values render for both players.
    const rows = screen.getAllByRole('row');
    const distanceRow = rows.find((r) => r.textContent.includes('Total distance'));
    expect(distanceRow.textContent).toContain('3000');
    expect(distanceRow.textContent).toContain('1500');

    expect(screen.getByText(/decision-ready reading/i)).toBeInTheDocument();
    expect(screen.getByText(/sam striker leads the comparison/i)).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    axios.get.mockRejectedValueOnce({ response: { data: { error: 'Player(s) not found: p9' } } });

    render(<PlayerComparison playerIds={['p1', 'p9']} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Player(s) not found: p9')).toBeInTheDocument());
  });

  it('calls onClose when the close button is clicked', async () => {
    axios.get.mockResolvedValueOnce({ data: sampleData });
    const onClose = jest.fn();
    render(<PlayerComparison playerIds={['p1', 'p2']} onClose={onClose} />);

    await waitFor(() => expect(screen.getAllByText('Sam Striker').length).toBeGreaterThan(0));
    screen.getByLabelText(/close comparison/i).click();
    expect(onClose).toHaveBeenCalled();
  });
});
