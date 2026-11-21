const express = require('express');
const {
  getLocations,
  reverseGeocode,
  createLocation,
  updateLocation
} = require('../controllers/locationController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/reverse', reverseGeocode);
router.get('/', getLocations);
router.post('/', protect, requireRole('superadmin'), createLocation);
router.patch('/:id', protect, requireRole('superadmin'), updateLocation);

module.exports = router;
