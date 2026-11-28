const mongoose = require('mongoose');

const FranchiseSchema = new mongoose.Schema(
  {
    /** Public application ID e.g. JAPTO-FR-2026-0001 */
    applicationId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    ownerName: { type: String, default: '' },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    pinCodes: [{ type: String }],
    /** Structured address from application */
    houseNo: { type: String, default: '' },
    streetArea: { type: String, default: '' },
    address: { type: String, default: '' },
    businessExperience: {
      type: String,
      enum: ['experienced', 'new', ''],
      default: ''
    },
    message: { type: String, default: '' },
    promoters: [
      {
        name: { type: String, default: '' },
        phone: { type: String, default: '' }
      }
    ],
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agreementUrl: { type: String, default: '' },
    agreementYears: { type: Number, default: 5 },
    franchiseFee: { type: Number, default: 0 },
    franchiseFeeMin: { type: Number, default: 200000 },
    franchiseFeeMax: { type: Number, default: 500000 },
    gstAmount: { type: Number, default: 0 },
    feeNonRefundable: { type: Boolean, default: true },
    registrationFeePaid: { type: Boolean, default: false },
    registrationFeeTxnId: { type: String, default: '' },
    registrationFeeRazorpayOrderId: { type: String, default: '' },
    registrationFeePaidAt: { type: Date },
    deliveryCommissionPct: { type: Number, default: 0 },
    bankAccountHolder: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    bankIfsc: { type: String, default: '' },
    pendingBankChange: {
      accountHolder: String,
      accountNumber: String,
      ifsc: String,
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none'
      },
      requestedAt: Date,
      decidedAt: Date,
      adminNote: { type: String, default: '' }
    },
    commissionLedger: [
      {
        amount: { type: Number, default: 0 },
        note: { type: String, default: '' },
        weekOf: { type: String, default: '' },
        status: {
          type: String,
          enum: ['pending', 'paid'],
          default: 'pending'
        },
        at: { type: Date, default: Date.now },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        orderNumber: { type: String, default: '' }
      }
    ],
    paymentHistory: [
      {
        amount: Number,
        note: String,
        status: {
          type: String,
          enum: ['pending', 'paid', 'failed'],
          default: 'paid'
        },
        paidAt: { type: Date, default: Date.now }
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'inactive'],
      default: 'pending'
    },
    isActive: { type: Boolean, default: false },
    decisionNote: { type: String, default: '' },
    decidedAt: Date,
    confirmationEmailQueued: { type: Boolean, default: false },
    /** Hashed at apply; copied to User.password on approve, then cleared */
    pendingPasswordHash: { type: String, select: false, default: '' }
  },
  { timestamps: true }
);

FranchiseSchema.index({ city: 1, status: 1 });
FranchiseSchema.index({ phone: 1 });
FranchiseSchema.index({ ownerUserId: 1 });

module.exports = mongoose.model('Franchise', FranchiseSchema);
