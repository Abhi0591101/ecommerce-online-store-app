const SellerNotification = require('../models/SellerNotification');

const createSellerNotification = async ({
  userId,
  storeId,
  type,
  title,
  body,
  meta = {}
}) => {
  if (!userId || !storeId) return null;
  try {
    return await SellerNotification.create({
      userId,
      storeId,
      type,
      title,
      body,
      read: false,
      meta
    });
  } catch (err) {
    console.error('createSellerNotification failed:', err.message);
    return null;
  }
};

const notifyNewOrder = async (order, store) => {
  if (!store?.ownerId) return;
  await createSellerNotification({
    userId: store.ownerId,
    storeId: store._id,
    type: 'order_new',
    title: 'New order received',
    body: `Order ${order.orderNumber} — ₹${order.grandTotal}`,
    meta: { orderId: order._id, orderNumber: order.orderNumber }
  });
};

const notifyOrderCancel = async (order, store) => {
  if (!store?.ownerId) return;
  await createSellerNotification({
    userId: store.ownerId,
    storeId: store._id,
    type: 'order_cancel',
    title: 'Order cancelled',
    body: `Order ${order.orderNumber} was cancelled`,
    meta: { orderId: order._id, orderNumber: order.orderNumber }
  });
};

const notifyProductApproval = async (product, storeId, ownerId, approvalStatus) => {
  if (!ownerId || !storeId) return;
  const approved = approvalStatus === 'approved';
  await createSellerNotification({
    userId: ownerId,
    storeId,
    type: 'product_approval',
    title: approved ? 'Product approved' : 'Product update',
    body: approved
      ? `"${product.name}" is now live on Japto`
      : `"${product.name}" was ${approvalStatus}`,
    meta: { productId: product._id, approvalStatus }
  });
};

module.exports = {
  createSellerNotification,
  notifyNewOrder,
  notifyOrderCancel,
  notifyProductApproval
};