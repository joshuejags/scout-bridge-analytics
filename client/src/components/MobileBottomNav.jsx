import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MobileBottomNav.css';

const quickLinks = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/dashboard', label: 'Analytics', icon: '◔' },
  { to: '/players', label: 'Players', icon: '⚽' },
  { to: '/notifications', label: 'Alerts', icon: '🔔' },
];

const MobileBottomNav = () => {
  const { user } = useAuth();
  const role = user?.role || 'scout';

  const links = role === 'admin'
    ? [...quickLinks, { to: '/admin', label: 'Admin', icon: '⚙' }]
    : quickLinks;

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} className="mobile-bottom-nav__item" end={link.to === '/'}>
          <span className="mobile-bottom-nav__icon" aria-hidden="true">
            {link.icon}
          </span>
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default MobileBottomNav;
