const express = require('express');
const { placeOrder, getOrders, updateOrderStatus } = require('../controllers/orderController');

const router = express.Router();

router.post('/', placeOrder);
router.get('/', getOrders);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
