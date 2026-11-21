const SellerNotification = require('../models/SellerNotification');
const Store = require('../models/Store');

// GET /api/notifications
const listNotifications = async (req, res, next) => {
  try {
    const { storeId, unreadOnly } = req.query;
    const filter = { userId: req.user._id };
    if (storeId) filter.storeId = storeId;
    if (unreadOnly === 'true' || unreadOnly === '1') filter.read = false;

    if (storeId && req.user.role === 'store_owner') {
      const store = await Store.findById(storeId);
      if (!store || String(store.ownerId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not your store' });
      }
    }

    const rows = await SellerNotification.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:id/read
const markNotificationRead = async (req, res, next) => {
  try {
    const doc = await SellerNotification.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    doc.read = true;
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/read-all
const markAllNotificationsRead = async (req, res, next) => {
  try {
    const { storeId } = req.body;
    const filter = { userId: req.user._id, read: false };
    if (storeId) filter.storeId = storeId;

    const result = await SellerNotification.updateMany(filter, { $set: { read: true } });
    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listNotifications, markNotificationRead, markAllNotificationsRead };