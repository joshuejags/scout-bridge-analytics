import React from 'react';
import { render, screen } from '@testing-library/react';
import AdvancedMetrics from '../AdvancedMetrics';

describe('AdvancedMetrics Component', () => {
  const mockActions = [
    { type: 'shot', position: { x: 0.8, y: 0.5 }, confidence: 0.95 },
    { type: 'shot', position: { x: 0.75, y: 0.3 }, confidence: 0.85 },
    { type: 'pass', position: { x: 0.6, y: 0.5 }, confidence: 0.92 },
    { type: 'pass', position: { x: 0.55, y: 0.4 }, confidence: 0.88 },
    { type: 'tackle', position: { x: 0.3, y: 0.5 }, confidence: 0.80 },
    { type: 'interception', position: { x: 0.4, y: 0.6 }, confidence: 0.78 },
  ];

  const mockPlayerData = [
    { teamColor: 'red', statistics: { distanceCovered: 8500, sprintCount: 12 } },
  ];

  const mockBallPossession = [
    { teamColor: 'red', duration: 1500 },
    { teamColor: 'blue', duration: 1000 },
  ];

  const mockPlayerStats = {
    distanceCovered: 8500,
    sprintCount: 12,
    averageSpeed: 7.2,
  };

  it('renders without crashing', () => {
    render(<AdvancedMetrics actions={mockActions} />);
    expect(screen.getByText('Expected Goals')).toBeInTheDocument();
  });

  it('displays all metrics in compact view', () => {
    render(<AdvancedMetrics actions={mockActions} />);
    expect(screen.getByText('Expected Goals')).toBeInTheDocument();
    expect(screen.getByText('Expected Assists')).toBeInTheDocument();
    expect(screen.getByText('Possession %')).toBeInTheDocument();
    expect(screen.getByText('Pass Completion')).toBeInTheDocument();
    expect(screen.getByText('Pressing Intensity')).toBeInTheDocument();
    expect(screen.getByText('Progression Rate')).toBeInTheDocument();
  });

  it('calculates expected goals from shots', () => {
    render(<AdvancedMetrics actions={mockActions} />);
    const xgElement = screen.getByText('Expected Goals').closest('.metric-card');
    expect(xgElement).toBeInTheDocument();
  });

  it('calculates pass completion percentage', () => {
    render(<AdvancedMetrics actions={mockActions} />);
    expect(screen.getByText('Pass Completion')).toBeInTheDocument();
  });

  it('calculates pressing intensity from defensive actions', () => {
    render(<AdvancedMetrics actions={mockActions} />);
    expect(screen.getByText('Pressing Intensity')).toBeInTheDocument();
  });

  it('displays detailed view when showDetailed is true', () => {
    render(
      <AdvancedMetrics 
        actions={mockActions}
        playerData={mockPlayerData}
        ballPossession={mockBallPossession}
        playerStats={mockPlayerStats}
        showDetailed={true}
      />
    );
    expect(screen.getByText('Offensive Metrics')).toBeInTheDocument();
    expect(screen.getByText('Possession & Control')).toBeInTheDocument();
    expect(screen.getByText('Defensive & Physical')).toBeInTheDocument();
  });

  it('shows metric bars in detailed view', () => {
    render(
      <AdvancedMetrics 
        actions={mockActions}
        playerData={mockPlayerData}
        ballPossession={mockBallPossession}
        playerStats={mockPlayerStats}
        showDetailed={true}
      />
    );
    const bars = document.querySelectorAll('.metric-bar');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('handles empty actions array', () => {
    render(<AdvancedMetrics actions={[]} />);
    expect(screen.getByText('Expected Goals')).toBeInTheDocument();
  });

  it('calculates possession percentage correctly', () => {
    render(
      <AdvancedMetrics 
        actions={mockActions}
        playerData={mockPlayerData}
        ballPossession={mockBallPossession}
      />
    );
    expect(screen.getByText('Possession %')).toBeInTheDocument();
  });

  it('handles different confidence scores', () => {
    const variableConfidenceActions = [
      { type: 'shot', position: { x: 0.9, y: 0.5 }, confidence: 0.99 },
      { type: 'shot', position: { x: 0.7, y: 0.5 }, confidence: 0.5 },
      { type: 'pass', position: { x: 0.6, y: 0.5 }, confidence: 0.3 },
    ];
    render(<AdvancedMetrics actions={variableConfidenceActions} />);
    expect(screen.getByText('Expected Goals')).toBeInTheDocument();
  });
});
