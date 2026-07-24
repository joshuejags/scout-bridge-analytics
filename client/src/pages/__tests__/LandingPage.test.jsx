import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../LandingPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );

describe('LandingPage', () => {
  it('renders without requiring authentication and shows sign-up/sign-in CTAs', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /get started free/i })).toHaveAttribute(
      'href',
      '/register'
    );
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('shows the first feature detail by default and switches on tab click', async () => {
    renderPage();

    expect(screen.getByText(/every player on the pitch is detected/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /jersey recognition/i }));

    expect(
      screen.getByText(/jersey numbers are read automatically/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/every player on the pitch is detected/i)).not.toBeInTheDocument();
  });

  it('expands and collapses "how it works" steps on click', async () => {
    renderPage();

    // First step starts open by default (openStep initialized to 0).
    expect(screen.getByText(/drop in a match video/i)).toBeInTheDocument();

    const secondStepButton = screen.getByRole('button', { name: /let it analyze/i });
    await userEvent.click(secondStepButton);
    expect(screen.getByText(/analyzed in the background/i)).toBeInTheDocument();
    expect(screen.queryByText(/drop in a match video/i)).not.toBeInTheDocument();

    // Clicking the open step again collapses it.
    await userEvent.click(secondStepButton);
    expect(screen.queryByText(/analyzed in the background/i)).not.toBeInTheDocument();
  });

  it('labels the sample report as sample data, not real results', () => {
    renderPage();
    expect(screen.getByText(/sample data/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in to analyze your own footage/i)).toBeInTheDocument();
  });

  it('has a final call-to-action linking to registration', () => {
    renderPage();
    const ctas = screen.getAllByRole('link', { name: /get started free|create a free account/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/register'));
  });
});
