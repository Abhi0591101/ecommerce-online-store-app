const express = require('express');
const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require('../controllers/notificationController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, requireRole('store_owner', 'superadmin'), listNotifications);
router.patch('/read-all', protect, requireRole('store_owner', 'superadmin'), markAllNotificationsRead);
router.patch('/:id/read', protect, requireRole('store_owner', 'superadmin'), markNotificationRead);

module.exports = router;