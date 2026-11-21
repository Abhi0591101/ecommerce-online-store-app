const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const c = require('../controllers/deliveryBoyController');

const router = express.Router();

// Public auth
router.post('/auth/send-otp', c.sendRiderOtp);
router.post('/auth/register', c.registerRider);
router.post('/auth/login-otp', c.loginRiderOtp);
router.post('/auth/login-email', c.loginRiderEmail);

router.use(protect, requireRole('driver', 'superadmin'));

router.get('/me', c.getMyProfile);
router.patch('/me', c.updateMyProfile);
router.patch('/duty', c.setDuty);

router.get('/orders/available', c.listAvailableOrders);
router.get('/deliveries', c.listMyDeliveries);
router.post('/deliveries/:id/accept', c.acceptDelivery);
router.post('/deliveries/:id/reject', c.rejectDelivery);
router.patch('/deliveries/:id/status', c.updateDeliveryStatus);
router.post('/deliveries/:id/pickup', c.confirmPickup);
router.post('/deliveries/:id/verify-otp', c.verifyOtpComplete);

router.get('/stats', c.getHistoryStats);
router.get('/notifications', c.listNotifications);
router.patch('/notifications/:id/read', c.markNotificationRead);

router.get('/requests', c.listRequests);
router.post('/requests', c.createRequest);

// Admin oversight of rider requests
router.get('/admin/requests', requireRole('superadmin'), c.adminListRiderRequests);
router.patch('/admin/requests/:id', requireRole('superadmin'), c.adminDecideRiderRequest);

module.exports = router;
