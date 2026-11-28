const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  unitSpec: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true }
});

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  orderType: { type: String, enum: ['delivery', 'pickup'], default: 'delivery' },
  timeSlot: { type: String, default: '⚡ Express Delivery (15-25 Mins)' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  deliveryAddress: { type: String, required: true },
  pincode: { type: String, default: '201301' },
  items: [OrderItemSchema],
  itemsTotal: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0.0 },
  grandTotal: { type: Number, required: true },
  paymentMode: {
    type: String,
    enum: ['COD', 'UPI', 'CARD', 'ONLINE', 'NETBANKING', 'WALLET'],
    default: 'COD'
  },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentTxnId: { type: String, default: '' },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  refundStatus: { type: String, enum: ['none', 'requested', 'approved', 'rejected', 'processed'], default: 'none' },
  refundNote: { type: String, default: '' },
  platformFee: { type: Number, default: 0 },
  sellerEarning: { type: Number, default: 0 },
  commissionPaid: { type: Boolean, default: false },
  /** Franchise that owns delivery PIN — earns % of deliveryFee */
  franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise' },
  franchiseCommissionPct: { type: Number, default: 0 },
  franchiseCommission: { type: Number, default: 0 },
  franchiseCommissionPosted: { type: Boolean, default: false },
  gstAmount: { type: Number, default: 0 },
  gstPct: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['placed', 'accepted', 'packing', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled', 'rejected'],
    default: 'placed'
  },
  otpCode: { type: String, required: true } // 4-digit security code e.g. '4821'
  ,
  /** Japto.in rider OR seller's own delivery */
  deliveryMethod: {
    type: String,
    enum: ['japto', 'seller_own'],
    default: 'japto'
  },
  couponCode: { type: String, default: '' },
  discountAmount: { type: Number, default: 0 },
  walletUsed: { type: Number, default: 0 },
  cancellationRequest: {
    requested: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    requestedAt: Date,
    decidedAt: Date,
    adminNote: { type: String, default: '' }
  }
}, { timestamps: true });

OrderSchema.index({ storeId: 1, status: 1 });
OrderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', OrderSchema);
