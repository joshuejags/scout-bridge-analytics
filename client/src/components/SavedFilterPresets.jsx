import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../utils/api';
import './SavedFilterPresets.css';

const SavedFilterPresets = ({ scope, currentFilters, onApplyPreset }) => {
  const [presets, setPresets] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const loadPresets = async () => {
      try {
        const { data } = await axios.get(apiUrl('/filter-presets'), { params: { scope } });
        setPresets(data);
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.error || 'Unable to load saved filters.' });
      } finally {
        setLoading(false);
      }
    };

    loadPresets();
  }, [scope]);

  const summary = useMemo(() => {
    if (!currentFilters) {
      return 'No filters applied';
    }

    const entries = Object.entries(currentFilters).filter(([, value]) => value && value !== 'all');
    if (entries.length === 0) {
      return 'No custom filters';
    }

    return entries
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' • ');
  }, [currentFilters]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Please name your preset before saving.' });
      return;
    }

    setSaving(true);
    try {
      const { data } = await axios.post(apiUrl('/filter-presets'), {
        name: name.trim(),
        scope,
        filters: currentFilters || {},
      });
      setPresets((prev) => [data, ...prev]);
      setName('');
      setMessage({ type: 'success', text: 'Preset saved to your workspace.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Unable to save filter preset.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (presetId) => {
    try {
      await axios.delete(apiUrl(`/filter-presets/${presetId}`));
      setPresets((prev) => prev.filter((preset) => preset._id !== presetId));
      setMessage({ type: 'success', text: 'Preset removed.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Unable to delete preset.' });
    }
  };

  return (
    <section className="saved-filter-presets surface-card">
      <div className="saved-filter-presets__header">
        <div>
          <h3 className="saved-filter-presets__title">Saved presets</h3>
          <p className="saved-filter-presets__summary">{summary}</p>
        </div>
        <span className="saved-filter-presets__badge">{scope}</span>
      </div>

      <form className="saved-filter-presets__form" onSubmit={handleSave}>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name this filter view"
          aria-label="Filter preset name"
        />
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save preset'}
        </button>
      </form>

      {message && (
        <div className={`saved-filter-presets__message saved-filter-presets__message--${message.type}`}>{message.text}</div>
      )}

      <div className="saved-filter-presets__list">
        {loading ? (
          <div className="saved-filter-presets__empty">Loading presets…</div>
        ) : presets.length === 0 ? (
          <div className="saved-filter-presets__empty">No saved presets yet. Save the current view to reuse it later.</div>
        ) : (
          presets.map((preset) => (
            <div key={preset._id} className="saved-filter-presets__item">
              <div>
                <strong>{preset.name}</strong>
                <p>{preset.filters ? Object.keys(preset.filters).length : 0} filters saved</p>
              </div>
              <div className="saved-filter-presets__actions">
                <button type="button" className="button button-secondary" onClick={() => onApplyPreset(preset)}>
                  Apply
                </button>
                <button type="button" className="button button-ghost" onClick={() => handleDelete(preset._id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default SavedFilterPresets;
