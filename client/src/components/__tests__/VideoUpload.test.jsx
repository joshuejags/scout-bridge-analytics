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

  it('sends the selected sport in the chunked-upload init request', async () => {
    // Upload happens in three requests now (init/chunk/complete) rather
    // than one multipart POST — see utils/chunkedUpload.js.
    axios.post
      .mockResolvedValueOnce({ data: { uploadId: 'u1', expectedSize: 13, chunkSizeHint: 5 * 1024 * 1024 } })
      .mockResolvedValueOnce({ data: { bytesReceived: 13, expectedSize: 13 } })
      .mockResolvedValueOnce({ data: { _id: 'v1', sport: 'basketball' } });

    const onUploadSuccess = jest.fn();
    render(<VideoUpload onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => expect(screen.getByLabelText('Sport')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Sport'), 'basketball');

    const fileInput = screen.getByLabelText('Highlight File');
    await userEvent.upload(fileInput, makeFile());

    await userEvent.click(screen.getByRole('button', { name: /upload video/i }));

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith({ _id: 'v1', sport: 'basketball' }));

    expect(axios.post).toHaveBeenCalledTimes(3);
    const [initUrl, initBody] = axios.post.mock.calls[0];
    expect(initUrl).toContain('/videos/upload/init');
    expect(initBody).toMatchObject({ originalName: 'match.mp4', fileSize: 13, sport: 'basketball' });

    const [chunkUrl] = axios.post.mock.calls[1];
    expect(chunkUrl).toContain('/videos/upload/u1/chunk');

    const [completeUrl] = axios.post.mock.calls[2];
    expect(completeUrl).toContain('/videos/upload/u1/complete');
  });

  it('shows an error and does not call onUploadSuccess when the init request fails', async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { error: 'Only video files are allowed' } } });
    const onUploadSuccess = jest.fn();
    render(<VideoUpload onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => expect(screen.getByLabelText('Highlight File')).toBeInTheDocument());
    await userEvent.upload(screen.getByLabelText('Highlight File'), makeFile());
    await userEvent.click(screen.getByRole('button', { name: /upload video/i }));

    await waitFor(() => expect(screen.getByText('Only video files are allowed')).toBeInTheDocument());
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });
});
