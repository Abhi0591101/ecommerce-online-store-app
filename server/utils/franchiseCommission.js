const Franchise = require('../models/Franchise');
const ServiceArea = require('../models/ServiceArea');
const PlatformConfig = require('../models/PlatformConfig');

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Resolve active franchise that owns this delivery PIN.
 */
async function findFranchiseForPincode(pincode) {
  const pin = String(pincode || '').trim();
  if (!pin) return null;

  const area = await ServiceArea.findOne({
    pincode: pin,
    franchiseId: { $ne: null },
    $or: [{ pinCodeStatus: 'approved' }, { pinCodeStatus: { $exists: false } }],
    isActive: true
  }).populate('franchiseId');

  const fromArea = area?.franchiseId;
  if (fromArea && fromArea.status === 'approved' && fromArea.isActive !== false) {
    return fromArea;
  }

  return Franchise.findOne({
    status: 'approved',
    isActive: true,
    pinCodes: pin
  });
}

async function resolveCommissionPct(franchise) {
  const own = Number(franchise?.deliveryCommissionPct);
  if (Number.isFinite(own) && own > 0) return own;

  let cfg = await PlatformConfig.findOne({ key: 'default' }).lean();
  if (!cfg) cfg = { franchiseDeliveryCommissionPct: 5 };
  return Number(cfg.franchiseDeliveryCommissionPct ?? 5) || 0;
}

/**
 * Attach franchise + commission amount on a new delivery order (not posted to ledger yet).
 * Mutates order fields; caller saves.
 */
async function attachFranchiseCommissionToOrder(order) {
  if (!order || order.orderType === 'pickup') return order;
  const deliveryFee = Number(order.deliveryFee || 0);
  if (deliveryFee <= 0) {
    order.franchiseCommission = 0;
    return order;
  }

  const franchise = await findFranchiseForPincode(order.pincode);
  if (!franchise) {
    order.franchiseId = undefined;
    order.franchiseCommission = 0;
    return order;
  }

  const pct = await resolveCommissionPct(franchise);
  order.franchiseId = franchise._id;
  order.franchiseCommissionPct = pct;
  order.franchiseCommission = round2(deliveryFee * (pct / 100));
  return order;
}

/**
 * When order is completed, push pending ledger entry once (idempotent).
 */
async function postFranchiseCommissionOnComplete(order) {
  if (!order) return null;
  if (order.status !== 'completed') return order;
  if (order.franchiseCommissionPosted) return order;
  if (!order.franchiseId || !(Number(order.franchiseCommission) > 0)) return order;

  // Re-resolve if place-order missed franchise (older orders)
  if (!order.franchiseCommission && order.deliveryFee > 0 && order.pincode) {
    await attachFranchiseCommissionToOrder(order);
  }
  if (!(Number(order.franchiseCommission) > 0) || !order.franchiseId) return order;

  await Franchise.findByIdAndUpdate(order.franchiseId, {
    $push: {
      commissionLedger: {
        amount: round2(order.franchiseCommission),
        note: `Delivery commission · ${order.orderNumber}`,
        weekOf: new Date().toISOString().slice(0, 10),
        status: 'pending',
        at: new Date(),
        orderId: order._id,
        orderNumber: order.orderNumber
      }
    }
  });

  order.franchiseCommissionPosted = true;
  await order.save();

  try {
    const FranchiseNotification = require('../models/FranchiseNotification');
    await FranchiseNotification.create({
      franchiseId: order.franchiseId,
      type: 'payment',
      title: 'Delivery commission earned',
      body: `₹${round2(order.franchiseCommission)} on order ${order.orderNumber}`,
      meta: { orderId: order._id, orderNumber: order.orderNumber }
    });
  } catch {
    /* ignore */
  }

  return order;
}

module.exports = {
  findFranchiseForPincode,
  attachFranchiseCommissionToOrder,
  postFranchiseCommissionOnComplete,
  resolveCommissionPct
};
