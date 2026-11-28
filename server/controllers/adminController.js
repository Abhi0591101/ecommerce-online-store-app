const User = require('../models/User');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Franchise = require('../models/Franchise');
const Coupon = require('../models/Coupon');
const Banner = require('../models/Banner');
const SiteSettings = require('../models/SiteSettings');
const Complaint = require('../models/Complaint');
const PlatformConfig = require('../models/PlatformConfig');
const AdminNotification = require('../models/AdminNotification');
const SupportRequest = require('../models/SupportRequest');
const ServiceArea = require('../models/ServiceArea');
const SellerNotification = require('../models/SellerNotification');
const CustomerNotification = require('../models/CustomerNotification');
const RiderNotification = require('../models/RiderNotification');

const getOrCreateConfig = async () => {
  let cfg = await PlatformConfig.findOne({ key: 'default' });
  if (!cfg) cfg = await PlatformConfig.create({ key: 'default' });
  return cfg;
};

const getOrCreateSettings = async () => {
  let s = await SiteSettings.findOne({ key: 'default' });
  if (!s) s = await SiteSettings.create({ key: 'default' });
  return s;
};

const rangeFilter = (range) => {
  const now = new Date();
  const start = new Date(now);
  if (range === 'daily') start.setHours(0, 0, 0, 0);
  else if (range === 'weekly') start.setDate(start.getDate() - 7);
  else if (range === 'monthly') start.setMonth(start.getMonth() - 1);
  else if (range === 'yearly') start.setFullYear(start.getFullYear() - 1);
  else return {};
  return { createdAt: { $gte: start } };
};

