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
    const { status, isActive, decisionNote } = req.body;
    const update = {};
    if (status) {
      update.status = status;
      update.decisionNote = decisionNote || '';
      update.decidedAt = new Date();
      if (status === 'approved') {
        update.isActive = true;
        update.isOnline = true;
      }
      if (status === 'rejected') update.isActive = false;
    }
    if (typeof isActive === 'boolean') update.isActive = isActive;
    const store = await Store.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!store) return res.status(404).json({ success: false, message: 'Seller not found' });
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
    const data = await Franchise.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const updateFranchise = async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (body.status === 'approved' || body.status === 'rejected') {
      body.decidedAt = new Date();
      if (body.status === 'approved') body.isActive = true;
      if (body.status === 'rejected') body.isActive = false;
    }
    if (typeof body.isActive === 'boolean' && body.isActive === false && !body.status) {
      body.status = 'inactive';
    }
    const data = await Franchise.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Franchise not found' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const addFranchisePayment = async (req, res, next) => {
  try {
    const { amount, note } = req.body;
    const data = await Franchise.findByIdAndUpdate(
      req.params.id,
      { $push: { paymentHistory: { amount, note, paidAt: new Date() } } },
      { new: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Franchise not found' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── 6. Products (admin list / master) ───────────────────────
const listProductsAdmin = async (req, res, next) => {
  try {
    const { approvalStatus, sellerId, q, isActive } = req.query;
    const filter = {};
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (sellerId) filter.submittedBy = sellerId;
    if (isActive === 'true') filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;
    if (q) filter.name = { $regex: q, $options: 'i' };
    const data = await Product.find(filter)
      .populate('submittedBy', 'name phone')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
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

    const data = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Order not found' });
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
      .select('orderNumber storeId platformFee sellerEarning grandTotal commissionPaid createdAt')
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const pending = orders.filter((o) => !o.commissionPaid).reduce((s, o) => s + (o.platformFee || 0), 0);
    const paidSum = orders.filter((o) => o.commissionPaid).reduce((s, o) => s + (o.platformFee || 0), 0);
    res.json({
      success: true,
      data: {
        config: cfg,
        orders,
        pendingCommission: pending,
        paidCommission: paidSum,
        franchiseDeliveryCommissionPct: cfg.franchiseDeliveryCommissionPct
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateCommissionConfig = async (req, res, next) => {
  try {
    const cfg = await getOrCreateConfig();
    const { sellerCommissionPct, franchiseDeliveryCommissionPct } = req.body;
    if (sellerCommissionPct !== undefined) cfg.sellerCommissionPct = Number(sellerCommissionPct);
    if (franchiseDeliveryCommissionPct !== undefined) {
      cfg.franchiseDeliveryCommissionPct = Number(franchiseDeliveryCommissionPct);
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
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .lean();
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).lean();
    const mappedSupport = support.map((s) => ({
      _id: s._id,
      source: 'seller',
      raisedByName: s.sellerId?.name || '',
      raisedByPhone: s.sellerId?.phone || '',
      subject: `Support: ${s.type}`,
      message: s.message,
      status: s.status === 'pending' ? 'open' : s.status === 'resolved' ? 'resolved' : 'closed',
      replies: s.adminNote ? [{ by: 'admin', message: s.adminNote, at: s.updatedAt }] : [],
      isSupportRequest: true,
      createdAt: s.createdAt
    }));
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
      const sr = await SupportRequest.findByIdAndUpdate(
        req.params.id,
        {
          adminNote: message || '',
          status: status === 'resolved' ? 'resolved' : status === 'closed' ? 'rejected' : 'pending'
        },
        { new: true }
      );
      if (sr) return res.json({ success: true, data: sr });
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
const getSettings = async (req, res, next) => {
  try {
    const data = await getOrCreateSettings();
    res.json({ success: true, data });
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
      'shippingReturnHtml'
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    await data.save();
    res.json({ success: true, data });
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
    if (audience === 'franchise') {
      sentCount += await Franchise.countDocuments({ status: 'approved' });
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
    const data = await ServiceArea.find().sort({ city: 1 });
    res.json({ success: true, data });
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
  listCities,
  createCity,
  updateCity,
  getDeliveryCharges,
  saveDeliveryCharges,
  getTaxConfig,
  updateTaxConfig,
  getOrCreateConfig
};
