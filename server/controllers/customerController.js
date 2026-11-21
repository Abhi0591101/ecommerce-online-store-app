const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Store = require('../models/Store');
const Coupon = require('../models/Coupon');
const Complaint = require('../models/Complaint');
const Wishlist = require('../models/Wishlist');
const WalletLedger = require('../models/WalletLedger');
const CustomerNotification = require('../models/CustomerNotification');
const ProductReview = require('../models/ProductReview');
const PlatformConfig = require('../models/PlatformConfig');
const ServiceArea = require('../models/ServiceArea');
const { publicCustomer, makeReferralCode } = require('./customerAuthController');

const ensureReferralCode = async (user) => {
  if (user.referralCode) return user;
  user.referralCode = makeReferralCode(user.name, user.phone);
  await user.save();
  return user;
};

const pushNotify = async (userId, payload) => {
  try {
    await CustomerNotification.create({ userId, ...payload });
  } catch {
    /* ignore */
  }
};

// ─── Profile ────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const user = await ensureReferralCode(await User.findById(req.user._id));
    res.json({ success: true, data: publicCustomer(user) });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { name, email, avatarUrl, preferredLanguage, city } = req.body;
    if (name) user.name = String(name).trim();
    if (email) user.email = String(email).trim().toLowerCase();
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (preferredLanguage === 'en' || preferredLanguage === 'hi') {
      user.preferredLanguage = preferredLanguage;
    }
    if (city !== undefined) user.city = city;
    await user.save();
    res.json({ success: true, data: publicCustomer(user) });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword required' });
    }
    const user = await User.findById(req.user._id);
    const ok = await bcrypt.compare(currentPassword, user.password || '');
    if (!ok) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password changed' });
  } catch (error) {
    next(error);
  }
};

const requestDeletion = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { deletionRequested: true, deletionRequestedAt: new Date() },
      { new: true }
    );
    res.json({ success: true, message: 'Deletion request submitted for Admin review', data: publicCustomer(user) });
  } catch (error) {
    next(error);
  }
};

