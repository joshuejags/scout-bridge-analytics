import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Toast from './Toast';
import './VideoUpload.css';

const VideoUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [teamRes, playerRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/teams`),
          axios.get(`${process.env.REACT_APP_API_URL}/players`),
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

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('uploadedBy', 'user@example.com');
    if (selectedTeam) formData.append('team', selectedTeam);
    if (selectedOpponent) formData.append('opponentTeam', selectedOpponent);
    selectedPlayers.forEach((playerId) => formData.append('players', playerId));

    setUploading(true);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/videos/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        },
      });

      setFile(null);
      setSelectedTeam('');
      setSelectedOpponent('');
      setSelectedPlayers([]);
      setProgress(0);
      setMessage('Upload succeeded!');
      if (onUploadSuccess) onUploadSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-upload">
      <h2>Upload Match Highlight</h2>
      <form onSubmit={handleUpload}>
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

        <button type="submit" disabled={uploading || !file}>
          {uploading ? `Uploading... ${progress}%` : 'Upload Video'}
        </button>
      </form>
      {message && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
    </div>
  );
};

export default VideoUpload;
