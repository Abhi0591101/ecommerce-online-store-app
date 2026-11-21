const mongoose = require('mongoose');

/**
 * Japto category master:
 * - parentId = null  → main category
 * - parentId set     → subcategory under that main category
 * Only Super Admin may create / edit / deactivate / reorder.
 */
const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nameHi: { type: String, default: '' },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true
    },
    iconEmoji: { type: String, default: '🛒' },
    photoUrl: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    /** Pharmacy / regulated — sellers need licence fields to list here */
    requiresLicence: { type: Boolean, default: false }
  },
  { timestamps: true }
);

CategorySchema.index({ parentId: 1, displayOrder: 1 });
CategorySchema.index({ isActive: 1, parentId: 1 });

module.exports = mongoose.model('Category', CategorySchema);
