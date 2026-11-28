const mongoose = require('mongoose');

/** Singleton-style platform config (commission, tax, delivery charges) */
const PlatformConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    sellerCommissionPct: { type: Number, default: 1 },
    franchiseDeliveryCommissionPct: { type: Number, default: 5 },
    /** Seller registration charge shown on public register form (Admin editable) */
    sellerRegistrationFee: { type: Number, default: 216 },
    /** Franchise registration / application charge (Admin editable) */
    franchiseRegistrationFee: { type: Number, default: 500 },
    /** Public franchise fee range shown on Franchise page */
    franchiseFeeMin: { type: Number, default: 200000 },
    franchiseFeeMax: { type: Number, default: 500000 },
    franchiseFeeNote: {
      type: String,
      default: '₹2,00,000 से ₹5,00,000 तक, शहर के अनुसार। अंतिम फीस Japto.in Head Office तय करेगा।'
    },
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
