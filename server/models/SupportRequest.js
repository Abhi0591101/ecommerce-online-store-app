const mongoose = require('mongoose');

const SupportRequestSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    type: {
      type: String,
      enum: ['profile', 'bank', 'contact', 'document', 'other'],
      required: true
    },
    message: { type: String, required: true },
    attachments: [{ type: String }],
    status: {
      type: String,
      enum: ['pending', 'resolved', 'rejected'],
      default: 'pending'
    },
    adminNote: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportRequest', SupportRequestSchema);