import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
      discovery: 0,
      watchlist: 1,
      shortlist: 0,
      live: 0,
      decision: 0,
    },
  },
  stages: ['discovery', 'watchlist', 'shortlist', 'live', 'decision'],
  targets: [
    {
      _id: 'target-1',
      stage: 'watchlist',
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
    axios.get.mockResolvedValue({ data: boardResponse });
    axios.patch.mockResolvedValue({
      data: {
        ...boardResponse.targets[0],
        stage: 'shortlist',
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

    await userEvent.selectOptions(screen.getAllByLabelText('Stage')[1], 'shortlist');
    await userEvent.selectOptions(screen.getAllByLabelText('Priority')[1], 'medium');
    await userEvent.clear(screen.getAllByLabelText('Fit score')[1]);
    await userEvent.type(screen.getAllByLabelText('Fit score')[1], '84');
    await userEvent.click(screen.getByRole('button', { name: 'Save target' }));

    await waitFor(() =>
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/scouting/targets/target-1'),
        expect.objectContaining({
          stage: 'shortlist',
          priority: 'medium',
          fitScore: 84,
        })
      )
    );
  });
});
