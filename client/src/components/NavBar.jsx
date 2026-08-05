import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import './NavBar.css';

const NavBar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { openUpload } = useUpload();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleUploadClick = () => {
    closeMenu();
    openUpload();
  };

  const openCommandPalette = () => {
    closeMenu();
    window.dispatchEvent(new Event('sba:open-command-palette'));
  };

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate('/login');
  };

  return (
    <nav className="nav-bar">
      <Link to="/" className="nav-brand" onClick={closeMenu} aria-label="Scout Bridge Analytics home">
        <span className="nav-brand-mark" aria-hidden="true" />
        <span>
          <strong>ScoutBridge</strong>
          <small>Football scouting OS</small>
        </span>
      </Link>
      <button
        type="button"
        className="nav-toggle"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <div className={`nav-links ${menuOpen ? 'nav-links-open' : ''}`}>
        {isAuthenticated ? (
          <>
            <NavLink to="/" end onClick={closeMenu}>
              Home
            </NavLink>
            <NavLink to="/dashboard" onClick={closeMenu}>
              Dashboard
            </NavLink>
            <NavLink to="/teams" onClick={closeMenu}>
              Teams
            </NavLink>
            <NavLink to="/players" onClick={closeMenu}>
              Players
            </NavLink>
            <button type="button" className="nav-search-btn" onClick={openCommandPalette}>
              Search
              <span className="nav-shortcut">Ctrl K</span>
            </button>
            <button type="button" className="nav-upload-btn" onClick={handleUploadClick}>
              + Upload video
            </button>
            <span className="nav-user">{user?.name || 'Scout'}</span>
            <button type="button" className="nav-logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" onClick={closeMenu}>
              Login
            </NavLink>
            <NavLink to="/register" onClick={closeMenu} className="nav-register-btn">
              Create account
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
