import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// Order matters for the legend/slice order, not just display - keeps the
// chart's status order matching the same importing -> uploaded -> queued ->
// processing -> analyzed -> failed progression used everywhere else
// (VideoList's status filters, Video.status's schema enum).
const STATUS_META = [
  { key: 'importing', label: 'Importing', color: '#6c757d' },
  { key: 'uploaded', label: 'Uploaded', color: '#4dabf7' },
  { key: 'queued', label: 'Queued', color: '#f0a94e' },
  { key: 'processing', label: 'Processing', color: '#9b6bd6' },
  { key: 'analyzed', label: 'Analyzed', color: '#28a745' },
  { key: 'failed', label: 'Failed', color: '#dc3545' },
];

const VideoStatusChart = ({ videos }) => {
  const counts = videos.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});
  const present = STATUS_META.filter((s) => counts[s.key] > 0);

  if (present.length === 0) {
    return <p className="no-data">No videos yet, so there's nothing to chart.</p>;
  }

  const data = {
    labels: present.map((s) => s.label),
    datasets: [
      {
        data: present.map((s) => counts[s.key]),
        backgroundColor: present.map((s) => s.color),
        borderWidth: 0,
      },
    ],
  };

  return (
    <Doughnut
      data={data}
      options={{
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              boxWidth: 10,
              padding: 16,
            },
          },
        },
      }}
    />
  );
};

export default VideoStatusChart;
