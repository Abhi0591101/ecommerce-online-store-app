const express = require('express');
const {
  getRiders,
  getPendingRiders,
  createRider,
  updateRiderStatus,
  updateRiderDuty
} = require('../controllers/riderController');
const { protect, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', getRiders);
router.get('/pending', protect, requireRole('superadmin'), getPendingRiders);
router.post('/', optionalAuth, createRider);
router.patch('/:id/status', protect, requireRole('superadmin'), updateRiderStatus);
router.patch('/:id/duty', optionalAuth, updateRiderDuty);

module.exports = router;
