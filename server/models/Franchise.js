const mongoose = require('mongoose');

const FranchiseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerName: { type: String, default: '' },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    city: { type: String, required: true },
    pinCodes: [{ type: String }],
    address: { type: String, default: '' },
    agreementUrl: { type: String, default: '' },
    franchiseFee: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    deliveryCommissionPct: { type: Number, default: 0 },
    paymentHistory: [
      {
        amount: Number,
        note: String,
        paidAt: { type: Date, default: Date.now }
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'inactive'],
      default: 'pending'
    },
    isActive: { type: Boolean, default: false },
    decisionNote: { type: String, default: '' },
    decidedAt: Date
  },
  { timestamps: true }
);

FranchiseSchema.index({ city: 1, status: 1 });

module.exports = mongoose.model('Franchise', FranchiseSchema);
