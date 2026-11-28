const express = require('express');
const {
  login,
  loginWithOtp,
  sendPortalOtp,
  register,
  logout,
  me
} = require('../controllers/authController');
const { sendSellerOtp, registerSeller } = require('../controllers/sellerAuthController');
const {
  sendCustomerOtp,
  registerCustomer,
  loginCustomerOtp,
  resetCustomerPassword
} = require('../controllers/customerAuthController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/send-otp', sendPortalOtp);
router.post('/login-otp', loginWithOtp);
router.post('/logout', protect, logout);
router.post('/register', register);
router.post('/seller/send-otp', sendSellerOtp);
router.post('/seller/register', registerSeller);
router.post('/customer/send-otp', sendCustomerOtp);
router.post('/customer/register', registerCustomer);
router.post('/customer/login-otp', loginCustomerOtp);
router.post('/customer/forgot-password', resetCustomerPassword);
router.get('/me', protect, me);

module.exports = router;
