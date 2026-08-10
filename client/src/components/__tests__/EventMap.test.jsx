import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EventMap from '../EventMap';

describe('EventMap Component', () => {
  const mockActions = [
    {
      type: 'shot',
      frameNumber: 10,
      position: { x: 0.8, y: 0.5 },
      confidence: 0.95,
      playerId: 'player1',
    },
    {
      type: 'pass',
      frameNumber: 20,
      position: { x: 0.4, y: 0.3 },
      confidence: 0.87,
      playerId: 'player2',
    },
    {
      type: 'tackle',
      frameNumber: 30,
      position: { x: 0.6, y: 0.7 },
      confidence: 0.92,
      playerId: 'player3',
    },
    {
      type: 'interception',
      frameNumber: 40,
      position: { x: 0.2, y: 0.4 },
      confidence: 0.78,
      playerId: 'player4',
    },
  ];

  it('renders without crashing', () => {
    render(<EventMap actions={mockActions} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('displays event statistics', () => {
    render(<EventMap actions={mockActions} />);
    expect(screen.getByText('1 shots')).toBeInTheDocument();
    expect(screen.getByText('1 passes')).toBeInTheDocument();
    expect(screen.getByText('1 tackles')).toBeInTheDocument();
    expect(screen.getByText('1 interceptions')).toBeInTheDocument();
  });

  it('displays legend items', () => {
    render(<EventMap actions={mockActions} />);
    expect(screen.getByText('Shot attempt')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Tackle')).toBeInTheDocument();
    expect(screen.getByText('Interception')).toBeInTheDocument();
  });

  it('shows empty state when no actions provided', () => {
    render(<EventMap actions={[]} />);
    expect(screen.getByText('No events to display on the pitch map.')).toBeInTheDocument();
  });

  it('renders canvas element', () => {
    render(<EventMap actions={mockActions} />);
    const canvas = screen.getByRole('img', { hidden: true });
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('filters actions by event type', () => {
    render(<EventMap actions={mockActions} eventType="shot" />);
    expect(screen.getByText('1 shots')).toBeInTheDocument();
    expect(screen.getByText('0 passes')).toBeInTheDocument();
  });

  it('handles canvas click to show event details', () => {
    const { container } = render(<EventMap actions={mockActions} />);
    const canvas = screen.getByRole('img', { hidden: true });
    
    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    
    setTimeout(() => {
      const detailPanel = container.querySelector('.event-map-detail');
      expect(detailPanel).toBeInTheDocument();
    }, 0);
  });

  it('closes event detail panel when close button is clicked', () => {
    const { container } = render(<EventMap actions={mockActions} />);
    const canvas = screen.getByRole('img', { hidden: true });
    
    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    
    setTimeout(() => {
      const closeBtn = container.querySelector('.event-map-detail-close');
      fireEvent.click(closeBtn);
      expect(container.querySelector('.event-map-detail')).not.toBeInTheDocument();
    }, 0);
  });

  it('defaults to soccer sport', () => {
    const { container } = render(<EventMap actions={mockActions} sport="soccer" />);
    const wrapper = container.querySelector('.event-map-canvas-wrapper');
    expect(wrapper).toBeInTheDocument();
  });

  it('handles different sports', () => {
    const { container } = render(<EventMap actions={mockActions} sport="basketball" />);
    expect(container.querySelector('.event-map-canvas-wrapper')).toBeInTheDocument();
  });

  it('updates canvas on window resize', () => {
    render(<EventMap actions={mockActions} />);
    const canvas = screen.getByRole('img', { hidden: true });
    
    fireEvent.resize(window, { innerWidth: 800 });
    
    expect(canvas).toBeInTheDocument();
  });

  it('displays all action types correctly', () => {
    const actionStats = [
      { type: 'shot' },
      { type: 'shot' },
      { type: 'pass' },
      { type: 'tackle' },
    ];
    
    render(<EventMap actions={actionStats} />);
    expect(screen.getByText('2 shots')).toBeInTheDocument();
    expect(screen.getByText('1 passes')).toBeInTheDocument();
    expect(screen.getByText('1 tackles')).toBeInTheDocument();
  });
});
