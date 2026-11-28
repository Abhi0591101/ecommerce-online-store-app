const mongoose = require('mongoose');

/** Inbound alerts for Super Admin inbox (bell) — not outbound broadcast. */
const AdminAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'franchise_application',
        'franchise_bank',
        'franchise_pin',
        'seller_application',
        'rider_application',
        'product_approval',
        'support',
        'order_cancel',
        'complaint',
        'system'
      ],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    entityType: { type: String, default: '' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    linkTab: { type: String, default: 'dashboard' },
    read: { type: Boolean, default: false },
    resolved: { type: Boolean, default: false },
    dedupeKey: { type: String, default: '', index: true }
  },
  { timestamps: true }
);

AdminAlertSchema.index({ read: 1, createdAt: -1 });
AdminAlertSchema.index({ type: 1, resolved: 1 });

module.exports = mongoose.model('AdminAlert', AdminAlertSchema);
