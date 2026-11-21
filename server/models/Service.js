const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['plumbing', 'electrical', 'ac', 'cleaning', 'appliance', 'carpentry', 'beauty', 'other'],
    default: 'other'
  },
  visitCharge: { type: Number, required: true, min: 0 },
  rating: { type: Number, default: 4.8 },
  reviews: { type: Number, default: 0 },
  photoUrl: { type: String, required: true },
  description: { type: String, default: '' },
  provider: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    experienceYears: { type: Number, default: 1 },
    badge: { type: String, default: 'Verified Pro' },
    photoUrl: String
  },
  city: { type: String, default: 'Noida' },
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }
}, { timestamps: true });

ServiceSchema.index({ isActive: 1, status: 1, category: 1 });

module.exports = mongoose.model('Service', ServiceSchema);
