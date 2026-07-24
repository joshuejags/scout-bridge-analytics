import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';
import VideoList from '../VideoList';
import { useAuth } from '../../context/AuthContext';

jest.mock('axios');
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// A minimal fake matching the subset of the socket.io-client API VideoList
// uses (on/off/emit), with a __trigger helper so tests can fire the same
// events the real server would push.
const createFakeSocket = () => {
  const handlers = {};
  return {
    connected: true,
    on: jest.fn((event, cb) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(cb);
    }),
    off: jest.fn((event, cb) => {
      if (!handlers[event]) return;
      handlers[event] = handlers[event].filter((h) => h !== cb);
    }),
    emit: jest.fn(),
    disconnect: jest.fn(),
    __trigger: async (event, payload) => {
      await act(async () => {
        await Promise.all((handlers[event] || []).map((cb) => cb(payload)));
      });
    },
  };
};

const baseVideo = {
  _id: 'vid1',
  originalName: 'match1.mp4',
  fileSize: 1024 * 1024 * 10,
  status: 'uploaded',
  createdAt: new Date().toISOString(),
};

const renderList = () =>
  render(
    <MemoryRouter>
      <VideoList />
    </MemoryRouter>
  );

describe('VideoList real-time analysis updates', () => {
  let fakeSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    fakeSocket = createFakeSocket();
    useAuth.mockReturnValue({ socket: fakeSocket });
    axios.get.mockResolvedValue({ data: [baseVideo] });
  });

  it('shows live progress percentage from analysis:progress events', async () => {
    axios.post.mockResolvedValueOnce({ status: 202, data: { status: 'queued' } });
    renderList();

    await waitFor(() => expect(screen.getByText('match1.mp4')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Process' }));

    await waitFor(() => expect(screen.getByText('queued')).toBeInTheDocument());

    // A worker actually picking the job up flips queued -> processing.
    await fakeSocket.__trigger('analysis:started', { videoId: 'vid1' });
    await waitFor(() => expect(screen.getByText('processing')).toBeInTheDocument());

    await fakeSocket.__trigger('analysis:progress', { videoId: 'vid1', frame: 30, total: 100, progress: 30 });

    await waitFor(() => expect(screen.getByText('processing (30%)')).toBeInTheDocument());
  });

  it('refreshes and clears progress on analysis:complete', async () => {
    axios.post.mockResolvedValueOnce({ status: 202, data: { status: 'queued' } });
    renderList();

    await waitFor(() => expect(screen.getByText('match1.mp4')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Process' }));
    await waitFor(() => expect(screen.getByText('queued')).toBeInTheDocument());

    await fakeSocket.__trigger('analysis:started', { videoId: 'vid1' });
    await waitFor(() => expect(screen.getByText('processing')).toBeInTheDocument());

    await fakeSocket.__trigger('analysis:progress', { videoId: 'vid1', frame: 30, total: 100, progress: 30 });
    await waitFor(() => expect(screen.getByText('processing (30%)')).toBeInTheDocument());

    axios.get.mockResolvedValueOnce({ data: [{ ...baseVideo, status: 'analyzed' }] });
    await fakeSocket.__trigger('analysis:complete', { videoId: 'vid1', analysisId: 'a1' });

    await waitFor(() => expect(screen.getByText('analyzed')).toBeInTheDocument());
    expect(screen.getByText(/analysis complete/i)).toBeInTheDocument();
  });

  it('marks the video failed and surfaces the error on analysis:failed', async () => {
    axios.post.mockResolvedValueOnce({ status: 202, data: { status: 'queued' } });
    renderList();

    await waitFor(() => expect(screen.getByText('match1.mp4')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Process' }));
    await waitFor(() => expect(screen.getByText('queued')).toBeInTheDocument());

    await fakeSocket.__trigger('analysis:failed', { videoId: 'vid1', error: 'Analyzer exited with code 1' });

    await waitFor(() => expect(screen.getByText('failed')).toBeInTheDocument());
    expect(screen.getByText('Analyzer exited with code 1')).toBeInTheDocument();
  });

  it('does not poll while a live socket is connected', async () => {
    axios.post.mockResolvedValueOnce({ status: 202, data: { status: 'queued' } });
    renderList();

    await waitFor(() => expect(screen.getByText('match1.mp4')).toBeInTheDocument());
    const getCallsBeforeProcess = axios.get.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Process' }));
    await waitFor(() => expect(screen.getByText('queued')).toBeInTheDocument());

    // Give any (incorrect) poll loop a chance to fire before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(axios.get.mock.calls.length).toBe(getCallsBeforeProcess);
  });

  it('shows a queued badge for a video queued by another connected client', async () => {
    axios.get.mockResolvedValue({ data: [baseVideo] });
    renderList();

    await waitFor(() => expect(screen.getByText('match1.mp4')).toBeInTheDocument());
    await fakeSocket.__trigger('analysis:queued', { videoId: 'vid1' });

    await waitFor(() => expect(screen.getByText('queued')).toBeInTheDocument());
  });
});
