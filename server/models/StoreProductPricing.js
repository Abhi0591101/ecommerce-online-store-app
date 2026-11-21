const mongoose = require('mongoose');

const StoreProductPricingSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  price: { type: Number, required: true }, // Store selling price
  stockQuantity: { type: Number, default: 50 },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

StoreProductPricingSchema.index({ storeId: 1, productId: 1 }, { unique: true });
StoreProductPricingSchema.index({ productId: 1, isAvailable: 1, price: 1 });

module.exports = mongoose.model('StoreProductPricing', StoreProductPricingSchema);
