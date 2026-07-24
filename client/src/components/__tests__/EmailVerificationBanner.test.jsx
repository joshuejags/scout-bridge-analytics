import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmailVerificationBanner from '../EmailVerificationBanner';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EmailVerificationBanner', () => {
  it('renders nothing when not authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null, resendVerification: jest.fn() });
    const { container } = render(<EmailVerificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the user is already verified', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { emailVerified: true },
      resendVerification: jest.fn(),
    });
    const { container } = render(<EmailVerificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the banner for an authenticated, unverified user', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { emailVerified: false },
      resendVerification: jest.fn(),
    });
    render(<EmailVerificationBanner />);
    expect(screen.getByText(/isn't verified yet/i)).toBeInTheDocument();
  });

  it('resends the verification email and shows confirmation', async () => {
    const resendVerification = jest.fn().mockResolvedValue({ message: 'sent' });
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { emailVerified: false },
      resendVerification,
    });

    render(<EmailVerificationBanner />);
    await userEvent.click(screen.getByRole('button', { name: /resend verification/i }));

    await waitFor(() => expect(resendVerification).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
  });

  it('shows an error if resending fails', async () => {
    const resendVerification = jest.fn().mockRejectedValue({
      response: { data: { error: 'Failed to send verification email' } },
    });
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { emailVerified: false },
      resendVerification,
    });

    render(<EmailVerificationBanner />);
    await userEvent.click(screen.getByRole('button', { name: /resend verification/i }));

    expect(await screen.findByText(/failed to send verification email/i)).toBeInTheDocument();
  });
});
