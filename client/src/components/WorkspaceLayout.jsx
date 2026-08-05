import React, { useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { roleLabels, workspaceNavigation } from '../config/workspace';
import './WorkspaceLayout.css';

const breadcrumbLabels = {
  dashboard: 'Analytics dashboard',
  admin: 'Admin portal',
  scouting: 'Scout portal',
  reports: 'Saved reports',
  search: 'Search workspace',
  'team-portal': 'Team portal',
  'player-portal': 'Player portal',
  teams: 'Teams',
  players: 'Players',
  compare: 'Compare',
  analysis: 'Analysis',
};

const WorkspaceLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { openUpload } = useUpload();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role || 'scout';
  const navigation = workspaceNavigation[role] || workspaceNavigation.scout;

  const breadcrumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [{ label: 'Overview', to: '/' }];

    return [
      { label: 'Overview', to: '/' },
      ...segments.map((segment, index) => ({
        label: breadcrumbLabels[segment] || segment.replace(/-/g, ' '),
        to: `/${segments.slice(0, index + 1).join('/')}`,
      })),
    ];
  }, [location.pathname]);

  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="workspace-shell">
      <aside className={`workspace-sidebar ${sidebarOpen ? 'workspace-sidebar--open' : ''}`}>
        <div className="workspace-sidebar__header">
          <Link to="/" className="workspace-brand" onClick={closeSidebar}>
            <span className="workspace-brand__mark" aria-hidden="true" />
            <span>
              <strong>ScoutBridge</strong>
              <small>{roleLabels[role]} workspace</small>
            </span>
          </Link>
          <button type="button" className="workspace-sidebar__close" onClick={closeSidebar} aria-label="Close sidebar">
            ×
          </button>
        </div>

        <div className="workspace-role-card">
          <span className="workspace-role-card__eyebrow">Signed in as</span>
          <strong>{user?.name || 'ScoutBridge user'}</strong>
          <span className="workspace-role-card__role">{roleLabels[role]}</span>
        </div>

        <nav className="workspace-nav" aria-label="Workspace">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `workspace-nav__item ${isActive ? 'active' : ''}`}
                onClick={closeSidebar}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="workspace-sidebar__footer">
          {role !== 'player' && (
            <button type="button" className="button button-primary workspace-sidebar__action" onClick={openUpload}>
              + Upload video
            </button>
          )}
          <button type="button" className="button button-secondary workspace-sidebar__logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <button type="button" className="workspace-backdrop" aria-label="Close sidebar" onClick={closeSidebar} />}

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <div className="workspace-breadcrumbs" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.to}>
                  {index > 0 && <span className="workspace-breadcrumbs__sep">/</span>}
                  {index === breadcrumbs.length - 1 ? (
                    <span className="workspace-breadcrumbs__current">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.to}>{crumb.label}</Link>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="workspace-topbar__meta">
              <span className="pill pill--neutral">{roleLabels[role]}</span>
              <span className="workspace-topbar__hint">Use Ctrl/Cmd + K for quick search</span>
            </div>
          </div>
          <div className="workspace-topbar__actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => window.dispatchEvent(new Event('sba:open-command-palette'))}
            >
              Search
            </button>
            <button type="button" className="workspace-topbar__menu" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              ☰
            </button>
          </div>
        </header>

        <div className="workspace-content">{children}</div>
      </div>
    </div>
  );
};

export default WorkspaceLayout;
