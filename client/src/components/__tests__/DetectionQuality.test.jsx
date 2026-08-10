import React from 'react';
import { render, screen } from '@testing-library/react';
import DetectionQuality from '../DetectionQuality';

describe('DetectionQuality', () => {
  const mockMetrics = {
    totalActionsDetected: 25,
    averageActionConfidence: 0.85,
    detectionCoverage: 0.88,
    qualityScore: 82,
    detectionDensity: 0.12,
  };

  describe('Rendering', () => {
    it('should not render when metrics are empty', () => {
      const { container } = render(<DetectionQuality metrics={{}} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render full quality report when metrics provided', () => {
      render(<DetectionQuality metrics={mockMetrics} />);
      expect(screen.getByText('Detection Quality Report')).toBeInTheDocument();
    });

    it('should render compact view when compact prop is true', () => {
      const { container } = render(<DetectionQuality metrics={mockMetrics} compact={true} />);
      expect(container.querySelector('.detection-quality-compact')).toBeInTheDocument();
    });

    it('should display all metric items', () => {
      render(<DetectionQuality metrics={mockMetrics} />);
      expect(screen.getByText('Actions Detected')).toBeInTheDocument();
      expect(screen.getByText('Average Confidence')).toBeInTheDocument();
      expect(screen.getByText('High-Confidence Coverage')).toBeInTheDocument();
      expect(screen.getByText('Detection Density')).toBeInTheDocument();
    });
  });

  describe('Quality Scoring', () => {
    it('should display correct quality label for high score', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 85 }} />);
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('should display correct quality label for good score', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 65 }} />);
      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('should display correct quality label for fair score', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 45 }} />);
      expect(screen.getByText('Fair')).toBeInTheDocument();
    });

    it('should display correct quality label for poor score', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 25 }} />);
      expect(screen.getByText('Poor')).toBeInTheDocument();
    });

    it('should display correct quality label for very poor score', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 5 }} />);
      expect(screen.getByText('Very Poor')).toBeInTheDocument();
    });
  });

  describe('Metrics Display', () => {
    it('should display total actions detected', () => {
      render(<DetectionQuality metrics={mockMetrics} />);
      const actionValue = screen.getByText('25');
      expect(actionValue).toBeInTheDocument();
    });

    it('should display average confidence as percentage', () => {
      render(<DetectionQuality metrics={mockMetrics} />);
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should display detection coverage as percentage', () => {
      render(<DetectionQuality metrics={mockMetrics} />);
      expect(screen.getByText('88%')).toBeInTheDocument();
    });

    it('should display detection density with decimal precision', () => {
      render(<DetectionQuality metrics={mockMetrics} />);
      expect(screen.getByText('12.00%')).toBeInTheDocument();
    });
  });

  describe('Quality Insights', () => {
    it('should show positive insight for high quality score', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 80 }} />);
      expect(screen.getByText(/Analysis is reliable for decision-making/i)).toBeInTheDocument();
    });

    it('should show warning insight for low quality score', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 50 }} />);
      expect(screen.getByText(/Recommend manual verification/i)).toBeInTheDocument();
    });

    it('should show positive insight for high average confidence', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, averageActionConfidence: 0.8 }} />);
      expect(screen.getByText(/Detections have strong confidence/i)).toBeInTheDocument();
    });

    it('should show warning insight for low average confidence', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, averageActionConfidence: 0.5 }} />);
      expect(screen.getByText(/Detections have moderate confidence/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const { container } = render(<DetectionQuality metrics={mockMetrics} />);
      const headings = container.querySelectorAll('h3, h4');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should have semantic structure', () => {
      const { container } = render(<DetectionQuality metrics={mockMetrics} />);
      expect(container.querySelector('.detection-quality')).toBeInTheDocument();
      expect(container.querySelector('.quality-metrics-grid')).toBeInTheDocument();
    });

    it('should have descriptive text for metrics', () => {
      render(<DetectionQuality metrics={mockMetrics} />);
      expect(screen.getByText(/High confidence detections/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should render with proper CSS classes', () => {
      const { container } = render(<DetectionQuality metrics={mockMetrics} />);
      expect(container.querySelector('.quality-metrics-grid')).toBeInTheDocument();
      expect(container.querySelector('.quality-insights')).toBeInTheDocument();
      expect(container.querySelector('.quality-factors')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should show badge in compact mode', () => {
      render(<DetectionQuality metrics={mockMetrics} compact={true} />);
      expect(screen.getByText('Excellent')).toBeInTheDocument();
      expect(screen.getByText('82')).toBeInTheDocument();
    });

    it('should display hint text in compact mode', () => {
      render(<DetectionQuality metrics={mockMetrics} compact={true} />);
      expect(screen.getByText('Analysis quality score based on detection confidence')).toBeInTheDocument();
    });

    it('should not show detailed metrics in compact mode', () => {
      render(<DetectionQuality metrics={mockMetrics} compact={true} />);
      expect(screen.queryByText('Detection Quality Report')).not.toBeInTheDocument();
      expect(screen.queryByText('Actions Detected')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined metrics gracefully', () => {
      const { container } = render(<DetectionQuality />);
      expect(container.firstChild).toBeNull();
    });

    it('should handle metrics with zero actions', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, totalActionsDetected: 0 }} />);
      expect(screen.getByText('No actions detected')).toBeInTheDocument();
    });

    it('should handle zero confidence', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, averageActionConfidence: 0 }} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle zero quality score', () => {
      render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 0 }} />);
      expect(screen.getByText(/Very Poor/i)).toBeInTheDocument();
    });
  });

  describe('Color Classes', () => {
    it('should apply excellent color class for high score', () => {
      const { container } = render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 85 }} />);
      expect(container.querySelector('.quality-excellent')).toBeInTheDocument();
    });

    it('should apply good color class for good score', () => {
      const { container } = render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 70 }} />);
      expect(container.querySelector('.quality-good')).toBeInTheDocument();
    });

    it('should apply fair color class for fair score', () => {
      const { container } = render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 45 }} />);
      expect(container.querySelector('.quality-fair')).toBeInTheDocument();
    });

    it('should apply poor color class for poor score', () => {
      const { container } = render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 25 }} />);
      expect(container.querySelector('.quality-poor')).toBeInTheDocument();
    });

    it('should apply veryPoor color class for very poor score', () => {
      const { container } = render(<DetectionQuality metrics={{ ...mockMetrics, qualityScore: 5 }} />);
      expect(container.querySelector('.quality-veryPoor')).toBeInTheDocument();
    });
  });
});
