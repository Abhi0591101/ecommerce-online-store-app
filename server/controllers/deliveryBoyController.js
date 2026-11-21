const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const Store = require('../models/Store');
const RiderRequest = require('../models/RiderRequest');
const RiderNotification = require('../models/RiderNotification');
const { issueOtp, verifyOtp, DEMO_OTP, normalizePhone } = require('../utils/otpStore');
const { signToken } = require('../middleware/auth');
const { publicUser } = require('./authController');

const pushRiderNotify = async (riderId, payload) => {
  try {
    await RiderNotification.create({ riderId, ...payload });
  } catch {
    /* ignore */
  }
};

const canWork = (rider) =>
  rider &&
  rider.role === 'driver' &&
  rider.status === 'approved' &&
  rider.isActive !== false &&
  rider.status !== 'inactive' &&
  rider.status !== 'suspended';

const mapRiderProfile = (u) => ({
  ...publicUser(u),
  fullAddress: u.fullAddress || '',
  vehicleType: u.vehicleType || '',
  vehicleModel: u.vehicleModel || '',
  plateNumber: u.plateNumber || '',
  licenseNo: u.licenseNo || '',
  aadhaarNo: u.aadhaarNo || '',
  idProofUrl: u.idProofUrl || '',
  rcDocUrl: u.rcDocUrl || '',
  licenseDocUrl: u.licenseDocUrl || '',
  insuranceDocUrl: u.insuranceDocUrl || '',
  bikePhotoUrl: u.bikePhotoUrl || '',
  bankAccount: u.bankAccount || '',
  ifsc: u.ifsc || '',
  bankProofUrl: u.bankProofUrl || '',
  isOnline: !!u.isOnline,
  isActive: u.isActive !== false,
  statusReason: u.statusReason || '',
  todayEarnings: u.todayEarnings || 0,
  monthEarnings: u.monthEarnings || 0,
  pendingPayout: u.pendingPayout || 0,
  paidPayout: u.paidPayout || 0,
  completedDeliveries: u.completedDeliveries || 0,
  failedDeliveries: u.failedDeliveries || 0,
  cancelledDeliveries: u.cancelledDeliveries || 0,
  payoutHistory: u.payoutHistory || []
});

const enrichDelivery = async (d) => {
  const order = await Order.findById(d.orderId).populate('storeId').lean();
  if (!order) return { ...d.toObject?.() || d, order: null };
  const store = order.storeId;
  return {
    ...(d.toObject ? d.toObject() : d),
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    otpCode: order.otpCode,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    pincode: order.pincode,
    items: order.items,
    grandTotal: order.grandTotal,
    paymentMode: order.paymentMode,
    storeName: store?.name || '',
    storePhone: store?.phone || '',
    storeAddress: store?.address || '',
    storeLat: store?.location?.coordinates?.[1],
    storeLng: store?.location?.coordinates?.[0],
    packageCount: d.packageCount || order.items?.length || 1
  };
};

// ─── Auth ───────────────────────────────────────────────────
const sendRiderOtp = async (req, res, next) => {
  try {
    const { phone, purpose = 'login' } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'phone required' });
    const existing = await User.findOne({ phone: normalizePhone(phone), role: 'driver' });
    if (purpose === 'register' && existing) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }
    if (purpose === 'login' && !existing) {
      return res.status(404).json({ success: false, message: 'Delivery partner not found' });
    }
    const result = await issueOtp(phone);
    res.json({
      success: true,
      mode: result.mode,
      ...(result.otp ? { demoOtp: result.otp, otp: result.otp } : {}),
      message: result.message || `OTP: ${DEMO_OTP}`
    });
  } catch (error) {
    next(error);
  }
};

const registerRider = async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.name || !b.phone || !b.otp) {
      return res.status(400).json({ success: false, message: 'name, phone, otp required' });
    }
    if (!verifyOtp(b.phone, b.otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const phone = normalizePhone(b.phone);
    if (await User.findOne({ phone })) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }
    const password = b.password || 'password123';
    const hash = await bcrypt.hash(password, 10);
    const rider = await User.create({
      name: b.name,
      phone,
      email: b.email || undefined,
      password: hash,
      role: 'driver',
      status: 'pending',
      phoneVerified: true,
      isOnline: false,
      isActive: false,
      avatarUrl: b.avatarUrl || '',
      fullAddress: b.fullAddress || '',
      city: b.city || '',
      aadhaarNo: b.aadhaarNo || '',
      idProofUrl: b.idProofUrl || '',
      vehicleType: b.vehicleType || b.bikeName || '',
      vehicleModel: b.vehicleModel || '',
      plateNumber: b.plateNumber || '',
      licenseNo: b.licenseNo || '',
      rcDocUrl: b.rcDocUrl || '',
      licenseDocUrl: b.licenseDocUrl || '',
      insuranceDocUrl: b.insuranceDocUrl || '',
      bikePhotoUrl: b.bikePhotoUrl || '',
      bankAccount: b.bankAccount || '',
      ifsc: b.ifsc || '',
      bankProofUrl: b.bankProofUrl || ''
    });
    res.status(201).json({
      success: true,
      message: 'Registration submitted — awaiting Admin approval',
      data: { user: mapRiderProfile(rider), token: null }
    });
  } catch (error) {
    next(error);
  }
};

const loginRiderOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!verifyOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const user = await User.findOne({ phone: normalizePhone(phone), role: 'driver' });
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: `Account suspended${user.statusReason ? `: ${user.statusReason}` : ''}`
      });
    }
    const token = signToken(user);
    res.json({ success: true, data: { token, user: mapRiderProfile(user) } });
  } catch (error) {
    next(error);
  }
};

const loginRiderEmail = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password required' });
    }
    const user = await User.findOne({ email: String(email).trim().toLowerCase(), role: 'driver' });
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspended' });
    }
    res.json({ success: true, data: { token: signToken(user), user: mapRiderProfile(user) } });
  } catch (error) {
    next(error);
  }
};

// ─── Profile ────────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: mapRiderProfile(user), canWork: canWork(user) });
  } catch (error) {
    next(error);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const fields = [
      'name', 'email', 'avatarUrl', 'fullAddress', 'city', 'aadhaarNo', 'idProofUrl',
      'vehicleType', 'vehicleModel', 'plateNumber', 'licenseNo', 'rcDocUrl', 'licenseDocUrl',
      'insuranceDocUrl', 'bikePhotoUrl', 'bankAccount', 'ifsc', 'bankProofUrl'
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    }
    await user.save();
    res.json({ success: true, data: mapRiderProfile(user) });
  } catch (error) {
    next(error);
  }
};

const setDuty = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!canWork(user)) {
      return res.status(403).json({
        success: false,
        message: 'Account not approved/active — cannot go on duty'
      });
    }
    user.isOnline = !!req.body.isOnline;
    await user.save();
    res.json({ success: true, data: mapRiderProfile(user) });
  } catch (error) {
    next(error);
  }
};

