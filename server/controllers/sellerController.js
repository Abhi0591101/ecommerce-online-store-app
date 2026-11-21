const mongoose = require('mongoose');
const Order = require('../models/Order');
const Store = require('../models/Store');
const Product = require('../models/Product');
const StoreProductPricing = require('../models/StoreProductPricing');

const assertSellerStore = async (user, storeId) => {
  if (!mongoose.isValidObjectId(storeId)) {
    return { error: 'Invalid storeId', code: 400 };
  }
  const store = await Store.findById(storeId);
  if (!store) return { error: 'Store not found', code: 404 };
  if (user.role !== 'superadmin' && String(store.ownerId) !== String(user._id)) {
    return { error: 'Not your store', code: 403 };
  }
  return { store };
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// GET /api/seller/dashboard?storeId=
const getDashboard = async (req, res, next) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({ success: false, message: 'storeId is required' });
    }
    const check = await assertSellerStore(req.user, storeId);
    if (check.error) {
      return res.status(check.code).json({ success: false, message: check.error });
    }

    const completedStatuses = ['completed'];
    const pendingStatuses = ['placed', 'accepted', 'packing', 'out_for_delivery', 'ready_for_pickup'];

    const [salesAgg, pendingOrders, productCount, recentOrders] = await Promise.all([
      Order.aggregate([
        { $match: { storeId: new mongoose.Types.ObjectId(storeId), status: { $in: completedStatuses } } },
        {
          $group: {
            _id: null,
            sales: { $sum: '$itemsTotal' },
            platformFees: { $sum: '$platformFee' },
            earnings: { $sum: '$sellerEarning' },
            orderCount: { $sum: 1 }
          }
        }
      ]),
      Order.countDocuments({ storeId, status: { $in: pendingStatuses } }),
      StoreProductPricing.countDocuments({ storeId, isAvailable: true }),
      Order.find({ storeId }).sort({ createdAt: -1 }).limit(5).select('orderNumber status grandTotal itemsTotal createdAt')
    ]);

    const totals = salesAgg[0] || { sales: 0, platformFees: 0, earnings: 0, orderCount: 0 };

    const pendingProducts = await Product.countDocuments({
      approvalStatus: 'pending',
      _id: {
        $in: (await StoreProductPricing.find({ storeId }).distinct('productId'))
      }
    });

    res.json({
      success: true,
      data: {
        storeId,
        sales: round2(totals.sales),
        platformFees: round2(totals.platformFees),
        earnings: round2(totals.earnings),
        completedOrders: totals.orderCount,
        pendingOrders,
        activeListings: productCount,
        pendingProductApprovals: pendingProducts,
        recentOrders
      }
    });
  } catch (error) {
    next(error);
  }
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const startOfMonth = (d) => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};

// GET /api/seller/reports?storeId=&range=daily|monthly|product
const getReports = async (req, res, next) => {
  try {
    const { storeId, range = 'daily' } = req.query;
    if (!storeId) {
      return res.status(400).json({ success: false, message: 'storeId is required' });
    }
    if (!['daily', 'monthly', 'product'].includes(range)) {
      return res.status(400).json({ success: false, message: 'range must be daily, monthly or product' });
    }

    const check = await assertSellerStore(req.user, storeId);
    if (check.error) {
      return res.status(check.code).json({ success: false, message: check.error });
    }

    const storeOid = new mongoose.Types.ObjectId(storeId);
    const matchBase = { storeId: storeOid, status: 'completed' };

    if (range === 'product') {
      const rows = await Order.aggregate([
        { $match: matchBase },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            productName: { $first: '$items.productName' },
            unitsSold: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.totalPrice' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 50 }
      ]);
      return res.json({
        success: true,
        data: {
          range,
          rows: rows.map((r) => ({
            productId: r._id,
            productName: r.productName,
            unitsSold: r.unitsSold,
            revenue: round2(r.revenue)
          }))
        }
      });
    }

    const now = new Date();
    const from = range === 'monthly' ? startOfMonth(now) : startOfDay(now);

    const rows = await Order.aggregate([
      { $match: { ...matchBase, createdAt: { $gte: from } } },
      {
        $group: {
          _id: range === 'monthly'
            ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            : { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } },
          orders: { $sum: 1 },
          sales: { $sum: '$itemsTotal' },
          platformFees: { $sum: '$platformFee' },
          earnings: { $sum: '$sellerEarning' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        range,
        from: from.toISOString(),
        rows: rows.map((r) => ({
          period: r._id,
          orders: r.orders,
          sales: round2(r.sales),
          platformFees: round2(r.platformFees),
          earnings: round2(r.earnings)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/seller/products?storeId= — includes pending seller-submitted products
const getSellerProducts = async (req, res, next) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({ success: false, message: 'storeId is required' });
    }
    const check = await assertSellerStore(req.user, storeId);
    if (check.error) {
      return res.status(check.code).json({ success: false, message: check.error });
    }

    const pricing = await StoreProductPricing.find({ storeId })
      .populate({
        path: 'productId',
        populate: [
          { path: 'categoryId', select: 'name slug' },
          { path: 'subcategoryId', select: 'name slug' }
        ]
      })
      .sort({ updatedAt: -1 });

    const data = pricing
      .filter((row) => row.productId)
      .map((row) => {
        const p = row.productId.toObject ? row.productId.toObject() : row.productId;
        return {
          ...p,
          categorySlug: p.categoryId?.slug,
          subcategorySlug: p.subcategoryId?.slug,
          approvalStatus: p.approvalStatus || 'approved',
          listing: {
            storeId: row.storeId,
            price: row.price,
            stockQuantity: row.stockQuantity,
            isAvailable: row.isAvailable,
            pricingId: row._id
          }
        };
      });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/seller/my-store — primary store for logged-in seller
const getMyStore = async (req, res, next) => {
  try {
    const filter =
      req.user.role === 'superadmin' && req.query.storeId
        ? { _id: req.query.storeId }
        : { ownerId: req.user._id };

    const store = await Store.findOne(filter).sort({ createdAt: -1 });
    if (!store) {
      return res.status(404).json({ success: false, message: 'No store found for this seller' });
    }
    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getReports, getSellerProducts, getMyStore };