import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('axios');

const TOKEN_KEY = 'sba_token';

// A minimal consumer component so tests can drive AuthContext through its
// public hook API rather than reaching into implementation details.
const Consumer = () => {
  const { isAuthenticated, loading, user, login, register, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="user-name">{user?.name || ''}</span>
      <button onClick={() => login('a@example.com', 'password123')}>login</button>
      <button onClick={() => register('Ada', 'a@example.com', 'password123')}>register</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
};

const renderWithProvider = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  );

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
  // Logging in/registering sets a token, which triggers the /auth/me
  // effect; give it a harmless default so tests that only care about
  // login/register don't also have to stub this every time.
  axios.get.mockResolvedValue({ data: { name: 'Ada', email: 'a@example.com', role: 'scout' } });
});

describe('AuthContext', () => {
  it('starts unauthenticated with no stored token', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });

  it('login stores the token and marks the user authenticated', async () => {
    axios.post.mockResolvedValueOnce({
      data: { token: 'abc123', user: { name: 'Ada', email: 'a@example.com', role: 'scout' } },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));
    expect(screen.getByTestId('user-name')).toHaveTextContent('Ada');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('abc123');
  });

  it('register stores the token the same way login does', async () => {
    axios.post.mockResolvedValueOnce({
      data: { token: 'xyz789', user: { name: 'Ada', email: 'a@example.com', role: 'scout' } },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await userEvent.click(screen.getByText('register'));

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('xyz789');
  });

  it('logout clears the token and user', async () => {
    axios.post.mockResolvedValueOnce({
      data: { token: 'abc123', user: { name: 'Ada', email: 'a@example.com', role: 'scout' } },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('false'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('restores a session from a stored token via /auth/me', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stored-token');
    axios.get.mockResolvedValueOnce({
      data: { name: 'Restored User', email: 'r@example.com', role: 'scout' },
    });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Restored User');
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({ headers: { Authorization: 'Bearer stored-token' } })
    );
  });

  it('logs out and clears loading if the stored token is rejected by /auth/me', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale-token');
    axios.get.mockRejectedValueOnce({ response: { status: 401 } });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
