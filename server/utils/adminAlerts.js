const AdminAlert = require('../models/AdminAlert');
const Franchise = require('../models/Franchise');
const Store = require('../models/Store');
const Product = require('../models/Product');
const User = require('../models/User');
const ServiceArea = require('../models/ServiceArea');
const SupportRequest = require('../models/SupportRequest');
const Order = require('../models/Order');

/**
 * Create an admin inbox alert (deduped by dedupeKey when provided).
 */
const pushAdminAlert = async ({
  type,
  title,
  body,
  entityType = '',
  entityId = null,
  linkTab = 'dashboard',
  dedupeKey = ''
}) => {
  try {
    if (dedupeKey) {
      const existing = await AdminAlert.findOne({
        dedupeKey,
        resolved: false
      });
      if (existing) {
        existing.title = title;
        existing.body = body;
        existing.read = false;
        await existing.save();
        return existing;
      }
    }
    return await AdminAlert.create({
      type,
      title,
      body,
      entityType,
      entityId,
      linkTab,
      dedupeKey: dedupeKey || undefined,
      read: false,
      resolved: false
    });
  } catch (err) {
    console.warn('[adminAlerts] push failed:', err.message);
    return null;
  }
};

const resolveAlertsForEntity = async (entityId, types = []) => {
  if (!entityId) return;
  const filter = { entityId, resolved: false };
  if (types.length) filter.type = { $in: types };
  await AdminAlert.updateMany(filter, { resolved: true, read: true });
};

/** Ensure open pending work items have matching inbox alerts (backfill). */
const syncPendingAdminAlerts = async () => {
  const [
    pendingFr,
    pendingBank,
    pendingPins,
    pendingSellers,
    pendingRiders,
    pendingProducts,
    pendingSupport,
    pendingCancels
  ] = await Promise.all([
    Franchise.find({ status: 'pending' }).select('_id name ownerName applicationId phone').lean(),
    Franchise.find({ 'pendingBankChange.status': 'pending' })
      .select('_id name ownerName phone pendingBankChange')
      .lean(),
    ServiceArea.find({ franchiseId: { $ne: null }, pinCodeStatus: 'pending' })
      .select('_id pincode city franchiseId')
      .lean(),
    Store.find({ status: 'pending' }).select('_id name phone').lean(),
    User.find({ role: 'driver', status: 'pending' }).select('_id name phone').lean(),
    Product.find({ approvalStatus: 'pending' }).select('_id name').lean(),
    SupportRequest.find({ status: 'pending' }).select('_id type message storeId').lean(),
    Order.find({ 'cancellationRequest.status': 'pending' })
      .select('_id orderNumber cancellationRequest')
      .lean()
  ]);

  for (const f of pendingFr) {
    await pushAdminAlert({
      type: 'franchise_application',
      title: 'New franchise application',
      body: `${f.ownerName || f.name} (${f.phone}) — ${f.applicationId || f._id}`,
      entityType: 'franchise',
      entityId: f._id,
      linkTab: 'franchises',
      dedupeKey: `franchise_application:${f._id}`
    });
  }

  for (const f of pendingBank) {
    const b = f.pendingBankChange || {};
    await pushAdminAlert({
      type: 'franchise_bank',
      title: 'Franchise bank change request',
      body: `${f.name || f.ownerName}: ${b.accountHolder || '—'} · ${b.accountNumber || '—'} · ${b.ifsc || '—'}`,
      entityType: 'franchise',
      entityId: f._id,
      linkTab: 'franchises',
      dedupeKey: `franchise_bank:${f._id}:${b.requestedAt || 'pending'}`
    });
  }

  for (const p of pendingPins) {
    await pushAdminAlert({
      type: 'franchise_pin',
      title: 'Franchise PIN approval pending',
      body: `PIN ${p.pincode} · ${p.city || ''}`,
      entityType: 'service_area',
      entityId: p._id,
      linkTab: 'franchises_pins',
      dedupeKey: `franchise_pin:${p._id}`
    });
  }

  for (const s of pendingSellers) {
    await pushAdminAlert({
      type: 'seller_application',
      title: 'Seller application pending',
      body: `${s.name || 'Store'} (${s.phone || '—'})`,
      entityType: 'store',
      entityId: s._id,
      linkTab: 'sellers',
      dedupeKey: `seller_application:${s._id}`
    });
  }

  for (const r of pendingRiders) {
    await pushAdminAlert({
      type: 'rider_application',
      title: 'Delivery partner pending approval',
      body: `${r.name || 'Rider'} (${r.phone || '—'})`,
      entityType: 'user',
      entityId: r._id,
      linkTab: 'delivery',
      dedupeKey: `rider_application:${r._id}`
    });
  }

  for (const p of pendingProducts) {
    await pushAdminAlert({
      type: 'product_approval',
      title: 'Product pending approval',
      body: p.name || 'Product',
      entityType: 'product',
      entityId: p._id,
      linkTab: 'products_pending',
      dedupeKey: `product_approval:${p._id}`
    });
  }

  for (const s of pendingSupport) {
    await pushAdminAlert({
      type: 'support',
      title: `Seller support: ${s.type}`,
      body: String(s.message || '').slice(0, 160),
      entityType: 'support_request',
      entityId: s._id,
      linkTab: 'complaints',
      dedupeKey: `support:${s._id}`
    });
  }

  for (const o of pendingCancels) {
    await pushAdminAlert({
      type: 'order_cancel',
      title: 'Order cancellation request',
      body: `Order ${o.orderNumber}: ${o.cancellationRequest?.reason || '—'}`,
      entityType: 'order',
      entityId: o._id,
      linkTab: 'orders',
      dedupeKey: `order_cancel:${o._id}`
    });
  }

  return {
    franchisePendingApps: pendingFr.length,
    franchisePendingBank: pendingBank.length,
    franchisePendingPins: pendingPins.length,
    pendingSellers: pendingSellers.length,
    pendingRiders: pendingRiders.length,
    pendingProducts: pendingProducts.length,
    pendingSupport: pendingSupport.length,
    pendingCancels: pendingCancels.length
  };
};

const getAdminBadgeCounts = async () => {
  const pending = await syncPendingAdminAlerts();
  const unreadAlerts = await AdminAlert.countDocuments({ read: false, resolved: false });
  return {
    unreadAlerts,
    ...pending,
    franchiseTotal:
      pending.franchisePendingApps +
      pending.franchisePendingBank +
      pending.franchisePendingPins
  };
};

module.exports = {
  pushAdminAlert,
  resolveAlertsForEntity,
  syncPendingAdminAlerts,
  getAdminBadgeCounts
};
