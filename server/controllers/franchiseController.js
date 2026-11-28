const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Franchise = require('../models/Franchise');
const FranchiseNotification = require('../models/FranchiseNotification');
const ServiceArea = require('../models/ServiceArea');
const Delivery = require('../models/Delivery');
const SiteSettings = require('../models/SiteSettings');
const PlatformConfig = require('../models/PlatformConfig');
const { issueOtp, verifyOtp, normalizePhone } = require('../utils/otpStore');
const { signToken } = require('../middleware/auth');
const { publicUser } = require('./authController');
const { queueEmail } = require('../utils/emailQueue');
const {
  franchiseApplicationConfirmation,
  franchiseApplicationAdminAlert
} = require('../utils/emailTemplates');

const nextApplicationId = async () => {
  const year = new Date().getFullYear();
  const count = await Franchise.countDocuments();
  return `JAPTO-FR-${year}-${String(count + 1).padStart(4, '0')}`;
};

const getFranchiseForUser = async (user) => {
  if (!user) return null;
  if (user.franchiseId) {
    return Franchise.findById(user.franchiseId);
  }
  return Franchise.findOne({
    $or: [{ ownerUserId: user._id }, { phone: user.phone }],
    status: { $in: ['approved', 'inactive'] }
  });
};

const pushFranchiseNotify = async (franchiseId, payload) => {
  try {
    await FranchiseNotification.create({ franchiseId, ...payload });
  } catch {
    /* ignore */
  }
};

const DEFAULT_FRANCHISE_REG_FEE = 500;
const DEFAULT_FEE_NOTE =
  '₹2,00,000 से ₹5,00,000 तक, शहर के अनुसार। अंतिम फीस Japto.in Head Office तय करेगा।';

const mapPublicInfo = async () => {
  const cfg = (await PlatformConfig.findOne({ key: 'default' })) || {};
  const settings = (await SiteSettings.findOne({ key: 'default' })) || {};
  const regFee = Number(cfg.franchiseRegistrationFee);
  const feeMin = Number(cfg.franchiseFeeMin);
  const feeMax = Number(cfg.franchiseFeeMax);
  return {
    franchiseRegistrationFee:
      Number.isFinite(regFee) && regFee >= 0 ? regFee : DEFAULT_FRANCHISE_REG_FEE,
    franchiseFeeMin: Number.isFinite(feeMin) && feeMin >= 0 ? feeMin : 200000,
    franchiseFeeMax: Number.isFinite(feeMax) && feeMax >= 0 ? feeMax : 500000,
    franchiseFeeNote: cfg.franchiseFeeNote || DEFAULT_FEE_NOTE,
    gstNote: 'GST फ्रेंचाइज़ी फीस से अलग लगेगा।',
    refundPolicy: 'फ्रेंचाइज़ी फीस Non-Refundable होगी।',
    agreementPeriod: '5 वर्ष',
    deliveryCommissionNote:
      'योग्य (eligible) डिलीवरी चार्ज पर Head Office द्वारा तय प्रतिशत के अनुसार कमीशन। भुगतान हर सप्ताह होगा।',
    workingAreaNote:
      'फ्रेंचाइज़ी को अपने शहर में केवल Head Office द्वारा स्वीकृत PIN Codes में कार्य करने का अधिकार होगा।',
    noSecurityDeposit: true,
    deliveryCommissionPctDefault: cfg.franchiseDeliveryCommissionPct ?? 5,
    headOffice: {
      phone: settings.contactPhone || '',
      email: settings.contactEmail || '',
      address: settings.contactAddress || ''
    }
  };
};

/** GET /api/franchise/public-info */
const getPublicInfo = async (req, res, next) => {
  try {
    res.json({ success: true, data: await mapPublicInfo() });
  } catch (error) {
    next(error);
  }
};

