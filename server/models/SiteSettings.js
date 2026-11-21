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
    shippingReturnHtml: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteSettings', SiteSettingsSchema);
