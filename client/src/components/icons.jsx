import React from 'react';

// Small, dependency-free icon set (no icon library in package.json, and
// pulling one in just for a handful of glyphs is more than this needs).
// Replaces the emoji glyphs these components used to render inline.
// Every icon inherits its color from CSS (stroke="currentColor") and takes
// a size in pixels so call sites can match whatever font-size the emoji it
// replaced was rendered at.

const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const VideoIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="5.5" width="14" height="13" rx="2" />
    <path d="M16.5 10.2 21 7.5v9l-4.5-2.7" />
  </svg>
);

export const CheckIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12.5 9.5 18 20 6" />
  </svg>
);

export const ClockIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

export const UsersIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 4.5c1.7.4 3 2 3 3.9 0 1.9-1.3 3.5-3 3.9" />
    <path d="M21 20c0-2.8-1.9-5.1-4.5-5.8" />
  </svg>
);

export const TagIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M11.5 3H5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 .6 1.4l8.5 8.5a2 2 0 0 0 2.8 0l6.5-6.5a2 2 0 0 0 0-2.8l-8.5-8.5A2 2 0 0 0 11.5 3Z" />
    <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const ChartIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20V10M11 20V4M18 20v-7" />
    <path d="M2.5 20h19" />
  </svg>
);

export const TargetIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const HashIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M9 3 7 21M17 3l-2 18M4 8.5h17M3 15.5h17" />
  </svg>
);

export const FlameIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-3-1.9-4.9-3-6.8-.3 1.6-1.1 2.6-2 2.6-1.4 0-1-2.4-2-4.6-2 1.6-4 4.9-4 8 0 .6.1 1.1.2 1.6" />
    <path d="M12 21c-2 0-3.5-1.4-3.5-3.4 0-1.6 1-2.6 1.7-3.5.2.9.7 1.4 1.3 1.4.9 0 .8-1.2 1.3-2.2 1 .8 1.7 2.3 1.7 3.7 0 2.3-1 4-2.5 4Z" />
  </svg>
);

export const SearchIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21 16.5 16.5" />
  </svg>
);

export const WarningIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const CompassIcon = ({ size = 24, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9l-2 5-4 2 2-5 4-2Z" />
  </svg>
);
