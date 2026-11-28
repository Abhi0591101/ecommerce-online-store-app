const express = require('express');
const {
  getStores,
  getPendingStores,
  createStore,
  updateStoreKycStatus,
  toggleStoreStatus,
  updateStore
} = require('../controllers/storeController');
const { protect, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, getStores);
router.get('/pending', protect, requireRole('superadmin'), getPendingStores);
router.post('/', optionalAuth, createStore);
router.patch(
  '/:id/toggle-status',
  protect,
  requireRole('superadmin', 'store_owner'),
  toggleStoreStatus
);
router.patch('/:id/status', protect, requireRole('superadmin'), updateStoreKycStatus);
router.patch('/:id', protect, requireRole('superadmin', 'store_owner'), updateStore);

module.exports = router;
