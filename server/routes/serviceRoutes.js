const express = require('express');
const {
  getServices,
  createService,
  updateService,
  deleteService
} = require('../controllers/serviceController');
const { protect, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', getServices);
router.post('/', optionalAuth, createService);
router.patch('/:id', protect, requireRole('superadmin'), updateService);
router.delete('/:id', protect, requireRole('superadmin'), deleteService);

module.exports = router;