// ─── Orders ─────────────────────────────────────────────────
const listMyDeliveries = async (req, res, next) => {
  try {
    if (!canWork(req.user) && req.user.status !== 'approved') {
      // pending riders see empty
    }
    const { status, date } = req.query;
    const filter = { driverId: req.user._id };
    if (status) filter.status = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }
    const rows = await Delivery.find(filter).sort({ createdAt: -1 }).limit(100);
    const data = await Promise.all(rows.map(enrichDelivery));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const listAvailableOrders = async (req, res, next) => {
  try {
    if (!canWork(req.user)) {
      return res.status(403).json({ success: false, message: 'Not approved for deliveries' });
    }
    const offered = await Delivery.find({
      $or: [
        { driverId: req.user._id, status: { $in: ['offered', 'assigned'] } },
        { driverId: null, status: 'offered' },
        { status: 'offered', driverId: { $exists: false } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50);

    // Also find orders needing rider without delivery assigned to others
    const openOrders = await Order.find({
      status: { $in: ['placed', 'accepted', 'packing'] },
      deliveryMethod: { $ne: 'seller_own' }
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const existingOrderIds = new Set(offered.map((d) => String(d.orderId)));
    for (const o of openOrders) {
      if (existingOrderIds.has(String(o._id))) continue;
      const hasActive = await Delivery.findOne({
        orderId: o._id,
        status: { $nin: ['rejected', 'cancelled'] }
      });
      if (hasActive) continue;
      const store = await Store.findById(o.storeId);
      const created = await Delivery.create({
        orderId: o._id,
        status: 'offered',
        deliveryCharge: o.deliveryFee || 30,
        packageCount: o.items?.length || 1,
        statusHistory: [{ status: 'offered', at: new Date() }],
        currentLat: store?.location?.coordinates?.[1] || 28.628,
        currentLng: store?.location?.coordinates?.[0] || 77.3649
      });
      offered.push(created);
      await pushRiderNotify(req.user._id, {
        type: 'new_order',
        title: 'New delivery order',
        body: `Order ${o.orderNumber} available`,
        meta: { orderId: o._id }
      });
    }

    const mine = offered.filter(
      (d) =>
        !d.driverId ||
        String(d.driverId) === String(req.user._id) ||
        ['offered', 'assigned'].includes(d.status)
    );
    const data = await Promise.all(mine.map(enrichDelivery));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const acceptDelivery = async (req, res, next) => {
  try {
    if (!canWork(req.user)) {
      return res.status(403).json({ success: false, message: 'Not approved for deliveries' });
    }
    const d = await Delivery.findById(req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Not found' });
    if (d.driverId && String(d.driverId) !== String(req.user._id) && d.status !== 'offered') {
      return res.status(409).json({ success: false, message: 'Already assigned' });
    }
    d.driverId = req.user._id;
    d.driverName = req.user.name;
    d.driverPhone = req.user.phone;
    d.driverVehicle = `${req.user.vehicleType || ''} ${req.user.plateNumber || ''}`.trim();
    d.status = 'accepted';
    d.statusHistory = [...(d.statusHistory || []), { status: 'accepted', at: new Date() }];
    await d.save();
    await Order.findByIdAndUpdate(d.orderId, { status: 'accepted' });
    await pushRiderNotify(req.user._id, {
      type: 'assignment',
      title: 'Order accepted',
      body: 'Proceed to pickup location',
      meta: { deliveryId: d._id }
    });
    res.json({ success: true, data: await enrichDelivery(d) });
  } catch (error) {
    next(error);
  }
};

const rejectDelivery = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason required' });
    const d = await Delivery.findById(req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Not found' });
    // One Delivery per order (unique orderId) — record rejection then re-offer same doc
    d.statusHistory = [
      ...(d.statusHistory || []),
      { status: 'rejected', at: new Date() },
      { status: 'offered', at: new Date() }
    ];
    d.rejectReason = String(reason);
    d.driverId = undefined;
    d.driverName = '';
    d.driverPhone = '';
    d.status = 'offered';
    await d.save();
    res.json({ success: true, message: 'Rejected — order re-offered to other riders', data: d });
  } catch (error) {
    next(error);
  }
};

const STATUS_FLOW = [
  'accepted',
  'reached_pickup',
  'picked_up',
  'on_the_way',
  'reached_customer',
  'delivered'
];

const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const d = await Delivery.findOne({ _id: req.params.id, driverId: req.user._id });
    if (!d) return res.status(404).json({ success: false, message: 'Not found' });
    if (status === 'delivered') {
      return res.status(400).json({ success: false, message: 'Use OTP verify to complete delivery' });
    }
    if (!STATUS_FLOW.includes(status) && !['arrived_at_store', 'out_for_delivery', 'picked_up'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const normalized =
      status === 'arrived_at_store' ? 'reached_pickup' : status === 'out_for_delivery' ? 'on_the_way' : status;
    d.status = normalized;
    d.statusHistory = [...(d.statusHistory || []), { status: normalized, at: new Date() }];
    if (normalized === 'picked_up' || normalized === 'reached_pickup') {
      if (normalized === 'picked_up') d.pickupConfirmedAt = new Date();
    }
    await d.save();

    // Sync order status for customer tracking
    const orderPatch = {};
    if (normalized === 'picked_up' || normalized === 'on_the_way') orderPatch.status = 'out_for_delivery';
    if (normalized === 'reached_pickup') orderPatch.status = 'packing';
    if (Object.keys(orderPatch).length) await Order.findByIdAndUpdate(d.orderId, orderPatch);

    const io = req.app.get('io');
    if (io) {
      const order = await Order.findById(d.orderId);
      if (order) io.to(`order:${order.orderNumber}`).emit('delivery:status', { status: normalized });
    }

    res.json({ success: true, data: await enrichDelivery(d) });
  } catch (error) {
    next(error);
  }
};

const confirmPickup = async (req, res, next) => {
  try {
    const d = await Delivery.findOne({ _id: req.params.id, driverId: req.user._id });
    if (!d) return res.status(404).json({ success: false, message: 'Not found' });
    d.status = 'picked_up';
    d.pickupConfirmedAt = new Date();
    d.statusHistory = [...(d.statusHistory || []), { status: 'picked_up', at: new Date() }];
    await d.save();
    await Order.findByIdAndUpdate(d.orderId, { status: 'out_for_delivery' });
    res.json({ success: true, data: await enrichDelivery(d) });
  } catch (error) {
    next(error);
  }
};

const verifyOtpComplete = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const d = await Delivery.findOne({ _id: req.params.id, driverId: req.user._id });
    if (!d) return res.status(404).json({ success: false, message: 'Not found' });
    const order = await Order.findById(d.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(otp).trim() !== String(order.otpCode).trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP — delivery not completed' });
    }
    d.status = 'delivered';
    d.otpVerified = true;
    d.otpVerifiedAt = new Date();
    d.statusHistory = [...(d.statusHistory || []), { status: 'delivered', at: new Date() }];
    await d.save();
    order.status = 'completed';
    if (order.paymentMode === 'COD') order.paymentStatus = 'paid';
    await order.save();

    const rider = await User.findById(req.user._id);
    const earn = d.deliveryCharge || 30;
    rider.todayEarnings = (rider.todayEarnings || 0) + earn;
    rider.monthEarnings = (rider.monthEarnings || 0) + earn;
    rider.pendingPayout = (rider.pendingPayout || 0) + earn;
    rider.completedDeliveries = (rider.completedDeliveries || 0) + 1;
    await rider.save();

    const io = req.app.get('io');
    if (io) io.to(`order:${order.orderNumber}`).emit('delivery:completed', { orderNumber: order.orderNumber });

    res.json({ success: true, message: 'Delivery completed', data: await enrichDelivery(d) });
  } catch (error) {
    next(error);
  }
};

// ─── History / earnings ─────────────────────────────────────
const getHistoryStats = async (req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const riderId = req.user._id;
    const [todayOk, totalOk, pending, cancelled, todayList] = await Promise.all([
      Delivery.countDocuments({ driverId: riderId, status: 'delivered', updatedAt: { $gte: start } }),
      Delivery.countDocuments({ driverId: riderId, status: 'delivered' }),
      Delivery.countDocuments({
        driverId: riderId,
        status: { $in: ['accepted', 'reached_pickup', 'picked_up', 'on_the_way', 'reached_customer', 'assigned'] }
      }),
      Delivery.countDocuments({ driverId: riderId, status: { $in: ['cancelled', 'rejected'] } }),
      Delivery.find({ driverId: riderId }).sort({ createdAt: -1 }).limit(50)
    ]);
    const rows = await Promise.all(todayList.map(enrichDelivery));
    const user = await User.findById(riderId);
    res.json({
      success: true,
      data: {
        todayDeliveries: todayOk,
        totalSuccessful: totalOk,
        pending,
        cancelled,
        todayEarnings: user.todayEarnings || 0,
        monthEarnings: user.monthEarnings || 0,
        pendingPayment: user.pendingPayout || 0,
        paidPayment: user.paidPayout || 0,
        payoutHistory: user.payoutHistory || [],
        deliveries: rows
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─── Notifications ──────────────────────────────────────────
const listNotifications = async (req, res, next) => {
  try {
    const data = await RiderNotification.find({ riderId: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const data = await RiderNotification.findOneAndUpdate(
      { _id: req.params.id, riderId: req.user._id },
      { read: true },
      { new: true }
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── Requests ───────────────────────────────────────────────
const listRequests = async (req, res, next) => {
  try {
    const data = await RiderRequest.find({ riderId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createRequest = async (req, res, next) => {
  try {
    const { type, message, sellerName, sellerPhone, shopName, shopAddress, shopInfo } = req.body;
    if (!type || !message) {
      return res.status(400).json({ success: false, message: 'type and message required' });
    }
    // No leave/holiday — reject if someone tries
    if (type === 'leave' || type === 'holiday') {
      return res.status(400).json({ success: false, message: 'Leave/holiday requests are not supported' });
    }
    const data = await RiderRequest.create({
      riderId: req.user._id,
      type,
      message,
      sellerName: sellerName || '',
      sellerPhone: sellerPhone || '',
      shopName: shopName || '',
      shopAddress: shopAddress || '',
      shopInfo: shopInfo || ''
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Admin: list/decide rider requests
const adminListRiderRequests = async (req, res, next) => {
  try {
    const data = await RiderRequest.find()
      .populate('riderId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const adminDecideRiderRequest = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be approved|rejected' });
    }
    const data = await RiderRequest.findByIdAndUpdate(
      req.params.id,
      { status, adminNote: adminNote || '', decidedAt: new Date() },
      { new: true }
    );
    if (data) {
      await pushRiderNotify(data.riderId, {
        type: 'admin_notice',
        title: `Request ${status}`,
        body: adminNote || `Your ${data.type} request was ${status}`,
        meta: { requestId: data._id }
      });
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendRiderOtp,
  registerRider,
  loginRiderOtp,
  loginRiderEmail,
  getMyProfile,
  updateMyProfile,
  setDuty,
  listMyDeliveries,
  listAvailableOrders,
  acceptDelivery,
  rejectDelivery,
  updateDeliveryStatus,
  confirmPickup,
  verifyOtpComplete,
  getHistoryStats,
  listNotifications,
  markNotificationRead,
  listRequests,
  createRequest,
  adminListRiderRequests,
  adminDecideRiderRequest,
  canWork,
  pushRiderNotify,
  mapRiderProfile
};
