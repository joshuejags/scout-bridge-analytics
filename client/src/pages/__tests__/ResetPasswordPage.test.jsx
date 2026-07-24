import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from '../ResetPasswordPage';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderPage = (initialEntries = ['/reset-password?token=abc123']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ResetPasswordPage />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ResetPasswordPage', () => {
  it('shows an "invalid link" state when no token is present in the URL', () => {
    useAuth.mockReturnValue({ resetPassword: jest.fn() });
    renderPage(['/reset-password']);
    expect(screen.getByText(/invalid link/i)).toBeInTheDocument();
  });

  it('rejects mismatched password confirmation client-side without calling the API', async () => {
    const resetPassword = jest.fn();
    useAuth.mockReturnValue({ resetPassword });

    renderPage();

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'newpassword123');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'different123');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('rejects a short password client-side', async () => {
    const resetPassword = jest.fn();
    useAuth.mockReturnValue({ resetPassword });

    renderPage();

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'short');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('submits the token and new password, then redirects to login', async () => {
    const resetPassword = jest.fn().mockResolvedValue({ message: 'ok' });
    useAuth.mockReturnValue({ resetPassword });

    renderPage();

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'newpassword123');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith('abc123', 'newpassword123')
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      '/login',
      expect.objectContaining({ replace: true })
    );
  });

  it('shows the server error when the token is invalid/expired', async () => {
    const resetPassword = jest.fn().mockRejectedValue({
      response: { data: { error: 'Reset link is invalid or has expired' } },
    });
    useAuth.mockReturnValue({ resetPassword });

    renderPage();

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'newpassword123');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
