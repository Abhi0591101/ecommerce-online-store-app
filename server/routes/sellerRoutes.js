const express = require('express');
const {
  getDashboard,
  getReports,
  getSellerProducts,
  getMyStore
} = require('../controllers/sellerController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/my-store', protect, requireRole('store_owner', 'superadmin'), getMyStore);
router.get('/dashboard', protect, requireRole('store_owner', 'superadmin'), getDashboard);
router.get('/reports', protect, requireRole('store_owner', 'superadmin'), getReports);
router.get('/products', protect, requireRole('store_owner', 'superadmin'), getSellerProducts);

module.exports = router;