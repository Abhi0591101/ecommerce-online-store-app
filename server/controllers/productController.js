const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const StoreProductPricing = require('../models/StoreProductPricing');
const { hasLocationQuery, resolveNearbyStores, distanceKm } = require('../utils/nearbyStores');
const { isCustomerVisibleStore } = require('../utils/storeVisibility');

const computeDeliveryFee = (itemPrice, store) => {
  if (store.freeDeliveryAbove > 0 && itemPrice >= store.freeDeliveryAbove) {
    return 0;
  }
  return store.baseDeliveryFee || 0;
};

// GET /api/products
// Optional location: lat,lng,radiusKm,pincode,city → only products stocked by nearby/serviceable stores
const getProducts = async (req, res, next) => {
  try {
    const { category, subcategory, search, q, brand, includeOutOfStock } = req.query;
    const filter = {
      isActive: true,
      status: { $ne: 'inactive' },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]
    };

    let nearbyStoreIds = null;
    let serviceable = null;
    if (hasLocationQuery(req.query)) {
      const nearby = await resolveNearbyStores(req.query);
      nearbyStoreIds = nearby.storeIds || [];
      serviceable = nearby.serviceable;
      // No stores in area → empty catalog (not global fallback)
      if (!nearbyStoreIds.length) {
        return res.json({
          success: true,
          data: [],
          meta: {
            scopedToLocation: true,
            storeCount: 0,
            serviceable,
            message: 'No stores serve this delivery area'
          }
        });
      }
    }

    if (category && category !== 'all' && category !== 'services' && category !== 'shops') {
      const categoryDoc = await Category.findOne({
        $or: [{ slug: category }, { _id: mongoose.isValidObjectId(category) ? category : null }]
      });
      if (!categoryDoc) {
        return res.json({ success: true, data: [] });
      }
      if (categoryDoc.parentId) {
        // slug pointed at a subcategory
        filter.subcategoryId = categoryDoc._id;
        filter.categoryId = categoryDoc.parentId;
      } else {
        filter.categoryId = categoryDoc._id;
      }
    }

    if (subcategory) {
      const subDoc = await Category.findOne({
        $or: [
          { slug: subcategory },
          { _id: mongoose.isValidObjectId(subcategory) ? subcategory : null }
        ],
        parentId: { $ne: null }
      });
      if (!subDoc) {
        return res.json({ success: true, data: [] });
      }
      filter.subcategoryId = subDoc._id;
    }

    if (brand) {
      filter.brand = new RegExp(String(brand), 'i');
    }

    const keyword = search || q;
    if (keyword) {
      filter.$or = [
        { name: new RegExp(keyword, 'i') },
        { brand: new RegExp(keyword, 'i') },
        { description: new RegExp(keyword, 'i') },
        { sku: new RegExp(keyword, 'i') }
      ];
    }

    const products = await Product.find(filter)
      .populate('categoryId', 'name slug iconEmoji requiresLicence')
      .populate('subcategoryId', 'name slug parentId')
      .sort({ createdAt: -1 });

    const productIds = products.map((p) => p._id);

    const pricingFilter = {
      productId: { $in: productIds },
      isAvailable: true
    };
    if (includeOutOfStock !== '1' && includeOutOfStock !== 'true') {
      pricingFilter.stockQuantity = { $gt: 0 };
    }
    if (nearbyStoreIds) {
      pricingFilter.storeId = { $in: nearbyStoreIds };
    }

    const pricingRows = await StoreProductPricing.find(pricingFilter).populate({
      path: 'storeId',
      match: { isOnline: true, status: 'approved', isActive: { $ne: false } }
    });

    const lowestByProduct = {};
    const offersByProduct = {};
    for (const row of pricingRows) {
      if (!row.storeId || !isCustomerVisibleStore(row.storeId)) continue;
      const key = row.productId.toString();
      const offer = {
        storeId: row.storeId._id,
        storeName: row.storeId.name,
        storeRating: row.storeId.rating,
        price: row.price,
        stockQuantity: row.stockQuantity,
        baseDeliveryFee: row.storeId.baseDeliveryFee,
        freeDeliveryAbove: row.storeId.freeDeliveryAbove,
        estDeliveryMins: row.storeId.estDeliveryMins,
        deliveryFee: computeDeliveryFee(row.price, row.storeId),
        pincode: row.storeId.pincode,
        city: row.storeId.city
      };
      offer.totalCost = offer.price + (offer.deliveryFee || 0);
      if (!offersByProduct[key]) offersByProduct[key] = [];
      offersByProduct[key].push(offer);
      if (!lowestByProduct[key] || row.price < lowestByProduct[key].price) {
        lowestByProduct[key] = offer;
      }
    }

    const data = products
      .map((product) => {
        const key = product._id.toString();
        const lowest = lowestByProduct[key];
        if (!lowest) return null;

        const savingsPercent = product.mrp > 0
          ? Math.round(((product.mrp - lowest.price) / product.mrp) * 100)
          : 0;

        return {
          ...product.toObject(),
          lowestPrice: lowest.price,
          lowestStore: {
            storeId: lowest.storeId,
            name: lowest.storeName,
            rating: lowest.storeRating,
            baseDeliveryFee: lowest.baseDeliveryFee,
            freeDeliveryAbove: lowest.freeDeliveryAbove,
            estDeliveryMins: lowest.estDeliveryMins,
            pincode: lowest.pincode,
            city: lowest.city
          },
          storeOffers: (offersByProduct[key] || []).sort((a, b) => a.totalCost - b.totalCost),
          savingsPercent: Math.max(0, savingsPercent),
          inStock: true
        };
      })
      .filter(Boolean);

    res.json({
      success: true,
      data,
      meta: nearbyStoreIds
        ? {
            scopedToLocation: true,
            storeCount: nearbyStoreIds.length,
            serviceable
          }
        : { scopedToLocation: false }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id/compare-stores
const compareStores = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const product = await Product.findById(id)
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug');
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const approval = product.approvalStatus || 'approved';
    if (approval !== 'approved') {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let nearbyStoreIds = null;
    if (hasLocationQuery(req.query)) {
      const nearby = await resolveNearbyStores(req.query);
      nearbyStoreIds = nearby.storeIds || [];
    }

    const pricingQuery = {
      productId: id,
      isAvailable: true,
      stockQuantity: { $gt: 0 }
    };
    if (nearbyStoreIds) {
      pricingQuery.storeId = { $in: nearbyStoreIds };
    }

    const pricingRows = await StoreProductPricing.find(pricingQuery).populate('storeId');

    const userLat = req.query.lat != null ? Number(req.query.lat) : null;
    const userLng = req.query.lng != null ? Number(req.query.lng) : null;

    const comparisons = pricingRows
      .filter((row) => row.storeId && isCustomerVisibleStore(row.storeId))
      .map((row) => {
        const store = row.storeId;
        const itemPrice = row.price;
        const deliveryFee = computeDeliveryFee(itemPrice, store);
        const totalCost = itemPrice + deliveryFee;
        const [lng, lat] = store.location?.coordinates || [];
        const d =
          userLat != null && userLng != null && lat != null && lng != null
            ? distanceKm(userLat, userLng, lat, lng)
            : null;

        return {
          storeId: store._id,
          storeName: store.name,
          photoUrl: store.photoUrl,
          rating: store.rating,
          reviewsCount: store.reviewsCount,
          address: store.address,
          pincode: store.pincode,
          city: store.city,
          lat,
          lng,
          distanceKm: d != null ? Number(d.toFixed(1)) : null,
          estDeliveryMins: store.estDeliveryMins,
          pickupAvailable: store.pickupAvailable,
          itemPrice,
          deliveryFee,
          totalCost,
          stockQuantity: row.stockQuantity,
          freeDeliveryAbove: store.freeDeliveryAbove,
          isLowestPrice: false
        };
      })
      .sort((a, b) => a.totalCost - b.totalCost);

    if (comparisons.length > 0) {
      comparisons[0].isLowestPrice = true;
    }

    res.json({
      success: true,
      data: {
        product: {
          _id: product._id,
          name: product.name,
          brand: product.brand,
          unit: product.unit,
          mrp: product.mrp,
          photoUrl: product.photoUrl,
          photos: product.photos?.length ? product.photos : [product.photoUrl],
          description: product.description,
          rating: product.rating,
          reviewsCount: product.reviewsCount,
          category: product.categoryId,
          subcategory: product.subcategoryId
        },
        stores: comparisons
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products — create master product (+ optional multi-store pricing)
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      brand,
      sku,
      unit,
      mrp,
      description,
      photoUrl,
      photos,
      categorySlug,
      categoryId,
      subcategorySlug,
      subcategoryId,
      pricing = [],
      status
    } = req.body;

    if (!name || !unit || mrp === undefined || mrp === null || !photoUrl) {
      return res.status(400).json({
        success: false,
        message: 'name, unit, mrp, and photoUrl are required'
      });
    }

    let subcategory = null;
    if (subcategoryId && mongoose.isValidObjectId(subcategoryId)) {
      subcategory = await Category.findById(subcategoryId);
    }
    if (!subcategory && subcategorySlug) {
      subcategory = await Category.findOne({ slug: subcategorySlug, isActive: true });
    }

    let category = null;
    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      category = await Category.findById(categoryId);
    }
    if (!category && categorySlug) {
      category = await Category.findOne({ slug: categorySlug, isActive: true });
    }

    // Prefer subcategory → derive main category
    if (subcategory) {
      if (!subcategory.parentId) {
        return res.status(400).json({
          success: false,
          message: 'subcategoryId must reference a subcategory, not a main category'
        });
      }
      if (!subcategory.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Selected subcategory is inactive'
        });
      }
      category = await Category.findById(subcategory.parentId);
    }

    if (!category || category.parentId) {
      return res.status(400).json({
        success: false,
        message: 'Valid active main category is required'
      });
    }
    if (!category.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected category is inactive'
      });
    }
    if (!subcategory) {
      return res.status(400).json({
        success: false,
        message: 'Valid active subcategorySlug or subcategoryId is required'
      });
    }
    if (String(subcategory.parentId) !== String(category._id)) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory does not belong to the selected main category'
      });
    }

    // Regulated category: seller store must have licence when pricing attached
    if (category.requiresLicence && Array.isArray(pricing) && pricing.length) {
      const Store = require('../models/Store');
      const storeIds = pricing.map((p) => p.storeId).filter(Boolean);
      const stores = await Store.find({ _id: { $in: storeIds } });
      const ineligible = stores.filter((s) => !s.fssai && !s.gstin);
      if (ineligible.length) {
        return res.status(403).json({
          success: false,
          message:
            'This category requires eligible sellers with FSSAI/GSTIN before listing regulated products'
        });
      }
    }

    const isSeller = req.user?.role === 'store_owner';
    const isAdmin = req.user?.role === 'superadmin';
    const needsApproval = isSeller && !isAdmin;

    const product = await Product.create({
      name: String(name).trim(),
      brand: brand || '',
      sku: sku || '',
      unit: String(unit).trim(),
      mrp: Number(mrp),
      description: description || 'Quality product from local verified sellers.',
      photoUrl,
      photos: Array.isArray(photos) && photos.length ? photos : [photoUrl],
      categoryId: category._id,
      subcategoryId: subcategory._id,
      // Unpublished until Admin approves seller-submitted products
      isActive: needsApproval ? false : true,
      status: needsApproval ? 'draft' : status === 'draft' ? 'draft' : 'active',
      approvalStatus: needsApproval ? 'pending' : 'approved',
      submittedBy: isSeller ? req.user._id : undefined
    });

    if (needsApproval) {
      try {
        const { pushAdminAlert } = require('../utils/adminAlerts');
        await pushAdminAlert({
          type: 'product_approval',
          title: 'Product pending approval',
          body: product.name,
          entityType: 'product',
          entityId: product._id,
          linkTab: 'products_pending',
          dedupeKey: `product_approval:${product._id}`
        });
      } catch {
        /* non-blocking */
      }
    }

    let pricingRows = [];
    if (Array.isArray(pricing) && pricing.length) {
      const ops = pricing
        .filter((row) => row.storeId && Number(row.price) > 0)
        .map((row) => ({
          updateOne: {
            filter: {
              storeId: row.storeId,
              productId: product._id
            },
            update: {
              $set: {
                price: Number(row.price),
                stockQuantity: Number(row.stockQuantity ?? 50),
                isAvailable: row.isAvailable !== false
              }
            },
            upsert: true
          }
        }));

      if (ops.length) {
        await StoreProductPricing.bulkWrite(ops);
        pricingRows = await StoreProductPricing.find({ productId: product._id }).populate(
          'storeId',
          'name baseDeliveryFee freeDeliveryAbove estDeliveryMins rating'
        );
      }
    }

    const populated = await Product.findById(product._id)
      .populate('categoryId', 'name slug iconEmoji')
      .populate('subcategoryId', 'name slug');

    const lowest = pricingRows
      .filter((r) => r.isAvailable && r.stockQuantity > 0)
      .sort((a, b) => a.price - b.price)[0];

    res.status(201).json({
      success: true,
      message: 'Product created',
      data: {
        ...populated.toObject(),
        categorySlug: populated.categoryId?.slug,
        subcategorySlug: populated.subcategoryId?.slug,
        lowestPrice: lowest?.price || Number(mrp),
        lowestStore: lowest?.storeId
          ? {
              storeId: lowest.storeId._id,
              name: lowest.storeId.name,
              rating: lowest.storeId.rating,
              baseDeliveryFee: lowest.storeId.baseDeliveryFee,
              freeDeliveryAbove: lowest.storeId.freeDeliveryAbove,
              estDeliveryMins: lowest.storeId.estDeliveryMins
            }
          : null,
        savingsPercent: lowest
          ? Math.max(0, Math.round(((Number(mrp) - lowest.price) / Number(mrp)) * 100))
          : 0,
        storeOffers: pricingRows.map((r) => ({
          storeId: r.storeId?._id || r.storeId,
          storeName: r.storeId?.name,
          price: r.price,
          stockQuantity: r.stockQuantity,
          isAvailable: r.isAvailable,
          deliveryFee:
            r.price >= (r.storeId?.freeDeliveryAbove || 0)
              ? 0
              : r.storeId?.baseDeliveryFee || 0
        })),
        inStock: !!lowest
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products/pricing-matrix — upsert multi-store prices for a product
const upsertPricingMatrix = async (req, res, next) => {
  try {
    const { productId, pricing = [] } = req.body;

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Valid productId is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!Array.isArray(pricing) || pricing.length === 0) {
      return res.status(400).json({ success: false, message: 'pricing array is required' });
    }

    const ops = pricing
      .filter((row) => row.storeId && Number(row.price) > 0)
      .map((row) => ({
        updateOne: {
          filter: { storeId: row.storeId, productId },
          update: {
            $set: {
              price: Number(row.price),
              stockQuantity: Number(row.stockQuantity ?? 50),
              isAvailable: row.isAvailable !== false
            }
          },
          upsert: true
        }
      }));

    if (!ops.length) {
      return res.status(400).json({ success: false, message: 'No valid pricing rows' });
    }

    await StoreProductPricing.bulkWrite(ops);

    const rows = await StoreProductPricing.find({ productId }).populate(
      'storeId',
      'name baseDeliveryFee freeDeliveryAbove'
    );

    res.json({
      success: true,
      message: 'Pricing matrix updated',
      data: rows.map((r) => ({
        _id: r._id,
        productId: r.productId,
        storeId: r.storeId?._id || r.storeId,
        storeName: r.storeId?.name,
        price: r.price,
        stockQuantity: r.stockQuantity,
        isAvailable: r.isAvailable
      }))
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/pricing — update stock / availability for one store-product
const updateStorePricing = async (req, res, next) => {
  try {
    const { productId, storeId, stockQuantity, isAvailable, price } = req.body;

    if (!productId || !storeId) {
      return res.status(400).json({
        success: false,
        message: 'productId and storeId are required'
      });
    }

    const update = {};
    if (stockQuantity !== undefined) update.stockQuantity = Number(stockQuantity);
    if (isAvailable !== undefined) update.isAvailable = !!isAvailable;
    if (price !== undefined) update.price = Number(price);

    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const row = await StoreProductPricing.findOneAndUpdate(
      { productId, storeId },
      { $set: update },
      { new: true, upsert: false }
    ).populate('storeId', 'name');

    if (!row) {
      return res.status(404).json({ success: false, message: 'Pricing row not found' });
    }

    res.json({
      success: true,
      data: {
        _id: row._id,
        productId: row.productId,
        storeId: row.storeId?._id || row.storeId,
        storeName: row.storeId?.name,
        price: row.price,
        stockQuantity: row.stockQuantity,
        isAvailable: row.isAvailable
      }
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/:id — update product master fields
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const {
      name,
      brand,
      sku,
      unit,
      mrp,
      description,
      photoUrl,
      photos,
      categorySlug,
      categoryId,
      subcategorySlug,
      subcategoryId,
      isActive,
      status
    } = req.body;

    if (name != null) product.name = String(name).trim();
    if (brand != null) product.brand = brand;
    if (sku != null) product.sku = sku;
    if (unit != null) product.unit = String(unit).trim();
    if (mrp != null) product.mrp = Number(mrp);
    if (description != null) product.description = description;
    if (photoUrl != null) {
      product.photoUrl = photoUrl;
      if (!Array.isArray(photos)) {
        product.photos = [photoUrl];
      }
    }
    if (Array.isArray(photos) && photos.length) product.photos = photos;
    if (isActive != null) product.isActive = Boolean(isActive);
    if (status != null && ['draft', 'active', 'inactive'].includes(status)) {
      product.status = status;
    }

    let subcategory = null;
    if (subcategoryId || subcategorySlug) {
      if (subcategoryId && mongoose.isValidObjectId(subcategoryId)) {
        subcategory = await Category.findById(subcategoryId);
      } else if (subcategorySlug) {
        subcategory = await Category.findOne({ slug: subcategorySlug });
      }
      if (!subcategory || !subcategory.parentId) {
        return res.status(400).json({ success: false, message: 'Valid subcategory required' });
      }
      product.subcategoryId = subcategory._id;
      product.categoryId = subcategory.parentId;
    } else if (categoryId || categorySlug) {
      let category = null;
      if (categoryId && mongoose.isValidObjectId(categoryId)) {
        category = await Category.findById(categoryId);
      } else if (categorySlug) {
        category = await Category.findOne({ slug: categorySlug });
      }
      if (!category || category.parentId) {
        return res.status(400).json({ success: false, message: 'Valid main category required' });
      }
      product.categoryId = category._id;
    }

    await product.save();
    const populated = await Product.findById(product._id)
      .populate('categoryId', 'name slug iconEmoji')
      .populate('subcategoryId', 'name slug');

    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id — hard delete product + pricing rows
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await StoreProductPricing.deleteMany({ productId: id });
    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted',
      data: { _id: id }
    });
  } catch (error) {
    next(error);
  }
};

async function attachSellerStores(products = []) {
  const Store = require('../models/Store');
  const StoreProductPricing = require('../models/StoreProductPricing');
  const ownerIds = [
    ...new Set(
      products
        .map((p) => p.submittedBy?._id || p.submittedBy)
        .filter(Boolean)
        .map(String)
    )
  ];
  const productIds = products.map((p) => p._id).filter(Boolean);

  const [stores, pricingRows] = await Promise.all([
    ownerIds.length
      ? Store.find({ ownerId: { $in: ownerIds } })
          .select('name phone city pincode ownerId status')
          .lean()
      : [],
    productIds.length
      ? StoreProductPricing.find({ productId: { $in: productIds } })
          .select('productId storeId price stockQuantity isAvailable')
          .populate('storeId', 'name phone city ownerId')
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

  return products.map((p) => {
    const plain = typeof p.toObject === 'function' ? p.toObject() : { ...p };
    const ownerId = plain.submittedBy?._id || plain.submittedBy;
    const sellerStore = ownerId ? storeByOwner.get(String(ownerId)) || null : null;
    const listings = pricingByProduct.get(String(plain._id)) || [];
    const stockTotal = listings.reduce((s, r) => s + (Number(r.stockQuantity) || 0), 0);
    return {
      ...plain,
      sellerStore,
      sellerName: plain.submittedBy?.name || '',
      sellerPhone: plain.submittedBy?.phone || '',
      storeName: sellerStore?.name || listings[0]?.storeId?.name || '',
      storeCity: sellerStore?.city || listings[0]?.storeId?.city || '',
      stock: stockTotal,
      listings
    };
  });
}

// GET /api/products/pending
const getPendingProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ approvalStatus: 'pending' })
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .populate('submittedBy', 'name phone email')
      .sort({ createdAt: -1 });

    const data = await attachSellerStores(products);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/:id/approval
const patchProductApproval = async (req, res, next) => {
  try {
    const { approvalStatus, reason, decisionNote } = req.body;
    if (!['approved', 'pending', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid approvalStatus' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.approvalStatus = approvalStatus;
    const note = String(reason || decisionNote || '').trim();
    if (approvalStatus === 'approved') {
      product.isActive = true;
      product.status = product.status === 'draft' ? 'active' : product.status;
      product.rejectionReason = '';
    } else if (approvalStatus === 'rejected' && note) {
      product.rejectionReason = note;
    }
    await product.save();
    if (approvalStatus === 'approved' || approvalStatus === 'rejected') {
      try {
        const { resolveAlertsForEntity } = require('../utils/adminAlerts');
        await resolveAlertsForEntity(product._id, ['product_approval']);
      } catch {
        /* ignore */
      }
    }

    const Store = require('../models/Store');
    const { notifyProductApproval } = require('../utils/sellerNotifications');

    if (product.submittedBy) {
      const store = await Store.findOne({ ownerId: product.submittedBy });
      if (store) {
        await notifyProductApproval(product, store._id, store.ownerId, approvalStatus);
      }
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  compareStores,
  createProduct,
  updateProduct,
  deleteProduct,
  upsertPricingMatrix,
  updateStorePricing,
  getPendingProducts,
  patchProductApproval
};
