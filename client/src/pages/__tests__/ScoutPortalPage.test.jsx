import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import ScoutPortalPage from '../ScoutPortalPage';

jest.mock('axios');

const boardResponse = {
  summary: {
    totalTargets: 1,
    highPriority: 1,
    activeDecisions: 0,
    dueThisWeek: 0,
    byStage: {
      discovered: 1,
      'under-review': 0,
      shortlisted: 0,
      scouted: 0,
      recommended: 0,
      trial: 0,
      signed: 0,
      rejected: 0,
    },
  },
  stages: ['discovered', 'under-review', 'shortlisted', 'scouted', 'recommended', 'trial', 'signed', 'rejected'],
  targets: [
    {
      _id: 'target-1',
      stage: 'discovered',
      priority: 'high',
      fitScore: 82,
      note: 'Explosive outlet option on the weak side.',
      nextAction: 'Schedule live view.',
      dueDate: '2099-02-01T00:00:00.000Z',
      player: {
        _id: 'player-1',
        name: 'Tobi Winger',
        position: 'Winger',
        team: { name: 'Rivers United' },
      },
    },
  ],
  availablePlayers: [
    {
      _id: 'player-2',
      name: 'Sam Playmaker',
      position: 'Midfielder',
      team: { name: 'Metro FC' },
    },
  ],
};

describe('ScoutPortalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes('/scouting/board')) return Promise.resolve({ data: boardResponse });
      if (url.includes('/filter-presets')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    axios.patch.mockResolvedValue({
      data: {
        ...boardResponse.targets[0],
        stage: 'shortlisted',
        priority: 'medium',
        fitScore: 84,
      },
    });
  });

  it('renders scouting targets and saves updates from the editor', async () => {
    render(
      <MemoryRouter>
        <ScoutPortalPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Recruitment board built for real scouting decisions.')).toBeInTheDocument();
    expect(screen.getAllByText('Tobi Winger').length).toBeGreaterThan(0);
    expect(screen.getByText('Tracked prospects')).toBeInTheDocument();

    const editorSection = screen.getByRole('heading', { name: 'Target editor' }).closest('section');
    await userEvent.selectOptions(within(editorSection).getByLabelText('Stage'), 'shortlisted');
    await userEvent.selectOptions(within(editorSection).getByLabelText('Priority'), 'medium');
    await userEvent.clear(within(editorSection).getByLabelText('Fit score'));
    await userEvent.type(within(editorSection).getByLabelText('Fit score'), '84');
    await userEvent.click(within(editorSection).getByRole('button', { name: 'Save target' }));

    await waitFor(() =>
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/scouting/targets/target-1'),
        expect.objectContaining({
          stage: 'shortlisted',
          priority: 'medium',
          fitScore: 84,
        })
      )
    );
  });
});
