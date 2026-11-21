const express = require('express');
const { listReviews, createReview } = require('../controllers/reviewController');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, listReviews);
router.post('/', createReview);

module.exports = router;