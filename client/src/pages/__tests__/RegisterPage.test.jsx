import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../RegisterPage';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderRegisterPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RegisterPage', () => {
  it('calls register with the entered fields and navigates home on success', async () => {
    const register = jest.fn().mockResolvedValue({ name: 'Ada' });
    useAuth.mockReturnValue({ register });

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText(/name/i), 'Ada Scout');
    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith('Ada Scout', 'ada@example.com', 'password123')
    );
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('rejects a short password client-side without calling register', async () => {
    const register = jest.fn();
    useAuth.mockReturnValue({ register });

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText(/name/i), 'Ada Scout');
    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows the server error when registration rejects (e.g. duplicate email)', async () => {
    const register = jest.fn().mockRejectedValue({
      response: { data: { error: 'An account with that email already exists' } },
    });
    useAuth.mockReturnValue({ register });

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText(/name/i), 'Ada Scout');
    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