/** POST /api/franchise/apply — public application */
const submitApplication = async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.ownerName || !b.phone || !b.city || !b.email) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, email and city are required'
      });
    }
    if (!b.password || String(b.password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required (min 6 characters) so you can login after approval'
      });
    }
    const phone = normalizePhone(b.phone);
    const email = String(b.email).trim().toLowerCase();
    const pendingPasswordHash = await bcrypt.hash(String(b.password), 10);
    const existing = await Franchise.findOne({
      phone,
      status: { $in: ['pending', 'approved'] }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An application already exists for this phone',
        data: { applicationId: existing.applicationId }
      });
    }
    // Email unique among franchises only — same email OK for customer / seller / rider
    const emailUsed = await Franchise.findOne({
      email,
      status: { $in: ['pending', 'approved'] }
    });
    if (emailUsed) {
      return res.status(409).json({
        success: false,
        message: 'An application already exists for this email',
        data: { applicationId: emailUsed.applicationId }
      });
    }
    const franchiseUserEmail = await User.findOne({ email, role: 'franchise' });
    if (franchiseUserEmail) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered as a franchise'
      });
    }

    const address = [b.houseNo, b.streetArea, b.city, b.state, b.pincode]
      .filter(Boolean)
      .join(', ');

    const applicationId = await nextApplicationId();
    const publicInfo = await mapPublicInfo();
    const feeAmount = Number(publicInfo.franchiseRegistrationFee || 0);
    const txnId = String(
      b.registrationFeeTxnId || b.razorpayPaymentId || b.paymentTxnId || ''
    ).trim();
    if (feeAmount > 0) {
      const { requireFeePayment } = require('../utils/verifiedPayments');
      const paid = requireFeePayment(txnId, feeAmount);
      if (!paid.ok) {
        return res.status(400).json({ success: false, message: paid.message });
      }
    }

    const doc = await Franchise.create({
      applicationId,
      name: b.shopName || b.name || `${b.ownerName} Franchise`,
      ownerName: b.ownerName,
      phone,
      email,
      city: b.city,
      state: b.state || '',
      pincode: b.pincode || '',
      pinCodes: b.pincode ? [String(b.pincode)] : [],
      houseNo: b.houseNo || '',
      streetArea: b.streetArea || '',
      address,
      businessExperience: b.businessExperience === 'experienced' ? 'experienced' : 'new',
      message: b.message || '',
      promoters: [
        { name: b.promoter1Name || '', phone: b.promoter1Phone || '' },
        { name: b.promoter2Name || '', phone: b.promoter2Phone || '' }
      ].filter((p) => p.name || p.phone),
      status: 'pending',
      isActive: false,
      confirmationEmailQueued: true,
      feeNonRefundable: true,
      agreementYears: 5,
      franchiseFee: feeAmount,
      franchiseFeeMin: publicInfo.franchiseFeeMin,
      franchiseFeeMax: publicInfo.franchiseFeeMax,
      registrationFeePaid: feeAmount <= 0 || Boolean(txnId),
      registrationFeeTxnId: txnId,
      registrationFeeRazorpayOrderId: String(b.registrationFeeRazorpayOrderId || b.razorpayOrderId || '').trim(),
      registrationFeePaidAt: feeAmount > 0 && txnId ? new Date() : undefined,
      pendingPasswordHash
    });

    if (txnId) {
      const { consumeVerified } = require('../utils/verifiedPayments');
      consumeVerified(txnId, null);
    }

    const payload = {
      applicationId: doc.applicationId,
      ownerName: doc.ownerName,
      phone: doc.phone,
      email: doc.email,
      city: doc.city,
      pincode: doc.pincode,
      address: doc.address,
      businessExperience: doc.businessExperience,
      message: doc.message,
      promoters: doc.promoters,
      createdAt: doc.createdAt
    };

    const applicantMail = await franchiseApplicationConfirmation(payload);
    const adminMail = await franchiseApplicationAdminAlert(payload);
    const { getOrCreateEmailSettings } = require('../utils/emailSettingsStore');
    const emailCfg = await getOrCreateEmailSettings();
    const adminInbox =
      emailCfg.adminEmail || process.env.ADMIN_EMAIL || 'abhishekdb13@gmail.com';

    const queued = [];
    queued.push(
      await queueEmail({
        to: email,
        subject: applicantMail.subject,
        html: applicantMail.html,
        text: applicantMail.text,
        template: 'franchise_application_confirmation',
        meta: { applicationId: doc.applicationId, franchiseId: String(doc._id) }
      })
    );
    queued.push(
      await queueEmail({
        to: adminInbox,
        subject: adminMail.subject,
        html: adminMail.html,
        text: adminMail.text,
        template: 'franchise_application_admin_alert',
        meta: { applicationId: doc.applicationId, franchiseId: String(doc._id) }
      })
    );

    try {
      const { pushAdminAlert } = require('../utils/adminAlerts');
      await pushAdminAlert({
        type: 'franchise_application',
        title: 'New franchise application',
        body: `${doc.ownerName || doc.name} (${doc.phone}) — ${doc.applicationId}`,
        entityType: 'franchise',
        entityId: doc._id,
        linkTab: 'franchises',
        dedupeKey: `franchise_application:${doc._id}`
      });
    } catch {
      /* non-blocking */
    }

    res.status(201).json({
      success: true,
      message:
        'Application submitted.',
      data: {
        applicationId: doc.applicationId,
        id: doc._id,
        status: doc.status,
        emailsQueued: queued.length,
        emailJobs: queued.map((q) => q._id)
      }
    });
  } catch (error) {
    next(error);
  }
};

const sendFranchiseOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'phone required' });
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

const loginFranchise = async (req, res, next) => {
  try {
    const { phone, otp, password } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone required' });
    }
    if (!otp && !password) {
      return res.status(400).json({
        success: false,
        message: 'OTP or password required'
      });
    }

    const user = await User.findOne({ phone: normalizePhone(phone), role: 'franchise' }).select(
      '+password'
    );
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (password) {
      const ok = user.password && (await bcrypt.compare(String(password), user.password));
      if (!ok) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else if (!verifyOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Franchise account pending Head Office approval'
      });
    }

    const franchise = await getFranchiseForUser(user);
    if (!franchise || franchise.status !== 'approved' || !franchise.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Franchise not approved / inactive'
      });
    }

    res.json({
      success: true,
      data: { token: signToken(user), user: publicUser(user), franchise }
    });
  } catch (error) {
    next(error);
  }
};

const changePasswordOtp = async (req, res, next) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'phone, otp and newPassword required' });
    }
    if (!verifyOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const user = await User.findOne({ phone: normalizePhone(phone), role: 'franchise' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (String(user._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Phone must match logged-in account' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) {
      return res.status(404).json({ success: false, message: 'Franchise not found' });
    }

    const partners = await User.find({
      role: 'driver',
      franchiseId: franchise._id
    }).select('-password');

    const activePartners = partners.filter((p) => p.isActive !== false && p.status === 'approved');
    const partnerIds = partners.map((p) => p._id);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [totalOk, weekOk] = await Promise.all([
      Delivery.countDocuments({
        driverId: { $in: partnerIds },
        status: 'delivered'
      }),
      Delivery.countDocuments({
        driverId: { $in: partnerIds },
        status: 'delivered',
        updatedAt: { $gte: weekStart }
      })
    ]);

    const ledger = franchise.commissionLedger || [];
    const weekCommission = ledger
      .filter((c) => c.at && new Date(c.at) >= weekStart)
      .reduce((s, c) => s + (c.amount || 0), 0);
    const paidCommission = ledger
      .filter((c) => c.status === 'paid')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const pendingCommission = ledger
      .filter((c) => c.status !== 'paid')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const totalCommission = ledger.reduce((s, c) => s + (c.amount || 0), 0);

    res.json({
      success: true,
      data: {
        franchise,
        overview: {
          totalPartners: partners.length,
          activePartners: activePartners.length,
          totalSuccessfulDeliveries: totalOk,
          weekDeliveries: weekOk,
          weekCommission,
          totalPaidCommission: paidCommission,
          pendingCommission,
          totalCommission
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const info = await mapPublicInfo();
    res.json({
      success: true,
      data: {
        user: publicUser(req.user),
        franchise,
        headOffice: info.headOffice
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const allowed = ['ownerName', 'email', 'address', 'houseNo', 'streetArea', 'state', 'pincode'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) franchise[k] = req.body[k];
    }
    if (req.body.name) franchise.name = req.body.name;
    await franchise.save();
    if (req.body.name || req.body.email) {
      await User.findByIdAndUpdate(req.user._id, {
        ...(req.body.name ? { name: req.body.name } : {}),
        ...(req.body.email ? { email: req.body.email } : {})
      });
    }
    res.json({ success: true, data: franchise });
  } catch (error) {
    next(error);
  }
};

const listPartners = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const data = await User.find({ role: 'driver', franchiseId: franchise._id })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: data.map((d) => ({
        ...d,
        workPins: franchise.pinCodes || []
      }))
    });
  } catch (error) {
    next(error);
  }
};

/** Franchise can add partner — stays pending until Admin approves */
const addPartner = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise || franchise.status !== 'approved') {
      return res.status(403).json({ success: false, message: 'Franchise not active' });
    }
    const { name, phone, password, city, pincode } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'name and phone required' });
    }
    const norm = normalizePhone(phone);
    const exists = await User.findOne({ phone: norm, role: 'driver' });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'This mobile is already registered as a rider'
      });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required (min 6 characters)'
      });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      phone: norm,
      password: hash,
      role: 'driver',
      status: 'pending',
      isActive: false,
      isOnline: false,
      city: city || franchise.city,
      franchiseId: franchise._id,
      fullAddress: pincode ? `${franchise.city} · PIN ${pincode}` : franchise.city
    });
    await pushFranchiseNotify(franchise._id, {
      type: 'partner',
      title: 'Delivery partner submitted',
      body: `${name} (${norm}) sent for Admin approval`
    });
    try {
      const { pushAdminAlert } = require('../utils/adminAlerts');
      await pushAdminAlert({
        type: 'rider_application',
        title: 'Delivery partner pending approval',
        body: `${name} (${norm}) via franchise ${franchise.name || franchise.ownerName}`,
        entityType: 'user',
        entityId: user._id,
        linkTab: 'delivery',
        dedupeKey: `rider_application:${user._id}`
      });
    } catch {
      /* non-blocking */
    }
    res.status(201).json({
      success: true,
      message: 'Partner added — awaiting Head Office / Admin approval before work can start',
      data: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const listPinCodes = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const areas = await ServiceArea.find({
      $or: [{ franchiseId: franchise._id }, { city: franchise.city }]
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: {
        approvedPins: franchise.pinCodes || [],
        requests: areas.filter((a) => String(a.franchiseId || '') === String(franchise._id))
      }
    });
  } catch (error) {
    next(error);
  }
};

