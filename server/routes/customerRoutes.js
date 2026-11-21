const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const c = require('../controllers/customerController');

const router = express.Router();

// Public
router.get('/cities', c.listEnabledCities);
router.get('/serviceability', c.checkServiceability);
router.get('/reviews/:productId', c.publicReviews);
router.get('/coupons/public', c.listCoupons);

router.use(protect, requireRole('customer', 'superadmin'));

router.get('/profile', c.getProfile);
router.patch('/profile', c.updateProfile);
router.post('/change-password', c.changePassword);
router.post('/delete-request', c.requestDeletion);

router.get('/addresses', c.listAddresses);
router.post('/addresses', c.addAddress);
router.patch('/addresses/:addrId', c.updateAddress);
router.delete('/addresses/:addrId', c.deleteAddress);

router.get('/wishlist', c.getWishlist);
router.post('/wishlist', c.addWishlist);
router.delete('/wishlist/:productId', c.removeWishlist);

router.get('/orders', c.myOrders);
router.post('/orders/:id/cancel-request', c.requestCancel);

router.get('/payments', c.paymentHistory);

router.get('/coupons', c.listCoupons);
router.post('/coupons/validate', c.validateCoupon);

router.get('/wallet', c.getWallet);
router.get('/referral', c.getReferral);

router.get('/notifications', c.listNotifications);
router.patch('/notifications/:id', c.markNotification);
router.post('/notifications/read-all', c.markAllNotifications);

router.get('/complaints', c.myComplaints);
router.post('/complaints', c.createCustomerComplaint);

router.get('/reviews', c.myReviews);
router.post('/reviews', c.submitReview);

router.get('/settings', c.getCustomerSettingsBundle);

module.exports = router;
