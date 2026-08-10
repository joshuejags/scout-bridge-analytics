import React from 'react';
import { SearchIcon } from './icons';
import './SearchFilter.css';

const SearchFilter = ({
  title,
  placeholder = 'Search...',
  value,
  onChange,
  onFilterChange,
  onClear,
  filters = [],
  summary,
}) => {
  return (
    <div className="search-filter-container surface-card">
      <div className="search-filter-top">
        <div className="search-box">
          <SearchIcon size={18} className="search-icon-svg" />
          <input
            type="text"
            placeholder={placeholder}
            aria-label={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="search-filter-meta">
          {title && <span className="search-filter-title">{title}</span>}
          {summary && <span className="search-filter-summary">{summary}</span>}
          {onClear && (
            <button type="button" className="button button-ghost search-clear-btn" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {filters.length > 0 && (
        <div className="filter-buttons">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`filter-btn ${filter.active ? 'active' : ''}`}
              onClick={() => onFilterChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchFilter;
