import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import App from '../App';

// App wires up the real AuthProvider (not mocked) so this exercises the
// actual RootRoute/NavBar wiring end to end, catching exactly the class of
// bug reported ("Home" going somewhere unexpected) that a shallow mock of
// useAuth would paper over.
jest.mock('axios');

describe('Home navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('routes an authenticated user to the real Home dashboard, not the guest landing page', async () => {
    window.localStorage.setItem('sba_token', 'a-valid-token');
    axios.get.mockImplementation((url) => {
      if (url.includes('/auth/me')) {
        return Promise.resolve({ data: { name: 'Ada Scout', email: 'ada@example.com', role: 'scout' } });
      }
      // Home's stats fetch (videos/teams/players) — empty is fine, this
      // test only cares about which page rendered.
      return Promise.resolve({ data: [] });
    });

    render(<App />);

    // Home-specific content (the personalized greeting) should appear;
    // LandingPage's guest-only marketing copy should not.
    expect(await screen.findByText(/good (morning|afternoon|evening), ada/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /get started free/i })).not.toBeInTheDocument();
  });

  it('clicking "Home" in the nav bar takes an authenticated user back to their dashboard from another page', async () => {
    window.localStorage.setItem('sba_token', 'a-valid-token');
    window.history.pushState({}, '', '/teams');
    axios.get.mockImplementation((url) => {
      if (url.includes('/auth/me')) {
        return Promise.resolve({ data: { name: 'Ada Scout', email: 'ada@example.com', role: 'scout' } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);

    const homeLink = await screen.findByRole('link', { name: 'Home' });
    expect(homeLink).toHaveAttribute('href', '/');

    await userEvent.click(homeLink);

    expect(await screen.findByText(/good (morning|afternoon|evening), ada/i)).toBeInTheDocument();
  });

  it('routes a signed-out visitor to the public landing page, not Home', async () => {
    axios.get.mockResolvedValue({ data: [] });
    render(<App />);

    expect(await screen.findByRole('link', { name: /get started free/i })).toBeInTheDocument();
    expect(screen.queryByText(/here's what's happening with your match analysis/i)).not.toBeInTheDocument();
  });
});
