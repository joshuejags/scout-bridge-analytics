import React, { useState } from 'react';
import { exportToJSON, exportToCSV, exportAnalysisReport } from '../utils/export';
import './ExportButton.css';

const ExportButton = ({ data, filename = 'export', type = 'data', analysisData = null }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = (format) => {
    try {
      if (type === 'analysis' && analysisData) {
        exportAnalysisReport(analysisData, format);
      } else if (format === 'json') {
        exportToJSON(data, `${filename}.json`);
      } else if (format === 'csv') {
        exportToCSV(data, `${filename}.csv`);
      }
      setShowMenu(false);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="export-button-container">
      <button
        className="export-btn"
        onClick={() => setShowMenu(!showMenu)}
        title="Export data"
      >
        ⬇️ Export
      </button>
      {showMenu && (
        <div className="export-menu">
          <button onClick={() => handleExport('json')} className="export-option">
            Export as JSON
          </button>
          <button onClick={() => handleExport('csv')} className="export-option">
            Export as CSV
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportButton;
