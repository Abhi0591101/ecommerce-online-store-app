const SupportRequest = require('../models/SupportRequest');
const Store = require('../models/Store');
const { normalizePhone } = require('../utils/otpStore');

const ALLOWED_TYPES = ['profile', 'bank', 'contact', 'document', 'address', 'promoters', 'other'];

const assertStoreOwner = async (user, storeId) => {
  const store = await Store.findById(storeId);
  if (!store) return { error: 'Store not found', code: 404 };
  if (user.role !== 'superadmin' && String(store.ownerId) !== String(user._id)) {
    return { error: 'Not your store', code: 403 };
  }
  return { store };
};

const normalizeAddressChanges = (raw = {}) => {
  const address = String(raw.address || '').trim();
  const pincode = String(raw.pincode || '').trim();
  const city = String(raw.city || '').trim();
  const state = String(raw.state || '').trim();
  const lat = raw.lat != null && raw.lat !== '' ? Number(raw.lat) : null;
  const lng = raw.lng != null && raw.lng !== '' ? Number(raw.lng) : null;

  if (!address || !pincode || !city) {
    return { error: 'Address change requires address, pincode and city' };
  }
  if (!/^[1-9]\d{5}$/.test(pincode)) {
    return { error: 'Valid 6-digit pincode required' };
  }

  const changes = { address, pincode, city };
  if (state) changes.state = state;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    changes.lat = lat;
    changes.lng = lng;
    changes.location = { type: 'Point', coordinates: [lng, lat] };
  }
  return { changes };
};

const normalizePromoterChanges = (raw = {}) => {
  const promoters = [
    {
      name: String(raw.promoter1Name || raw.promoters?.[0]?.name || '').trim(),
      phone: String(raw.promoter1Phone || raw.promoters?.[0]?.phone || '').trim()
    },
    {
      name: String(raw.promoter2Name || raw.promoters?.[1]?.name || '').trim(),
      phone: String(raw.promoter2Phone || raw.promoters?.[1]?.phone || '').trim()
    }
  ].map((p) => ({
    name: p.name,
    phone: p.phone ? normalizePhone(p.phone) : ''
  }));

  if (!promoters.some((p) => p.name || p.phone)) {
    return { error: 'At least one promoter name or mobile is required' };
  }
  return {
    changes: {
      promoters: promoters.filter((p) => p.name || p.phone),
      promoter1Name: promoters[0].name,
      promoter1Phone: promoters[0].phone,
      promoter2Name: promoters[1].name,
      promoter2Phone: promoters[1].phone
    }
  };
};

/** Apply approved structured changes onto the store */
const applyRequestedChanges = async (supportDoc) => {
  if (!supportDoc?.requestedChanges) return null;
  const store = await Store.findById(supportDoc.storeId);
  if (!store) return null;

  const c = supportDoc.requestedChanges;
  if (supportDoc.type === 'address') {
    if (c.address) store.address = c.address;
    if (c.pincode) store.pincode = c.pincode;
    if (c.city) store.city = c.city;
    if (c.location?.coordinates) store.location = c.location;
    else if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      store.location = { type: 'Point', coordinates: [c.lng, c.lat] };
    }
  }
  if (supportDoc.type === 'promoters') {
    const hasFlat =
      c.promoter1Name != null ||
      c.promoter1Phone != null ||
      c.promoter2Name != null ||
      c.promoter2Phone != null;
    if (hasFlat) {
      store.promoters = [
        { name: c.promoter1Name || '', phone: c.promoter1Phone || '' },
        { name: c.promoter2Name || '', phone: c.promoter2Phone || '' }
      ].filter((p) => p.name || p.phone);
    } else if (Array.isArray(c.promoters)) {
      store.promoters = c.promoters;
    }
  }
  await store.save();
  return store;
};

// POST /api/support-requests
const createSupportRequest = async (req, res, next) => {
  try {
    const { storeId, type, message, attachments = [], requestedChanges } = req.body;
    if (!storeId || !type || !message) {
      return res.status(400).json({
        success: false,
        message: 'storeId, type and message are required'
      });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid support request type' });
    }

    const check = await assertStoreOwner(req.user, storeId);
    if (check.error) {
      return res.status(check.code).json({ success: false, message: check.error });
    }

    let changes = null;
    if (type === 'address') {
      const normalized = normalizeAddressChanges(requestedChanges || {});
      if (normalized.error) {
        return res.status(400).json({ success: false, message: normalized.error });
      }
      changes = normalized.changes;
    } else if (type === 'promoters') {
      const normalized = normalizePromoterChanges(requestedChanges || {});
      if (normalized.error) {
        return res.status(400).json({ success: false, message: normalized.error });
      }
      changes = normalized.changes;
    } else if (requestedChanges && typeof requestedChanges === 'object') {
      changes = requestedChanges;
    }

    const doc = await SupportRequest.create({
      sellerId: req.user._id,
      storeId,
      type,
      message: String(message).trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      requestedChanges: changes
    });

    try {
      const { pushAdminAlert } = require('../utils/adminAlerts');
      await pushAdminAlert({
        type: 'support',
        title: `Seller support: ${type}`,
        body: String(message).trim().slice(0, 160),
        entityType: 'support_request',
        entityId: doc._id,
        linkTab: 'complaints',
        dedupeKey: `support:${doc._id}`
      });
    } catch {
      /* non-blocking */
    }

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

// GET /api/support-requests
const listSupportRequests = async (req, res, next) => {
  try {
    const { storeId, status } = req.query;
    const filter = {};

    if (req.user.role === 'superadmin') {
      if (storeId) filter.storeId = storeId;
      if (status) filter.status = status;
    } else {
      filter.sellerId = req.user._id;
      if (storeId) filter.storeId = storeId;
      if (status) filter.status = status;
    }

    const rows = await SupportRequest.find(filter)
      .populate('storeId', 'name')
      .populate('sellerId', 'name phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/support-requests/:id
const patchSupportRequest = async (req, res, next) => {
  try {
    const { status, adminNote, requestedChanges } = req.body;
    if (status && !['pending', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const doc = await SupportRequest.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Support request not found' });
    }

    if (status) doc.status = status;
    if (adminNote != null) doc.adminNote = adminNote;
    if (requestedChanges && typeof requestedChanges === 'object') {
      doc.requestedChanges = { ...(doc.requestedChanges || {}), ...requestedChanges };
    }
    await doc.save();

    if (doc.status === 'resolved') {
      await applyRequestedChanges(doc);
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSupportRequest,
  listSupportRequests,
  patchSupportRequest,
  applyRequestedChanges,
  ALLOWED_TYPES
};
