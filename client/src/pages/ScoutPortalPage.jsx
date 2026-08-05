import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import SavedFilterPresets from '../components/SavedFilterPresets';
import { FlameIcon, TargetIcon, UsersIcon, WarningIcon } from '../components/icons';
import { scoutingPriorities, scoutingStages } from '../config/workspace';
import { apiUrl } from '../utils/api';
import './ScoutPortalPage.css';

const DEFAULT_FORM = {
  playerId: '',
  stage: 'watchlist',
  priority: 'medium',
  fitScore: 75,
  note: '',
  nextAction: '',
  dueDate: '',
};

const DEFAULT_FILTERS = {
  stage: 'all',
  priority: 'all',
  searchQuery: '',
};

const stageLabelMap = scoutingStages.reduce((acc, stage) => {
  acc[stage.value] = stage.label;
  return acc;
}, {});

const ScoutPortalPage = () => {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [createForm, setCreateForm] = useState(DEFAULT_FORM);
  const [editorState, setEditorState] = useState(DEFAULT_FORM);
  const [filterState, setFilterState] = useState(DEFAULT_FILTERS);

  const loadBoard = async (preferredTargetId) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(apiUrl('/scouting/board'));
      setBoard(data);

      const nextSelectedTarget =
        data.targets.find((target) => target._id === preferredTargetId) ||
        data.targets.find((target) => target._id === selectedTargetId) ||
        data.targets[0] ||
        null;

      setSelectedTargetId(nextSelectedTarget?._id || null);
      setEditorState(nextSelectedTarget ? targetToForm(nextSelectedTarget) : DEFAULT_FORM);
      if (!createForm.playerId && data.availablePlayers[0]) {
        setCreateForm((prev) => ({ ...prev, playerId: data.availablePlayers[0]._id }));
      }
    } catch (err) {
      console.error('Error loading scouting board:', err);
      setError(err.response?.data?.error || "Couldn't load the scout portal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTarget = useMemo(
    () => board?.targets.find((target) => target._id === selectedTargetId) || null,
    [board?.targets, selectedTargetId]
  );

  const filteredTargets = useMemo(() => {
    if (!board?.targets) return [];

    const query = filterState.searchQuery.trim().toLowerCase();
    return board.targets.filter((target) => {
      const matchesStage = filterState.stage === 'all' || target.stage === filterState.stage;
      const matchesPriority = filterState.priority === 'all' || target.priority === filterState.priority;
      const haystack = [target.player?.name, target.player?.team?.name, target.note, target.nextAction, stageLabelMap[target.stage], target.priority]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesStage && matchesPriority && matchesSearch;
    });
  }, [board?.targets, filterState.priority, filterState.searchQuery, filterState.stage]);

  const groupedTargets = useMemo(() => {
    const initial = scoutingStages.reduce((acc, stage) => {
      acc[stage.value] = [];
      return acc;
    }, {});
    filteredTargets.forEach((target) => {
      if (!initial[target.stage]) initial[target.stage] = [];
      initial[target.stage].push(target);
    });
    return initial;
  }, [filteredTargets]);

  const topTargets = useMemo(
    () =>
      [...filteredTargets]
        .sort((a, b) => {
          const priorityRank = { high: 0, medium: 1, low: 2 };
          return priorityRank[a.priority] - priorityRank[b.priority];
        })
        .slice(0, 5),
    [filteredTargets]
  );

  const handleApplyPreset = (preset) => {
    setFilterState({
      stage: preset.filters?.stage || 'all',
      priority: preset.filters?.priority || 'all',
      searchQuery: preset.filters?.searchQuery || '',
    });
  };

  const handleCreateTarget = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const payload = normalizeFormPayload(createForm);
      const { data } = await axios.post(apiUrl('/scouting/targets'), payload);
      setToast({ type: 'success', message: `${data.player.name} is now on your scouting board.` });
      setCreateForm(DEFAULT_FORM);
      await loadBoard(data._id);
    } catch (err) {
      console.error('Error creating scouting target:', err);
      setToast({ type: 'error', message: err.response?.data?.error || 'Could not add player to scouting board.' });
    } finally {
      setCreating(false);
    }
  };

  const handleEditorSave = async (event) => {
    event.preventDefault();
    if (!selectedTarget) return;
    setSavingId(selectedTarget._id);
    try {
      const payload = normalizeFormPayload(editorState);
      const { data } = await axios.patch(apiUrl(`/scouting/targets/${selectedTarget._id}`), payload);
      setToast({ type: 'success', message: `${data.player.name} updated.` });
      await loadBoard(data._id);
    } catch (err) {
      console.error('Error updating scouting target:', err);
      setToast({ type: 'error', message: err.response?.data?.error || 'Could not save scouting changes.' });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteTarget = async () => {
    if (!selectedTarget) return;
    setSavingId(selectedTarget._id);
    try {
      await axios.delete(apiUrl(`/scouting/targets/${selectedTarget._id}`));
      setToast({ type: 'success', message: 'Removed target from scouting board.' });
      await loadBoard();
    } catch (err) {
      console.error('Error deleting scouting target:', err);
      setToast({ type: 'error', message: err.response?.data?.error || 'Could not remove scouting target.' });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading scout portal..." />;
  }

  return (
    <div className="page-shell page-shell--wide scout-portal">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Scout portal</div>
          <h1 className="page-title">Recruitment board built for real scouting decisions.</h1>
          <p className="page-lead">
            Move prospects from discovery to shortlist, keep notes in one workspace, and make the next live-view decision
            obvious.
          </p>
        </div>
      </div>

      {error && (
        <div className="home-stats-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => loadBoard()}>
            Retry
          </button>
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <section className="kpi-grid scout-portal__kpis">
        <article className="kpi-card">
          <span className="scout-portal__kpi-icon"><TargetIcon size={20} /></span>
          <span className="kpi-card__value">{board?.summary.totalTargets || 0}</span>
          <span className="kpi-card__label">Tracked prospects</span>
        </article>
        <article className="kpi-card">
          <span className="scout-portal__kpi-icon"><FlameIcon size={20} /></span>
          <span className="kpi-card__value">{board?.summary.highPriority || 0}</span>
          <span className="kpi-card__label">High-priority targets</span>
        </article>
        <article className="kpi-card">
          <span className="scout-portal__kpi-icon"><UsersIcon size={20} /></span>
          <span className="kpi-card__value">{board?.summary.activeDecisions || 0}</span>
          <span className="kpi-card__label">Live or final decisions</span>
        </article>
        <article className="kpi-card">
          <span className="scout-portal__kpi-icon"><WarningIcon size={20} /></span>
          <span className="kpi-card__value">{board?.summary.dueThisWeek || 0}</span>
          <span className="kpi-card__label">Actions due this week</span>
        </article>
      </section>

      <div className="scout-portal__layout">
        <div className="scout-portal__main">
          <SavedFilterPresets scope="scouting" currentFilters={filterState} onApplyPreset={handleApplyPreset} />

          <section className="surface-card scout-portal__create-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Add a prospect</h2>
                <p className="card-subtitle">Save the next player to review, assign a stage, and keep a clear next action.</p>
              </div>
            </div>

            <form className="scout-portal__form-grid" onSubmit={handleCreateTarget}>
              <label>
                Player
                <select
                  value={createForm.playerId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, playerId: event.target.value }))}
                  required
                >
                  <option value="" disabled>
                    Select a player
                  </option>
                  {board?.availablePlayers.map((player) => (
                    <option key={player._id} value={player._id}>
                      {player.name}{player.team?.name ? ` - ${player.team.name}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stage
                <select
                  value={createForm.stage}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, stage: event.target.value }))}
                >
                  {scoutingStages.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={createForm.priority}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, priority: event.target.value }))}
                >
                  {scoutingPriorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fit score
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={createForm.fitScore}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, fitScore: event.target.value }))}
                />
              </label>
              <label className="scout-portal__field--wide">
                Scout note
                <textarea
                  rows="3"
                  value={createForm.note}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="What makes this player worth tracking?"
                />
              </label>
              <label>
                Next action
                <input
                  type="text"
                  value={createForm.nextAction}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, nextAction: event.target.value }))}
                  placeholder="Book live view, request more clips..."
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </label>
              <div className="scout-portal__form-actions">
                <button type="submit" className="button button-primary" disabled={creating || !createForm.playerId}>
                  {creating ? 'Adding...' : 'Add to board'}
                </button>
              </div>
            </form>
          </section>

          <section className="surface-card scout-portal__pipeline-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Recruitment pipeline</h2>
                <p className="card-subtitle">Keep every prospect in a visible stage so handoffs and decisions stay aligned.</p>
              </div>
            </div>
 
            <div className="scout-portal__filters">
              <label>
                <span>Search</span>
                <input
                  type="text"
                  value={filterState.searchQuery}
                  onChange={(event) => setFilterState((prev) => ({ ...prev, searchQuery: event.target.value }))}
                  placeholder="Search by player, team, or note"
                />
              </label>
              <label>
                <span>Stage</span>
                <select
                  value={filterState.stage}
                  onChange={(event) => setFilterState((prev) => ({ ...prev, stage: event.target.value }))}
                >
                  <option value="all">All stages</option>
                  {scoutingStages.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={filterState.priority}
                  onChange={(event) => setFilterState((prev) => ({ ...prev, priority: event.target.value }))}
                >
                  <option value="all">All priorities</option>
                  {scoutingPriorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setFilterState({ ...DEFAULT_FILTERS })}
              >
                Reset
              </button>
            </div>
 
            {filteredTargets.length ? (
              <div className="scout-portal__pipeline">
                {scoutingStages.map((stage) => (
                  <div key={stage.value} className="scout-stage-column">
                    <div className="scout-stage-column__header">
                      <strong>{stage.label}</strong>
                      <span>{groupedTargets[stage.value]?.length || 0}</span>
                    </div>
                    <div className="scout-stage-column__body">
                      {groupedTargets[stage.value]?.length ? (
                        groupedTargets[stage.value].map((target) => (
                          <button
                            key={target._id}
                            type="button"
                            className={`scout-target-card ${selectedTargetId === target._id ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedTargetId(target._id);
                              setEditorState(targetToForm(target));
                            }}
                          >
                            <div className="scout-target-card__top">
                              <span className={`pill pill--${priorityTone(target.priority)}`}>{target.priority}</span>
                              <span className="scout-target-card__score">{target.fitScore}</span>
                            </div>
                            <strong>{target.player?.name}</strong>
                            <span>{target.player?.team?.name || 'Independent'} · {target.player?.position || 'Unassigned role'}</span>
                            {target.note ? <p>{target.note}</p> : <p>Add a scouting note to capture the why.</p>}
                          </button>
                        ))
                      ) : (
                        <div className="empty-state-card scout-stage-column__empty">No prospects in this stage yet.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-card">
                Build your first watchlist from the player database to start tracking discovery, live views, and decision-ready
                targets.
              </div>
            )}
          </section>
        </div>

        <aside className="scout-portal__side">
          <section className="surface-card scout-portal__focus-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Priority board</h2>
                <p className="card-subtitle">The next players that should move your recruitment meeting forward.</p>
              </div>
              <Link to="/reports" className="button button-ghost">
                Saved reports
              </Link>
            </div>
            {topTargets.length ? (
              <div className="scout-priority-list">
                {topTargets.map((target) => (
                  <button
                    key={target._id}
                    type="button"
                    className={`scout-priority-item ${selectedTargetId === target._id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedTargetId(target._id);
                      setEditorState(targetToForm(target));
                    }}
                  >
                    <div>
                      <strong>{target.player?.name}</strong>
                      <span>{stageLabelMap[target.stage]}</span>
                    </div>
                    <span className={`pill pill--${priorityTone(target.priority)}`}>{target.priority}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state-card">No saved prospects yet.</div>
            )}
          </section>

          <section className="surface-card scout-portal__editor-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Target editor</h2>
                <p className="card-subtitle">Keep the note, fit, and next live-view step current.</p>
              </div>
            </div>

            {selectedTarget ? (
              <form className="scout-portal__editor-form" onSubmit={handleEditorSave}>
                <div className="scout-portal__editor-summary">
                  <strong>{selectedTarget.player?.name}</strong>
                  <span>{selectedTarget.player?.team?.name || 'Independent'} · {selectedTarget.player?.position || 'Unassigned role'}</span>
                </div>

                <label>
                  Stage
                  <select
                    value={editorState.stage}
                    onChange={(event) => setEditorState((prev) => ({ ...prev, stage: event.target.value }))}
                  >
                    {scoutingStages.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={editorState.priority}
                    onChange={(event) => setEditorState((prev) => ({ ...prev, priority: event.target.value }))}
                  >
                    {scoutingPriorities.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fit score
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editorState.fitScore}
                    onChange={(event) => setEditorState((prev) => ({ ...prev, fitScore: event.target.value }))}
                  />
                </label>
                <label>
                  Next action
                  <input
                    type="text"
                    value={editorState.nextAction}
                    onChange={(event) => setEditorState((prev) => ({ ...prev, nextAction: event.target.value }))}
                  />
                </label>
                <label>
                  Due date
                  <input
                    type="date"
                    value={editorState.dueDate}
                    onChange={(event) => setEditorState((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </label>
                <label>
                  Scout note
                  <textarea
                    rows="5"
                    value={editorState.note}
                    onChange={(event) => setEditorState((prev) => ({ ...prev, note: event.target.value }))}
                  />
                </label>
                <div className="scout-portal__editor-actions">
                  <button type="submit" className="button button-primary" disabled={savingId === selectedTarget._id}>
                    {savingId === selectedTarget._id ? 'Saving...' : 'Save target'}
                  </button>
                  <button type="button" className="button button-secondary" onClick={handleDeleteTarget} disabled={savingId === selectedTarget._id}>
                    Remove
                  </button>
                </div>
              </form>
            ) : (
              <div className="empty-state-card">Pick a target from the pipeline to edit your note and next action.</div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

function priorityTone(priority) {
  return priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'neutral';
}

function normalizeFormPayload(form) {
  return {
    ...form,
    fitScore: Number(form.fitScore),
    dueDate: form.dueDate || null,
  };
}

function targetToForm(target) {
  return {
    playerId: target.player?._id || '',
    stage: target.stage,
    priority: target.priority,
    fitScore: target.fitScore,
    note: target.note || '',
    nextAction: target.nextAction || '',
    dueDate: target.dueDate ? String(target.dueDate).slice(0, 10) : '',
  };
}

export default ScoutPortalPage;
