import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import PlayersPage from '../PlayersPage';

jest.mock('axios');

const players = [
  { _id: 'p1', name: 'Sam Striker', team: null, position: 'Forward', jerseyNumber: 9 },
  { _id: 'p2', name: 'Danny Defender', team: null, position: 'Defender', jerseyNumber: 4 },
];

describe('PlayersPage player comparison selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes('/teams')) return Promise.resolve({ data: [] });
      if (url.includes('/players/compare')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: players });
    });
  });

  it('does not show a compare bar until a player is selected', async () => {
    render(<PlayersPage />);
    await waitFor(() => expect(screen.getByText('Sam Striker')).toBeInTheDocument());
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });

  it('enables Compare only once two or more players are selected', async () => {
    render(<PlayersPage />);
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
    render(<PlayersPage />);
    await waitFor(() => expect(screen.getByText('Sam Striker')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));

    expect(await screen.findByRole('dialog', { name: /player comparison/i })).toBeInTheDocument();
  });

  it('clears the selection when Clear is clicked', async () => {
    render(<PlayersPage />);
    await waitFor(() => expect(screen.getByText('Sam Striker')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    expect(screen.getByText('1 player selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });
});
