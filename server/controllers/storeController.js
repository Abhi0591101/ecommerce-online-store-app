const bcrypt = require('bcryptjs');
const Store = require('../models/Store');
const User = require('../models/User');
const { hasLocationQuery, resolveNearbyStores, distanceKm: calculateDistanceKm } = require('../utils/nearbyStores');

const mapStore = (store, userLat = null, userLng = null) => {
  const doc = store.toObject ? store.toObject() : { ...store };
  const [storeLng, storeLat] = doc.location?.coordinates || [doc.lng, doc.lat];
  let distanceKm = null;

  if (userLat !== null && userLng !== null && storeLat !== undefined && storeLng !== undefined) {
    const d = calculateDistanceKm(userLat, userLng, storeLat, storeLng);
    distanceKm = d != null ? Number(d.toFixed(1)) : null;
  }

  return {
    ...doc,
    lat: storeLat,
    lng: storeLng,
    deliveryFee: doc.baseDeliveryFee,
    distanceKm,
    ownerName: doc.ownerName || doc.ownerId?.name || '',
    estDeliveryMins: distanceKm !== null
      ? Math.max(15, Math.min(60, Math.round(15 + distanceKm * 4)))
      : doc.estDeliveryMins
  };
};

// GET /api/stores
const getStores = async (req, res, next) => {
  try {
    const {
      lat,
      lng,
      pincode,
      city,
      radiusKm = 40,
      onlineOnly,
      status = 'approved',
      includeAll
    } = req.query;

    // Customer location browse: radius + ServiceArea pins (not exact-PIN-only AND)
    const isCustomerBrowse =
      status === 'approved' &&
      hasLocationQuery(req.query) &&
      includeAll !== 'true';

    if (isCustomerBrowse) {
      const nearby = await resolveNearbyStores({
        lat,
        lng,
        pincode,
        city,
        radiusKm,
        onlineOnly: onlineOnly === 'true' ? true : onlineOnly === 'false' ? false : true
      });
      const stores = nearby.stores.map((s) => ({
        ...s,
        deliveryFee: s.baseDeliveryFee,
        ownerName: s.ownerName || '',
        estDeliveryMins:
          s.distanceKm != null
            ? Math.max(15, Math.min(60, Math.round(15 + s.distanceKm * 4)))
            : s.estDeliveryMins
      }));
      return res.json({
        success: true,
        data: stores,
        meta: {
          scopedToLocation: true,
          serviceable: nearby.serviceable,
          servicePins: nearby.servicePins
        }
      });
    }

    const filter = {};
    if (includeAll === 'true' && req.user?.role === 'superadmin') {
      /* no status filter */
    } else if (status === 'all') {
      /* no status filter */
    } else {
      filter.status = status;
    }

    if (onlineOnly === 'true') filter.isOnline = true;
    if (pincode) filter.pincode = pincode;
    if (city) filter.city = new RegExp(`^${city}$`, 'i');

    let stores = await Store.find(filter).populate('ownerId', 'name phone');

    const userLat = lat !== undefined ? parseFloat(lat) : null;
    const userLng = lng !== undefined ? parseFloat(lng) : null;
    const maxRadius = parseFloat(radiusKm) || 40;

    stores = stores.map((store) => mapStore(store, userLat, userLng));

    if (userLat !== null && userLng !== null && status === 'approved') {
      stores = stores
        .filter((s) => s.distanceKm === null || s.distanceKm <= maxRadius)
        .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    } else {
      stores = stores.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    res.json({ success: true, data: stores });
  } catch (error) {
    next(error);
  }
};

// GET /api/stores/pending
const getPendingStores = async (req, res, next) => {
  try {
    const stores = await Store.find({ status: 'pending' })
      .populate('ownerId', 'name phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: stores.map((s) => {
        const mapped = mapStore(s);
        return {
          ...mapped,
          id: String(s._id),
          _id: s._id,
          ownerName: mapped.ownerName || mapped.ownerId?.name,
          submittedAt: s.createdAt ? new Date(s.createdAt).toLocaleString() : '',
          // KYC docs for Admin Seller Management
          panNumber: s.panNumber,
          panDocUrl: s.panDocUrl,
          gstNumber: s.gstNumber || s.gstin,
          gstDocUrl: s.gstDocUrl,
          enrollmentNumber: s.enrollmentNumber,
          enrollmentDocUrl: s.enrollmentDocUrl,
          bankAccount: s.bankAccount,
          ifsc: s.ifsc,
          bankProofUrl: s.bankProofUrl,
          fssaiDocUrl: s.fssaiDocUrl,
          registrationFeePaid: s.registrationFeePaid,
          isActive: s.isActive !== false
        };
      })
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/stores
const createStore = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      photoUrl,
      address,
      pincode,
      city = 'Noida',
      lat,
      lng,
      ownerName,
      ownerPhone,
      ownerPassword,
      gstin,
      fssai,
      category,
      baseDeliveryFee,
      freeDeliveryAbove,
      estDeliveryMins,
      openingTime,
      status,
      isOnline
    } = req.body;

    if (!name || !phone || !photoUrl || !address || !pincode || lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: 'name, phone, photoUrl, address, pincode, lat, lng are required'
      });
    }

    const isAdmin = req.user?.role === 'superadmin';
    const storeStatus = isAdmin ? (status || 'approved') : 'pending';

    let ownerId = req.user?.role === 'store_owner' ? req.user._id : null;
    const ownerPhoneFinal = ownerPhone || phone;

    if (!ownerId) {
      let owner = await User.findOne({
        phone: String(ownerPhoneFinal).trim(),
        role: 'store_owner'
      });
      if (!owner) {
        const crypto = require('crypto');
        const rawPass =
          ownerPassword && String(ownerPassword).length >= 6
            ? String(ownerPassword)
            : crypto.randomBytes(24).toString('hex');
        const hash = await bcrypt.hash(rawPass, 10);
        owner = await User.create({
          name: ownerName || name,
          phone: String(ownerPhoneFinal).trim(),
          email: undefined,
          password: hash,
          role: 'store_owner',
          status: storeStatus === 'approved' ? 'approved' : 'pending'
        });
      }
      ownerId = owner._id;
    }

    const store = await Store.create({
      name,
      ownerId,
      phone,
      photoUrl,
      address,
      pincode,
      city,
      location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
      baseDeliveryFee: baseDeliveryFee != null ? Number(baseDeliveryFee) : 20,
      freeDeliveryAbove: freeDeliveryAbove != null ? Number(freeDeliveryAbove) : 300,
      estDeliveryMins: estDeliveryMins != null ? Number(estDeliveryMins) : 20,
      openingTime: openingTime || '08:00 AM - 10:30 PM',
      ownerName: ownerName || '',
      gstin: gstin || '',
      fssai: fssai || '',
      category: category || 'grocery',
      status: storeStatus,
      isOnline: isOnline != null ? !!isOnline : storeStatus === 'approved',
      pickupAvailable: true,
      rating: 4.8,
      reviewsCount: 0
    });

    res.status(201).json({ success: true, data: mapStore(store) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/stores/:id/status
const updateStoreKycStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const { hasCompleteSellerKyc } = require('../utils/storeVisibility');
    store.status = status;
    if (status === 'approved') {
      store.isActive = true;
      store.isOnline = hasCompleteSellerKyc(store);
    }
    if (status === 'rejected') {
      store.isActive = false;
      store.isOnline = false;
    }
    if (status === 'pending') {
      store.isOnline = false;
    }
    await store.save();

    if (store.ownerId) {
      await User.findByIdAndUpdate(store.ownerId, {
        status: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'
      });
    }

    res.json({
      success: true,
      data: mapStore(store),
      message: `Store ${status}`
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/stores/:id/toggle-status
// Admin: any store. Seller (store_owner): only their own approved store.
const toggleStoreStatus = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const role = req.user?.role;
    const isAdmin = role === 'superadmin';
    const isOwner =
      role === 'store_owner' &&
      store.ownerId &&
      String(store.ownerId) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only change online status for your own store'
      });
    }

    const { canSellerGoOnline } = require('../utils/storeVisibility');
    const goingOnline = !store.isOnline;

    // Going online: seller blocked if rejected / inactive / KYC incomplete
    if (goingOnline) {
      if (!isAdmin) {
        const gate = canSellerGoOnline(store);
        if (!gate.ok) {
          return res.status(403).json({ success: false, message: gate.message });
        }
      } else {
        // Admin can force online only when store is approved + active + KYC ok
        const gate = canSellerGoOnline(store);
        if (!gate.ok) {
          return res.status(403).json({
            success: false,
            message: gate.message
          });
        }
      }
    }

    store.isOnline = goingOnline;
    await store.save();

    res.json({
      success: true,
      data: {
        _id: store._id,
        name: store.name,
        isOnline: store.isOnline
      },
      message: store.isOnline ? 'Store is now ONLINE' : 'Store is now OFFLINE'
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/stores/:id
const updateStore = async (req, res, next) => {
  try {
    const allowed = [
      'name', 'phone', 'photoUrl', 'address', 'pincode', 'city', 'baseDeliveryFee',
      'freeDeliveryAbove', 'estDeliveryMins', 'openingTime', 'ownerName', 'gstin',
      'fssai', 'category', 'pickupAvailable', 'isOnline', 'rating', 'reviewsCount',
      'panNumber', 'panDocUrl', 'gstNumber', 'gstDocUrl', 'enrollmentNumber',
      'enrollmentDocUrl', 'bankAccount', 'ifsc', 'bankProofUrl', 'dealsInFood', 'fssaiDocUrl'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body.lat != null && req.body.lng != null) {
      updates.location = {
        type: 'Point',
        coordinates: [Number(req.body.lng), Number(req.body.lat)]
      };
    }

    const store = await Store.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    res.json({ success: true, data: mapStore(store) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStores,
  getPendingStores,
  createStore,
  updateStoreKycStatus,
  toggleStoreStatus,
  updateStore
};
