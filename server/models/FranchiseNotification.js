const mongoose = require('mongoose');

const FranchiseNotificationSchema = new mongoose.Schema(
  {
    franchiseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['notice', 'admin_notice', 'payment', 'pin', 'bank', 'partner', 'system'],
      default: 'notice'
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

FranchiseNotificationSchema.index({ franchiseId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('FranchiseNotification', FranchiseNotificationSchema);
