const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

const publicUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  phone: user.phone,
  email: user.email,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl,
  vehicleType: user.vehicleType,
  plateNumber: user.plateNumber,
  licenseNo: user.licenseNo,
  city: user.city,
  isOnline: user.isOnline,
  todayEarnings: user.todayEarnings,
  completedDeliveries: user.completedDeliveries,
  rating: user.rating,
  addresses: user.addresses,
  phoneVerified: user.phoneVerified,
  preferredLanguage: user.preferredLanguage || 'en',
  walletBalance: user.walletBalance || 0,
  referralCode: user.referralCode || '',
  deletionRequested: !!user.deletionRequested
});

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { phone, password, role } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password required' });
    }

    const user = await User.findOne({ phone: String(phone).trim() });
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Strict portal check — superadmin must use Admin portal (no cross-portal bypass)
    if (role && user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `This account is "${user.role}". Open the matching portal tab to sign in.`
      });
    }

    // Sellers may log in while pending so they can see verification status in Seller Panel
    if (user.status === 'pending' && user.role !== 'store_owner') {
      return res.status(403).json({ success: false, message: 'Account pending approval' });
    }
    if (user.status === 'rejected' || user.status === 'suspended') {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }

    const token = signToken(user);
    res.json({ success: true, data: { token, user: publicUser(user) } });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      password,
      email,
      role = 'customer',
      vehicleType,
      plateNumber,
      licenseNo,
      aadhaarNo,
      city
    } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, phone and password required' });
    }

    const allowed = ['customer', 'store_owner', 'driver'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role for self-registration' });
    }

    const exists = await User.findOne({ phone: String(phone).trim() });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }

    const needsKyc = role === 'driver' || role === 'store_owner';
    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      phone: String(phone).trim(),
      email,
      password: hash,
      role,
      status: needsKyc ? 'pending' : 'approved',
      vehicleType: vehicleType || '',
      plateNumber: plateNumber || '',
      licenseNo: licenseNo || '',
      aadhaarNo: aadhaarNo || '',
      city: city || '',
      isOnline: role === 'driver' ? false : undefined,
      rating: 5.0
    });

    const token = needsKyc ? null : signToken(user);
    res.status(201).json({
      success: true,
      message: needsKyc
        ? 'Registration submitted — awaiting KYC approval'
        : 'Registered successfully',
      data: { token, user: publicUser(user) }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
};

module.exports = { login, register, me, publicUser };
