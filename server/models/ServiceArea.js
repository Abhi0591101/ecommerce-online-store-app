const mongoose = require('mongoose');

const ServiceAreaSchema = new mongoose.Schema({
  pincode: { type: String, required: true },
  area: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  tag: { type: String, default: '' },
  storesCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
  pinCodes: [{ type: String }],
  pinCodeStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise' }
}, { timestamps: true });

ServiceAreaSchema.index({ isActive: 1, city: 1, displayOrder: 1 });

module.exports = mongoose.model('ServiceArea', ServiceAreaSchema);
