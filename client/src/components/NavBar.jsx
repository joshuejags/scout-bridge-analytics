import React from 'react';
import { Link } from 'react-router-dom';
import './NavBar.css';

const NavBar = () => {
  return (
    <nav className="nav-bar">
      <div className="nav-brand">Scout Bridge Analytics</div>
      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/teams">Teams</Link>
        <Link to="/players">Players</Link>
      </div>
    </nav>
  );
};

export default NavBar;
