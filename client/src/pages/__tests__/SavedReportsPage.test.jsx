import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import SavedReportsPage from '../SavedReportsPage';

jest.mock('axios');

const createObjectURL = jest.fn(() => 'blob:test');
const revokeObjectURL = jest.fn();
let anchorClickSpy;

beforeAll(() => {
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;
  anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterAll(() => {
  anchorClickSpy.mockRestore();
});

describe('SavedReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: [
        {
          _id: 'r1',
          title: 'Weekend report',
          summary: 'High-energy winger profile.',
          tags: ['priority', 'winger'],
          template: 'recruitment-decision',
          insightSnapshot: {
            recommendation: { label: 'Priority live view', score: 82 },
            confidence: { label: 'High confidence', score: 74 },
            metrics: { totalActions: 4 },
            recruitmentSignals: ['2 shots flagged final-third involvement worth a second pass.'],
            tacticalSignals: ['Blue held 40.0m width with 11.0m compactness across 2 lines (4-3).'],
            eventBreakdown: [{ type: 'shot', count: 2 }],
          },
          updatedAt: '2026-08-05T12:00:00.000Z',
          video: { _id: 'v1', originalName: 'weekend.mp4', sport: 'soccer', status: 'analyzed' },
        },
      ],
    });
  });

  it('renders saved reports and filters them by tag', async () => {
    render(
      <MemoryRouter>
        <SavedReportsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Weekend report')).toBeInTheDocument();
    expect(screen.getByText('Priority live view')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'priority' }));
    expect(screen.getByRole('link', { name: 'Open report' })).toHaveAttribute('href', '/analysis/v1');
  });

  it('filters by template and exports markdown', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'r1',
            title: 'Weekend report',
            summary: 'High-energy winger profile.',
            tags: ['priority', 'winger'],
            template: 'recruitment-decision',
            insightSnapshot: {
              recommendation: { label: 'Priority live view', score: 82 },
              confidence: { label: 'High confidence', score: 74 },
              metrics: { totalActions: 4 },
              recruitmentSignals: ['2 shots flagged final-third involvement worth a second pass.'],
              tacticalSignals: ['Blue held 40.0m width with 11.0m compactness across 2 lines (4-3).'],
              eventBreakdown: [{ type: 'shot', count: 2 }],
            },
            updatedAt: '2026-08-05T12:00:00.000Z',
            video: { _id: 'v1', originalName: 'weekend.mp4', sport: 'soccer', status: 'analyzed' },
          },
        ],
      })
      .mockResolvedValueOnce({ data: new Blob(['# report']) });
    axios.patch.mockResolvedValue({
      data: {
        _id: 'r1',
        title: 'Weekend report',
        summary: 'High-energy winger profile.',
        tags: ['priority', 'winger'],
        template: 'player-development',
        insightSnapshot: {
          recommendation: { label: 'Priority live view', score: 82 },
          confidence: { label: 'High confidence', score: 74 },
          metrics: { totalActions: 4 },
          recruitmentSignals: ['2 shots flagged final-third involvement worth a second pass.'],
          tacticalSignals: ['Blue held 40.0m width with 11.0m compactness across 2 lines (4-3).'],
          eventBreakdown: [{ type: 'shot', count: 2 }],
        },
        updatedAt: '2026-08-05T12:00:00.000Z',
        video: { _id: 'v1', originalName: 'weekend.mp4', sport: 'soccer', status: 'analyzed' },
      },
    });

    render(
      <MemoryRouter>
        <SavedReportsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Weekend report')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recruitment decision' }));
    await userEvent.selectOptions(screen.getByLabelText('Template for Weekend report'), 'player-development');
    expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining('/reports/saved/r1'), { template: 'player-development' });
    await userEvent.click(screen.getByRole('button', { name: 'Player development' }));
    await userEvent.click(screen.getByRole('button', { name: 'Export markdown' }));

    expect(axios.get).toHaveBeenLastCalledWith(expect.stringContaining('/reports/saved/r1/export'), { responseType: 'blob' });
    expect(createObjectURL).toHaveBeenCalled();
  });
});
