import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5000';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[socket] connected', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connection error', err.message);
    });
  }
  return socket;
};

export const joinStoreRoom = (storeId) => {
  if (!storeId) return;
  getSocket().emit('join:store', storeId);
};

export const joinStoreRooms = (storeIds = []) => {
  getSocket().emit('join:stores', storeIds);
};

export const joinOrderRoom = (orderId) => {
  if (!orderId) return;
  getSocket().emit('join:order', orderId);
};

export const leaveOrderRoom = (orderId) => {
  if (!orderId) return;
  getSocket().emit('leave:order', orderId);
};

export const joinRidersRoom = () => {
  getSocket().emit('join:riders');
};

export const setRiderDutySocket = (onDuty) => {
  getSocket().emit('rider:duty', { onDuty: !!onDuty });
};

export default getSocket;
