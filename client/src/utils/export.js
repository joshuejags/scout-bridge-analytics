/**
 * Export utilities for converting data to CSV/JSON formats
 */

export const exportToJSON = (data, filename = 'export.json') => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadFile(blob, filename);
};

export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV header row
  const csvHeaders = headers.map((h) => `"${h}"`).join(',');
  
  // Create CSV data rows
  const csvRows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      // Escape quotes and handle special characters
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csv = [csvHeaders, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadFile(blob, filename);
};

export const exportAnalysisReport = (analysis, format = 'json') => {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `analysis-report-${timestamp}.${format === 'csv' ? 'csv' : 'json'}`;

  if (format === 'csv') {
    // Flatten analysis data for CSV
    const flatData = {
      'Video ID': analysis.videoId,
      'Status': analysis.status,
      'Total Players': analysis.playerData?.length || 0,
      'Processing Time': analysis.processingTime || 'N/A',
      'Created At': analysis.createdAt,
    };
    exportToCSV([flatData], filename);
  } else {
    exportToJSON(analysis, filename);
  }
};

const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
