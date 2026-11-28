const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { issueOtp, verifyOtp, normalizePhone } = require('../utils/otpStore');

const PORTAL_ROLES = ['customer', 'store_owner', 'driver', 'franchise', 'superadmin'];

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

// POST /api/auth/send-otp  { phone, role, purpose: login|register|reset }
const sendPortalOtp = async (req, res, next) => {
  try {
    const { phone, role, purpose = 'login' } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'phone is required' });
    }
    if (role && !PORTAL_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid portal role' });
    }
    const phoneNorm = normalizePhone(phone);
    if (purpose === 'login' || purpose === 'reset') {
      const filter = role ? { phone: phoneNorm, role } : { phone: phoneNorm };
      const existing = await User.findOne(filter);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: role ? `No ${role} account for this mobile` : 'Account not found'
        });
      }
    }
    const result = await issueOtp(phoneNorm);
    res.json({
      success: true,
      mode: result.mode,
      ...(result.otp ? { otp: result.otp, demoOtp: result.demoOtp || result.otp } : {}),
      message: result.message || 'OTP sent to your mobile number'
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login-otp  { phone, otp, role }
const loginWithOtp = async (req, res, next) => {
  try {
    const { phone, otp, role } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP required' });
    }
    if (!role || !PORTAL_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Portal role is required' });
    }
    if (!verifyOtp(phone, otp)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const phoneNorm = normalizePhone(phone);
    const user = await User.findOne({ phone: phoneNorm, role });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: `Invalid credentials for ${role} portal`
      });
    }

    // Sellers may log in while pending so they can see verification status
    if (user.status === 'pending' && user.role !== 'store_owner') {
      return res.status(403).json({ success: false, message: 'Account pending approval' });
    }
    if (user.status === 'rejected' || user.status === 'suspended') {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }

    user.phoneVerified = true;
    if (user.role === 'customer') {
      user.loginActivity = [
        ...(user.loginActivity || []).slice(-19),
        { at: new Date(), note: 'otp_login' }
      ];
    }
    await user.save();

    const token = signToken(user);
    res.json({ success: true, data: { token, user: publicUser(user) } });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login — password login disabled; use OTP
const login = async (req, res) => {
  res.status(400).json({
    success: false,
    message: 'Password login disabled. Send OTP and sign in with OTP.'
  });
};

// POST /api/auth/logout — client clears JWT; endpoint confirms secure sign-out
const logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out securely. Session cleared on device.' });
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

    const exists = await User.findOne({ phone: String(phone).trim(), role });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: `Phone already registered as ${role}`
      });
    }
    const emailNorm = email ? String(email).trim().toLowerCase() : '';
    if (emailNorm) {
      const emailTaken = await User.findOne({ email: emailNorm, role });
      if (emailTaken) {
        return res.status(409).json({
          success: false,
          message: `Email already registered as ${role}`
        });
      }
    }

    const needsKyc = role === 'driver' || role === 'store_owner';
    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      phone: String(phone).trim(),
      email: emailNorm || undefined,
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

module.exports = {
  login,
  loginWithOtp,
  sendPortalOtp,
  register,
  logout,
  me,
  publicUser
};
