const Order = require('../models/Order');
const {
  getKeys,
  isConfigured,
  getRazorpay,
  toPaise,
  verifyPaymentSignature,
  verifyWebhookSignature,
  mapRazorpayMethod
} = require('../utils/razorpayClient');
const { markVerified } = require('../utils/verifiedPayments');

/** GET /api/payments/razorpay/config — public key + enabled flag (no secret) */
const getRazorpayConfig = async (req, res, next) => {
  try {
    const configured = await isConfigured();
    const keys = await getKeys();
    res.json({
      success: true,
      data: {
        enabled: configured,
        keyId: configured ? keys.keyId : '',
        currency: 'INR',
        companyName: keys.companyName || 'Japto.in'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve payable INR from purpose so clients cannot underpay fees.
 * purpose: checkout | seller_registration | franchise_registration
 */
const resolvePayableAmount = async (reqBody = {}) => {
  const purpose = String(reqBody.purpose || 'checkout').trim();
  if (purpose === 'seller_registration' || purpose === 'franchise_registration') {
    const PlatformConfig = require('../models/PlatformConfig');
    const cfg = (await PlatformConfig.findOne({ key: 'default' }).lean()) || {};
    if (purpose === 'seller_registration') {
      const fee = Number(cfg.sellerRegistrationFee);
      return {
        purpose,
        amount: Number.isFinite(fee) && fee >= 0 ? fee : 216
      };
    }
    const fee = Number(cfg.franchiseRegistrationFee);
    return {
      purpose,
      amount: Number.isFinite(fee) && fee >= 0 ? fee : 500
    };
  }
  const amount = Number(reqBody.amount);
  return { purpose: purpose || 'checkout', amount };
};

/**
 * POST /api/payments/razorpay/create-order
 */
const createRazorpayOrder = async (req, res, next) => {
  try {
    if (!(await isConfigured())) {
      return res.status(503).json({
        success: false,
        message:
          'Razorpay not configured. Admin → Settings → enter Razorpay Key Id and Key Secret, then Save.'
      });
    }
    const resolved = await resolvePayableAmount(req.body || {});
    const amount = Number(resolved.amount);
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({
        success: false,
        message:
          amount === 0
            ? 'Fee is ₹0 — payment not required'
            : 'amount (INR) must be at least 1'
      });
    }
    const amountPaise = toPaise(amount);
    const receipt = `japto_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`.slice(
      0,
      40
    );
    const rzp = await getRazorpay();
    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        source: `japto_${resolved.purpose}`,
        purpose: resolved.purpose,
        customerName: String(req.body.customerName || '').slice(0, 80),
        customerPhone: String(req.body.customerPhone || '').slice(0, 20)
      }
    });
    const keys = await getKeys();
    res.status(201).json({
      success: true,
      data: {
        keyId: keys.keyId,
        purpose: resolved.purpose,
        razorpayOrderId: order.id,
        amount: order.amount,
        amountRupees: amountPaise / 100,
        currency: order.currency,
        receipt: order.receipt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/razorpay/verify
 */
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    if (!(await isConfigured())) {
      return res.status(503).json({
        success: false,
        message: 'Razorpay is not configured'
      });
    }
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required'
      });
    }

    const ok = await verifyPaymentSignature({ orderId, paymentId, signature });
    if (!ok) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    let method = 'ONLINE';
    let amountPaise = null;
    try {
      const rzp = await getRazorpay();
      const payment = await rzp.payments.fetch(paymentId);
      method = mapRazorpayMethod(payment.method);
      amountPaise = Number(payment.amount);
      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        return res.status(400).json({
          success: false,
          message: `Payment not successful (status: ${payment.status})`
        });
      }
    } catch {
      if (req.body.amount != null) amountPaise = toPaise(req.body.amount);
    }

    markVerified(paymentId, {
      amountPaise,
      orderId,
      method
    });

    res.json({
      success: true,
      data: {
        verified: true,
        paymentId,
        razorpayOrderId: orderId,
        paymentMode: method,
        paymentTxnId: paymentId
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/razorpay/webhook
 */
const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const raw =
      Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

    const keys = await getKeys();
    if (keys.webhookSecret) {
      const ok = await verifyWebhookSignature(raw, signature);
      if (!ok) {
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const payload = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body;
    const event = payload?.event;
    const payment = payload?.payload?.payment?.entity;

    if (event === 'payment.captured' && payment?.id) {
      markVerified(payment.id, {
        amountPaise: Number(payment.amount),
        orderId: payment.order_id || '',
        method: mapRazorpayMethod(payment.method)
      });

      const order = await Order.findOne({
        $or: [
          { paymentTxnId: payment.id },
          { razorpayPaymentId: payment.id },
          { razorpayOrderId: payment.order_id }
        ]
      });
      if (order && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.paymentTxnId = payment.id;
        order.razorpayPaymentId = payment.id;
        if (payment.order_id) order.razorpayOrderId = payment.order_id;
        order.paymentMode = mapRazorpayMethod(payment.method);
        await order.save();
      }
    }

    if (event === 'payment.failed' && payment?.id) {
      const order = await Order.findOne({
        $or: [{ razorpayOrderId: payment.order_id }, { paymentTxnId: payment.id }]
      });
      if (order && order.paymentStatus === 'pending') {
        order.paymentStatus = 'failed';
        await order.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error.message);
    res.status(500).json({ success: false, message: 'Webhook handler error' });
  }
};

module.exports = {
  getRazorpayConfig,
  createRazorpayOrder,
  verifyRazorpayPayment,
  razorpayWebhook
};
