import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

export function createGroupSocket() {
  return io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
  });
}