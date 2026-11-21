const mongoose = require('mongoose');

const WalletLedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, default: '' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WalletLedger', WalletLedgerSchema);
