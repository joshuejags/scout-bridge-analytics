import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installAxiosInterceptors } from './utils/axiosSetup';
import './index.css';

installAxiosInterceptors();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
