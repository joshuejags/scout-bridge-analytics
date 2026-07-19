import React from 'react';
import './SearchFilter.css';

const SearchFilter = ({ 
  placeholder = 'Search...', 
  value, 
  onChange, 
  onFilterChange,
  filters = []
}) => {
  return (
    <div className="search-filter-container">
      <div className="search-box">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="search-input"
        />
        <span className="search-icon">🔍</span>
      </div>
      {filters.length > 0 && (
        <div className="filter-buttons">
          {filters.map((filter) => (
            <button
              key={filter.id}
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
