import axios from 'axios';

const TOKEN_KEY = 'sba_token';

/**
 * Attaches the stored JWT to every outgoing request and redirects to
 * /login on a 401 response. Installed once at app startup; every existing
 * call site uses the plain `axios` import directly (not a dedicated
 * instance), so this has to live on the global axios defaults.
 */
export const installAxiosInterceptors = () => {
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
        localStorage.removeItem(TOKEN_KEY);
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
};
