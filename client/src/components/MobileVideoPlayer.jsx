import React, { useRef, useEffect, useState } from 'react';
import './MobileVideoPlayer.css';

const MobileVideoPlayer = ({ 
  src, 
  title = 'Video', 
  onTimeUpdate = null,
  onPlay = null,
  onPause = null,
  quality = 'auto',
  onQualityChange = null,
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const controlsTimeoutRef = useRef(null);

  // Auto-hide controls after 3 seconds of inactivity
  const handleUserActivity = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    if (isPlaying) {
      handleUserActivity();
    }
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [isPlaying]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
        onPlay?.();
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        onPause?.();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if (containerRef.current.webkitRequestFullscreen) {
          await containerRef.current.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.webkitFullscreenElement) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen request failed:', error);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      onTimeUpdate?.(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const handlePlaybackRateChange = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const handleQualityChange = (newQuality) => {
    setShowQualityMenu(false);
    onQualityChange?.(newQuality);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className={`mobile-video-player ${isFullscreen ? 'fullscreen' : ''}`}
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
    >
      <div className="video-container">
        <video
          ref={videoRef}
          src={src}
          className="video-element"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          poster={`${src}?t=0`}
        />

        {/* Play button overlay */}
        {!isPlaying && showControls && (
          <div 
            className="play-overlay"
            onClick={togglePlay}
          >
            <button className="play-button" aria-label="Play video">
              ▶
            </button>
          </div>
        )}

        {/* Controls */}
        <div className={`controls ${showControls ? 'visible' : 'hidden'}`}>
          {/* Progress Bar */}
          <div 
            className="progress-bar"
            onClick={handleSeek}
            role="slider"
            aria-label="Video progress"
            aria-value={currentTime}
            aria-valuemin="0"
            aria-valuemax={duration}
            tabIndex="0"
          >
            <div 
              className="progress-fill"
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            />
            <div className="progress-handle" />
          </div>

          {/* Control buttons row */}
          <div className="controls-row">
            {/* Left side: Play, Mute */}
            <div className="control-group">
              <button
                className="control-button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              <button
                className="control-button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
                aria-label="Volume"
              />
            </div>

            {/* Center: Time display */}
            <div className="time-display">
              <span className="current-time">{formatTime(currentTime)}</span>
              <span className="time-separator">/</span>
              <span className="duration">{formatTime(duration)}</span>
            </div>

            {/* Right side: Playback rate, Quality, Fullscreen */}
            <div className="control-group">
              <div className="playback-rate-menu">
                <button
                  className="control-button"
                  onClick={() => setShowControls(!showControls) || setShowQualityMenu(!showQualityMenu)}
                  aria-label="Playback speed"
                  title="Playback speed"
                >
                  {playbackRate}×
                </button>
                {showQualityMenu && (
                  <div className="rate-options">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        className={`rate-option ${rate === playbackRate ? 'active' : ''}`}
                        onClick={() => handlePlaybackRateChange(rate)}
                      >
                        {rate}×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="quality-menu">
                <button
                  className="control-button"
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  aria-label="Video quality"
                  title="Video quality"
                >
                  📶
                </button>
                {showQualityMenu && (
                  <div className="quality-options">
                    {['Auto', '1080p', '720p', '480p', '360p'].map(q => (
                      <button
                        key={q}
                        className={`quality-option ${q === quality ? 'active' : ''}`}
                        onClick={() => handleQualityChange(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="control-button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? '⛶' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Title bar */}
      <div className="player-title">
        <h4>{title}</h4>
      </div>
    </div>
  );
};

export default MobileVideoPlayer;
