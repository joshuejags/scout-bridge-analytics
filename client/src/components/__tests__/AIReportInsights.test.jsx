import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AIReportInsights from '../AIReportInsights';
import { generateAIReport, formatReportForExport } from '../../utils/reportGenerator';

describe('AIReportInsights', () => {
  const mockAnalysis = {
    actions: [
      { type: 'shot', confidence: 0.95, position: { x: 0.85, y: 0.5 } },
      { type: 'pass', confidence: 0.90, position: { x: 0.5, y: 0.5 }, to: { x: 0.6, y: 0.4 } },
      { type: 'pass', confidence: 0.85, position: { x: 0.4, y: 0.5 }, to: { x: 0.5, y: 0.6 } },
      { type: 'tackle', confidence: 0.88, position: { x: 0.2, y: 0.5 } },
      { type: 'interception', confidence: 0.92, position: { x: 0.3, y: 0.4 } },
    ],
    playerData: [
      {
        name: 'John Doe',
        position: 'CM',
        statistics: {
          distanceCovered: 9200,
          sprintCount: 18,
          acceleration: 12,
          topSpeed: 32.5,
        },
      },
    ],
    ballPossession: [
      { team: 'Team A', duration: 1200 },
      { team: 'Team B', duration: 800 },
    ],
    video: {
      originalName: 'Match Highlights',
      sport: 'soccer',
      createdAt: '2024-01-15T10:30:00Z',
    },
  };

  describe('Rendering', () => {
    it('should render empty state when no analysis provided', () => {
      render(<AIReportInsights analysis={null} />);
      expect(screen.getByText(/No analysis data available/i)).toBeInTheDocument();
    });

    it('should render report summary', () => {
      render(<AIReportInsights analysis={mockAnalysis} />);
      expect(screen.getByText(/Executive Summary/i)).toBeInTheDocument();
    });

    it('should render metrics section with values', () => {
      render(<AIReportInsights analysis={mockAnalysis} />);
      expect(screen.getByText(/Expected Goals \(xG\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Expected Assists \(xA\)/i)).toBeInTheDocument();
    });

    it('should render strengths section', () => {
      render(<AIReportInsights analysis={mockAnalysis} />);
      expect(screen.getByText(/Strengths/i)).toBeInTheDocument();
    });

    it('should render development plan', () => {
      render(<AIReportInsights analysis={mockAnalysis} />);
      expect(screen.getByText(/Development Plan/i)).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render compact summary when compact prop is true', () => {
      const { container } = render(<AIReportInsights analysis={mockAnalysis} compact={true} />);
      expect(container.querySelector('.ai-report-compact')).toBeInTheDocument();
    });

    it('should show recommendation badge in compact mode', () => {
      render(<AIReportInsights analysis={mockAnalysis} compact={true} />);
      const summary = screen.getByText(/Outstanding all-around performance/i);
      expect(summary).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      // Mock document methods for file download
      global.URL.createObjectURL = jest.fn();
      global.document.createElement = jest.fn((...args) => {
        if (args[0] === 'a') {
          return {
            setAttribute: jest.fn(),
            style: {},
            click: jest.fn(),
          };
        }
        return document.createElement(...args);
      });
    });

    it('should show export buttons when showExport is true', () => {
      render(<AIReportInsights analysis={mockAnalysis} showExport={true} />);
      expect(screen.getByText(/Export as Markdown/i)).toBeInTheDocument();
      expect(screen.getByText(/Export as JSON/i)).toBeInTheDocument();
    });

    it('should not show export buttons when showExport is false', () => {
      render(<AIReportInsights analysis={mockAnalysis} showExport={false} />);
      expect(screen.queryByText(/Export/i)).not.toBeInTheDocument();
    });
  });

  describe('Report Generation', () => {
    it('should generate strengths for high distance covered', () => {
      const report = generateAIReport(mockAnalysis);
      const strengthAreas = report.strengths.map(s => s.area);
      expect(strengthAreas).toContain('Movement & Endurance');
    });

    it('should generate strengths for high sprint count', () => {
      const report = generateAIReport(mockAnalysis);
      const strengthAreas = report.strengths.map(s => s.area);
      expect(strengthAreas).toContain('Intensity & Explosiveness');
    });

    it('should generate recommendation score', () => {
      const report = generateAIReport(mockAnalysis);
      expect(report.recommendation.score).toBeGreaterThan(50);
      expect(report.recommendation.label).toBeTruthy();
    });

    it('should have confidence levels on strengths', () => {
      const report = generateAIReport(mockAnalysis);
      report.strengths.forEach(strength => {
        expect(strength.confidence).toBeGreaterThan(0);
        expect(strength.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Export Formats', () => {
    it('should export report as markdown', () => {
      const report = generateAIReport(mockAnalysis);
      const markdown = formatReportForExport(report, 'markdown');
      expect(markdown).toContain('# Scouting Report');
      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('## Strengths');
    });

    it('should export report as JSON', () => {
      const report = generateAIReport(mockAnalysis);
      const json = formatReportForExport(report, 'json');
      const parsed = JSON.parse(json);
      expect(parsed.timestamp).toBeTruthy();
      expect(parsed.strengths).toBeInstanceOf(Array);
    });

    it('should include metrics in markdown export', () => {
      const report = generateAIReport(mockAnalysis);
      const markdown = formatReportForExport(report, 'markdown');
      expect(markdown).toContain('Expected Goals (xG)');
      expect(markdown).toContain('Expected Assists (xA)');
      expect(markdown).toContain('Pass Completion');
    });
  });

  describe('Recommendation Scoring', () => {
    it('should rate high-performing players higher', () => {
      const highPerformer = {
        ...mockAnalysis,
        playerData: [{
          ...mockAnalysis.playerData[0],
          statistics: {
            distanceCovered: 10000,
            sprintCount: 25,
          },
        }],
        actions: [
          ...mockAnalysis.actions,
          { type: 'shot', confidence: 0.85 },
          { type: 'pass', confidence: 0.88 },
        ],
      };

      const report = generateAIReport(highPerformer);
      expect(report.recommendation.score).toBeGreaterThan(70);
    });

    it('should rate low-performing players lower', () => {
      const lowPerformer = {
        actions: [
          { type: 'pass', confidence: 0.40 },
        ],
        playerData: [{
          name: 'Player',
          statistics: {
            distanceCovered: 2000,
            sprintCount: 1,
          },
        }],
        ballPossession: [],
        video: {},
      };

      const report = generateAIReport(lowPerformer);
      expect(report.recommendation.score).toBeLessThan(50);
    });
  });

  describe('Development Areas Identification', () => {
    it('should identify decision-making as development area for active but inaccurate players', () => {
      const analysis = {
        actions: Array(10).fill({ type: 'pass', confidence: 0.50 }),
        playerData: [{
          name: 'Player',
          statistics: { distanceCovered: 8000, sprintCount: 10 },
        }],
        ballPossession: [],
        video: {},
      };

      const report = generateAIReport(analysis);
      const hasDecisionMaking = report.developmentAreas.some(
        area => area.area.includes('Decision')
      );
      expect(hasDecisionMaking).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const { container } = render(<AIReportInsights analysis={mockAnalysis} />);
      const headings = container.querySelectorAll('h3');
      expect(headings.length).toBeGreaterThan(0);
      headings.forEach(h => {
        expect(h.className).toContain('section-title');
      });
    });

    it('should have semantic HTML structure', () => {
      const { container } = render(<AIReportInsights analysis={mockAnalysis} />);
      const sections = container.querySelectorAll('.report-section');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('should have descriptive button labels', () => {
      render(<AIReportInsights analysis={mockAnalysis} />);
      expect(screen.getByText(/Export as Markdown/i)).toBeInTheDocument();
      expect(screen.getByText(/Export as JSON/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should render with proper CSS classes', () => {
      const { container } = render(<AIReportInsights analysis={mockAnalysis} />);
      expect(container.querySelector('.ai-report-insights')).toBeInTheDocument();
      expect(container.querySelector('.report-section')).toBeInTheDocument();
      expect(container.querySelector('.metrics-grid')).toBeInTheDocument();
    });
  });
});
