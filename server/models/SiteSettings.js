const mongoose = require('mongoose');

const SiteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    siteName: { type: String, default: 'Japto.in' },
    logoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    homepageHeadline: { type: String, default: 'Groceries in minutes' },
    homepageSubtext: { type: String, default: 'Hyperlocal delivery near you' },
    contactPhone: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactAddress: { type: String, default: '' },
    termsHtml: { type: String, default: '' },
    privacyHtml: { type: String, default: '' },
    shippingReturnHtml: { type: String, default: '' },
    /** Razorpay — managed from Admin → Settings (not .env) */
    razorpayKeyId: { type: String, default: '' },
    razorpayKeySecret: { type: String, default: '' },
    razorpayWebhookSecret: { type: String, default: '' },
    razorpayCompanyName: { type: String, default: 'Japto.in' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteSettings', SiteSettingsSchema);