const requestPinCode = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const { pincode, area } = req.body;
    if (!pincode) return res.status(400).json({ success: false, message: 'pincode required' });
    const doc = await ServiceArea.create({
      pincode: String(pincode),
      area: area || franchise.city,
      city: franchise.city,
      state: franchise.state || 'UP',
      lat: 26.0,
      lng: 78.0,
      isActive: false,
      pinCodeStatus: 'pending',
      franchiseId: franchise._id
    });
    await pushFranchiseNotify(franchise._id, {
      type: 'pin',
      title: 'PIN request submitted',
      body: `PIN ${pincode} sent for Admin approval`
    });
    try {
      const { pushAdminAlert } = require('../utils/adminAlerts');
      await pushAdminAlert({
        type: 'franchise_pin',
        title: 'Franchise PIN approval pending',
        body: `PIN ${pincode} · ${franchise.city || ''} (${franchise.name || franchise.ownerName})`,
        entityType: 'service_area',
        entityId: doc._id,
        linkTab: 'franchises_pins',
        dedupeKey: `franchise_pin:${doc._id}`
      });
    } catch {
      /* non-blocking */
    }
    res.status(201).json({
      success: true,
      message: 'PIN request submitted — Admin approval required before work in this PIN',
      data: doc
    });
  } catch (error) {
    next(error);
  }
};

