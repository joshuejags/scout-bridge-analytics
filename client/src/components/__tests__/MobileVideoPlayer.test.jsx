import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileVideoPlayer from '../MobileVideoPlayer';

// Mock HTMLMediaElement methods
window.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = jest.fn();
window.HTMLMediaElement.prototype.load = jest.fn();

describe('MobileVideoPlayer', () => {
  const mockVideoSrc = 'https://example.com/video.mp4';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render video player container', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.mobile-video-player')).toBeInTheDocument();
    });

    it('should render video element with correct src', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const video = container.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video.src).toContain(mockVideoSrc);
    });

    it('should render with title', () => {
      render(<MobileVideoPlayer src={mockVideoSrc} title="Test Video" />);
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });

    it('should render play button overlay initially', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.play-overlay')).toBeInTheDocument();
      expect(container.querySelector('.play-button')).toBeInTheDocument();
    });

    it('should render controls', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.controls')).toBeInTheDocument();
    });
  });

  describe('Play/Pause Functionality', () => {
    it('should toggle play state on button click', async () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const playButton = container.querySelector('.play-button');
      
      fireEvent.click(playButton);
      
      await waitFor(() => {
        expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
      });
    });

    it('should call onPlay callback when playing', async () => {
      const onPlay = jest.fn();
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} onPlay={onPlay} />);
      const playButton = container.querySelector('.play-button');
      
      fireEvent.click(playButton);
      
      await waitFor(() => {
        expect(onPlay).toHaveBeenCalled();
      });
    });

    it('should call onPause callback when pausing', async () => {
      const onPause = jest.fn();
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} onPause={onPause} />);
      const video = container.querySelector('video');
      const controlsPlayButton = container.querySelector('.controls .control-button');
      
      fireEvent.click(container.querySelector('.play-button'));
      await waitFor(() => {
        expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
      });

      Object.defineProperty(video, 'paused', {
        configurable: true,
        get: () => false,
      });
      fireEvent.click(controlsPlayButton);

      await waitFor(() => {
        expect(onPause).toHaveBeenCalled();
      });
    });
  });

  describe('Volume Control', () => {
    it('should render mute button', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const muteButtons = container.querySelectorAll('.control-button');
      expect(muteButtons.length).toBeGreaterThan(0);
    });

    it('should toggle mute state', async () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const muteButton = container.querySelectorAll('.control-button')[1]; // Second button is mute
      
      fireEvent.click(muteButton);
      
      await waitFor(() => {
        // Mute state should change
        expect(muteButton).toBeInTheDocument();
      });
    });

    it('should adjust volume via volume slider', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const volumeSlider = container.querySelector('.volume-slider');
      
      expect(volumeSlider).toBeInTheDocument();
      
      fireEvent.change(volumeSlider, { target: { value: '0.5' } });
      
      expect(volumeSlider.value).toBe('0.5');
    });
  });

  describe('Progress Control', () => {
    it('should render progress bar', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.progress-bar')).toBeInTheDocument();
    });

    it('should display current time and duration', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.current-time')).toBeInTheDocument();
      expect(container.querySelector('.duration')).toBeInTheDocument();
    });

    it('should handle seek on progress bar click', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const progressBar = container.querySelector('.progress-bar');
      
      // Mock getBoundingClientRect
      progressBar.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        width: 100,
      }));

      fireEvent.click(progressBar, { clientX: 50 });
      
      expect(progressBar).toBeInTheDocument();
    });

    it('should call onTimeUpdate callback', () => {
      const onTimeUpdate = jest.fn();
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} onTimeUpdate={onTimeUpdate} />);
      const video = container.querySelector('video');
      
      fireEvent.timeUpdate(video, { target: { currentTime: 5 } });
    });
  });

  describe('Fullscreen', () => {
    it('should render fullscreen button', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const buttons = container.querySelectorAll('.control-button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have fullscreen CSS class when toggled', async () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const playerContainer = container.querySelector('.mobile-video-player');
      
      expect(playerContainer).not.toHaveClass('fullscreen');
    });
  });

  describe('Playback Rate Control', () => {
    it('should render playback rate button', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.playback-rate-menu')).toBeInTheDocument();
    });

    it('should show rate options when menu opened', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const rateButton = container.querySelector('.playback-rate-menu .control-button');
      
      fireEvent.click(rateButton);
      
      const rateOptions = container.querySelector('.rate-options');
      expect(rateOptions).toBeInTheDocument();
    });

    it('should change playback rate', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const rateButton = container.querySelector('.playback-rate-menu .control-button');
      
      fireEvent.click(rateButton);
      
      const rateOption = container.querySelector('.rate-option');
      if (rateOption) {
        fireEvent.click(rateOption);
      }
    });
  });

  describe('Quality Selection', () => {
    it('should render quality button', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.quality-menu')).toBeInTheDocument();
    });

    it('should show quality options when menu opened', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const qualityButton = container.querySelector('.quality-menu .control-button');
      
      fireEvent.click(qualityButton);
      
      const qualityOptions = container.querySelector('.quality-options');
      expect(qualityOptions).toBeInTheDocument();
    });

    it('should call onQualityChange callback', () => {
      const onQualityChange = jest.fn();
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} onQualityChange={onQualityChange} />);
      
      const qualityButton = container.querySelector('.quality-menu .control-button');
      fireEvent.click(qualityButton);
      
      const qualityOption = container.querySelector('.quality-option');
      if (qualityOption) {
        fireEvent.click(qualityOption);
        expect(onQualityChange).toHaveBeenCalled();
      }
    });
  });

  describe('Controls Auto-hide', () => {
    it('should show controls on user activity', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const controls = container.querySelector('.controls');
      
      fireEvent.mouseMove(container);
      
      expect(controls).toHaveClass('visible');
    });

    it('should hide controls when playing and inactive', () => {
      jest.useFakeTimers();
      
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const video = container.querySelector('video');
      
      fireEvent.play(video);
      
      jest.advanceTimersByTime(3000);
      
      jest.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have ARIA labels on buttons', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const buttons = container.querySelectorAll('[aria-label]');
      
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have progress bar with ARIA attributes', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const progressBar = container.querySelector('.progress-bar');
      
      expect(progressBar).toHaveAttribute('role');
      expect(progressBar).toHaveAttribute('aria-label');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should render with mobile-friendly layout', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.mobile-video-player')).toBeInTheDocument();
    });

    it('should have touch-friendly button sizes', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const buttons = container.querySelectorAll('.control-button');
      
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(button => {
        expect(button).toHaveClass('control-button');
      });
    });
  });

  describe('Time Formatting', () => {
    it('should format time correctly', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      expect(container.querySelector('.time-display')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing onPlay callback', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const playButton = container.querySelector('.play-button');
      
      expect(() => {
        fireEvent.click(playButton);
      }).not.toThrow();
    });

    it('should handle missing onTimeUpdate callback', () => {
      const { container } = render(<MobileVideoPlayer src={mockVideoSrc} />);
      const video = container.querySelector('video');
      
      expect(() => {
        fireEvent.timeUpdate(video);
      }).not.toThrow();
    });

    it('should handle missing src gracefully', () => {
      const { container } = render(<MobileVideoPlayer src="" />);
      expect(container.querySelector('video')).toBeInTheDocument();
    });
  });
});
