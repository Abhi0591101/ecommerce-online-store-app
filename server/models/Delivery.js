const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    driverName: { type: String, default: '' },
    driverPhone: { type: String, default: '' },
    driverVehicle: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'offered',
        'assigned', // legacy
        'accepted',
        'rejected',
        'reached_pickup',
        'arrived_at_store', // legacy → reached_pickup
        'picked_up',
        'on_the_way',
        'out_for_delivery', // legacy → on_the_way
        'reached_customer',
        'delivered',
        'cancelled'
      ],
      default: 'offered'
    },
    rejectReason: { type: String, default: '' },
    deliveryCharge: { type: Number, default: 30 },
    distanceKm: { type: Number, default: 0 },
    packageCount: { type: Number, default: 1 },
    deliveryInstructions: { type: String, default: '' },
    statusHistory: [
      {
        status: String,
        at: { type: Date, default: Date.now }
      }
    ],
    pickupConfirmedAt: Date,
    otpVerifiedAt: Date,
    otpVerified: { type: Boolean, default: false },
    currentLat: { type: Number, default: 28.628 },
    currentLng: { type: Number, default: 77.3649 },
    etaMins: { type: Number, default: 15 },
    distanceRemainingKm: { type: Number, default: 1.5 },
    lastPingAt: { type: Date, default: Date.now },
    earningPaid: { type: Boolean, default: false }
  },
  { timestamps: true }
);

DeliverySchema.index({ driverId: 1, status: 1 });

module.exports = mongoose.model('Delivery', DeliverySchema);