const getCommissionLedger = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const ledger = franchise.commissionLedger || [];
    const total = ledger.reduce((s, c) => s + (c.amount || 0), 0);
    const paid = ledger.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const week = ledger
      .filter((c) => c.at && new Date(c.at) >= weekStart)
      .reduce((s, c) => s + (c.amount || 0), 0);
    res.json({
      success: true,
      data: {
        total,
        week,
        paid,
        pending: total - paid,
        rows: ledger.slice().sort((a, b) => new Date(b.at) - new Date(a.at))
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentHistory = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    res.json({
      success: true,
      data: (franchise.paymentHistory || [])
        .slice()
        .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
    });
  } catch (error) {
    next(error);
  }
};

const getBankDetails = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    res.json({
      success: true,
      data: {
        accountHolder: franchise.bankAccountHolder || '',
        accountNumber: franchise.bankAccountNumber || '',
        ifsc: franchise.bankIfsc || '',
        pendingBankChange: franchise.pendingBankChange || { status: 'none' }
      }
    });
  } catch (error) {
    next(error);
  }
};

const requestBankChange = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const { accountHolder, accountNumber, ifsc } = req.body;
    if (!accountHolder || !accountNumber || !ifsc) {
      return res.status(400).json({
        success: false,
        message: 'accountHolder, accountNumber and ifsc required'
      });
    }
    franchise.pendingBankChange = {
      accountHolder,
      accountNumber,
      ifsc,
      status: 'pending',
      requestedAt: new Date(),
      adminNote: ''
    };
    await franchise.save();
    await pushFranchiseNotify(franchise._id, {
      type: 'bank',
      title: 'Bank change requested',
      body: 'Old bank details remain valid until Admin approves the change'
    });
    try {
      const { pushAdminAlert } = require('../utils/adminAlerts');
      await pushAdminAlert({
        type: 'franchise_bank',
        title: 'Franchise bank change request',
        body: `${franchise.name || franchise.ownerName}: ${accountHolder} · ${accountNumber} · ${ifsc}`,
        entityType: 'franchise',
        entityId: franchise._id,
        linkTab: 'franchises',
        dedupeKey: `franchise_bank:${franchise._id}:${franchise.pendingBankChange.requestedAt}`
      });
    } catch {
      /* non-blocking */
    }
    res.json({
      success: true,
      message: 'Bank change request sent — awaiting Admin approval',
      data: franchise.pendingBankChange
    });
  } catch (error) {
    next(error);
  }
};

const listNotices = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const data = await FranchiseNotification.find({ franchiseId: franchise._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const markNoticeRead = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    const data = await FranchiseNotification.findOneAndUpdate(
      { _id: req.params.id, franchiseId: franchise._id },
      { read: true },
      { new: true }
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const markAllNoticesRead = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    await FranchiseNotification.updateMany(
      { franchiseId: franchise._id, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const contactHeadOffice = async (req, res, next) => {
  try {
    const franchise = await getFranchiseForUser(req.user);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
    const { subject, message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message required' });
    await pushFranchiseNotify(franchise._id, {
      type: 'system',
      title: 'Message queued to Head Office',
      body: `${subject || 'Contact'}: ${message}`
    });
    // Also store as admin-visible notice via AdminNotification-like trail on franchise message field is enough for demo
    res.json({
      success: true,
      message: 'Message queued for Head Office (email gateway may be demo)'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicInfo,
  submitApplication,
  sendFranchiseOtp,
  loginFranchise,
  changePasswordOtp,
  getDashboard,
  getMyProfile,
  updateProfile,
  listPartners,
  addPartner,
  listPinCodes,
  requestPinCode,
  getCommissionLedger,
  getPaymentHistory,
  getBankDetails,
  requestBankChange,
  listNotices,
  markNoticeRead,
  markAllNoticesRead,
  contactHeadOffice,
  getFranchiseForUser,
  pushFranchiseNotify
};
