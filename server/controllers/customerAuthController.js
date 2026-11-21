const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { issueOtp, verifyOtp, DEMO_OTP, normalizePhone } = require('../utils/otpStore');

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
  preferredLanguage: user.preferredLanguage || 'en',
  walletBalance: user.walletBalance || 0,
  referralCode: user.referralCode || '',
  addresses: user.addresses || [],
  deletionRequested: !!user.deletionRequested,
  city: user.city || ''
});

// POST /api/auth/customer/send-otp  { phone, purpose: register|login|reset }
const sendCustomerOtp = async (req, res, next) => {
  try {
    const { phone, purpose = 'login' } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'phone is required' });
    const existing = await User.findOne({ phone: normalizePhone(phone), role: 'customer' });
    if (purpose === 'register' && existing) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }
    if ((purpose === 'login' || purpose === 'reset') && !existing) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const result = await issueOtp(phone);
    res.json({
      success: true,
      mode: result.mode,
      ...(result.otp ? { demoOtp: result.otp, otp: result.otp } : {}),
      message: result.message || `OTP sent. Demo: ${DEMO_OTP}`
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
    if (!verifyOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const phoneNorm = normalizePhone(phone);
    if (await User.findOne({ phone: phoneNorm })) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
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
      email: String(email).trim().toLowerCase(),
      password: hash,
      role: 'customer',
      status: 'approved',
      phoneVerified: true,
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
