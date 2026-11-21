const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    linkUrl: { type: String, default: '' },
    text: { type: String, default: '' },
    city: { type: String, default: '' },
    placement: { type: String, enum: ['homepage', 'category', 'checkout'], default: 'homepage' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

BannerSchema.index({ isActive: 1, placement: 1, city: 1 });

module.exports = mongoose.model('Banner', BannerSchema);
