import React from 'react';
import { render, screen } from '@testing-library/react';
import OperationalPulse from '../OperationalPulse';

describe('OperationalPulse', () => {
  it('renders operational metrics with progress bars', () => {
    render(
      <OperationalPulse
        metrics={[
          { label: 'Coverage', value: 82, description: 'Videos analyzed' },
          { label: 'Queue pressure', value: 18, description: 'Waiting for review' },
        ]}
      />
    );

    expect(screen.getByText('Operational pulse')).toBeInTheDocument();
    expect(screen.getByText('Coverage')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('Videos analyzed')).toBeInTheDocument();
  });
});
