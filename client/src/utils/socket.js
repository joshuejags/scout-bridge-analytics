import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socketInstance = null;

const getSocketUrl = () => {
  return API_BASE_URL.replace(/\/api\/?$/, '');
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
