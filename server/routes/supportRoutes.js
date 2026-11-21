const express = require('express');
const {
  createSupportRequest,
  listSupportRequests,
  patchSupportRequest
} = require('../controllers/supportController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, requireRole('store_owner', 'superadmin'), listSupportRequests);
router.post('/', protect, requireRole('store_owner'), createSupportRequest);
router.patch('/:id', protect, requireRole('superadmin'), patchSupportRequest);

module.exports = router;