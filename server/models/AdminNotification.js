const mongoose = require('mongoose');

const AdminNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    audience: {
      type: String,
      enum: ['all', 'customers', 'sellers', 'delivery', 'franchise'],
      default: 'all'
    },
    channels: {
      app: { type: Boolean, default: true },
      email: { type: Boolean, default: false }
    },
    sentCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminNotification', AdminNotificationSchema);
