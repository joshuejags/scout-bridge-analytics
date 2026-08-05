import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import SearchWorkspacePage from '../SearchWorkspacePage';

jest.mock('axios');

describe('SearchWorkspacePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes('/players')) {
        return Promise.resolve({ data: [{ _id: 'p1', name: 'Sam Striker', team: { name: 'Arsenal' }, position: 'Forward', jerseyNumber: 9 }] });
      }
      if (url.includes('/teams')) {
        return Promise.resolve({ data: [{ _id: 't1', name: 'Arsenal', league: 'Premier League', country: 'England' }] });
      }
      if (url.includes('/videos')) {
        return Promise.resolve({ data: [{ _id: 'v1', originalName: 'Match highlight', status: 'analyzed', sport: 'soccer' }] });
      }
      if (url.includes('/reports/saved')) {
        return Promise.resolve({ data: [{ _id: 'r1', title: 'Scout summary', template: 'scout-summary', tags: ['wings'] }] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders search results from the workspace data and filters by query', async () => {
    render(
      <MemoryRouter>
        <SearchWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /find the right player, report, or video faster/i })).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/search players, teams, videos, and reports/i);
    await userEvent.type(searchInput, 'sam');

    await waitFor(() => expect(screen.getByText('Sam Striker')).toBeInTheDocument());
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
  });
});
