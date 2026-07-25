import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installAxiosInterceptors } from './utils/axiosSetup';
import { initErrorTracking } from './utils/errorTracking';
import './index.css';

installAxiosInterceptors();
initErrorTracking();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
