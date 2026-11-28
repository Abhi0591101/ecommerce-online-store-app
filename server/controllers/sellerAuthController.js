const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Store = require('../models/Store');
const PlatformConfig = require('../models/PlatformConfig');
const { issueOtp, verifyOtp, OTP_MODE, normalizePhone } = require('../utils/otpStore');

const DEFAULT_REGISTRATION_FEE = 216;

const resolveRegistrationFee = async () => {
  const cfg = await PlatformConfig.findOne({ key: 'default' }).lean();
  const fee = Number(cfg?.sellerRegistrationFee);
  return Number.isFinite(fee) && fee >= 0 ? fee : DEFAULT_REGISTRATION_FEE;
};

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
      ...(result.otp ? { otp: result.otp, demoOtp: result.demoOtp || result.otp } : {}),
      message: result.message || 'OTP sent to your mobile number'
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
      registrationFeeTxnId,
      registrationFeeRazorpayOrderId,
      razorpayPaymentId,
      paymentTxnId,
      category,
      baseDeliveryFee,
      freeDeliveryAbove,
      estDeliveryMins,
      openingTime,
      promoter1Name,
      promoter1Phone,
      promoter2Name,
      promoter2Phone
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
    const feeAmount = await resolveRegistrationFee();
    const txnId = String(
      registrationFeeTxnId || razorpayPaymentId || paymentTxnId || ''
    ).trim();
    if (feeAmount > 0) {
      const { requireFeePayment } = require('../utils/verifiedPayments');
      const paid = requireFeePayment(txnId, feeAmount);
      if (!paid.ok) {
        return res.status(400).json({ success: false, message: paid.message });
      }
    } else if (!registrationFeePaid) {
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
    const exists = await User.findOne({ phone: phoneNorm, role: 'store_owner' });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'This mobile is already registered as a seller'
      });
    }
    const emailNorm = email ? String(email).trim().toLowerCase() : '';
    if (emailNorm) {
      const emailTaken = await User.findOne({ email: emailNorm, role: 'store_owner' });
      if (emailTaken) {
        return res.status(409).json({
          success: false,
          message: 'This email is already registered as a seller'
        });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      phone: phoneNorm,
      email: emailNorm || undefined,
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
      registrationFeeAmount: feeAmount,
      registrationFeeTxnId: txnId,
      registrationFeeRazorpayOrderId: String(registrationFeeRazorpayOrderId || '').trim(),
      registrationFeePaidAt: feeAmount > 0 ? new Date() : undefined,
      category: category || 'grocery',
      baseDeliveryFee: baseDeliveryFee != null ? Number(baseDeliveryFee) : 20,
      freeDeliveryAbove: freeDeliveryAbove != null ? Number(freeDeliveryAbove) : 300,
      estDeliveryMins: estDeliveryMins != null ? Number(estDeliveryMins) : 20,
      openingTime: openingTime || '08:00 AM - 10:30 PM',
      status: 'pending',
      isOnline: false,
      promoters: [
        {
          name: String(promoter1Name || '').trim(),
          phone: promoter1Phone ? normalizePhone(promoter1Phone) : ''
        },
        {
          name: String(promoter2Name || '').trim(),
          phone: promoter2Phone ? normalizePhone(promoter2Phone) : ''
        }
      ].filter((p) => p.name || p.phone)
    });

    if (txnId) {
      const { consumeVerified } = require('../utils/verifiedPayments');
      consumeVerified(txnId, null);
    }

    try {
      const { pushAdminAlert } = require('../utils/adminAlerts');
      await pushAdminAlert({
        type: 'seller_application',
        title: 'Seller application pending',
        body: `${store.name} (${phoneNorm})`,
        entityType: 'store',
        entityId: store._id,
        linkTab: 'sellers',
        dedupeKey: `seller_application:${store._id}`
      });
    } catch {
      /* non-blocking */
    }

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