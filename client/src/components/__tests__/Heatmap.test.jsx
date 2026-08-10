import React from 'react';
import { render, screen } from '@testing-library/react';
import Heatmap from '../Heatmap';

describe('Heatmap', () => {
  it('shows an empty-data message when the grid has no rows', () => {
    render(<Heatmap grid={[]} sport="soccer" />);
    expect(screen.getByText(/no heatmap data available/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows an empty-data message when the grid is missing entirely', () => {
    render(<Heatmap grid={undefined} sport="soccer" />);
    expect(screen.getByText(/no heatmap data available/i)).toBeInTheDocument();
  });

  it('renders a canvas for a real grid, sized to the grid dimensions', () => {
    // A 25-column x 14-row grid, matching what a 1280x720 video with the
    // analyzer's 50px cell size actually produces — the old fixed
    // 3-column CSS grid this replaces would have scrambled this entirely.
    const grid = Array.from({ length: 14 }, () => Array.from({ length: 25 }, () => 0));
    grid[3][10] = 42;
    render(<Heatmap grid={grid} sport="soccer" />);

    const canvas = screen.getByRole('img', { name: /player position density heatmap/i });
    expect(canvas.tagName).toBe('CANVAS');
    expect(screen.queryByText(/no player positions were recorded/i)).not.toBeInTheDocument();
    expect(screen.getByText(/peak density/i)).toBeInTheDocument();
  });

  it('flags an all-zero grid as having no recorded positions', () => {
    const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
    render(<Heatmap grid={grid} sport="soccer" />);

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText(/no player positions were recorded/i)).toBeInTheDocument();
  });

  it('renders the low/high density legend for a populated grid', () => {
    const grid = [[1, 2], [3, 4]];
    render(<Heatmap grid={grid} sport="basketball" />);

    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('does not throw when grid rows have uneven lengths or unusual data', () => {
    expect(() => render(<Heatmap grid={[[1, 2, 3]]} sport="hockey" />)).not.toThrow();
  });
});
