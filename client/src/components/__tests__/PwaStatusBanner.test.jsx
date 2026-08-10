import React from 'react';
import { render, screen } from '@testing-library/react';
import PwaStatusBanner from '../PwaStatusBanner';
import { useInstallPrompt, useNetworkStatus } from '../../hooks/useResponsive';

jest.mock('../../hooks/useResponsive', () => ({
  useInstallPrompt: jest.fn(),
  useNetworkStatus: jest.fn(),
}));

describe('PwaStatusBanner', () => {
  beforeEach(() => {
    useInstallPrompt.mockReturnValue({
      canInstall: true,
      install: jest.fn().mockResolvedValue(true),
    });
    useNetworkStatus.mockReturnValue({ isOnline: true });
  });

  it('shows install guidance when the app can be installed', () => {
    render(<PwaStatusBanner />);

    expect(screen.getByText(/Install ScoutBridge/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Install app/i })).toBeInTheDocument();
  });
});
