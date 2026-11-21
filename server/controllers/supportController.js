const SupportRequest = require('../models/SupportRequest');
const Store = require('../models/Store');

const assertStoreOwner = async (user, storeId) => {
  const store = await Store.findById(storeId);
  if (!store) return { error: 'Store not found', code: 404 };
  if (user.role !== 'superadmin' && String(store.ownerId) !== String(user._id)) {
    return { error: 'Not your store', code: 403 };
  }
  return { store };
};

// POST /api/support-requests
const createSupportRequest = async (req, res, next) => {
  try {
    const { storeId, type, message, attachments = [] } = req.body;
    if (!storeId || !type || !message) {
      return res.status(400).json({
        success: false,
        message: 'storeId, type and message are required'
      });
    }
    const check = await assertStoreOwner(req.user, storeId);
    if (check.error) {
      return res.status(check.code).json({ success: false, message: check.error });
    }

    const doc = await SupportRequest.create({
      sellerId: req.user._id,
      storeId,
      type,
      message,
      attachments: Array.isArray(attachments) ? attachments : []
    });

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
    const { status, adminNote } = req.body;
    if (!['pending', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const doc = await SupportRequest.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Support request not found' });
    }

    doc.status = status;
    if (adminNote != null) doc.adminNote = adminNote;
    await doc.save();

    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

module.exports = { createSupportRequest, listSupportRequests, patchSupportRequest };