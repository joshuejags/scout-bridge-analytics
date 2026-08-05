import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Toast from './Toast';
import { uploadFileInChunks } from '../utils/chunkedUpload';
import { apiUrl } from '../utils/api';
import './VideoUpload.css';

const SPORTS = [
  { value: 'soccer', label: 'Soccer' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'hockey', label: 'Hockey' },
  { value: 'rugby', label: 'Rugby' },
];

const VideoUpload = ({ onUploadSuccess }) => {
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [sport, setSport] = useState('soccer');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [teamRes, playerRes] = await Promise.all([
          axios.get(apiUrl('/teams')),
          axios.get(apiUrl('/players')),
        ]);
        setTeams(teamRes.data);
        setPlayers(playerRes.data);
      } catch (err) {
        console.error('Error loading teams or players:', err);
      }
    };

    fetchMeta();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handlePlayerSelection = (event) => {
    const selected = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedPlayers(selected);
  };

  const resetFormFields = () => {
    setFile(null);
    setVideoUrl('');
    setSelectedTeam('');
    setSelectedOpponent('');
    setSelectedPlayers([]);
    setSport('soccer');
    setProgress(0);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (mode === 'file' && !file) {
      setError('Please select a file');
      return;
    }
    if (mode === 'url' && !videoUrl.trim()) {
      setError('Please paste a video URL');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      if (mode === 'file') {
        // Uploaded as a sequence of chunks rather than one long-lived
        // multipart POST — see utils/chunkedUpload.js for why (resilience
        // against a dropped connection, and reverse-proxy/load-balancer
        // idle-timeout limits on very large single requests).
        const video = await uploadFileInChunks(
          file,
          {
            sport,
            team: selectedTeam || undefined,
            opponentTeam: selectedOpponent || undefined,
            players: selectedPlayers,
          },
          { onProgress: setProgress }
        );
        setMessage('Upload succeeded!');
        if (onUploadSuccess) onUploadSuccess(video);
      } else {
        // The server responds as soon as the import is queued (202) and
        // downloads the file in the background; see
        // videoController.importVideoFromUrl. VideoList picks up progress
        // from there over the video:import:* socket events.
        const response = await axios.post(apiUrl('/videos/import-url'), {
          url: videoUrl.trim(),
          sport,
          team: selectedTeam || undefined,
          opponentTeam: selectedOpponent || undefined,
          players: selectedPlayers,
        });
        setMessage('Import started. The video will appear once the download finishes.');
        if (onUploadSuccess) onUploadSuccess(response.data);
      }

      resetFormFields();
    } catch (err) {
      setError(err.response?.data?.error || (mode === 'file' ? 'Upload failed' : 'Import failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-upload surface-card">
      <div className="card-title-row">
        <div>
          <h2 className="card-title">Upload match highlight</h2>
          <p className="card-subtitle">Add a video file or import a supported link for analysis.</p>
        </div>
      </div>
      <form onSubmit={handleUpload}>
        <div className="form-row">
          <label htmlFor="sport">Sport</label>
          <select
            id="sport"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            disabled={uploading}
          >
            {SPORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="team">Team</label>
          <select
            id="team"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            disabled={uploading}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="opponentTeam">Opponent Team</label>
          <select
            id="opponentTeam"
            value={selectedOpponent}
            onChange={(e) => setSelectedOpponent(e.target.value)}
            disabled={uploading}
          >
            <option value="">Select opponent</option>
            {teams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="players">Players</label>
          <select
            id="players"
            multiple
            value={selectedPlayers}
            onChange={handlePlayerSelection}
            disabled={uploading}
          >
            {players.map((player) => (
              <option key={player._id} value={player._id}>
                {player.name} {player.team?.name ? `(${player.team.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row upload-mode-toggle" role="group" aria-label="Video source">
          <button
            type="button"
            className={mode === 'file' ? 'upload-mode-btn active' : 'upload-mode-btn'}
            onClick={() => setMode('file')}
            disabled={uploading}
          >
            Upload file
          </button>
          <button
            type="button"
            className={mode === 'url' ? 'upload-mode-btn active' : 'upload-mode-btn'}
            onClick={() => setMode('url')}
            disabled={uploading}
          >
            From URL
          </button>
        </div>

        {mode === 'file' ? (
          <div className="form-row">
            <label htmlFor="videoFile">Highlight File</label>
            <input
              id="videoFile"
              type="file"
              onChange={handleFileChange}
              accept="video/*"
              disabled={uploading}
            />
          </div>
        ) : (
          <div className="form-row">
            <label htmlFor="videoUrl">Video URL</label>
            <input
              id="videoUrl"
              type="url"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={uploading}
            />
            <p className="upload-url-hint">
              Works with YouTube, Instagram, TikTok, Facebook, X/Twitter, and Vimeo links.
            </p>
          </div>
        )}

        <button type="submit" disabled={uploading || (mode === 'file' ? !file : !videoUrl.trim())}>
          {uploading
            ? mode === 'file'
              ? `Uploading... ${progress}%`
              : 'Starting import...'
            : mode === 'file'
            ? 'Upload Video'
            : 'Import Video'}
        </button>
        {uploading && mode === 'file' && (
          <div className="upload-progress" aria-label="Upload progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
      </form>
      {message && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
    </div>
  );
};

export default VideoUpload;
