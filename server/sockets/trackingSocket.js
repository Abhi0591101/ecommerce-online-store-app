/**
 * Socket.IO realtime rooms:
 *  - store_{storeId}  → merchant dashboards
 *  - order_{orderId}  → customer live tracking
 *  - riders           → all on-duty delivery partners
 */
const setupTrackingSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join:store', (storeId) => {
      if (!storeId) return;
      socket.join(`store_${storeId}`);
    });

    socket.on('join:stores', (storeIds = []) => {
      (Array.isArray(storeIds) ? storeIds : []).forEach((id) => {
        if (id) socket.join(`store_${id}`);
      });
    });

    socket.on('join:order', (orderId) => {
      if (!orderId) return;
      socket.join(`order_${orderId}`);
    });

    socket.on('leave:order', (orderId) => {
      if (!orderId) return;
      socket.leave(`order_${orderId}`);
    });

    socket.on('join:riders', () => {
      socket.join('riders');
    });

    socket.on('leave:riders', () => {
      socket.leave('riders');
    });

    socket.on('rider:duty', ({ onDuty } = {}) => {
      if (onDuty) socket.join('riders');
      else socket.leave('riders');
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = setupTrackingSocket;
