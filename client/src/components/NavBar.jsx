import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate('/login');
  };

  return (
    <nav className="nav-bar">
      <Link to="/" className="nav-brand" onClick={closeMenu}>
        Scout Bridge Analytics
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
            <Link to="/" onClick={closeMenu}>Home</Link>
            <Link to="/dashboard" onClick={closeMenu}>Dashboard</Link>
            <Link to="/teams" onClick={closeMenu}>Teams</Link>
            <Link to="/players" onClick={closeMenu}>Players</Link>
            <button type="button" className="nav-upload-btn" onClick={handleUploadClick}>
              + Upload Video
            </button>
            <span className="nav-user">{user?.name}</span>
            <button className="nav-logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" onClick={closeMenu}>Login</Link>
            <Link to="/register" onClick={closeMenu}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
