const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Store = require('../models/Store');
const { issueOtp, verifyOtp, DEMO_OTP, OTP_MODE, normalizePhone } = require('../utils/otpStore');

const REGISTRATION_FEE = 500;

// POST /api/auth/seller/send-otp
const sendSellerOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'phone is required' });
    }
    const result = await issueOtp(phone);
    res.json({
      success: true,
      mode: result.mode || OTP_MODE,
      // Expose demo OTP in API so UI can show it until SMS gateway is live
      ...(result.otp ? { demoOtp: result.otp, otp: result.otp } : {}),
      message: result.message || `Use OTP ${DEMO_OTP}`
    });
  } catch (error) {
    next(error);
  }
};

const hasGst = (body) => body.gstNumber && body.gstDocUrl;
const hasEnrollment = (body) => body.enrollmentNumber && body.enrollmentDocUrl;

// POST /api/auth/seller/register
const registerSeller = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      password,
      email,
      otp,
      storeName,
      photoUrl,
      address,
      pincode,
      city = 'Noida',
      lat,
      lng,
      ownerName,
      panNumber,
      panDocUrl,
      gstNumber,
      gstDocUrl,
      enrollmentNumber,
      enrollmentDocUrl,
      bankAccount,
      ifsc,
      bankProofUrl,
      dealsInFood,
      fssai,
      fssaiDocUrl,
      registrationFeePaid,
      category,
      baseDeliveryFee,
      freeDeliveryAbove,
      estDeliveryMins,
      openingTime
    } = req.body;

    if (!name || !phone || !password || !otp) {
      return res.status(400).json({
        success: false,
        message: 'name, phone, password and otp are required'
      });
    }
    if (!verifyOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (!registrationFeePaid) {
      return res.status(400).json({
        success: false,
        message: 'registrationFeePaid must be true'
      });
    }
    if (!panNumber || !panDocUrl) {
      return res.status(400).json({ success: false, message: 'PAN number and panDocUrl are required' });
    }
    if (!bankAccount || !ifsc || !bankProofUrl) {
      return res.status(400).json({
        success: false,
        message: 'bankAccount, ifsc and bankProofUrl are required'
      });
    }
    const gstOk = hasGst(req.body);
    const enrollOk = hasEnrollment(req.body);
    if (!gstOk && !enrollOk) {
      return res.status(400).json({
        success: false,
        message: 'Provide either GST (gstNumber + gstDocUrl) or enrollment (enrollmentNumber + enrollmentDocUrl)'
      });
    }
    if (gstOk && enrollOk) {
      return res.status(400).json({
        success: false,
        message: 'Provide GST or enrollment, not both'
      });
    }
    if (dealsInFood && (!fssai || !fssaiDocUrl)) {
      return res.status(400).json({
        success: false,
        message: 'FSSAI number and fssaiDocUrl required when dealsInFood is true'
      });
    }
    if (!storeName || !photoUrl || !address || !pincode || lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: 'storeName, photoUrl, address, pincode, lat, lng are required'
      });
    }

    const phoneNorm = normalizePhone(phone);
    const exists = await User.findOne({ phone: phoneNorm });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      phone: phoneNorm,
      email: email || undefined,
      password: hash,
      role: 'store_owner',
      status: 'pending'
    });

    const store = await Store.create({
      name: storeName,
      ownerId: user._id,
      phone: phoneNorm,
      photoUrl,
      address,
      pincode,
      city,
      location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
      ownerName: ownerName || name,
      gstin: gstOk ? gstNumber : '',
      gstNumber: gstOk ? gstNumber : '',
      gstDocUrl: gstOk ? gstDocUrl : '',
      enrollmentNumber: enrollOk ? enrollmentNumber : '',
      enrollmentDocUrl: enrollOk ? enrollmentDocUrl : '',
      panNumber,
      panDocUrl,
      bankAccount,
      ifsc,
      bankProofUrl,
      dealsInFood: !!dealsInFood,
      fssai: fssai || '',
      fssaiDocUrl: dealsInFood ? fssaiDocUrl || '' : '',
      phoneVerified: true,
      registrationFeePaid: true,
      registrationFeeAmount: REGISTRATION_FEE,
      category: category || 'grocery',
      baseDeliveryFee: baseDeliveryFee != null ? Number(baseDeliveryFee) : 20,
      freeDeliveryAbove: freeDeliveryAbove != null ? Number(freeDeliveryAbove) : 300,
      estDeliveryMins: estDeliveryMins != null ? Number(estDeliveryMins) : 20,
      openingTime: openingTime || '08:00 AM - 10:30 PM',
      status: 'pending',
      isOnline: false
    });

    res.status(201).json({
      success: true,
      message: 'Seller registration submitted — pending admin approval',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: user.status
        },
        store: {
          _id: store._id,
          name: store.name,
          status: store.status,
          registrationFeeAmount: store.registrationFeeAmount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { sendSellerOtp, registerSeller };