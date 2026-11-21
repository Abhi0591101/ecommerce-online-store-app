const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0 },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date },
    usageCount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 0 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    description: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', CouponSchema);
