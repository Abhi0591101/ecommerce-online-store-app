const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: '' },
    sku: { type: String, default: '', trim: true },
    unit: { type: String, required: true }, // pack qty e.g. '1 Litre', '500g' — NOT clothing size
    description: { type: String },
    photoUrl: { type: String, required: true },
    photos: [{ type: String }],
    mrp: { type: Number, required: true },
    rating: { type: Number, default: 4.8 },
    reviewsCount: { type: Number, default: 25 },
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'active', 'inactive'],
      default: 'active'
    },
    approvalStatus: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved'
    },
    rejectionReason: { type: String, default: '' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', brand: 'text', description: 'text', sku: 'text' });
ProductSchema.index({ categoryId: 1, subcategoryId: 1, isActive: 1 });

module.exports = mongoose.model('Product', ProductSchema);
