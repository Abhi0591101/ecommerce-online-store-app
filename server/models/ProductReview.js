const mongoose = require('mongoose');

const ProductReviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    customerName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'hidden'],
      default: 'pending'
    },
    adminNote: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductReview', ProductReviewSchema);
