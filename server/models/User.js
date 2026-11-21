const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  role: {
    type: String,
    enum: ['customer', 'store_owner', 'driver', 'superadmin'],
    default: 'customer'
  },
  addresses: [{
    tag: { type: String, default: 'Home' },
    flatBuilding: String,
    streetArea: String,
    pincode: String,
    city: String,
    lat: Number,
    lng: Number,
    isDefault: { type: Boolean, default: false }
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'suspended', 'rejected', 'inactive'],
    default: 'approved'
  },
  statusReason: { type: String, default: '' },
  avatarUrl: String,
  // Driver / rider profile (Delivery Boy Panel)
  fullAddress: { type: String, default: '' },
  vehicleType: { type: String, default: '' },
  vehicleModel: { type: String, default: '' },
  plateNumber: { type: String, default: '' },
  licenseNo: { type: String, default: '' },
  aadhaarNo: { type: String, default: '' },
  idProofUrl: { type: String, default: '' },
  rcDocUrl: { type: String, default: '' },
  licenseDocUrl: { type: String, default: '' },
  insuranceDocUrl: { type: String, default: '' },
  bikePhotoUrl: { type: String, default: '' },
  bankAccount: { type: String, default: '' },
  ifsc: { type: String, default: '' },
  bankProofUrl: { type: String, default: '' },
  city: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  todayEarnings: { type: Number, default: 0 },
  monthEarnings: { type: Number, default: 0 },
  pendingPayout: { type: Number, default: 0 },
  paidPayout: { type: Number, default: 0 },
  completedDeliveries: { type: Number, default: 0 },
  failedDeliveries: { type: Number, default: 0 },
  cancelledDeliveries: { type: Number, default: 0 },
  codCollected: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0 },
  docUrls: [{ type: String }],
  payoutHistory: [
    {
      amount: Number,
      note: String,
      status: { type: String, enum: ['pending', 'paid'], default: 'paid' },
      paidAt: { type: Date, default: Date.now }
    }
  ],
  // Customer panel
  phoneVerified: { type: Boolean, default: false },
  preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
  walletBalance: { type: Number, default: 0 },
  referralCode: { type: String, default: '', index: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletionRequested: { type: Boolean, default: false },
  deletionRequestedAt: Date,
  loginActivity: [
    {
      at: { type: Date, default: Date.now },
      ip: String,
      note: String
    }
  ]
}, { timestamps: true });

UserSchema.index({ role: 1, status: 1 });

module.exports = mongoose.model('User', UserSchema);
