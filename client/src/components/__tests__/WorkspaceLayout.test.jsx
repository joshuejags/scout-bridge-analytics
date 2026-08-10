import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WorkspaceLayout from '../WorkspaceLayout';

const mockLogout = jest.fn();
const mockOpenUpload = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Ada Scout', role: 'scout' },
    logout: mockLogout,
  }),
}));

jest.mock('../../context/UploadContext', () => ({
  useUpload: () => ({
    openUpload: mockOpenUpload,
  }),
}));

describe('WorkspaceLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders role-aware navigation and opens upload from the sidebar CTA', async () => {
    render(
      <MemoryRouter initialEntries={['/teams']}>
        <WorkspaceLayout>
          <div>Team page body</div>
        </WorkspaceLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Teams' })).toBeInTheDocument();
    expect(screen.getAllByText('Scout').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: '+ Upload video' }));
    expect(mockOpenUpload).toHaveBeenCalled();
  });
});
