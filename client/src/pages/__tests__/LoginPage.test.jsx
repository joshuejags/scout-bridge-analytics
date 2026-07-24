import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderLoginPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginPage', () => {
  it('calls login with the entered credentials and navigates on success', async () => {
    const login = jest.fn().mockResolvedValue({ name: 'Ada' });
    useAuth.mockReturnValue({ login });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('ada@example.com', 'password123'));
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows the server error message when login rejects', async () => {
    const login = jest.fn().mockRejectedValue({
      response: { data: { error: 'Invalid email or password' } },
    });
    useAuth.mockReturnValue({ login });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('disables the submit button while submitting', async () => {
    let resolveLogin;
    const login = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );
    useAuth.mockReturnValue({ login });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    resolveLogin({ name: 'Ada' });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });
});
