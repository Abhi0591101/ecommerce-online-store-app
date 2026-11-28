const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  phone: { type: String, required: true },
  photoUrl: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true },
  city: { type: String, default: 'Noida' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  deliveryRadiusKm: { type: Number, default: 5.0 },
  baseDeliveryFee: { type: Number, default: 20.0 },
  freeDeliveryAbove: { type: Number, default: 300.0 },
  estDeliveryMins: { type: Number, default: 20 },
  pickupAvailable: { type: Boolean, default: true },
  rating: { type: Number, default: 4.8 },
  reviewsCount: { type: Number, default: 50 },
  isOnline: { type: Boolean, default: true }, // Store Open / Closed Switch
  isActive: { type: Boolean, default: true }, // Admin Active/Inactive
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  decisionNote: { type: String, default: '' },
  decidedAt: Date,
  openingTime: { type: String, default: '08:00 AM - 10:30 PM' },
  ownerName: { type: String, default: '' },
  gstin: { type: String, default: '' },
  fssai: { type: String, default: '' },
  category: { type: String, default: 'grocery' },
  // Seller KYC (Japto Seller Panel)
  phoneVerified: { type: Boolean, default: false },
  panNumber: { type: String, default: '' },
  panDocUrl: { type: String, default: '' },
  gstNumber: { type: String, default: '' },
  gstDocUrl: { type: String, default: '' },
  enrollmentNumber: { type: String, default: '' },
  enrollmentDocUrl: { type: String, default: '' },
  bankAccount: { type: String, default: '' },
  ifsc: { type: String, default: '' },
  bankProofUrl: { type: String, default: '' },
  dealsInFood: { type: Boolean, default: false },
  fssaiDocUrl: { type: String, default: '' },
  registrationFeePaid: { type: Boolean, default: false },
  registrationFeeAmount: { type: Number, default: 216 },
  registrationFeeTxnId: { type: String, default: '' },
  registrationFeeRazorpayOrderId: { type: String, default: '' },
  registrationFeePaidAt: { type: Date },
  /** Shop promoters (same pattern as franchise) */
  promoters: [
    {
      name: { type: String, default: '' },
      phone: { type: String, default: '' }
    }
  ]
}, { timestamps: true });

StoreSchema.index({ location: '2dsphere' });
StoreSchema.index({ isOnline: 1, status: 1 });

module.exports = mongoose.model('Store', StoreSchema);