// ─── 1. Dashboard ───────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const [
      customers,
      sellers,
      deliveryPartners,
      franchises,
      products,
      ordersTotal,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      salesAgg,
      commissionAgg
    ] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      Store.countDocuments({}),
      User.countDocuments({ role: 'driver' }),
      Franchise.countDocuments({}),
      Product.countDocuments({}),
      Order.countDocuments({}),
      Order.countDocuments({ status: { $in: ['placed', 'accepted', 'packing'] } }),
      Order.countDocuments({ status: 'completed' }),
      Order.countDocuments({ status: { $in: ['cancelled', 'rejected'] } }),
      Order.aggregate([
        { $match: { status: { $nin: ['cancelled', 'rejected'] } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Order.aggregate([
        { $match: { status: { $nin: ['cancelled', 'rejected'] } } },
        { $group: { _id: null, total: { $sum: '$platformFee' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        customers,
        sellers,
        deliveryPartners,
        franchises,
        products,
        orders: ordersTotal,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalSales: salesAgg[0]?.total || 0,
        totalCommission: commissionAgg[0]?.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─── 2. Customers ───────────────────────────────────────────
const listCustomers = async (req, res, next) => {
  try {
    const customers = await User.find({ role: 'customer' }).select('-password').sort({ createdAt: -1 }).lean();
    const withOrders = await Promise.all(
      customers.map(async (c) => {
        const orderCount = await Order.countDocuments({
          $or: [{ customerId: c._id }, { customerPhone: c.phone }]
        });
        const complaints = await Complaint.countDocuments({
          source: 'customer',
          $or: [{ userId: c._id }, { raisedByPhone: c.phone }]
        });
        const addr = c.addresses?.[0];
        return {
          ...c,
          totalOrders: orderCount,
          complaintCount: complaints,
          fullAddress: addr
            ? [addr.flatBuilding, addr.streetArea, addr.city, addr.pincode].filter(Boolean).join(', ')
            : ''
        };
      })
    );
    res.json({ success: true, data: withOrders });
  } catch (error) {
    next(error);
  }
};

const getCustomerDetail = async (req, res, next) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'customer' }).select('-password');
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    const orders = await Order.find({
      $or: [{ customerId: customer._id }, { customerPhone: customer.phone }]
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const complaints = await Complaint.find({
      source: 'customer',
      $or: [{ userId: customer._id }, { raisedByPhone: customer.phone }]
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: { customer, orders, complaints } });
  } catch (error) {
    next(error);
  }
};

const updateCustomerStatus = async (req, res, next) => {
  try {
    const { status, isActive } = req.body;
    const update = {};
    if (status) update.status = status;
    if (typeof isActive === 'boolean') update.isActive = isActive;
    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'customer' },
      update,
      { new: true }
    ).select('-password');
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

// ─── 3. Sellers ─────────────────────────────────────────────
const listSellers = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const stores = await Store.find(filter).populate('ownerId', 'name phone email status').sort({ createdAt: -1 }).lean();
    const data = await Promise.all(
      stores.map(async (s) => {
        const [productCount, orderCount, salesAgg, complaints] = await Promise.all([
          Product.countDocuments({ submittedBy: s.ownerId?._id }),
          Order.countDocuments({ storeId: s._id }),
          Order.aggregate([
            { $match: { storeId: s._id, status: { $nin: ['cancelled', 'rejected'] } } },
            {
              $group: {
                _id: null,
                sales: { $sum: '$grandTotal' },
                earnings: { $sum: '$sellerEarning' }
              }
            }
          ]),
          Complaint.countDocuments({ source: 'seller', storeId: s._id })
        ]);
        return {
          ...s,
          productCount,
          orderCount,
          totalSales: salesAgg[0]?.sales || 0,
          totalEarnings: salesAgg[0]?.earnings || 0,
          complaintCount: complaints
        };
      })
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getSellerDetail = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id).populate('ownerId', 'name phone email status').lean();
    if (!store) return res.status(404).json({ success: false, message: 'Seller not found' });
    const [products, orders, complaints] = await Promise.all([
      Product.find({ submittedBy: store.ownerId?._id || store.ownerId }).limit(100).lean(),
      Order.find({ storeId: store._id }).sort({ createdAt: -1 }).limit(100).lean(),
      Complaint.find({ source: 'seller', storeId: store._id }).sort({ createdAt: -1 })
    ]);
    res.json({ success: true, data: { store, products, orders, complaints } });
  } catch (error) {
    next(error);
  }
};

const updateSellerAdmin = async (req, res, next) => {
  try {
    const { hasCompleteSellerKyc } = require('../utils/storeVisibility');
    const { status, isActive, decisionNote, address, pincode, city, lat, lng } = req.body;
    const update = {};
    if (status) {
      update.status = status;
      update.decisionNote = decisionNote || '';
      update.decidedAt = new Date();
      if (status === 'approved') {
        update.isActive = true;
        // Online only after KYC is complete — otherwise keep hidden
        // (final isOnline decided after load below)
      }
      if (status === 'rejected') {
        update.isActive = false;
        update.isOnline = false; // reject → visibility off
      }
    }
    if (typeof isActive === 'boolean') {
      update.isActive = isActive;
      if (isActive === false) {
        update.isOnline = false; // inactive → visibility off
      }
    }

    // Admin can update store address directly (Users → Sellers detail)
    if (address != null) update.address = String(address).trim();
    if (pincode != null) {
      const pin = String(pincode).trim();
      if (pin && !/^[1-9]\d{5}$/.test(pin)) {
        return res.status(400).json({ success: false, message: 'Valid 6-digit pincode required' });
      }
      if (pin) update.pincode = pin;
    }
    if (city != null) update.city = String(city).trim();
    if (lat != null && lng != null && lat !== '' && lng !== '') {
      const la = Number(lat);
      const ln = Number(lng);
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        update.location = { type: 'Point', coordinates: [ln, la] };
      }
    }

    let store = await Store.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!store) return res.status(404).json({ success: false, message: 'Seller not found' });

    // Approve with complete KYC → may go online; approve without KYC → stay offline
    if (status === 'approved') {
      store.isOnline = hasCompleteSellerKyc(store);
      await store.save();
    }

    // Safety: rejected / inactive never stay online
    if (store.status === 'rejected' || store.isActive === false) {
      if (store.isOnline) {
        store.isOnline = false;
        await store.save();
      }
    }

    if (status === 'approved' || status === 'rejected') {
      try {
        const { resolveAlertsForEntity } = require('../utils/adminAlerts');
        await resolveAlertsForEntity(store._id, ['seller_application']);
      } catch {
        /* ignore */
      }
    }

    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

// ─── 4. Delivery partners ───────────────────────────────────
const listDeliveryPartners = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { role: 'driver' };
    if (status) filter.status = status;
    const riders = await User.find(filter).select('-password').sort({ createdAt: -1 }).lean();
    const riderIds = riders.map((r) => r._id);
    const complaintCounts = await Complaint.aggregate([
      { $match: { source: 'delivery', userId: { $in: riderIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);
    const cMap = Object.fromEntries(complaintCounts.map((c) => [String(c._id), c.count]));
    const data = riders.map((r) => ({
      ...r,
      fullAddress: r.fullAddress || r.city || '',
      successfulDeliveries: r.completedDeliveries || 0,
      failedDeliveries: r.failedDeliveries || 0,
      codOrders: r.codCollected || 0,
      complaintCount: cMap[String(r._id)] || 0,
      docs: {
        aadhaarNo: r.aadhaarNo || '',
        idProofUrl: r.idProofUrl || '',
        rcDocUrl: r.rcDocUrl || '',
        licenseDocUrl: r.licenseDocUrl || '',
        insuranceDocUrl: r.insuranceDocUrl || '',
        bikePhotoUrl: r.bikePhotoUrl || '',
        bankProofUrl: r.bankProofUrl || ''
      }
    }));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const updateDeliveryPartner = async (req, res, next) => {
  try {
    const { status, isActive, statusReason, decisionNote, city } = req.body;
    const update = {};
    if (status) update.status = status;
    if (typeof isActive === 'boolean') update.isActive = isActive;
    if (statusReason !== undefined) update.statusReason = String(statusReason);
    else if (decisionNote !== undefined) update.statusReason = String(decisionNote);
    if (city !== undefined) update.city = city;
    if (status === 'approved') {
      update.isActive = true;
      update.isOnline = false;
    }
    if (status === 'inactive' || status === 'suspended' || status === 'rejected') {
      update.isOnline = false;
      if (status === 'inactive' || status === 'suspended') update.isActive = false;
    }
    const rider = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'driver' },
      update,
      { new: true }
    ).select('-password');
    if (!rider) return res.status(404).json({ success: false, message: 'Delivery partner not found' });
    if (status === 'approved' || status === 'rejected') {
      try {
        const { resolveAlertsForEntity } = require('../utils/adminAlerts');
        await resolveAlertsForEntity(rider._id, ['rider_application']);
      } catch {
        /* ignore */
      }
    }
    try {
      await RiderNotification.create({
        riderId: rider._id,
        type: 'account_status',
        title: `Account ${rider.status}`,
        body: rider.statusReason || `Your delivery account is now ${rider.status}`
      });
    } catch {
      /* ignore */
    }
    res.json({ success: true, data: rider });
  } catch (error) {
    next(error);
  }
};

// ─── 5. Franchises ──────────────────────────────────────────
const listFranchises = async (req, res, next) => {
  try {
    const data = await Franchise.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createFranchise = async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { normalizePhone } = require('../utils/otpStore');
    const b = req.body || {};
    if (!b.ownerName || !b.phone || !b.city || !b.email) {
      return res.status(400).json({
        success: false,
        message: 'Owner name, phone, email and city are required'
      });
    }
    if (!b.password || String(b.password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required (min 6 characters)'
      });
    }

    const phone = normalizePhone(b.phone);
    const email = String(b.email).trim().toLowerCase();

    const existing = await Franchise.findOne({
      phone,
      status: { $in: ['pending', 'approved'] }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A franchise already exists for this phone',
        data: { applicationId: existing.applicationId }
      });
    }
    if (await User.findOne({ phone, role: 'franchise' })) {
      return res.status(409).json({
        success: false,
        message: 'This mobile is already registered as a franchise'
      });
    }
    if (await User.findOne({ email, role: 'franchise' })) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered as a franchise'
      });
    }

    const year = new Date().getFullYear();
    const count = await Franchise.countDocuments();
    const applicationId = `JAPTO-FR-${year}-${String(count + 1).padStart(4, '0')}`;
    const address = [b.houseNo, b.streetArea, b.city, b.state, b.pincode]
      .filter(Boolean)
      .join(', ');
    const passwordHash = await bcrypt.hash(String(b.password), 10);
    const pinCodes = [
      ...(b.pincode ? [String(b.pincode).trim()] : []),
      ...(Array.isArray(b.pinCodes)
        ? b.pinCodes.map(String)
        : String(b.pinCodes || '')
            .split(',')
            .map((s) => s.trim()))
    ].filter((p, i, arr) => p && arr.indexOf(p) === i);

    // Admin-created franchise is approved & active by default (can still set pending)
    const status = b.status === 'pending' ? 'pending' : 'approved';
    const isActive = status === 'approved';

    const cfg = await getOrCreateConfig();
    const regFee = Number(
      b.franchiseFee != null && b.franchiseFee !== ''
        ? b.franchiseFee
        : cfg.franchiseRegistrationFee ?? 500
    );

    const franchise = await Franchise.create({
      applicationId,
      name: b.name || b.shopName || `${b.ownerName} Franchise`,
      ownerName: b.ownerName,
      phone,
      email,
      city: b.city,
      state: b.state || '',
      pincode: b.pincode || '',
      pinCodes,
      houseNo: b.houseNo || '',
      streetArea: b.streetArea || '',
      address: address || b.address || '',
      businessExperience: b.businessExperience === 'experienced' ? 'experienced' : 'new',
      message: b.message || '',
      promoters: [
        { name: b.promoter1Name || '', phone: b.promoter1Phone || '' },
        { name: b.promoter2Name || '', phone: b.promoter2Phone || '' }
      ].filter((p) => p.name || p.phone),
      status,
      isActive,
      decidedAt: status === 'approved' ? new Date() : undefined,
      decisionNote: status === 'approved' ? 'Created by Admin' : '',
      feeNonRefundable: true,
      agreementYears: 5,
      franchiseFee: Number.isFinite(regFee) && regFee >= 0 ? regFee : 500,
      franchiseFeeMin: Number(cfg.franchiseFeeMin ?? 200000),
      franchiseFeeMax: Number(cfg.franchiseFeeMax ?? 500000),
      pendingPasswordHash: status === 'pending' ? passwordHash : ''
    });

    if (status === 'approved') {
      const user = await User.create({
        name: franchise.ownerName || franchise.name,
        phone: franchise.phone,
        email: franchise.email,
        password: passwordHash,
        role: 'franchise',
        status: 'approved',
        franchiseId: franchise._id,
        city: franchise.city,
        fullAddress: franchise.address
      });
      franchise.ownerUserId = user._id;
      await franchise.save();
    }

    res.status(201).json({ success: true, data: franchise });
  } catch (error) {
    next(error);
  }
};

const updateFranchise = async (req, res, next) => {
  try {
    const franchise = await Franchise.findById(req.params.id);
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });

    const body = { ...req.body };

    // Bank change decision
    if (body.bankDecision === 'approved' || body.bankDecision === 'rejected') {
      const pending = franchise.pendingBankChange || {};
      if (pending.status === 'pending') {
        if (body.bankDecision === 'approved') {
          franchise.bankAccountHolder = pending.accountHolder || franchise.bankAccountHolder;
          franchise.bankAccountNumber = pending.accountNumber || franchise.bankAccountNumber;
          franchise.bankIfsc = pending.ifsc || franchise.bankIfsc;
          franchise.pendingBankChange = {
            ...pending,
            status: 'approved',
            decidedAt: new Date(),
            adminNote: body.adminNote || body.decisionNote || 'Approved'
          };
        } else {
          franchise.pendingBankChange = {
            ...pending,
            status: 'rejected',
            decidedAt: new Date(),
            adminNote: body.adminNote || body.decisionNote || 'Rejected'
          };
        }
        try {
          const { resolveAlertsForEntity } = require('../utils/adminAlerts');
          await resolveAlertsForEntity(franchise._id, ['franchise_bank']);
        } catch {
          /* ignore */
        }
      }
      delete body.bankDecision;
      delete body.adminNote;
    }

    if (body.status === 'approved' || body.status === 'rejected') {
      franchise.decidedAt = new Date();
      franchise.status = body.status;
      franchise.decisionNote = body.decisionNote || franchise.decisionNote || '';
      if (body.status === 'approved') franchise.isActive = true;
      if (body.status === 'rejected') franchise.isActive = false;
      try {
        const { resolveAlertsForEntity } = require('../utils/adminAlerts');
        await resolveAlertsForEntity(franchise._id, ['franchise_application']);
      } catch {
        /* ignore */
      }
    }
    if (typeof body.isActive === 'boolean') {
      franchise.isActive = body.isActive;
      if (body.isActive === false && franchise.status === 'approved') franchise.status = 'inactive';
      if (body.isActive === true && franchise.status === 'inactive') franchise.status = 'approved';
    }

    const assignable = [
      'name',
      'ownerName',
      'phone',
      'email',
      'city',
      'state',
      'pincode',
      'pinCodes',
      'address',
      'agreementUrl',
      'franchiseFee',
      'gstAmount',
      'deliveryCommissionPct',
      'bankAccountHolder',
      'bankAccountNumber',
      'bankIfsc',
      'decisionNote'
    ];
    for (const k of assignable) {
      if (body[k] !== undefined) franchise[k] = body[k];
    }

    // On approve: create franchise login user if missing
    if (franchise.status === 'approved' && franchise.isActive) {
      let user = null;
      if (franchise.ownerUserId) {
        user = await User.findById(franchise.ownerUserId);
      }
      if (!user) {
        user = await User.findOne({ phone: franchise.phone, role: 'franchise' });
      }
      const bcrypt = require('bcryptjs');
      const frWithPw = await Franchise.findById(franchise._id).select('+pendingPasswordHash');
      const applicantHash = frWithPw?.pendingPasswordHash || '';
      if (!user) {
        const frEmail = franchise.email
          ? String(franchise.email).trim().toLowerCase()
          : undefined;
        user = await User.create({
          name: franchise.ownerName || franchise.name,
          phone: franchise.phone,
          email: frEmail,
          password:
            applicantHash ||
            (await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10)),
          role: 'franchise',
          status: 'approved',
          franchiseId: franchise._id,
          city: franchise.city,
          fullAddress: franchise.address
        });
      } else {
        user.status = 'approved';
        user.franchiseId = franchise._id;
        user.role = 'franchise';
        if (franchise.email) {
          user.email = String(franchise.email).trim().toLowerCase();
        }
        // Apply registration password if user still has none / random and applicant set one
        if (applicantHash) {
          user.password = applicantHash;
        }
        await user.save();
      }
      franchise.ownerUserId = user._id;
      franchise.pendingPasswordHash = '';
      try {
        const FranchiseNotification = require('../models/FranchiseNotification');
        await FranchiseNotification.create({
          franchiseId: franchise._id,
          type: 'admin_notice',
          title: 'Franchise approved',
          body: 'Your franchise dashboard is now active. Login with OTP or the password you set at registration.'
        });
      } catch {
        /* ignore */
      }
    }

    await franchise.save();
    res.json({ success: true, data: franchise });
  } catch (error) {
    next(error);
  }
};

