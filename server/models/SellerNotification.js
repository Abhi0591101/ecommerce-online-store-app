const mongoose = require('mongoose');

const SellerNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    type: {
      type: String,
      enum: ['order_new', 'order_cancel', 'payment', 'product_approval', 'admin_notice', 'system'],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

SellerNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('SellerNotification', SellerNotificationSchema);