// ─── Addresses ──────────────────────────────────────────────
const listAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user.addresses || [] });
  } catch (error) {
    next(error);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = {
      tag: req.body.tag || 'Home',
      flatBuilding: req.body.flatBuilding || '',
      streetArea: req.body.streetArea || '',
      pincode: req.body.pincode || '',
      city: req.body.city || '',
      lat: req.body.lat,
      lng: req.body.lng,
      isDefault: !!req.body.isDefault
    };
    if (addr.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
    if (!user.addresses.length) addr.isDefault = true;
    user.addresses.push(addr);
    await user.save();
    res.status(201).json({ success: true, data: user.addresses });
  } catch (error) {
    next(error);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
    ['tag', 'flatBuilding', 'streetArea', 'pincode', 'city', 'lat', 'lng'].forEach((k) => {
      if (req.body[k] !== undefined) addr[k] = req.body[k];
    });
    if (req.body.isDefault) {
      user.addresses.forEach((a) => { a.isDefault = false; });
      addr.isDefault = true;
    }
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (error) {
    next(error);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
    addr.deleteOne();
    if (user.addresses.length && !user.addresses.some((a) => a.isDefault)) {
      user.addresses[0].isDefault = true;
    }
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (error) {
    next(error);
  }
};

const checkServiceability = async (req, res, next) => {
  try {
    const pincode = String(req.query.pincode || req.body.pincode || '').trim();
    if (!pincode) return res.status(400).json({ success: false, message: 'pincode required' });
    const area = await ServiceArea.findOne({
      $or: [{ pincode }, { pinCodes: pincode }],
      isActive: true
    });
    res.json({
      success: true,
      data: {
        pincode,
        serviceable: !!area,
        city: area?.city || '',
        area: area?.area || ''
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─── Wishlist ───────────────────────────────────────────────
const getWishlist = async (req, res, next) => {
  try {
    const items = await Wishlist.find({ userId: req.user._id })
      .populate('productId')
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .lean();
    const data = items.map((w) => ({
      _id: w._id,
      product: w.productId,
      store: w.storeId,
      priceSnapshot: w.priceSnapshot,
      outOfStock: w.productId ? w.productId.isActive === false : true,
      currentPrice: w.productId?.mrp ?? w.priceSnapshot
    }));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const addWishlist = async (req, res, next) => {
  try {
    const { productId, storeId, price } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'productId required' });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const doc = await Wishlist.findOneAndUpdate(
      { userId: req.user._id, productId },
      {
        userId: req.user._id,
        productId,
        storeId: storeId || undefined,
        priceSnapshot: price ?? product.mrp
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

const removeWishlist = async (req, res, next) => {
  try {
    await Wishlist.findOneAndDelete({ userId: req.user._id, productId: req.params.productId });
    res.json({ success: true, message: 'Removed' });
  } catch (error) {
    next(error);
  }
};

// ─── Orders ─────────────────────────────────────────────────
const myOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {
      $or: [{ customerId: req.user._id }, { customerPhone: req.user.phone }]
    };
    if (status) filter.status = status;
    const data = await Order.find(filter)
      .populate('storeId', 'name phone city')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const requestCancel = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason required' });
    const order = await Order.findOne({
      _id: req.params.id,
      $or: [{ customerId: req.user._id }, { customerPhone: req.user.phone }]
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const blocked = ['completed', 'cancelled', 'rejected', 'out_for_delivery'];
    if (blocked.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order in status: ${order.status}`
      });
    }
    order.cancellationRequest = {
      requested: true,
      reason: String(reason),
      status: 'pending',
      requestedAt: new Date(),
      adminNote: ''
    };
    await order.save();
    await pushNotify(req.user._id, {
      type: 'order_cancelled',
      title: 'Cancellation requested',
      body: `Order ${order.orderNumber} cancellation is pending Admin approval.`,
      meta: { orderId: order._id }
    });
    res.json({ success: true, data: order, message: 'Cancellation request sent to Admin' });
  } catch (error) {
    next(error);
  }
};

// ─── Payments history ───────────────────────────────────────
const paymentHistory = async (req, res, next) => {
  try {
    const data = await Order.find({
      $or: [{ customerId: req.user._id }, { customerPhone: req.user.phone }]
    })
      .select(
        'orderNumber grandTotal paymentMode paymentStatus paymentTxnId refundStatus createdAt discountAmount walletUsed'
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── Coupons ────────────────────────────────────────────────
const listCoupons = async (req, res, next) => {
  try {
    const now = new Date();
    const data = await Coupon.find({
      isActive: true,
      $and: [
        { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
        { $or: [{ validTo: null }, { validTo: { $gte: now } }] }
      ]
    })
      .select('-usedBy')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const validateCoupon = async (req, res, next) => {
  try {
    const { code, orderValue = 0 } = req.body;
    const coupon = await Coupon.findOne({ code: String(code || '').toUpperCase() });
    if (!coupon || !coupon.isActive) {
      return res.status(400).json({ success: false, message: 'Invalid coupon' });
    }
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return res.status(400).json({ success: false, message: 'Coupon not yet valid' });
    }
    if (coupon.validTo && now > coupon.validTo) {
      return res.status(400).json({ success: false, message: 'Coupon expired' });
    }
    if (coupon.minOrderValue && Number(orderValue) < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order ₹${coupon.minOrderValue} required`
      });
    }
    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }
    let discount = 0;
    if (coupon.discountType === 'percent') {
      discount = Math.round((Number(orderValue) * coupon.discountValue) / 100);
    } else {
      discount = coupon.discountValue;
    }
    discount = Math.min(discount, Number(orderValue));
    res.json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount,
        minOrderValue: coupon.minOrderValue,
        validTo: coupon.validTo
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─── Wallet ─────────────────────────────────────────────────
const getWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const ledger = await WalletLedger.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100);
    const cfg = await PlatformConfig.findOne({ key: 'default' });
    res.json({
      success: true,
      data: {
        balance: user.walletBalance || 0,
        walletEnabled: true,
        ledger,
        note: 'Refunds credit to wallet only when Admin permits'
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─── Referral ───────────────────────────────────────────────
const getReferral = async (req, res, next) => {
  try {
    const user = await ensureReferralCode(await User.findById(req.user._id));
    const referred = await User.countDocuments({ referredBy: user._id, role: 'customer' });
    const link = `https://japto.in/ref/${user.referralCode}`;
    res.json({
      success: true,
      data: {
        code: user.referralCode,
        link,
        referredCount: referred,
        rewardStatus: 'Admin configures reward amount',
        whatsappText: `Join Japto.in with my code ${user.referralCode}: ${link}`
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─── Notifications ──────────────────────────────────────────
const listNotifications = async (req, res, next) => {
  try {
    const data = await CustomerNotification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const markNotification = async (req, res, next) => {
  try {
    const { read = true } = req.body;
    const data = await CustomerNotification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: !!read },
      { new: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const markAllNotifications = async (req, res, next) => {
  try {
    await CustomerNotification.updateMany({ userId: req.user._id }, { read: true });
    res.json({ success: true, message: 'All marked read' });
  } catch (error) {
    next(error);
  }
};

// ─── Complaints ─────────────────────────────────────────────
const myComplaints = async (req, res, next) => {
  try {
    const data = await Complaint.find({
      source: 'customer',
      $or: [{ userId: req.user._id }, { raisedByPhone: req.user.phone }]
    }).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createCustomerComplaint = async (req, res, next) => {
  try {
    const { subject, message, orderId, category } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'subject and message required' });
    }
    const data = await Complaint.create({
      source: 'customer',
      raisedByName: req.user.name,
      raisedByPhone: req.user.phone,
      userId: req.user._id,
      orderId: orderId || undefined,
      subject: `[${category || 'general'}] ${subject}`,
      message,
      status: 'open',
      replies: []
    });
    // complaint id for customer
    data._doc.complaintId = `CMP-${String(data._id).slice(-8).toUpperCase()}`;
    await pushNotify(req.user._id, {
      type: 'complaint',
      title: 'Complaint registered',
      body: `Complaint ID CMP-${String(data._id).slice(-8).toUpperCase()} created.`,
      meta: { complaintId: data._id }
    });
    res.status(201).json({
      success: true,
      data: { ...data.toObject(), complaintId: `CMP-${String(data._id).slice(-8).toUpperCase()}` }
    });
  } catch (error) {
    next(error);
  }
};

// ─── Reviews ────────────────────────────────────────────────
const myReviews = async (req, res, next) => {
  try {
    const data = await ProductReview.find({ customerId: req.user._id })
      .populate('productId', 'name photoUrl')
      .sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const submitReview = async (req, res, next) => {
  try {
    const { productId, storeId, orderId, rating, comment, imageUrl } = req.body;
    if (!productId || !storeId || !rating) {
      return res.status(400).json({ success: false, message: 'productId, storeId, rating required' });
    }
    const purchased = await Order.findOne({
      $or: [{ customerId: req.user._id }, { customerPhone: req.user.phone }],
      status: 'completed',
      'items.productId': productId,
      ...(orderId ? { _id: orderId } : {})
    });
    if (!purchased) {
      return res.status(403).json({
        success: false,
        message: 'Only verified purchasers can review this product'
      });
    }
    let review = await ProductReview.findOne({ customerId: req.user._id, productId, storeId });
    if (review) {
      review.rating = rating;
      review.comment = comment || '';
      review.imageUrl = imageUrl || review.imageUrl;
      review.approvalStatus = 'pending';
      await review.save();
    } else {
      review = await ProductReview.create({
        productId,
        storeId,
        orderId: purchased._id,
        customerId: req.user._id,
        customerName: req.user.name,
        rating,
        comment: comment || '',
        imageUrl: imageUrl || '',
        approvalStatus: 'pending'
      });
    }
    res.status(201).json({
      success: true,
      message: 'Review submitted — pending Admin approval',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

const publicReviews = async (req, res, next) => {
  try {
    const data = await ProductReview.find({
      productId: req.params.productId,
      approvalStatus: 'approved'
    })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── Cities ─────────────────────────────────────────────────
const listEnabledCities = async (req, res, next) => {
  try {
    const areas = await ServiceArea.find({ isActive: true }).sort({ city: 1, displayOrder: 1 });
    const cities = [...new Set(areas.map((a) => a.city).filter(Boolean))];
    res.json({ success: true, data: { cities, areas } });
  } catch (error) {
    next(error);
  }
};

// ─── Settings / policies (public already) ───────────────────
const getCustomerSettingsBundle = async (req, res, next) => {
  try {
    const SiteSettings = require('../models/SiteSettings');
    let settings = await SiteSettings.findOne({ key: 'default' });
    if (!settings) settings = await SiteSettings.create({ key: 'default' });
    res.json({
      success: true,
      data: {
        language: req.user?.preferredLanguage || 'en',
        termsHtml: settings.termsHtml,
        privacyHtml: settings.privacyHtml,
        shippingReturnHtml: settings.shippingReturnHtml,
        siteName: settings.siteName,
        returnsEnabled: false
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  requestDeletion,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  checkServiceability,
  getWishlist,
  addWishlist,
  removeWishlist,
  myOrders,
  requestCancel,
  paymentHistory,
  listCoupons,
  validateCoupon,
  getWallet,
  getReferral,
  listNotifications,
  markNotification,
  markAllNotifications,
  myComplaints,
  createCustomerComplaint,
  myReviews,
  submitReview,
  publicReviews,
  listEnabledCities,
  getCustomerSettingsBundle,
  pushNotify
};
