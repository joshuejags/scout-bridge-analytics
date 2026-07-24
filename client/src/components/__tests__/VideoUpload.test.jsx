import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import VideoUpload from '../VideoUpload';

jest.mock('axios');

const makeFile = () => new File(['dummy content'], 'match.mp4', { type: 'video/mp4' });

describe('VideoUpload sport selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes('/teams')) return Promise.resolve({ data: [] });
      if (url.includes('/players')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it('defaults the sport selector to soccer', async () => {
    render(<VideoUpload onUploadSuccess={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Sport')).toBeInTheDocument());
    expect(screen.getByLabelText('Sport')).toHaveValue('soccer');
  });

  it('submits the selected sport as part of the upload', async () => {
    axios.post.mockResolvedValueOnce({ data: { _id: 'v1', sport: 'basketball' } });
    const onUploadSuccess = jest.fn();
    render(<VideoUpload onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => expect(screen.getByLabelText('Sport')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Sport'), 'basketball');

    const fileInput = screen.getByLabelText('Highlight File');
    await userEvent.upload(fileInput, makeFile());

    await userEvent.click(screen.getByRole('button', { name: /upload video/i }));

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalled());

    const [, formData] = axios.post.mock.calls[0];
    expect(formData.get('sport')).toBe('basketball');
  });
});
