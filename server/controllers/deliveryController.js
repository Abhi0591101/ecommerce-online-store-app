const mongoose = require('mongoose');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');

// GET /api/delivery/track/:orderNumber
const trackDelivery = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber })
      .populate('storeId', 'name photoUrl address pincode city location phone rating');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const delivery = await Delivery.findOne({ orderId: order._id })
      .populate('driverId', 'name phone avatarUrl');

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery record not found' });
    }

    const [storeLng, storeLat] = order.storeId?.location?.coordinates || [];

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        orderType: order.orderType,
        otpCode: order.otpCode,
        grandTotal: order.grandTotal,
        paymentMode: order.paymentMode,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        pincode: order.pincode,
        items: order.items,
        store: order.storeId
          ? {
              _id: order.storeId._id,
              name: order.storeId.name,
              photoUrl: order.storeId.photoUrl,
              address: order.storeId.address,
              phone: order.storeId.phone,
              rating: order.storeId.rating,
              lat: storeLat,
              lng: storeLng
            }
          : null,
        delivery: {
          _id: delivery._id,
          status: delivery.status,
          driverName: delivery.driverName,
          driverPhone: delivery.driverPhone,
          driverVehicle: delivery.driverVehicle,
          currentLat: delivery.currentLat,
          currentLng: delivery.currentLng,
          etaMins: delivery.etaMins,
          distanceRemainingKm: delivery.distanceRemainingKm,
          lastPingAt: delivery.lastPingAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/delivery/update-location
const updateLocation = async (req, res, next) => {
  try {
    const { orderId, orderNumber, lat, lng, etaMins, distanceKm } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }

    let order = null;
    if (orderId && mongoose.isValidObjectId(orderId)) {
      order = await Order.findById(orderId);
    }
    if (!order && orderNumber) {
      order = await Order.findOne({ orderNumber });
    }
    if (!orderId && !orderNumber) {
      return res.status(400).json({ success: false, message: 'orderId or orderNumber is required' });
    }
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let delivery = await Delivery.findOne({ orderId: order._id });
    if (!delivery) {
      delivery = await Delivery.create({
        orderId: order._id,
        status: 'out_for_delivery',
        currentLat: Number(lat),
        currentLng: Number(lng),
        etaMins: etaMins !== undefined ? Number(etaMins) : 8,
        lastPingAt: new Date()
      });
    }

    delivery.currentLat = Number(lat);
    delivery.currentLng = Number(lng);
    if (etaMins !== undefined) delivery.etaMins = Number(etaMins);
    if (distanceKm !== undefined) delivery.distanceRemainingKm = Number(distanceKm);
    delivery.lastPingAt = new Date();
    if (delivery.status === 'assigned' || delivery.status === 'picked_up') {
      delivery.status = 'out_for_delivery';
    }
    await delivery.save();

    const locationPayload = {
      orderId: delivery.orderId,
      lat: delivery.currentLat,
      lng: delivery.currentLng,
      etaMins: delivery.etaMins,
      distanceRemainingKm: delivery.distanceRemainingKm,
      status: delivery.status,
      lastPingAt: delivery.lastPingAt
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`order_${delivery.orderId}`).emit('delivery:location', locationPayload);
      io.to(`order_${delivery.orderId}`).emit('driver:location', locationPayload);
      if (order.orderNumber) {
        io.to(`order_${order.orderNumber}`).emit('delivery:location', locationPayload);
        io.to(`order_${order.orderNumber}`).emit('driver:location', locationPayload);
      }
    }

    res.json({
      success: true,
      data: {
        orderId: delivery.orderId,
        currentLat: delivery.currentLat,
        currentLng: delivery.currentLng,
        etaMins: delivery.etaMins,
        distanceRemainingKm: delivery.distanceRemainingKm,
        status: delivery.status,
        lastPingAt: delivery.lastPingAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/delivery/verify-otp
const verifyOtp = async (req, res, next) => {
  try {
    const { orderNumber, orderId, otpCode, otp } = req.body;
    const code = otpCode || otp;

    if ((!orderNumber && !orderId) || !code) {
      return res.status(400).json({ success: false, message: 'orderNumber and otpCode are required' });
    }

    let order = null;
    if (orderNumber) order = await Order.findOne({ orderNumber });
    if (!order && orderId) order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.otpCode !== String(code)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    order.status = 'completed';
    order.paymentStatus = order.paymentMode === 'COD' ? 'paid' : order.paymentStatus;
    await order.save();
    try {
      const { postFranchiseCommissionOnComplete } = require('../utils/franchiseCommission');
      await postFranchiseCommissionOnComplete(order);
    } catch {
      /* ignore */
    }

    const delivery = await Delivery.findOneAndUpdate(
      { orderId: order._id },
      { status: 'delivered', lastPingAt: new Date() },
      { new: true }
    );

    const completedPayload = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      storeId: order.storeId,
      status: order.status,
      deliveryStatus: delivery?.status || 'delivered',
      otpVerified: true
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`order_${order._id}`).emit('delivery:completed', completedPayload);
      io.to(`order_${order._id}`).emit('order:completed', completedPayload);
      io.to(`store_${order.storeId}`).emit('order:completed', completedPayload);
      io.emit('order:completed', completedPayload);
    }

    res.json({
      success: true,
      message: 'Delivery completed successfully',
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryStatus: delivery?.status
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { trackDelivery, updateLocation, verifyOtp };
