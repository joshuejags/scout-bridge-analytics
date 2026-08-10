import React from 'react';
import { render, screen } from '@testing-library/react';
import PerformanceTrends from '../PerformanceTrends';

describe('PerformanceTrends Component', () => {
  const mockData = [
    { label: 'Match 1', value: 65 },
    { label: 'Match 2', value: 72 },
    { label: 'Match 3', value: 78 },
    { label: 'Match 4', value: 81 },
    { label: 'Match 5', value: 85 },
  ];

  it('renders without crashing', () => {
    render(<PerformanceTrends data={mockData} />);
    expect(screen.getByText('Performance trends')).toBeInTheDocument();
  });

  it('displays title correctly', () => {
    render(<PerformanceTrends data={mockData} title="Player Form" />);
    expect(screen.getByText('Player Form')).toBeInTheDocument();
  });

  it('displays average statistic', () => {
    render(<PerformanceTrends data={mockData} />);
    expect(screen.getByText('Average')).toBeInTheDocument();
  });

  it('displays trend statistic', () => {
    render(<PerformanceTrends data={mockData} />);
    expect(screen.getByText('Trend')).toBeInTheDocument();
  });

  it('displays range statistic', () => {
    render(<PerformanceTrends data={mockData} />);
    expect(screen.getByText('Range')).toBeInTheDocument();
  });

  it('renders canvas element', () => {
    render(<PerformanceTrends data={mockData} />);
    const canvas = screen.getByRole('img', { hidden: true });
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('shows empty state when no data provided', () => {
    render(<PerformanceTrends data={[]} />);
    expect(screen.getByText('No performance data available yet.')).toBeInTheDocument();
  });

  it('calculates average correctly', () => {
    render(<PerformanceTrends data={mockData} />);
    const values = mockData.map(d => d.value);
    const expected = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    expect(screen.getByText(`${expected} rating`)).toBeInTheDocument();
  });

  it('displays custom unit', () => {
    render(<PerformanceTrends data={mockData} unit="points" />);
    expect(screen.getByText(/\d+ points/)).toBeInTheDocument();
  });

  it('handles upward trend', () => {
    const upwardData = [
      { label: 'Match 1', value: 60 },
      { label: 'Match 2', value: 80 },
    ];
    render(<PerformanceTrends data={upwardData} />);
    expect(screen.getByText('Trend')).toBeInTheDocument();
  });

  it('handles downward trend', () => {
    const downwardData = [
      { label: 'Match 1', value: 85 },
      { label: 'Match 2', value: 65 },
    ];
    render(<PerformanceTrends data={downwardData} />);
    expect(screen.getByText('Trend')).toBeInTheDocument();
  });

  it('handles stable trend', () => {
    const stableData = [
      { label: 'Match 1', value: 75 },
      { label: 'Match 2', value: 75 },
    ];
    render(<PerformanceTrends data={stableData} />);
    expect(screen.getByText('Trend')).toBeInTheDocument();
  });

  it('filters out non-numeric values', () => {
    const mixedData = [
      { label: 'Match 1', value: 65 },
      { label: 'Match 2', value: null },
      { label: 'Match 3', value: 78 },
    ];
    render(<PerformanceTrends data={mixedData} />);
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });
});
