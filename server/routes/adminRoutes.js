const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const c = require('../controllers/adminController');

const router = express.Router();

router.use(protect, requireRole('superadmin'));

// 1 Dashboard
router.get('/dashboard', c.getDashboard);

// 2 Customers
router.get('/customers', c.listCustomers);
router.get('/customers/:id', c.getCustomerDetail);
router.patch('/customers/:id', c.updateCustomerStatus);

// 3 Sellers
router.get('/sellers', c.listSellers);
router.get('/sellers/:id', c.getSellerDetail);
router.patch('/sellers/:id', c.updateSellerAdmin);

// 4 Delivery
router.get('/delivery-partners', c.listDeliveryPartners);
router.patch('/delivery-partners/:id', c.updateDeliveryPartner);

// 5 Franchise
router.get('/franchises', c.listFranchises);
router.post('/franchises', c.createFranchise);
router.patch('/franchises/:id', c.updateFranchise);
router.post('/franchises/:id/payments', c.addFranchisePayment);

// 6 Products
router.get('/products', c.listProductsAdmin);

// 7 Orders
router.get('/orders', c.listOrdersAdmin);
router.patch('/orders/:id', c.updateOrderAdmin);

// 8 Payments
router.get('/payments', c.listPayments);

// 9 Commission
router.get('/commission', c.getCommission);
router.patch('/commission/config', c.updateCommissionConfig);
router.post('/commission/mark-paid', c.markCommissionPaid);

// 10 Reports
router.get('/reports', c.getReports);

// 11 Complaints
router.get('/complaints', c.listComplaints);
router.post('/complaints', c.createComplaint);
router.patch('/complaints/:id', c.replyComplaint);

// 12 Settings (also public GET via separate route below pattern — admin update here)
router.get('/settings', c.getSettings);
router.patch('/settings', c.updateSettings);

// 13 Coupons
router.get('/coupons', c.listCoupons);
router.post('/coupons', c.createCoupon);
router.patch('/coupons/:id', c.updateCoupon);
router.delete('/coupons/:id', c.deleteCoupon);

// 14 Banners
router.get('/banners', c.listBanners);
router.post('/banners', c.createBanner);
router.patch('/banners/:id', c.updateBanner);
router.delete('/banners/:id', c.deleteBanner);

// 15 Notifications (outbound broadcast) + inbox alerts (bell)
router.get('/notifications', c.listAdminNotifications);
router.post('/notifications', c.sendAdminNotification);
router.get('/alerts', c.listAdminAlerts);
router.patch('/alerts/:id/read', c.markAdminAlertRead);
router.post('/alerts/read-all', c.markAllAdminAlertsRead);
router.get('/badges', c.getAdminBadges);

// 16 Cities
router.get('/cities', c.listCities);
router.post('/cities', c.createCity);
router.patch('/cities/:id', c.updateCity);

// 17 Delivery charges
router.get('/delivery-charges', c.getDeliveryCharges);
router.put('/delivery-charges', c.saveDeliveryCharges);

// 18 Tax
router.get('/tax', c.getTaxConfig);
router.patch('/tax', c.updateTaxConfig);

// Email SMTP + templates + queue
router.get('/email-settings', c.getEmailSettings);
router.patch('/email-settings', c.updateEmailSettings);
router.get('/email-queue', c.listEmailQueue);
router.post('/email-queue/process', c.processEmailQueue);

module.exports = router;
