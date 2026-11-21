const express = require('express');
const {
  trackDelivery,
  updateLocation,
  verifyOtp
} = require('../controllers/deliveryController');

const router = express.Router();

router.get('/track/:orderNumber', trackDelivery);
router.post('/update-location', updateLocation);
router.post('/verify-otp', verifyOtp);

module.exports = router;
