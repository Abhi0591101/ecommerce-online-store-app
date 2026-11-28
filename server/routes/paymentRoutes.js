const express = require('express');
const {
  getRazorpayConfig,
  createRazorpayOrder,
  verifyRazorpayPayment
} = require('../controllers/paymentController');

const router = express.Router();

router.get('/razorpay/config', getRazorpayConfig);
router.post('/razorpay/create-order', createRazorpayOrder);
router.post('/razorpay/verify', verifyRazorpayPayment);

module.exports = router;
