const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const c = require('../controllers/franchiseController');

const router = express.Router();

// Public
router.get('/public-info', c.getPublicInfo);
router.post('/apply', c.submitApplication);
router.post('/auth/send-otp', c.sendFranchiseOtp);
router.post('/auth/login', c.loginFranchise);
/** Forgot password — public (OTP + new password); also available while logged in */
router.post('/auth/change-password', c.changePasswordOtp);

router.use(protect, requireRole('franchise', 'superadmin'));
router.get('/dashboard', c.getDashboard);
router.get('/me', c.getMyProfile);
router.patch('/me', c.updateProfile);

router.get('/partners', c.listPartners);
router.post('/partners', c.addPartner);

router.get('/pins', c.listPinCodes);
router.post('/pins/request', c.requestPinCode);

router.get('/commission', c.getCommissionLedger);
router.get('/payments', c.getPaymentHistory);

router.get('/bank', c.getBankDetails);
router.post('/bank/change-request', c.requestBankChange);

router.get('/notices', c.listNotices);
router.patch('/notices/read-all', c.markAllNoticesRead);
router.patch('/notices/:id/read', c.markNoticeRead);
router.post('/contact-head-office', c.contactHeadOffice);

module.exports = router;
