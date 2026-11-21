const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const Store = require('../models/Store');
const StoreProductPricing = require('../models/StoreProductPricing');
const { notifyNewOrder, notifyOrderCancel } = require('../utils/sellerNotifications');

const generateOrderNumber = () => {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  const suffix = Math.floor(100 + Math.random() * 900);
  return `ORD-${hex}${suffix}`;
};

const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));

// POST /api/orders
const placeOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      storeId,
      items,
      orderType = 'delivery',
      timeSlot,
      customerName,
      customerPhone,
      deliveryAddress,
      pincode = '201301',
      paymentMode = 'COD',
      customerId,
      deliveryFee: clientDeliveryFee,
      couponCode = '',
      discountAmount = 0,
      walletUsed = 0,
      paymentTxnId = ''
    } = req.body;

    if (!storeId || !Array.isArray(items) || items.length === 0) {
      const err = new Error('storeId and items are required');
      err.statusCode = 400;
      throw err;
    }

    if (!customerName || !customerPhone || !deliveryAddress) {
      const err = new Error('customerName, customerPhone and deliveryAddress are required');
      err.statusCode = 400;
      throw err;
    }

    const store = await Store.findById(storeId).session(session);
    if (!store) {
      const err = new Error('Fulfilling store not found');
      err.statusCode = 404;
      throw err;
    }
    if (!store.isOnline || store.status !== 'approved') {
      const err = new Error('Store is currently offline or unavailable');
      err.statusCode = 400;
      throw err;
    }

    const orderItems = [];
    let itemsTotal = 0;

    for (const item of items) {
      const quantity = Number(item.quantity) || 1;
      const productId = item.productId;

      const pricing = await StoreProductPricing.findOneAndUpdate(
        {
          storeId,
          productId,
          isAvailable: true,
          stockQuantity: { $gte: quantity }
        },
        { $inc: { stockQuantity: -quantity } },
        { session, new: true }
      );

      if (!pricing) {
        const err = new Error(`Out of stock: ${item.productName || item.name || productId}`);
        err.statusCode = 400;
        throw err;
      }

      const unitPrice = Number(item.unitPrice ?? item.price ?? pricing.price);
      const totalPrice = unitPrice * quantity;
      itemsTotal += totalPrice;

      orderItems.push({
        productId,
        productName: item.productName || item.name,
        unitSpec: item.unitSpec || item.unit || '1 Unit',
        quantity,
        unitPrice,
        totalPrice
      });
    }

    const { getOrCreateConfig } = require('./adminController');
    const cfg = await getOrCreateConfig();

    let deliveryFee = 0;
    if (orderType === 'delivery') {
      const pin = String(pincode || req.body.pincode || '').trim();
      const city = String(store.city || req.body.city || '').trim();
      const rules = (cfg.deliveryCharges || []).filter((r) => r.isActive !== false);
      const byPin = pin
        ? rules.find((r) => r.pincode && String(r.pincode) === pin)
        : null;
      const byCity = city
        ? rules.find((r) => r.city && String(r.city).toLowerCase() === city.toLowerCase())
        : null;
      const fallbackRule = rules.find((r) => !r.city && !r.pincode) || rules[0];
      const rule = byPin || byCity || fallbackRule;

      if (rule) {
        if (rule.freeDeliveryAbove > 0 && itemsTotal >= rule.freeDeliveryAbove) {
          deliveryFee = 0;
        } else {
          deliveryFee = Number(rule.charge) || 0;
        }
      } else if (typeof clientDeliveryFee === 'number') {
        deliveryFee = clientDeliveryFee;
      } else if (store.freeDeliveryAbove > 0 && itemsTotal >= store.freeDeliveryAbove) {
        deliveryFee = 0;
      } else {
        deliveryFee = store.baseDeliveryFee || 0;
      }
    }

    const discount = Math.max(0, Number(discountAmount) || 0);
    const wallet = Math.max(0, Number(walletUsed) || 0);
    const grandTotal = Math.max(0, itemsTotal + deliveryFee - discount - wallet);
    const commissionPct = Number(cfg.sellerCommissionPct ?? 1) / 100;
    const gstPct = Number(cfg.defaultGstPct ?? 0);
    const platformFee = Math.round(itemsTotal * commissionPct * 100) / 100;
    const sellerEarning = Math.round((itemsTotal - platformFee) * 100) / 100;
    const gstAmount = Math.round(itemsTotal * (gstPct / 100) * 100) / 100;

    if (couponCode) {
      const Coupon = require('../models/Coupon');
      await Coupon.updateOne(
        { code: String(couponCode).toUpperCase(), isActive: true },
        { $inc: { usageCount: 1 } },
        { session }
      );
    }

    const otpCode = generateOtp();
    const orderNumber = generateOrderNumber();

    const [order] = await Order.create([{
      orderNumber,
      customerId: customerId || undefined,
      storeId,
      orderType,
      timeSlot: timeSlot || (orderType === 'pickup'
        ? '🏬 Instant Store Pickup (Ready in 15 mins)'
        : '⚡ Express Delivery (15-25 Mins)'),
      customerName,
      customerPhone,
      deliveryAddress,
      pincode,
      items: orderItems,
      itemsTotal,
      deliveryFee,
      grandTotal,
      platformFee,
      sellerEarning,
      gstAmount,
      gstPct,
      paymentMode,
      paymentStatus: paymentMode === 'COD' ? 'pending' : 'pending',
      paymentTxnId: paymentTxnId || '',
      couponCode: couponCode ? String(couponCode).toUpperCase() : '',
      discountAmount: discount,
      walletUsed: wallet,
      status: orderType === 'pickup' ? 'accepted' : 'placed',
      otpCode
    }], { session });

    if (wallet > 0 && customerId) {
      const User = require('../models/User');
      const WalletLedger = require('../models/WalletLedger');
      const user = await User.findById(customerId).session(session);
      if (user && (user.walletBalance || 0) >= wallet) {
        user.walletBalance = Math.round(((user.walletBalance || 0) - wallet) * 100) / 100;
        await user.save({ session });
        await WalletLedger.create(
          [
            {
              userId: user._id,
              type: 'debit',
              amount: wallet,
              balanceAfter: user.walletBalance,
              reason: 'Order payment',
              orderId: order._id
            }
          ],
          { session }
        );
      }
    }

    if (customerId) {
      try {
        const { pushNotify } = require('./customerController');
        await pushNotify(customerId, {
          type: 'order_placed',
          title: 'Order placed',
          body: `Order ${order.orderNumber} placed successfully.`,
          meta: { orderId: order._id, orderNumber: order.orderNumber }
        });
      } catch {
        /* ignore */
      }
    }

    const [lng, lat] = store.location?.coordinates || [77.3649, 28.6280];

    await Delivery.create([{
      orderId: order._id,
      status: 'offered',
      deliveryCharge: deliveryFee || 30,
      packageCount: orderItems.length || 1,
      statusHistory: [{ status: 'offered', at: new Date() }],
      currentLat: lat,
      currentLng: lng,
      etaMins: store.estDeliveryMins || 15,
      distanceRemainingKm: 1.5,
      lastPingAt: new Date()
    }], { session });

    await session.commitTransaction();

    const populated = await Order.findById(order._id)
      .populate('storeId', 'name photoUrl phone address pincode city location');

    await notifyNewOrder(order, store);

    const io = req.app.get('io');
    if (io) {
      const payload = populated?.toObject ? populated.toObject() : order.toObject();
      io.to(`store_${storeId}`).emit('order:new', payload);
      io.emit('order:placed', payload);
    }

    res.status(201).json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
        otpCode: order.otpCode,
        status: order.status,
        orderId: order._id,
        deliveryFee: order.deliveryFee,
        itemsTotal: order.itemsTotal,
        orderType: order.orderType,
        timeSlot: order.timeSlot,
        storeId: order.storeId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress
      }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// GET /api/orders
