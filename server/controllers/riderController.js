const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { publicUser } = require('./authController');

const mapDriver = (u) => ({
  id: String(u._id),
  _id: u._id,
  name: u.name,
  phone: u.phone,
  email: u.email,
  vehicleType: u.vehicleType || 'Bike',
  plateNumber: u.plateNumber || '',
  licenseNo: u.licenseNo || '',
  aadhaarNo: u.aadhaarNo || '',
  city: u.city || '',
  rating: u.rating ?? 5,
  isOnline: !!u.isOnline,
  todayEarnings: u.todayEarnings || 0,
  completedDeliveries: u.completedDeliveries || 0,
  status: u.status,
  submittedAt: u.createdAt ? new Date(u.createdAt).toLocaleString() : '',
  role: u.role
});

// GET /api/riders — approved fleet
const getRiders = async (req, res, next) => {
  try {
    const { status = 'approved', onlineOnly } = req.query;
    const filter = { role: 'driver' };
    if (status !== 'all') filter.status = status;
    if (onlineOnly === 'true') filter.isOnline = true;

    const riders = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: riders.map(mapDriver) });
  } catch (error) {
    next(error);
  }
};

// GET /api/riders/pending — KYC queue
const getPendingRiders = async (req, res, next) => {
  try {
    const riders = await User.find({ role: 'driver', status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, data: riders.map(mapDriver) });
  } catch (error) {
    next(error);
  }
};

// POST /api/riders — create rider (admin) or self-register pending
const createRider = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      password = 'password123',
      email,
      vehicleType,
      plateNumber,
      licenseNo,
      aadhaarNo,
      city,
      status,
      isOnline,
      rating
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone required' });
    }

    const exists = await User.findOne({ phone: String(phone).trim() });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }

    const isAdmin = req.user?.role === 'superadmin';
    const hash = await bcrypt.hash(password, 10);

    const rider = await User.create({
      name,
      phone: String(phone).trim(),
      email: email || undefined,
      password: hash,
      role: 'driver',
      status: isAdmin ? (status || 'approved') : 'pending',
      vehicleType: vehicleType || 'Hero Splendor (Bike)',
      plateNumber: plateNumber || '',
      licenseNo: licenseNo || '',
      aadhaarNo: aadhaarNo || '',
      city: city || '',
      isOnline: isOnline != null ? !!isOnline : isAdmin,
      rating: rating != null ? Number(rating) : 5.0,
      todayEarnings: 0,
      completedDeliveries: 0
    });

    res.status(201).json({ success: true, data: mapDriver(rider) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/riders/:id/status — approve / reject
const updateRiderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'suspended', 'pending', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const rider = await User.findOne({ _id: req.params.id, role: 'driver' });
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    rider.status = status;
    if (req.body.statusReason !== undefined) rider.statusReason = req.body.statusReason;
    if (status === 'approved') {
      rider.isOnline = false;
      rider.isActive = true;
    }
    if (status === 'inactive') {
      rider.isActive = false;
      rider.isOnline = false;
    }
    if (status === 'suspended') {
      rider.isActive = false;
      rider.isOnline = false;
    }
    await rider.save();

    try {
      const { pushRiderNotify } = require('./deliveryBoyController');
      await pushRiderNotify(rider._id, {
        type: 'account_status',
        title: `Account ${status}`,
        body: req.body.statusReason || `Your account is now ${status}`,
        meta: { status }
      });
    } catch {
      /* ignore */
    }

    res.json({ success: true, data: mapDriver(rider), message: `Rider ${status}` });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/riders/:id/duty
const updateRiderDuty = async (req, res, next) => {
  try {
    const rider = await User.findOne({ _id: req.params.id, role: 'driver' });
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    if (req.body.isOnline != null) rider.isOnline = !!req.body.isOnline;
    if (req.body.todayEarnings != null) rider.todayEarnings = Number(req.body.todayEarnings);
    if (req.body.completedDeliveries != null) {
      rider.completedDeliveries = Number(req.body.completedDeliveries);
    }
    if (req.body.vehicleType) rider.vehicleType = req.body.vehicleType;
    if (req.body.plateNumber) rider.plateNumber = req.body.plateNumber;

    await rider.save();
    res.json({ success: true, data: mapDriver(rider) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRiders,
  getPendingRiders,
  createRider,
  updateRiderStatus,
  updateRiderDuty,
  mapDriver
};
