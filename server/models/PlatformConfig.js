const mongoose = require('mongoose');

/** Singleton-style platform config (commission, tax, delivery charges) */
const PlatformConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    sellerCommissionPct: { type: Number, default: 1 },
    franchiseDeliveryCommissionPct: { type: Number, default: 5 },
    defaultGstPct: { type: Number, default: 5 },
    gstByCategory: [
      {
        categorySlug: String,
        gstPct: Number
      }
    ],
    deliveryCharges: [
      {
        name: { type: String, default: 'Default' },
        city: { type: String, default: '' },
        pincode: { type: String, default: '' },
        charge: { type: Number, default: 20 },
        minOrderValue: { type: Number, default: 0 },
        freeDeliveryAbove: { type: Number, default: 300 },
        isActive: { type: Boolean, default: true }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformConfig', PlatformConfigSchema);
