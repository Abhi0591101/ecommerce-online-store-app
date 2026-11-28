const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { issueOtp, verifyOtp, normalizePhone } = require('../utils/otpStore');

const makeReferralCode = (name, phone) => {
  const base = String(name || 'JAP')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 4)
    .toUpperCase() || 'JAP';
  const tail = String(phone || '').slice(-4);
  return `${base}${tail}${Math.floor(10 + Math.random() * 89)}`;
};

const publicCustomer = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  phone: user.phone,
  email: user.email,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl || '',
  phoneVerified: !!user.phoneVerified,
  emailVerified: !!user.emailVerified,
  preferredLanguage: user.preferredLanguage || 'en',
  walletBalance: user.walletBalance || 0,
  referralCode: user.referralCode || '',
  addresses: user.addresses || [],
  deletionRequested: !!user.deletionRequested,
  deletionRequestedAt: user.deletionRequestedAt || null,
  city: user.city || ''
});

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
const isValidMobile = (phone) => {
  const p = normalizePhone(phone).replace(/\s+/g, '');
  return /^[6-9]\d{9}$/.test(p) || /^\+91[6-9]\d{9}$/.test(p);
};

// POST /api/auth/customer/send-otp  { phone, purpose: register|login|reset|email_change }
const sendCustomerOtp = async (req, res, next) => {
  try {
    const { phone, purpose = 'login' } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'phone is required' });
    if (!isValidMobile(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
    }
    const existing = await User.findOne({ phone: normalizePhone(phone), role: 'customer' });
    if (purpose === 'register' && existing) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }
    if (['login', 'reset', 'email_change'].includes(purpose) && !existing) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const result = await issueOtp(phone);
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

// POST /api/auth/customer/register
const registerCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, password, otp, referralCode } = req.body;
    if (!name || !phone || !email || !password || !otp) {
      return res.status(400).json({
        success: false,
        message: 'name, phone, email, password and otp are required'
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (!isValidMobile(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (!verifyOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP — mobile not verified' });
    }
    const phoneNorm = normalizePhone(phone);
    const emailNorm = String(email).trim().toLowerCase();
    if (await User.findOne({ phone: phoneNorm, role: 'customer' })) {
      return res.status(409).json({
        success: false,
        message: 'This mobile is already registered as a customer'
      });
    }
    if (await User.findOne({ email: emailNorm, role: 'customer' })) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered as a customer'
      });
    }
    let referredBy;
    if (referralCode) {
      const ref = await User.findOne({
        referralCode: String(referralCode).toUpperCase(),
        role: 'customer'
      });
      if (ref) referredBy = ref._id;
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      phone: phoneNorm,
      email: emailNorm,
      password: hash,
      role: 'customer',
      status: 'approved',
      phoneVerified: true,
      emailVerified: true,
      referralCode: makeReferralCode(name, phoneNorm),
      referredBy
    });
    const token = signToken(user);
    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      data: { token, user: publicCustomer(user) }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/customer/login-otp
const loginCustomerOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'phone and otp required' });
    }
    if (!verifyOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const user = await User.findOne({ phone: normalizePhone(phone), role: 'customer' });
    if (!user) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }
    user.phoneVerified = true;
    user.loginActivity = [
      ...(user.loginActivity || []).slice(-19),
      { at: new Date(), note: 'otp_login' }
    ];
    await user.save();
    const token = signToken(user);
    res.json({ success: true, data: { token, user: publicCustomer(user) } });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/customer/forgot-password
const resetCustomerPassword = async (req, res, next) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'phone, otp and newPassword required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (!verifyOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const user = await User.findOne({ phone: normalizePhone(phone), role: 'customer' });
    if (!user) return res.status(404).json({ success: false, message: 'Customer not found' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password updated. Please login.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendCustomerOtp,
  registerCustomer,
  loginCustomerOtp,
  resetCustomerPassword,
  publicCustomer,
  makeReferralCode
};
