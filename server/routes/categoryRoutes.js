const express = require('express');
const {
  getCategories,
  createCategory,
  updateCategory,
  setCategoryStatus,
  reorderCategories,
  deleteCategory
} = require('../controllers/categoryController');
const { protect, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public browse (active only by default); inactive visible to Super Admin via optionalAuth
router.get('/', optionalAuth, getCategories);

// Super Admin only — category / subcategory master
router.post('/', protect, requireRole('superadmin'), createCategory);
router.patch('/reorder', protect, requireRole('superadmin'), reorderCategories);
router.patch('/:id/status', protect, requireRole('superadmin'), setCategoryStatus);
router.patch('/:id', protect, requireRole('superadmin'), updateCategory);
router.delete('/:id', protect, requireRole('superadmin'), deleteCategory);

module.exports = router;
