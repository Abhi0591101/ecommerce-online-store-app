const ProductReview = require('../models/ProductReview');
const Store = require('../models/Store');
const Product = require('../models/Product');

// GET /api/reviews?storeId=
const listReviews = async (req, res, next) => {
  try {
    const { storeId, productId } = req.query;
    if (!storeId) {
      return res.status(400).json({ success: false, message: 'storeId query is required' });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    if (req.user?.role === 'store_owner' && String(store.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not your store' });
    }

    const filter = { storeId };
    if (productId) filter.productId = productId;
    // Sellers see all; public callers only approved
    if (req.user?.role !== 'store_owner' && req.user?.role !== 'superadmin') {
      filter.approvalStatus = 'approved';
    }

    const reviews = await ProductReview.find(filter)
      .populate('productId', 'name photoUrl')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

// POST /api/reviews (public optional)
const createReview = async (req, res, next) => {
  try {
    const { productId, storeId, customerName, rating, comment } = req.body;
    if (!productId || !storeId || !customerName || rating == null) {
      return res.status(400).json({
        success: false,
        message: 'productId, storeId, customerName and rating are required'
      });
    }
    const r = Number(rating);
    if (r < 1 || r > 5) {
      return res.status(400).json({ success: false, message: 'rating must be 1–5' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const doc = await ProductReview.create({
      productId,
      storeId,
      customerId: req.user?._id,
      customerName: String(customerName).trim(),
      rating: r,
      comment: comment || '',
      approvalStatus: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted — pending Admin approval',
      data: doc
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listReviews, createReview };