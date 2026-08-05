import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import SearchFilter from '../components/SearchFilter';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import SavedFilterPresets from '../components/SavedFilterPresets';
import { apiUrl } from '../utils/api';
import './SavedReportsPage.css';

const templateLabels = {
  'scout-summary': 'Scout summary',
  'recruitment-decision': 'Recruitment decision',
  'player-development': 'Player development',
};

const SavedReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [updatingReportId, setUpdatingReportId] = useState(null);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const response = await axios.get(apiUrl('/reports/saved'));
        setReports(response.data);
      } catch (err) {
        console.error('Error loading saved reports:', err);
        setError(err.response?.data?.error || 'Unable to load saved reports.');
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  const availableTags = useMemo(
    () => [...new Set(reports.flatMap((report) => report.tags || []))].sort(),
    [reports]
  );

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const text = `${report.title} ${report.summary} ${(report.tags || []).join(' ')} ${report.video?.originalName || ''}`.toLowerCase();
        const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
        const matchesTag = tagFilter === 'all' || (report.tags || []).includes(tagFilter);
        const matchesTemplate = templateFilter === 'all' || report.template === templateFilter;
        return matchesSearch && matchesTag && matchesTemplate;
      }),
    [reports, searchQuery, tagFilter, templateFilter]
  );

  const filters = [
    { id: 'all', label: 'All tags', active: tagFilter === 'all' },
    ...availableTags.map((tag) => ({ id: tag, label: tag, active: tagFilter === tag })),
  ];

  const templateFilters = [
    { id: 'all', label: 'All templates', active: templateFilter === 'all' },
    ...Object.entries(templateLabels).map(([value, label]) => ({ id: value, label, active: templateFilter === value })),
  ];

  const currentReportFilters = useMemo(
    () => ({ searchQuery, tagFilter, templateFilter }),
    [searchQuery, tagFilter, templateFilter]
  );

  const handleApplyPreset = (preset) => {
    setSearchQuery(preset.filters?.searchQuery || '');
    setTagFilter(preset.filters?.tagFilter || 'all');
    setTemplateFilter(preset.filters?.templateFilter || 'all');
  };

  const exportReport = async (reportId) => {
    try {
      const response = await axios.get(apiUrl(`/reports/saved/${reportId}/export`), { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'text/markdown' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'scoutbridge-report.md';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      setToast({ type: 'success', message: 'Report export started.' });
    } catch (err) {
      console.error('Error exporting report:', err);
      setToast({ type: 'error', message: err.response?.data?.error || 'Unable to export report.' });
    }
  };

  const updateTemplate = async (reportId, template) => {
    setUpdatingReportId(reportId);
    try {
      const response = await axios.patch(apiUrl(`/reports/saved/${reportId}`), { template });
      setReports((prev) => prev.map((report) => (report._id === reportId ? response.data : report)));
      setToast({ type: 'success', message: 'Report template updated.' });
    } catch (err) {
      console.error('Error updating report template:', err);
      setToast({ type: 'error', message: err.response?.data?.error || 'Unable to update report template.' });
    } finally {
      setUpdatingReportId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading saved reports..." />;
  }

  return (
    <div className="page-shell page-shell--wide saved-reports-page">
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Saved reports</div>
          <h1 className="page-title">Your reusable scouting report history.</h1>
          <p className="page-lead">
            Reopen the reports worth sharing, filter by tags, and keep curated analysis outputs in one premium review surface.
          </p>
        </div>
      </div>

      <SavedFilterPresets scope="reports" currentFilters={currentReportFilters} onApplyPreset={handleApplyPreset} />

      <SearchFilter
        title="Report filters"
        placeholder="Search saved reports, notes, tags, or video names..."
        value={searchQuery}
        onChange={setSearchQuery}
        summary={`${filteredReports.length} saved`}
        onClear={() => {
          setSearchQuery('');
          setTagFilter('all');
          setTemplateFilter('all');
        }}
        filters={filters}
        onFilterChange={setTagFilter}
      />

      <div className="saved-reports-template-filters">
        {templateFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`filter-btn ${filter.active ? 'active' : ''}`}
            onClick={() => setTemplateFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredReports.length === 0 ? (
        <div className="surface-card empty-state-card">
          No saved reports match the current filters. Save a report from any analysis page to populate this workspace.
        </div>
      ) : (
        <section className="saved-reports-grid">
          {filteredReports.map((report) => (
            <article key={report._id} className="surface-card saved-report-card">
              <div className="saved-report-card__top">
                <div>
                  <span className="page-kicker">{report.video?.sport || 'soccer'} report</span>
                  <h2 className="card-title">{report.title}</h2>
                </div>
                <div className="saved-report-card__status">
                  <span className="pill pill--neutral">{templateLabels[report.template] || 'Scout summary'}</span>
                  <span className={`pill pill--${report.video?.status === 'analyzed' ? 'success' : report.video?.status === 'failed' ? 'danger' : 'warning'}`}>
                    {report.video?.status || 'saved'}
                  </span>
                </div>
              </div>
              <p className="saved-report-card__summary">{report.summary}</p>
              {report.insightSnapshot && (
                <>
                  <div className="saved-report-card__insight-metrics">
                    <span className="pill pill--neutral">{report.insightSnapshot.recommendation?.label || 'Monitor'}</span>
                    <span className="pill pill--neutral">Score {report.insightSnapshot.recommendation?.score || 0}</span>
                    <span className="pill pill--neutral">{report.insightSnapshot.confidence?.label || 'Low confidence'}</span>
                    <span className="pill pill--neutral">{report.insightSnapshot.metrics?.totalActions || 0} events</span>
                  </div>
                  <div className="saved-report-card__insight-columns">
                    {(report.insightSnapshot.recruitmentSignals || []).length > 0 && (
                      <div className="saved-report-card__insight-list">
                        <h3>Recruitment signals</h3>
                        <ul>
                          {report.insightSnapshot.recruitmentSignals.slice(0, 3).map((signal) => (
                            <li key={signal}>{signal}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(report.insightSnapshot.tacticalSignals || []).length > 0 && (
                      <div className="saved-report-card__insight-list">
                        <h3>Tactical notes</h3>
                        <ul>
                          {report.insightSnapshot.tacticalSignals.slice(0, 2).map((signal) => (
                            <li key={signal}>{signal}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {(report.insightSnapshot.eventBreakdown || []).length > 0 && (
                    <div className="analysis-actions">
                      {report.insightSnapshot.eventBreakdown.map((event) => (
                        <span key={`${report._id}-${event.type}`} className="pill pill--neutral">
                          {event.count} {event.type}
                          {event.count === 1 ? '' : 's'}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="saved-report-card__meta">
                <span>{report.video?.originalName || 'Analysis report'}</span>
                <span>{new Date(report.updatedAt).toLocaleDateString()}</span>
              </div>
              <label className="saved-report-card__template-control">
                <span>Template</span>
                <select
                  aria-label={`Template for ${report.title}`}
                  value={report.template || 'scout-summary'}
                  disabled={updatingReportId === report._id}
                  onChange={(event) => updateTemplate(report._id, event.target.value)}
                >
                  {Object.entries(templateLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {(report.tags || []).length > 0 && (
                <div className="analysis-actions">
                  {report.tags.map((tag) => (
                    <span key={tag} className="pill pill--neutral">{tag}</span>
                  ))}
                </div>
              )}
              <div className="saved-report-card__actions">
                {report.video?._id && (
                  <Link to={`/analysis/${report.video._id}`} className="button button-primary">Open report</Link>
                )}
                <button type="button" className="button button-secondary" onClick={() => exportReport(report._id)}>
                  Export markdown
                </button>
                <Link to="/players" className="button button-secondary">Open player database</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default SavedReportsPage;