const getOrders = async (req, res, next) => {
  try {
    const { customerId, storeId, phone, status } = req.query;
    const filter = {};

    if (customerId) filter.customerId = customerId;
    if (storeId) filter.storeId = storeId;
    if (phone) filter.customerPhone = phone;
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('storeId', 'name photoUrl phone address pincode city location')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, deliveryMethod } = req.body;
    const allowed = [
      'placed',
      'accepted',
      'packing',
      'out_for_delivery',
      'ready_for_pickup',
      'completed',
      'cancelled',
      'rejected'
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    let order = null;
    if (mongoose.isValidObjectId(req.params.id)) {
      order = await Order.findById(req.params.id).populate(
        'storeId',
        'name photoUrl phone address pincode city location'
      );
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: req.params.id }).populate(
        'storeId',
        'name photoUrl phone address pincode city location'
      );
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const prevStatus = order.status;
    order.status = status;
    if (deliveryMethod === 'japto' || deliveryMethod === 'seller_own') {
      order.deliveryMethod = deliveryMethod;
    }
    await order.save();

    if (status === 'cancelled' && prevStatus !== 'cancelled') {
      const storeDoc = await Store.findById(order.storeId._id || order.storeId);
      if (storeDoc) await notifyOrderCancel(order, storeDoc);
    }

    const io = req.app.get('io');
    if (io) {
      const payload = order.toObject();
      io.to(`store_${order.storeId._id || order.storeId}`).emit('order:status', payload);
      io.to(`order_${order._id}`).emit('order:status', payload);

      // Ready for pickup → ping all on-duty riders
      if (status === 'ready_for_pickup') {
        io.to('riders').emit('order:radar', {
          ...payload,
          payout: Math.floor(45 + (order.deliveryFee || 15) * 1.5)
        });
      }
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

module.exports = { placeOrder, getOrders, updateOrderStatus };
