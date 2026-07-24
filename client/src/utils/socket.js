import { io } from 'socket.io-client';

let socketInstance = null;

// REACT_APP_API_URL points at the REST base (".../api"); Socket.IO attaches
// to the same HTTP server but at its own root, not under /api.
const getSocketUrl = () => {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

export const connectSocket = (token) => {
  if (socketInstance) {
    socketInstance.disconnect();
  }
  socketInstance = io(getSocketUrl(), {
    auth: { token },
  });
  return socketInstance;
};

export const getSocket = () => socketInstance;

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
