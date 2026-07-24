import React, { useState } from 'react';
import axios from 'axios';
import Toast from './Toast';
import { useAuthedMedia } from '../utils/useAuthedMedia';
import './PlayerVerification.css';

const uploadsBase = () =>
  (process.env.REACT_APP_API_URL || '').replace(/\/api\/?$/, '');

/**
 * Thumbnails live behind the protected /uploads route, and a plain <img>
 * can't attach an Authorization header, so each thumbnail is fetched as an
 * authenticated blob individually (one hook instance per card, since hooks
 * can't be called inside the parent's .map() loop).
 */
const AuthedThumbnail = ({ src, alt }) => {
  const { blobUrl } = useAuthedMedia(src);
  if (!blobUrl) {
    return <div className="pv-thumb-placeholder">Loading...</div>;
  }
  return <img src={blobUrl} alt={alt} className="pv-thumb" />;
};

const PlayerVerification = ({ analysis, players, onAnalysisUpdate }) => {
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [editingTrackId, setEditingTrackId] = useState(null);
  const [draftJersey, setDraftJersey] = useState('');
  const [draftPlayerId, setDraftPlayerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const analysisId = analysis._id;
  const tracks = analysis.playerData || [];

  const filteredTracks = tracks.filter((t) => {
    if (filter === 'unverified') return !t.verified;
    if (filter === 'identified') return t.jerseyNumber != null || t.playerId;
    return true;
  });

  const toggleSelect = (trackId) => {
    setSelectedTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const startEdit = (track) => {
    setEditingTrackId(track.trackId);
    setDraftJersey(track.jerseyNumber != null ? String(track.jerseyNumber) : '');
    setDraftPlayerId(track.playerId?._id || track.playerId || '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingTrackId(null);
    setDraftJersey('');
    setDraftPlayerId('');
  };

  const saveEdit = async (trackId) => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        jerseyNumber: draftJersey === '' ? null : Number(draftJersey),
        playerId: draftPlayerId === '' ? null : draftPlayerId,
      };
      const response = await axios.patch(
        `${process.env.REACT_APP_API_URL}/analysis/${analysisId}/tracks/${trackId}`,
        body
      );
      onAnalysisUpdate(response.data);
      setMessage('Player identity updated.');
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update track.');
    } finally {
      setBusy(false);
    }
  };

  const mergeSelected = async () => {
    if (selectedTrackIds.length !== 2) return;
    const [targetTrackId, sourceTrackId] = selectedTrackIds;
    setBusy(true);
    setError(null);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/analysis/${analysisId}/tracks/merge`,
        { sourceTrackId, targetTrackId }
      );
      onAnalysisUpdate(response.data);
      setMessage('Tracks merged into one player.');
      setSelectedTrackIds([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to merge tracks.');
    } finally {
      setBusy(false);
    }
  };

  const identifiedCount = tracks.filter((t) => t.jerseyNumber != null || t.playerId).length;
  const verifiedCount = tracks.filter((t) => t.verified).length;

  return (
    <div className="player-verification">
      <div className="pv-header">
        <div>
          <h3>Verify Players</h3>
          <p className="pv-subtitle">
            {tracks.length} tracked {tracks.length === 1 ? 'entity' : 'entities'} ·{' '}
            {identifiedCount} identified · {verifiedCount} human-verified
          </p>
        </div>
        <div className="pv-filters">
          <button
            className={`pv-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`pv-filter-btn ${filter === 'unverified' ? 'active' : ''}`}
            onClick={() => setFilter('unverified')}
          >
            Unverified
          </button>
          <button
            className={`pv-filter-btn ${filter === 'identified' ? 'active' : ''}`}
            onClick={() => setFilter('identified')}
          >
            Identified
          </button>
        </div>
      </div>

      {message && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <p className="pv-hint">
        Select exactly two cards to merge them into one player (use this when the same person
        appears as two tracks). Click a card's "Edit" button to set a jersey number or link it to
        a roster player.
      </p>

      {selectedTrackIds.length === 2 && (
        <div className="pv-merge-bar">
          <span>Merge track {selectedTrackIds[1]} into track {selectedTrackIds[0]}?</span>
          <button onClick={mergeSelected} disabled={busy} className="pv-merge-confirm">
            {busy ? 'Merging...' : 'Merge'}
          </button>
          <button onClick={() => setSelectedTrackIds([])} className="pv-merge-cancel">
            Cancel
          </button>
        </div>
      )}

      <div className="pv-grid">
        {filteredTracks.map((track) => {
          const isSelected = selectedTrackIds.includes(track.trackId);
          const isEditing = editingTrackId === track.trackId;
          const thumbUrl = track.thumbnail
            ? `${uploadsBase()}/uploads/thumbnails/${track.thumbnail}`
            : null;
          const label = track.playerId?.name
            ? track.playerId.name
            : track.jerseyNumber != null
            ? `#${track.jerseyNumber}`
            : `Track ${track.trackId}`;

          return (
            <div
              key={track.trackId}
              className={`pv-card ${isSelected ? 'pv-card-selected' : ''} ${
                track.verified ? 'pv-card-verified' : ''
              }`}
            >
              <div className="pv-thumb-wrap" onClick={() => toggleSelect(track.trackId)}>
                {thumbUrl ? (
                  <AuthedThumbnail src={thumbUrl} alt={`Track ${track.trackId}`} />
                ) : (
                  <div className="pv-thumb-placeholder">No image</div>
                )}
                {isSelected && <div className="pv-check">✓</div>}
              </div>

              <div className="pv-card-body">
                <p className="pv-card-label">{label}</p>
                {track.teamColor && <p className="pv-card-color">{track.teamColor} kit</p>}
                {track.verified && <span className="pv-verified-tag">Verified</span>}

                {isEditing ? (
                  <div className="pv-edit-form">
                    <label>
                      Jersey #
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={draftJersey}
                        onChange={(e) => setDraftJersey(e.target.value)}
                      />
                    </label>
                    <label>
                      Roster player
                      <select
                        value={draftPlayerId}
                        onChange={(e) => setDraftPlayerId(e.target.value)}
                      >
                        <option value="">Unlinked</option>
                        {players.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} {p.jerseyNumber != null ? `(#${p.jerseyNumber})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="pv-edit-actions">
                      <button
                        onClick={() => saveEdit(track.trackId)}
                        disabled={busy}
                        className="pv-save-btn"
                      >
                        Save
                      </button>
                      <button onClick={cancelEdit} className="pv-cancel-btn">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="pv-edit-btn" onClick={() => startEdit(track)}>
                    Edit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredTracks.length === 0 && (
        <p className="pv-empty">No tracks match this filter.</p>
      )}
    </div>
  );
};

export default PlayerVerification;
