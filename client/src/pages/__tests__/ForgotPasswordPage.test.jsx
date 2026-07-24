import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from '../ForgotPasswordPage';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ForgotPasswordPage', () => {
  it('submits the email and shows a confirmation screen', async () => {
    const forgotPassword = jest.fn().mockResolvedValue({ message: 'ok' });
    useAuth.mockReturnValue({ forgotPassword });

    renderPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith('ada@example.com'));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
  });

  it('shows the same confirmation screen even for a nonexistent account (no enumeration)', async () => {
    // The backend always returns 200 regardless of whether the account
    // exists; the frontend has no way to distinguish and must not try to.
    const forgotPassword = jest.fn().mockResolvedValue({ message: 'ok' });
    useAuth.mockReturnValue({ forgotPassword });

    renderPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it('shows an error if the request itself fails (network/server error, not "account not found")', async () => {
    const forgotPassword = jest.fn().mockRejectedValue({
      response: { data: { error: 'Too many password reset requests. Try again in a few minutes.' } },
    });
    useAuth.mockReturnValue({ forgotPassword });

    renderPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/too many password reset requests/i)).toBeInTheDocument();
  });
});
