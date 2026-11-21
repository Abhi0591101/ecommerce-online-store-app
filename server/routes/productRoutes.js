const express = require('express');
const {
  getProducts,
  compareStores,
  createProduct,
  updateProduct,
  deleteProduct,
  upsertPricingMatrix,
  updateStorePricing,
  getPendingProducts,
  patchProductApproval
} = require('../controllers/productController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', getProducts);
router.get('/pending', protect, requireRole('superadmin'), getPendingProducts);
router.patch('/:id/approval', protect, requireRole('superadmin'), patchProductApproval);
router.post('/', protect, requireRole('superadmin', 'store_owner'), createProduct);
router.post('/pricing-matrix', protect, requireRole('superadmin', 'store_owner'), upsertPricingMatrix);
router.patch('/pricing', protect, requireRole('superadmin', 'store_owner'), updateStorePricing);
router.patch('/:id', protect, requireRole('superadmin', 'store_owner'), updateProduct);
router.delete('/:id', protect, requireRole('superadmin', 'store_owner'), deleteProduct);
router.get('/:id/compare-stores', compareStores);

module.exports = router;
