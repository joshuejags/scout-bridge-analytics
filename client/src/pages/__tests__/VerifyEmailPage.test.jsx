import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmailPage from '../VerifyEmailPage';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const renderPage = (initialEntries = ['/verify-email?token=abc123']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <VerifyEmailPage />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('VerifyEmailPage', () => {
  it('shows a loading state while verifying', () => {
    const verifyEmail = jest.fn(() => new Promise(() => {})); // never resolves
    useAuth.mockReturnValue({ verifyEmail });

    renderPage();

    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();
  });

  it('calls verifyEmail with the token from the URL and shows success', async () => {
    const verifyEmail = jest.fn().mockResolvedValue({ user: { emailVerified: true } });
    useAuth.mockReturnValue({ verifyEmail });

    renderPage();

    expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledWith('abc123');
    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('shows an error state when verification fails', async () => {
    const verifyEmail = jest.fn().mockRejectedValue({
      response: { data: { error: 'Verification link is invalid or has expired' } },
    });
    useAuth.mockReturnValue({ verifyEmail });

    renderPage();

    expect(await screen.findByText(/verification failed/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
  });

  it('shows an error immediately when no token is in the URL, without calling the API', () => {
    const verifyEmail = jest.fn();
    useAuth.mockReturnValue({ verifyEmail });

    renderPage(['/verify-email']);

    expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
