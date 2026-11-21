const mongoose = require('mongoose');

const CustomerNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'order_placed',
        'order_confirmed',
        'order_shipped',
        'order_out',
        'order_delivered',
        'order_cancelled',
        'payment',
        'offer',
        'announcement',
        'complaint',
        'system'
      ],
      default: 'system'
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

CustomerNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerNotification', CustomerNotificationSchema);
