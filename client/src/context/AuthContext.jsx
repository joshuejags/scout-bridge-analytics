import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { connectSocket, disconnectSocket } from '../utils/socket';

const AuthContext = createContext(null);

const TOKEN_KEY = 'sba_token';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    axios
      .get(`${process.env.REACT_APP_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data))
      .catch(() => {
        // Token invalid/expired
        logout();
      })
      .finally(() => setLoading(false));
  }, [token, logout]);

  // Real-time analysis progress rides the same session as the REST API: one
  // socket connection per signed-in session, torn down on logout/expiry so
  // a stale token never lingers on an open connection.
  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocket(null);
      return;
    }
    const instance = connectSocket(token);
    setSocket(instance);
    return () => {
      disconnectSocket();
      setSocket(null);
    };
  }, [token]);

  const login = async (email, password) => {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/login`, {
      email,
      password,
    });
    localStorage.setItem(TOKEN_KEY, response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  const register = async (name, email, password) => {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/register`, {
      name,
      email,
      password,
    });
    localStorage.setItem(TOKEN_KEY, response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  const forgotPassword = async (email) => {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/forgot-password`, {
      email,
    });
    return response.data;
  };

  const resetPassword = async (resetToken, password) => {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/reset-password`, {
      token: resetToken,
      password,
    });
    return response.data;
  };

  const verifyEmail = async (verifyToken) => {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/verify-email`, {
      token: verifyToken,
    });
    // If the verified account happens to be the currently logged-in user,
    // reflect the verified status immediately without a full re-fetch.
    setUser((prev) =>
      prev && prev.email === response.data.user.email
        ? { ...prev, emailVerified: true }
        : prev
    );
    return response.data;
  };

  const resendVerification = async () => {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/auth/resend-verification`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        socket,
        isAuthenticated: !!token,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        verifyEmail,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
