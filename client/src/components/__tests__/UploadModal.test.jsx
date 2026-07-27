import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import UploadModal from '../UploadModal';
import { UploadProvider, useUpload } from '../../context/UploadContext';

jest.mock('axios');

// A tiny stand-in for the NavBar button, so these tests exercise the same
// open/close wiring real pages use instead of reaching into UploadModal's
// internals directly.
const OpenButton = () => {
  const { openUpload } = useUpload();
  return <button onClick={openUpload}>Open</button>;
};

const renderWithProvider = () =>
  render(
    <UploadProvider>
      <OpenButton />
      <UploadModal />
    </UploadProvider>
  );

describe('UploadModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes('/teams')) return Promise.resolve({ data: [] });
      if (url.includes('/players')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it('is not rendered until openUpload is called', () => {
    renderWithProvider();
    expect(screen.queryByLabelText('Highlight File')).not.toBeInTheDocument();
  });

  it('opens on openUpload and shows the upload form', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByLabelText('Highlight File')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByLabelText('Highlight File')).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByLabelText('Highlight File')).not.toBeInTheDocument()
    );
  });

  it('closes on the close button', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByLabelText('Highlight File')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() =>
      expect(screen.queryByLabelText('Highlight File')).not.toBeInTheDocument()
    );
  });
});
