const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ['customer', 'seller', 'delivery', 'franchise'],
      required: true
    },
    raisedByName: { type: String, default: '' },
    raisedByPhone: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open'
    },
    replies: [
      {
        by: { type: String, default: 'admin' },
        message: String,
        at: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

ComplaintSchema.index({ source: 1, status: 1 });

module.exports = mongoose.model('Complaint', ComplaintSchema);
