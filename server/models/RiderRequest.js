const mongoose = require('mongoose');

const RiderRequestSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['general', 'vehicle', 'payment', 'seller_onboarding', 'other'],
      required: true
    },
    message: { type: String, required: true },
    // Seller onboarding fields
    sellerName: { type: String, default: '' },
    sellerPhone: { type: String, default: '' },
    shopName: { type: String, default: '' },
    shopAddress: { type: String, default: '' },
    shopInfo: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    adminNote: { type: String, default: '' },
    decidedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('RiderRequest', RiderRequestSchema);