const addFranchisePayment = async (req, res, next) => {
  try {
    const { amount, note, status = 'paid', asCommission } = req.body;
    const push = {
      paymentHistory: {
        amount,
        note,
        status,
        paidAt: new Date()
      }
    };
    if (asCommission) {
      push.commissionLedger = {
        amount,
        note: note || 'Weekly commission',
        weekOf: new Date().toISOString().slice(0, 10),
        status: status === 'paid' ? 'paid' : 'pending',
        at: new Date()
      };
    }
    const data = await Franchise.findByIdAndUpdate(
      req.params.id,
      { $push: push },
      { new: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Franchise not found' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── 6. Products (admin list / master) ───────────────────────
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listProductsAdmin = async (req, res, next) => {
  try {
    const { approvalStatus, sellerId, q, isActive } = req.query;
    const filter = {};
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (sellerId) filter.submittedBy = sellerId;
    if (isActive === 'true') filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;

    const rawQ = String(q || '').trim();
    // Ignore 1-char noise; match phrase + meaningful tokens (AND) on name/brand only
    if (rawQ.length >= 2) {
      const phrase = escapeRegex(rawQ);
      const tokens = rawQ
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .map(escapeRegex);

      const fieldMatch = (pattern) => ({
        $or: [
          { name: { $regex: pattern, $options: 'i' } },
          { brand: { $regex: pattern, $options: 'i' } }
        ]
      });

      if (tokens.length > 1) {
        // All words must appear (avoids random single-word hits)
        filter.$and = tokens.map((t) => fieldMatch(t));
      } else {
        filter.$and = [fieldMatch(phrase)];
      }
    }

    const rows = await Product.find(filter)
      .populate('submittedBy', 'name phone email')
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const ownerIds = [
      ...new Set(rows.map((p) => p.submittedBy?._id || p.submittedBy).filter(Boolean).map(String))
    ];
    const productIds = rows.map((p) => p._id);
    const StoreProductPricing = require('../models/StoreProductPricing');

    const [stores, pricingRows] = await Promise.all([
      ownerIds.length
        ? Store.find({ ownerId: { $in: ownerIds } })
            .select('name phone city pincode ownerId')
            .lean()
        : [],
      productIds.length
        ? StoreProductPricing.find({ productId: { $in: productIds } })
            .select('productId storeId price stockQuantity')
            .populate('storeId', 'name city phone')
            .lean()
        : []
    ]);

    const storeByOwner = new Map(stores.map((s) => [String(s.ownerId), s]));
    const pricingByProduct = new Map();
    for (const row of pricingRows) {
      const key = String(row.productId);
      if (!pricingByProduct.has(key)) pricingByProduct.set(key, []);
      pricingByProduct.get(key).push(row);
    }

    const data = rows.map((p) => {
      const ownerId = p.submittedBy?._id || p.submittedBy;
      const sellerStore = ownerId ? storeByOwner.get(String(ownerId)) || null : null;
      const listings = pricingByProduct.get(String(p._id)) || [];
      const stockTotal = listings.reduce((s, r) => s + (Number(r.stockQuantity) || 0), 0);
      return {
        ...p,
        sellerStore,
        sellerName: p.submittedBy?.name || (sellerStore ? 'Store owner' : 'Admin / Master'),
        sellerPhone: p.submittedBy?.phone || sellerStore?.phone || '',
        storeName: sellerStore?.name || listings[0]?.storeId?.name || '—',
        storeCity: sellerStore?.city || listings[0]?.storeId?.city || '',
        stock: stockTotal,
        price: listings[0]?.price ?? p.mrp,
        listings
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── 7. Orders ──────────────────────────────────────────────
const listOrdersAdmin = async (req, res, next) => {
  try {
    const { status, paymentStatus, paymentMode } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMode) filter.paymentMode = paymentMode;
    const data = await Order.find(filter)
      .populate('storeId', 'name phone city')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const updateOrderAdmin = async (req, res, next) => {
  try {
    const allowed = ['status', 'paymentStatus', 'paymentTxnId', 'refundStatus', 'refundNote', 'commissionPaid'];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }

    // Cancellation request decision
    if (req.body.cancellationDecision) {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      const decision = req.body.cancellationDecision;
      order.cancellationRequest = order.cancellationRequest || {};
      order.cancellationRequest.status = decision;
      order.cancellationRequest.decidedAt = new Date();
      order.cancellationRequest.adminNote = req.body.adminNote || '';
      if (decision === 'approved') {
        order.status = 'cancelled';
        if (order.paymentStatus === 'paid') order.refundStatus = 'requested';
      }
      await order.save();
      try {
        const { resolveAlertsForEntity } = require('../utils/adminAlerts');
        await resolveAlertsForEntity(order._id, ['order_cancel']);
      } catch {
        /* ignore */
      }
      if (order.customerId) {
        try {
          const { pushNotify } = require('./customerController');
          await pushNotify(order.customerId, {
            type: 'order_cancelled',
            title: decision === 'approved' ? 'Order cancelled' : 'Cancellation rejected',
            body: `Order ${order.orderNumber}: cancellation ${decision}`,
            meta: { orderId: order._id }
          });
        } catch {
          /* ignore */
        }
      }
      return res.json({ success: true, data: order });
    }

    const prev = await Order.findById(req.params.id);
    if (!prev) return res.status(404).json({ success: false, message: 'Order not found' });
    const data = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Order not found' });
    if (update.status === 'completed' && prev.status !== 'completed') {
      try {
        const { postFranchiseCommissionOnComplete } = require('../utils/franchiseCommission');
        await postFranchiseCommissionOnComplete(data);
      } catch {
        /* ignore */
      }
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── 8. Payments ────────────────────────────────────────────
const listPayments = async (req, res, next) => {
  try {
    const { paymentMode, paymentStatus, refundStatus } = req.query;
    const filter = {};
    if (paymentMode) filter.paymentMode = paymentMode;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (refundStatus) filter.refundStatus = refundStatus;
    const data = await Order.find(filter)
      .select(
        'orderNumber customerName customerPhone grandTotal paymentMode paymentStatus paymentTxnId refundStatus refundNote storeId createdAt platformFee sellerEarning'
      )
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── 9. Commission ──────────────────────────────────────────
const getCommission = async (req, res, next) => {
  try {
    const cfg = await getOrCreateConfig();
    const { paid } = req.query;
    const filter = { status: { $nin: ['cancelled', 'rejected'] } };
    if (paid === 'true') filter.commissionPaid = true;
    if (paid === 'false') filter.commissionPaid = false;
    const orders = await Order.find(filter)
      .select(
        'orderNumber storeId platformFee sellerEarning grandTotal commissionPaid createdAt deliveryFee franchiseId franchiseCommission franchiseCommissionPct franchiseCommissionPosted'
      )
      .populate('storeId', 'name')
      .populate('franchiseId', 'name city')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const pending = orders.filter((o) => !o.commissionPaid).reduce((s, o) => s + (o.platformFee || 0), 0);
    const paidSum = orders.filter((o) => o.commissionPaid).reduce((s, o) => s + (o.platformFee || 0), 0);
    const franchiseEarned = orders.reduce((s, o) => s + (o.franchiseCommission || 0), 0);
    const franchisePosted = orders
      .filter((o) => o.franchiseCommissionPosted)
      .reduce((s, o) => s + (o.franchiseCommission || 0), 0);
    res.json({
      success: true,
      data: {
        config: cfg,
        orders,
        pendingCommission: pending,
        paidCommission: paidSum,
        franchiseDeliveryCommissionPct: cfg.franchiseDeliveryCommissionPct,
        franchiseCommissionEarned: franchiseEarned,
        franchiseCommissionPosted: franchisePosted
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateCommissionConfig = async (req, res, next) => {
  try {
    const cfg = await getOrCreateConfig();
    const {
      sellerCommissionPct,
      franchiseDeliveryCommissionPct,
      sellerRegistrationFee,
      franchiseRegistrationFee,
      franchiseFeeMin,
      franchiseFeeMax,
      franchiseFeeNote
    } = req.body;
    if (sellerCommissionPct !== undefined) cfg.sellerCommissionPct = Number(sellerCommissionPct);
    if (franchiseDeliveryCommissionPct !== undefined) {
      cfg.franchiseDeliveryCommissionPct = Number(franchiseDeliveryCommissionPct);
    }
    if (sellerRegistrationFee !== undefined) {
      const fee = Number(sellerRegistrationFee);
      if (!Number.isFinite(fee) || fee < 0) {
        return res.status(400).json({
          success: false,
          message: 'sellerRegistrationFee must be a non-negative number'
        });
      }
      cfg.sellerRegistrationFee = fee;
    }
    if (franchiseRegistrationFee !== undefined) {
      const fee = Number(franchiseRegistrationFee);
      if (!Number.isFinite(fee) || fee < 0) {
        return res.status(400).json({
          success: false,
          message: 'franchiseRegistrationFee must be a non-negative number'
        });
      }
      cfg.franchiseRegistrationFee = fee;
    }
    if (franchiseFeeMin !== undefined) {
      const n = Number(franchiseFeeMin);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({
          success: false,
          message: 'franchiseFeeMin must be a non-negative number'
        });
      }
      cfg.franchiseFeeMin = n;
    }
    if (franchiseFeeMax !== undefined) {
      const n = Number(franchiseFeeMax);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({
          success: false,
          message: 'franchiseFeeMax must be a non-negative number'
        });
      }
      cfg.franchiseFeeMax = n;
    }
    if (franchiseFeeNote !== undefined) {
      cfg.franchiseFeeNote = String(franchiseFeeNote || '');
    }
    await cfg.save();
    res.json({ success: true, data: cfg });
  } catch (error) {
    next(error);
  }
};

const markCommissionPaid = async (req, res, next) => {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || !orderIds.length) {
      return res.status(400).json({ success: false, message: 'orderIds required' });
    }
    await Order.updateMany({ _id: { $in: orderIds } }, { commissionPaid: true });
    res.json({ success: true, message: 'Marked paid' });
  } catch (error) {
    next(error);
  }
};

// ─── 10. Reports ────────────────────────────────────────────
const getReports = async (req, res, next) => {
  try {
    const { type = 'sales', range = 'monthly', format } = req.query;
    const match = rangeFilter(range);
    match.status = { $nin: ['cancelled', 'rejected'] };

    let rows = [];
    if (type === 'sales' || type === 'order' || type === 'payment' || type === 'commission') {
      rows = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: range === 'yearly' ? '%Y-%m' : '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            orders: { $sum: 1 },
            sales: { $sum: '$grandTotal' },
            commission: { $sum: '$platformFee' },
            onlinePayments: {
              $sum: { $cond: [{ $in: ['$paymentMode', ['UPI', 'CARD']] }, '$grandTotal', 0] }
            },
            codPayments: {
              $sum: { $cond: [{ $eq: ['$paymentMode', 'COD'] }, '$grandTotal', 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } else if (type === 'seller') {
      rows = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$storeId',
            orders: { $sum: 1 },
            sales: { $sum: '$grandTotal' },
            commission: { $sum: '$platformFee' },
            earnings: { $sum: '$sellerEarning' }
          }
        },
        { $sort: { sales: -1 } }
      ]);
      const storeIds = rows.map((r) => r._id).filter(Boolean);
      const stores = await Store.find({ _id: { $in: storeIds } }).select('name city').lean();
      const map = Object.fromEntries(stores.map((s) => [String(s._id), s]));
      rows = rows.map((r) => ({
        ...r,
        storeName: map[String(r._id)]?.name || 'Unknown',
        city: map[String(r._id)]?.city || ''
      }));
    } else if (type === 'city') {
      rows = await Order.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'stores',
            localField: 'storeId',
            foreignField: '_id',
            as: 'store'
          }
        },
        { $unwind: { path: '$store', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$store.city',
            orders: { $sum: 1 },
            sales: { $sum: '$grandTotal' }
          }
        },
        { $sort: { sales: -1 } }
      ]);
    } else if (type === 'franchise') {
      rows = await Franchise.find().select('name city status franchiseFee gstAmount deliveryCommissionPct paymentHistory').lean();
    } else if (type === 'delivery') {
      rows = await User.find({ role: 'driver' })
        .select('name phone city completedDeliveries failedDeliveries codCollected status')
        .lean();
    } else if (type === 'gst') {
      rows = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$createdAt' }
            },
            gstCollected: { $sum: '$gstAmount' },
            sales: { $sum: '$grandTotal' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    }

    if (format === 'csv') {
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="japto-${type}-${range}.csv"`);
      return res.send(csv);
    }

    res.json({ success: true, data: { type, range, rows } });
  } catch (error) {
    next(error);
  }
};

const toCsv = (rows) => {
  if (!rows?.length) return 'empty\n';
  const keys = Object.keys(rows[0]).filter((k) => k !== '__v');
  const escape = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') return JSON.stringify(v).replace(/"/g, '""');
    const s = String(v);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n');
};

// ─── 11. Complaints ─────────────────────────────────────────
const listComplaints = async (req, res, next) => {
  try {
    const { source, status } = req.query;
    const filter = {};
    if (source) filter.source = source;
    if (status) filter.status = status;
    const support = await SupportRequest.find()
      .populate('sellerId', 'name phone')
      .populate('storeId', 'name address pincode city phone promoters')
      .sort({ createdAt: -1 })
      .lean();
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).lean();
    const mappedSupport = support.map((s) => {
      const rc = s.requestedChanges;
      const addressSummary =
        s.type === 'address' && rc
          ? `\nRequested address: ${rc.address || ''}, ${rc.city || ''} ${rc.pincode || ''}${
              rc.lat != null ? ` (${rc.lat}, ${rc.lng})` : ''
            }`
          : '';
      const promotersSummary =
        s.type === 'promoters' && rc
          ? `\nRequested promoters: P1 ${rc.promoter1Name || rc.promoters?.[0]?.name || '—'} (${
              rc.promoter1Phone || rc.promoters?.[0]?.phone || '—'
            }), P2 ${rc.promoter2Name || rc.promoters?.[1]?.name || '—'} (${
              rc.promoter2Phone || rc.promoters?.[1]?.phone || '—'
            })`
          : '';
      return {
        _id: s._id,
        source: 'seller',
        raisedByName: s.sellerId?.name || '',
        raisedByPhone: s.sellerId?.phone || '',
        storeName: s.storeId?.name || '',
        storeId: s.storeId?._id || s.storeId || null,
        currentAddress: s.storeId
          ? {
              address: s.storeId.address || '',
              pincode: s.storeId.pincode || '',
              city: s.storeId.city || ''
            }
          : null,
        currentPromoters: Array.isArray(s.storeId?.promoters) ? s.storeId.promoters : [],
        subject: `Support: ${s.type}`,
        supportType: s.type,
        message: `${s.message || ''}${addressSummary}${promotersSummary}`,
        requestedChanges: rc || null,
        status: s.status === 'pending' ? 'open' : s.status === 'resolved' ? 'resolved' : 'closed',
        replies: s.adminNote ? [{ by: 'admin', message: s.adminNote, at: s.updatedAt }] : [],
        isSupportRequest: true,
        createdAt: s.createdAt
      };
    });
    res.json({ success: true, data: [...complaints, ...mappedSupport] });
  } catch (error) {
    next(error);
  }
};

const createComplaint = async (req, res, next) => {
  try {
    const data = await Complaint.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const replyComplaint = async (req, res, next) => {
  try {
    const { message, status } = req.body;
    if (req.body.isSupportRequest || (await SupportRequest.findById(req.params.id))) {
      const nextStatus =
        status === 'resolved' ? 'resolved' : status === 'closed' ? 'rejected' : 'pending';
      const sr = await SupportRequest.findById(req.params.id);
      if (!sr) {
        return res.status(404).json({ success: false, message: 'Support request not found' });
      }
      sr.adminNote = message || sr.adminNote || '';
      sr.status = nextStatus;

      // Admin may adjust structured fields before approving
      if (
        nextStatus === 'resolved' &&
        (sr.type === 'address' || sr.type === 'promoters') &&
        req.body.requestedChanges &&
        typeof req.body.requestedChanges === 'object'
      ) {
        sr.requestedChanges = {
          ...(sr.requestedChanges || {}),
          ...req.body.requestedChanges
        };
      }

      await sr.save();

      // Apply structured address / promoters (or other) changes when Admin resolves
      if (nextStatus === 'resolved') {
        const { applyRequestedChanges } = require('./supportController');
        await applyRequestedChanges(sr);
      }

      if (nextStatus === 'resolved' || nextStatus === 'rejected') {
        try {
          const { resolveAlertsForEntity } = require('../utils/adminAlerts');
          await resolveAlertsForEntity(sr._id, ['support']);
        } catch {
          /* ignore */
        }
      }

      return res.json({ success: true, data: sr });
    }
    const update = {};
    if (message) update.$push = { replies: { by: 'admin', message, at: new Date() } };
    if (status) update.$set = { status };
    const data = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Complaint not found' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── 12. Website settings ───────────────────────────────────
const sanitizeSettingsForClient = (plain, { includeSecrets = false } = {}) => {
  const out = { ...plain };
  if (!includeSecrets) {
    delete out.razorpayKeySecret;
    delete out.razorpayWebhookSecret;
    // Public may know key id only for checkout; keep razorpayKeyId for admin UI too
  } else {
    out.razorpayKeySecretSet = Boolean(String(out.razorpayKeySecret || '').trim());
    out.razorpayWebhookSecretSet = Boolean(String(out.razorpayWebhookSecret || '').trim());
    // Do not send full secrets back to browser — only whether set + key id
    out.razorpayKeySecret = '';
    out.razorpayWebhookSecret = '';
  }
  return out;
};

const getSettings = async (req, res, next) => {
  try {
    const data = await getOrCreateSettings();
    const cfg = await getOrCreateConfig();
    const plain = typeof data.toObject === 'function' ? data.toObject() : { ...data };
    const isAdmin = Boolean(req.user && (req.user.role === 'superadmin' || req.user.role === 'admin'));
    res.json({
      success: true,
      data: {
        ...sanitizeSettingsForClient(plain, { includeSecrets: isAdmin }),
        sellerRegistrationFee: Number(cfg.sellerRegistrationFee ?? 216),
        franchiseRegistrationFee: Number(cfg.franchiseRegistrationFee ?? 500),
        franchiseFeeMin: Number(cfg.franchiseFeeMin ?? 200000),
        franchiseFeeMax: Number(cfg.franchiseFeeMax ?? 500000),
        franchiseFeeNote:
          cfg.franchiseFeeNote ||
          '₹2,00,000 से ₹5,00,000 तक, शहर के अनुसार। अंतिम फीस Japto.in Head Office तय करेगा।',
        razorpayConfigured: Boolean(
          String(plain.razorpayKeyId || '').trim() && String(plain.razorpayKeySecret || '').trim()
        )
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const data = await getOrCreateSettings();
    const fields = [
      'siteName',
      'logoUrl',
      'bannerUrl',
      'homepageHeadline',
      'homepageSubtext',
      'contactPhone',
      'contactEmail',
      'contactAddress',
      'termsHtml',
      'privacyHtml',
      'shippingReturnHtml',
      'razorpayKeyId',
      'razorpayCompanyName'
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    // Secrets: only update when non-empty (blank = keep existing)
    if (
      req.body.razorpayKeySecret !== undefined &&
      String(req.body.razorpayKeySecret).trim() !== ''
    ) {
      data.razorpayKeySecret = String(req.body.razorpayKeySecret).trim();
    }
    if (
      req.body.razorpayWebhookSecret !== undefined &&
      String(req.body.razorpayWebhookSecret).trim() !== ''
    ) {
      data.razorpayWebhookSecret = String(req.body.razorpayWebhookSecret).trim();
    }
    await data.save();
    try {
      const { invalidateRazorpayCache } = require('../utils/razorpayClient');
      invalidateRazorpayCache();
    } catch {
      /* ignore */
    }
    const plain = data.toObject();
    res.json({
      success: true,
      data: {
        ...sanitizeSettingsForClient(plain, { includeSecrets: true }),
        razorpayConfigured: Boolean(
          String(plain.razorpayKeyId || '').trim() && String(plain.razorpayKeySecret || '').trim()
        )
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─── 13. Coupons ────────────────────────────────────────────
const listCoupons = async (req, res, next) => {
  try {
    const data = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createCoupon = async (req, res, next) => {
  try {
    const body = { ...req.body, code: String(req.body.code || '').toUpperCase() };
    const data = await Coupon.create(body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    if (req.body.code) req.body.code = String(req.body.code).toUpperCase();
    const data = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

// ─── 14. Banners ────────────────────────────────────────────
const listBanners = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.active === '1') {
      const now = new Date();
      filter.isActive = true;
      filter.$and = [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] }
      ];
    }
    if (req.query.city) filter.$or = [{ city: '' }, { city: req.query.city }];
    const data = await Banner.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createBanner = async (req, res, next) => {
  try {
    const data = await Banner.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const updateBanner = async (req, res, next) => {
  try {
    const data = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

// ─── 15. Notifications ──────────────────────────────────────
const listAdminNotifications = async (req, res, next) => {
  try {
    const data = await AdminNotification.find().sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/alerts — inbound inbox for Super Admin bell */
const listAdminAlerts = async (req, res, next) => {
  try {
    const { getAdminBadgeCounts } = require('../utils/adminAlerts');
    const AdminAlert = require('../models/AdminAlert');
    const badges = await getAdminBadgeCounts();
    const data = await AdminAlert.find({ resolved: false })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({
      success: true,
      data,
      unread: badges.unreadAlerts,
      badges
    });
  } catch (error) {
    next(error);
  }
};

const markAdminAlertRead = async (req, res, next) => {
  try {
    const AdminAlert = require('../models/AdminAlert');
    const alert = await AdminAlert.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
};

const markAllAdminAlertsRead = async (req, res, next) => {
  try {
    const AdminAlert = require('../models/AdminAlert');
    await AdminAlert.updateMany({ read: false, resolved: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const getAdminBadges = async (req, res, next) => {
  try {
    const { getAdminBadgeCounts } = require('../utils/adminAlerts');
    const badges = await getAdminBadgeCounts();
    res.json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
};

const sendAdminNotification = async (req, res, next) => {
  try {
    const { title, body, audience = 'all', channels = { app: true, email: false } } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'title and body required' });
    }

    let sentCount = 0;
    if (audience === 'sellers' || audience === 'all') {
      const sellers = await Store.find({ status: 'approved' }).select('ownerId');
      const docs = sellers
        .filter((s) => s.ownerId)
        .map((s) => ({
          userId: s.ownerId,
          storeId: s._id,
          type: 'admin_notice',
          title,
          body
        }));
      if (docs.length) {
        await SellerNotification.insertMany(docs);
        sentCount += docs.length;
      }
    }
    if (audience === 'customers' || audience === 'all') {
      const customers = await User.find({ role: 'customer' }).select('_id').lean();
      if (customers.length) {
        await CustomerNotification.insertMany(
          customers.map((u) => ({
            userId: u._id,
            type: 'announcement',
            title,
            body
          }))
        );
        sentCount += customers.length;
      }
    }
    if (audience === 'delivery' || audience === 'all') {
      const drivers = await User.find({ role: 'driver' }).select('_id').lean();
      if (drivers.length) {
        await RiderNotification.insertMany(
          drivers.map((d) => ({
            riderId: d._id,
            type: 'admin_notice',
            title,
            body
          }))
        );
        sentCount += drivers.length;
      }
    }
    if (audience === 'franchise' || audience === 'all') {
      const franchises = await Franchise.find({ status: 'approved' }).select('_id').lean();
      if (franchises.length) {
        const FranchiseNotification = require('../models/FranchiseNotification');
        await FranchiseNotification.insertMany(
          franchises.map((f) => ({
            franchiseId: f._id,
            type: 'admin_notice',
            title,
            body
          }))
        );
        sentCount += franchises.length;
      }
    }

    const data = await AdminNotification.create({
      title,
      body,
      audience,
      channels: {
        app: channels?.app !== false,
        email: !!channels?.email
      },
      sentCount,
      createdBy: req.user._id
    });
    res.status(201).json({
      success: true,
      data,
      message: channels?.email
        ? 'In-app sent; email channel recorded (SMTP gateway not connected yet)'
        : 'In-app notifications sent'
    });
  } catch (error) {
    next(error);
  }
};

// ─── 16. Cities / PIN (ServiceArea) ─────────────────────────
const listCities = async (req, res, next) => {
  try {
    const { pinCodeStatus, franchiseOnly } = req.query;
    const filter = {};
    if (pinCodeStatus) filter.pinCodeStatus = pinCodeStatus;
    if (franchiseOnly === 'true') filter.franchiseId = { $ne: null };
    const data = await ServiceArea.find(filter)
      .populate('franchiseId', 'name ownerName phone city applicationId status')
      .sort({ createdAt: -1, city: 1 })
      .lean();
    const pendingFranchisePins = await ServiceArea.countDocuments({
      franchiseId: { $ne: null },
      pinCodeStatus: 'pending'
    });
    // Pending franchise PIN requests first in the list
    data.sort((a, b) => {
      const ap = a.pinCodeStatus === 'pending' && a.franchiseId ? 0 : 1;
      const bp = b.pinCodeStatus === 'pending' && b.franchiseId ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    res.json({
      success: true,
      data,
      pendingFranchisePins
    });
  } catch (error) {
    next(error);
  }
};

const createCity = async (req, res, next) => {
  try {
    const data = await ServiceArea.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const updateCity = async (req, res, next) => {
  try {
    const data = await ServiceArea.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'City not found' });
    // When Admin approves a franchise PIN request, enable work in that PIN
    if (
      req.body.pinCodeStatus === 'approved' &&
      data.franchiseId &&
      data.pincode
    ) {
      await Franchise.findByIdAndUpdate(data.franchiseId, {
        $addToSet: { pinCodes: String(data.pincode) }
      });
      data.isActive = true;
      await data.save();
      try {
        const FranchiseNotification = require('../models/FranchiseNotification');
        await FranchiseNotification.create({
          franchiseId: data.franchiseId,
          type: 'pin',
          title: 'PIN approved',
          body: `PIN ${data.pincode} is now approved for your working area`
        });
      } catch {
        /* ignore */
      }
    }
    if (req.body.pinCodeStatus === 'rejected' && data.franchiseId && data.pincode) {
      data.isActive = false;
      await data.save();
      try {
        const FranchiseNotification = require('../models/FranchiseNotification');
        await FranchiseNotification.create({
          franchiseId: data.franchiseId,
          type: 'pin',
          title: 'PIN rejected',
          body: `PIN ${data.pincode} request was rejected by Admin`
        });
      } catch {
        /* ignore */
      }
    }
    if (req.body.pinCodeStatus === 'approved' || req.body.pinCodeStatus === 'rejected') {
      try {
        const { resolveAlertsForEntity } = require('../utils/adminAlerts');
        await resolveAlertsForEntity(data._id, ['franchise_pin']);
      } catch {
        /* ignore */
      }
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── 17. Delivery charges ───────────────────────────────────
const getDeliveryCharges = async (req, res, next) => {
  try {
    const cfg = await getOrCreateConfig();
    res.json({ success: true, data: cfg.deliveryCharges || [] });
  } catch (error) {
    next(error);
  }
};

const saveDeliveryCharges = async (req, res, next) => {
  try {
    const cfg = await getOrCreateConfig();
    cfg.deliveryCharges = Array.isArray(req.body.deliveryCharges)
      ? req.body.deliveryCharges
      : req.body;
    await cfg.save();
    res.json({ success: true, data: cfg.deliveryCharges });
  } catch (error) {
    next(error);
  }
};

// ─── 18. Tax / GST ──────────────────────────────────────────
// ─── Email settings / queue ─────────────────────────────────
const {
  getOrCreateEmailSettings,
  publicEmailSettings,
  DEFAULT_APPLICANT_HTML,
  DEFAULT_ADMIN_HTML
} = require('../utils/emailSettingsStore');
const EmailQueue = require('../models/EmailQueue');

const getEmailSettings = async (req, res, next) => {
  try {
    const data = await getOrCreateEmailSettings();
    const queued = await EmailQueue.countDocuments({ status: 'queued' });
    const failed = await EmailQueue.countDocuments({ status: 'failed' });
    const sent = await EmailQueue.countDocuments({ status: 'sent' });
    res.json({
      success: true,
      data: publicEmailSettings(data),
      queue: { queued, failed, sent }
    });
  } catch (error) {
    next(error);
  }
};

const updateEmailSettings = async (req, res, next) => {
  try {
    const data = await getOrCreateEmailSettings();
    const b = req.body || {};
    if (b.adminEmail !== undefined) data.adminEmail = String(b.adminEmail).trim();
    if (b.smtpHost !== undefined) data.smtpHost = String(b.smtpHost).trim();
    if (b.smtpPort !== undefined) data.smtpPort = Number(b.smtpPort) || 587;
    if (b.smtpUser !== undefined) data.smtpUser = String(b.smtpUser).trim();
    if (b.smtpFrom !== undefined) data.smtpFrom = String(b.smtpFrom).trim();
    if (typeof b.smtpSecure === 'boolean') data.smtpSecure = b.smtpSecure;
    // Keep existing password if UI sends masked value / blank intentionally with keepPass
    if (b.smtpPass !== undefined) {
      const pass = String(b.smtpPass);
      if (pass && pass !== '********') data.smtpPass = pass;
    }
    if (b.clearSmtpPass === true) data.smtpPass = '';

    if (b.templates?.franchiseApplicant) {
      data.templates = data.templates || {};
      data.templates.franchiseApplicant = {
        subject:
          b.templates.franchiseApplicant.subject ??
          data.templates.franchiseApplicant?.subject,
        html:
          b.templates.franchiseApplicant.html ?? data.templates.franchiseApplicant?.html
      };
    }
    if (b.templates?.franchiseAdmin) {
      data.templates = data.templates || {};
      data.templates.franchiseAdmin = {
        subject:
          b.templates.franchiseAdmin.subject ?? data.templates.franchiseAdmin?.subject,
        html: b.templates.franchiseAdmin.html ?? data.templates.franchiseAdmin?.html
      };
    }

    if (b.resetApplicantTemplate) {
      data.templates.franchiseApplicant = {
        subject: 'Japto.in Franchise — आवेदन प्राप्त ({{applicationId}})',
        html: DEFAULT_APPLICANT_HTML
      };
    }
    if (b.resetAdminTemplate) {
      data.templates.franchiseAdmin = {
        subject: '[Japto] New Franchise Application {{applicationId}}',
        html: DEFAULT_ADMIN_HTML
      };
    }

    data.markModified('templates');
    await data.save();
    res.json({ success: true, data: publicEmailSettings(data) });
  } catch (error) {
    next(error);
  }
};

const listEmailQueue = async (req, res, next) => {
  try {
    const data = await EmailQueue.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .select('to subject template status attempts lastError sentAt createdAt');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const processEmailQueue = async (req, res, next) => {
  try {
    const nodemailer = require('nodemailer');
    const cfg = await getOrCreateEmailSettings();
    const user = cfg.smtpUser || process.env.SMTP_USER;
    const pass = cfg.smtpPass || process.env.SMTP_PASS;
    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        message: 'SMTP user/password not set. Save Email settings first.'
      });
    }
    const port = Number(cfg.smtpPort || 587);
    const transport = nodemailer.createTransport({
      host: cfg.smtpHost || 'smtp.gmail.com',
      port,
      secure: port === 465 || !!cfg.smtpSecure,
      auth: { user, pass }
    });
    const from = cfg.smtpFrom || `Japto.in <${user}>`;
    const pending = await EmailQueue.find({ status: { $in: ['queued', 'failed'] } })
      .sort({ createdAt: 1 })
      .limit(50);

    let sent = 0;
    let failed = 0;
    const errors = [];
    for (const job of pending) {
      job.status = 'sending';
      job.attempts = (job.attempts || 0) + 1;
      await job.save();
      try {
        const info = await transport.sendMail({
          from,
          to: job.to,
          cc: job.cc?.length ? job.cc : undefined,
          subject: job.subject,
          html: job.html,
          text: job.text || undefined
        });
        job.status = 'sent';
        job.sentAt = new Date();
        job.lastError = '';
        job.meta = { ...(job.meta || {}), messageId: info.messageId };
        await job.save();
        sent += 1;
      } catch (err) {
        job.status = 'failed';
        job.lastError = err.message || String(err);
        await job.save();
        failed += 1;
        errors.push({ to: job.to, error: job.lastError });
      }
    }

    res.json({
      success: true,
      message: `Processed ${pending.length} job(s)`,
      data: { processed: pending.length, sent, failed, errors }
    });
  } catch (error) {
    next(error);
  }
};

const getTaxConfig = async (req, res, next) => {
  try {
    const cfg = await getOrCreateConfig();
    const gstReport = await Order.aggregate([
      { $match: { status: { $nin: ['cancelled', 'rejected'] } } },
      {
        $group: {
          _id: null,
          gstCollected: { $sum: '$gstAmount' },
          invoices: { $sum: 1 }
        }
      }
    ]);
    const invoices = await Order.find({ status: { $nin: ['cancelled', 'rejected'] } })
      .select('orderNumber grandTotal gstAmount gstPct paymentMode createdAt customerName')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({
      success: true,
      data: {
        defaultGstPct: cfg.defaultGstPct,
        gstByCategory: cfg.gstByCategory || [],
        collection: gstReport[0] || { gstCollected: 0, invoices: 0 },
        invoices
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateTaxConfig = async (req, res, next) => {
  try {
    const cfg = await getOrCreateConfig();
    if (req.body.defaultGstPct !== undefined) cfg.defaultGstPct = Number(req.body.defaultGstPct);
    if (Array.isArray(req.body.gstByCategory)) cfg.gstByCategory = req.body.gstByCategory;
    await cfg.save();
    res.json({ success: true, data: cfg });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  listCustomers,
  getCustomerDetail,
  updateCustomerStatus,
  listSellers,
  getSellerDetail,
  updateSellerAdmin,
  listDeliveryPartners,
  updateDeliveryPartner,
  listFranchises,
  createFranchise,
  updateFranchise,
  addFranchisePayment,
  listProductsAdmin,
  listOrdersAdmin,
  updateOrderAdmin,
  listPayments,
  getCommission,
  updateCommissionConfig,
  markCommissionPaid,
  getReports,
  listComplaints,
  createComplaint,
  replyComplaint,
  getSettings,
  updateSettings,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  listAdminNotifications,
  sendAdminNotification,
  listAdminAlerts,
  markAdminAlertRead,
  markAllAdminAlertsRead,
  getAdminBadges,
  listCities,
  createCity,
  updateCity,
  getDeliveryCharges,
  saveDeliveryCharges,
  getTaxConfig,
  updateTaxConfig,
  getEmailSettings,
  updateEmailSettings,
  listEmailQueue,
  processEmailQueue,
  getOrCreateConfig
};
