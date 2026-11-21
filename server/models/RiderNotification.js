const mongoose = require('mongoose');

const RiderNotificationSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'new_order',
        'assignment',
        'cancellation',
        'reassignment',
        'payment',
        'admin_notice',
        'account_status',
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

module.exports = mongoose.model('RiderNotification', RiderNotificationSchema);
