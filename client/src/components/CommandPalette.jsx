import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { apiUrl } from '../utils/api';
import { SearchIcon, VideoIcon, UsersIcon, TagIcon, ChartIcon, CompassIcon } from './icons';
import './CommandPalette.css';

const STATIC_COMMANDS = [
  {
    id: 'upload',
    label: 'Upload highlight',
    description: 'Import a new match video or video link',
    icon: VideoIcon,
    action: 'upload',
    keywords: ['upload', 'video', 'import', 'highlight'],
  },
  {
    id: 'dashboard',
    label: 'Open dashboard',
    description: 'Review throughput and scouting health',
    icon: ChartIcon,
    action: 'navigate',
    to: '/dashboard',
    keywords: ['dashboard', 'analytics', 'reports'],
  },
  {
    id: 'players',
    label: 'Open players',
    description: 'Search, compare, and open player profiles',
    icon: UsersIcon,
    action: 'navigate',
    to: '/players',
    keywords: ['players', 'compare', 'profiles'],
  },
  {
    id: 'teams',
    label: 'Open teams',
    description: 'Manage squad context and opponent groups',
    icon: TagIcon,
    action: 'navigate',
    to: '/teams',
    keywords: ['teams', 'squads', 'opponents'],
  },
];

const ResultItem = ({ item, active, onSelect }) => {
  const Icon = item.icon || CompassIcon;
  return (
    <button
      type="button"
      className={`command-item ${active ? 'active' : ''}`}
      onMouseEnter={item.onHover}
      onClick={() => onSelect(item)}
    >
      <span className="command-item-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="command-item-body">
        <strong>{item.label}</strong>
        <span>{item.description}</span>
      </span>
      <span className="command-item-meta">{item.meta}</span>
    </button>
  );
};

const CommandPalette = () => {
  const { isAuthenticated } = useAuth();
  const { openUpload } = useUpload();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [videos, setVideos] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const loadSearchData = useCallback(async () => {
    if (!isAuthenticated || loaded) return;
    setLoading(true);
    setError(null);
    try {
      const [videosRes, playersRes, teamsRes] = await Promise.all([
        axios.get(apiUrl('/videos')),
        axios.get(apiUrl('/players')),
        axios.get(apiUrl('/teams')),
      ]);
      setVideos(videosRes.data || []);
      setPlayers(playersRes.data || []);
      setTeams(teamsRes.data || []);
      setLoaded(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load quick search results.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, loaded]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isShortcut) {
        event.preventDefault();
        openPalette();
      }
      if (event.key === 'Escape' && open) {
        closePalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closePalette, open, openPalette]);

  useEffect(() => {
    const handler = () => openPalette();
    window.addEventListener('sba:open-command-palette', handler);
    return () => window.removeEventListener('sba:open-command-palette', handler);
  }, [openPalette]);

  useEffect(() => {
    if (!open) return;
    loadSearchData();
    const timeout = window.setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadSearchData, open]);

  const dynamicItems = useMemo(() => {
    if (!loaded) return [];

    const videoItems = videos.map((video) => ({
      id: `video-${video._id}`,
      label: video.originalName,
      description:
        video.status === 'analyzed'
          ? 'Open scouting report'
          : video.status === 'processing'
          ? 'Processing in progress'
          : 'Open video record',
      meta: 'Video',
      icon: VideoIcon,
      keywords: [video.originalName, video.status, video.sport, 'video'],
      action: 'navigate',
      to: video.status === 'analyzed' ? `/analysis/${video._id}` : '/dashboard',
    }));

    const playerItems = players.map((player) => ({
      id: `player-${player._id}`,
      label: player.name,
      description: `${player.position || 'Unspecified position'}${player.team?.name ? ` · ${player.team.name}` : ''}`,
      meta: 'Player',
      icon: UsersIcon,
      keywords: [player.name, player.position, player.team?.name, 'player'],
      action: 'navigate',
      to: `/players/${player._id}`,
    }));

    const teamItems = teams.map((team) => ({
      id: `team-${team._id}`,
      label: team.name,
      description: team.description || 'Team workspace',
      meta: 'Team',
      icon: TagIcon,
      keywords: [team.name, team.description, 'team'],
      action: 'navigate',
      to: '/teams',
    }));

    return [...videoItems, ...playerItems, ...teamItems];
  }, [loaded, players, teams, videos]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = [...STATIC_COMMANDS, ...dynamicItems].map((item) => ({
      ...item,
      onHover: () => {
        const index = [...STATIC_COMMANDS, ...dynamicItems].findIndex((entry) => entry.id === item.id);
        if (index >= 0) setActiveIndex(index);
      },
    }));

    if (!q) return items;

    return items.filter((item) =>
      [item.label, item.description, ...(item.keywords || [])]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    );
  }, [dynamicItems, query]);

  useEffect(() => {
    if (activeIndex >= visibleItems.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, visibleItems.length]);

  const runCommand = useCallback(
    (item) => {
      if (item.action === 'upload') {
        openUpload();
      } else if (item.action === 'navigate') {
        navigate(item.to);
      }
      closePalette();
    },
    [closePalette, navigate, openUpload]
  );

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(visibleItems.length - 1, 0)));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === 'Enter' && visibleItems[activeIndex]) {
      event.preventDefault();
      runCommand(visibleItems[activeIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="command-palette-overlay" role="dialog" aria-modal="true" aria-label="Quick search">
      <div className="command-palette-panel" ref={panelRef}>
        <div className="command-palette-input-row">
          <SearchIcon size={18} className="command-palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search videos, players, teams, or commands..."
            aria-label="Search videos, players, teams, or commands"
            className="command-palette-input"
          />
          <button type="button" className="command-palette-close" onClick={closePalette} aria-label="Close search">
            Esc
          </button>
        </div>

        <div className="command-palette-body">
          {loading && <div className="command-palette-state">Loading quick search...</div>}
          {error && <div className="command-palette-state command-palette-state--error">{error}</div>}

          {!loading && !error && (
            <>
              <div className="command-palette-section">
                <div className="command-palette-section-title">
                  {query ? 'Results' : 'Quick actions and recent items'}
                </div>
                {visibleItems.length > 0 ? (
                  <div className="command-palette-list">
                    {visibleItems.map((item, index) => (
                      <ResultItem
                        key={item.id}
                        item={{ ...item, meta: item.meta || 'Action', onHover: () => setActiveIndex(index) }}
                        active={activeIndex === index}
                        onSelect={runCommand}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="command-palette-state">
                    {query ? 'No matches found.' : 'No shortcuts available.'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
