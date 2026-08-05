import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';
import CommandPalette from '../CommandPalette';

jest.mock('axios');
const mockOpenUpload = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
jest.mock('../../context/UploadContext', () => ({
  useUpload: () => ({ openUpload: mockOpenUpload }),
}));

const sampleData = {
  videos: [{ _id: 'v1', originalName: 'Match One', status: 'analyzed', sport: 'soccer' }],
  players: [{ _id: 'p1', name: 'Sam Striker', position: 'Forward', team: { name: 'Home FC' } }],
  teams: [{ _id: 't1', name: 'Home FC', description: 'First team' }],
};

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes('/videos')) return Promise.resolve({ data: sampleData.videos });
      if (url.includes('/players')) return Promise.resolve({ data: sampleData.players });
      if (url.includes('/teams')) return Promise.resolve({ data: sampleData.teams });
      return Promise.resolve({ data: [] });
    });
  });

  it('opens with the keyboard shortcut and navigates to dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <CommandPalette />
                <LocationDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(await screen.findByRole('dialog', { name: /quick search/i })).toBeInTheDocument();
    await screen.findByRole('button', { name: /open dashboard/i });
    await userEvent.click(screen.getByRole('button', { name: /open dashboard/i }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard');
  });

  it('opens upload from the quick actions list', async () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    await screen.findByRole('dialog', { name: /quick search/i });
    await screen.findByRole('button', { name: /upload highlight/i });
    await userEvent.click(screen.getByRole('button', { name: /upload highlight/i }));
    expect(mockOpenUpload).toHaveBeenCalled();
  });
});
