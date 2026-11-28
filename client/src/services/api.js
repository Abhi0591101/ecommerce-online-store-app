import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
const TOKEN_KEY = 'hyperlocal_auth_token_v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  timeout: 12000
});

let lastOnline = true;

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setStoredToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    lastOnline = true;
    return response.data;
  },
  (error) => {
    const isNetwork =
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error');
    if (isNetwork) lastOnline = false;
    const message =
      error.response?.data?.message ||
      error.message ||
      'Request failed';
    const err = new Error(message);
    err.isNetwork = isNetwork;
    err.status = error.response?.status;
    return Promise.reject(err);
  }
);

// --- Auth ---
export const login = (payload) => api.post('/auth/login', payload);
export const sendPortalOtp = (payload) => api.post('/auth/send-otp', payload);
export const loginWithOtp = (payload) => api.post('/auth/login-otp', payload);
export const logoutApi = () => api.post('/auth/logout');
export const register = (payload) => api.post('/auth/register', payload);
export const fetchMe = () => api.get('/auth/me');
export const sendSellerOtp = (payload) => api.post('/auth/seller/send-otp', payload);
export const registerSeller = (payload) => api.post('/auth/seller/register', payload);
export const sendCustomerOtp = (payload) => api.post('/auth/customer/send-otp', payload);
export const registerCustomer = (payload) => api.post('/auth/customer/register', payload);
export const loginCustomerOtp = (payload) => api.post('/auth/customer/login-otp', payload);
export const resetCustomerPassword = (payload) =>
  api.post('/auth/customer/forgot-password', payload);

// --- Customer panel ---
export const getCustomerProfile = () => api.get('/customer/profile');
export const patchCustomerProfile = (payload) => api.patch('/customer/profile', payload);
export const changeCustomerPassword = (payload) => api.post('/customer/change-password', payload);
export const requestAccountDeletion = () => api.post('/customer/delete-request');
export const getCustomerAddresses = () => api.get('/customer/addresses');
export const addCustomerAddress = (payload) => api.post('/customer/addresses', payload);
export const patchCustomerAddress = (id, payload) => api.patch(`/customer/addresses/${id}`, payload);
export const deleteCustomerAddress = (id) => api.delete(`/customer/addresses/${id}`);
export const checkServiceability = (pincode) =>
  api.get('/customer/serviceability', { params: { pincode } });
export const getWishlist = () => api.get('/customer/wishlist');
export const addWishlist = (payload) => api.post('/customer/wishlist', payload);
export const removeWishlist = (productId) => api.delete(`/customer/wishlist/${productId}`);
export const getMyCustomerOrders = (params = {}) => api.get('/customer/orders', { params });
export const requestOrderCancel = (id, reason) =>
  api.post(`/customer/orders/${id}/cancel-request`, { reason });
export const getCustomerPayments = () => api.get('/customer/payments');
export const getCustomerCoupons = () => api.get('/customer/coupons');
export const getPublicCoupons = () => api.get('/customer/coupons/public');
export const validateCoupon = (payload) => api.post('/customer/coupons/validate', payload);
export const getCustomerWallet = () => api.get('/customer/wallet');
export const getCustomerReferral = () => api.get('/customer/referral');
export const getCustomerNotifications = () => api.get('/customer/notifications');
export const markCustomerNotification = (id, read = true) =>
  api.patch(`/customer/notifications/${id}`, { read });
export const markAllCustomerNotifications = () => api.post('/customer/notifications/read-all');
export const getCustomerComplaints = () => api.get('/customer/complaints');
export const createCustomerComplaint = (payload) => api.post('/customer/complaints', payload);
export const getMyReviews = () => api.get('/customer/reviews');
export const submitCustomerReview = (payload) => api.post('/customer/reviews', payload);
export const getPublicProductReviews = (productId) => api.get(`/customer/reviews/${productId}`);
export const getEnabledCities = () => api.get('/customer/cities');
export const getCustomerSettings = () => api.get('/customer/settings');

// --- Categories (Admin master; sellers only read active) ---
export const getCategories = (params = {}) => api.get('/categories', { params });
export const getCategoryTree = (includeInactive = false) =>
  api.get('/categories', {
    params: { tree: 1, ...(includeInactive ? { includeInactive: 1 } : {}) }
  });
export const createCategory = (payload) => api.post('/categories', payload);
export const updateCategory = (id, payload) => api.patch(`/categories/${id}`, payload);
export const setCategoryStatus = (id, isActive) =>
  api.patch(`/categories/${id}/status`, { isActive });
export const reorderCategories = (items) => api.patch('/categories/reorder', { items });
export const deleteCategory = (id, { cascade = true, force = false } = {}) =>
  api.delete(`/categories/${id}`, { params: { cascade: cascade ? 1 : 0, force: force ? 1 : 0 } });

// --- Stores ---
export const getStores = (params = {}) => api.get('/stores', { params });
export const getPendingStores = () => api.get('/stores/pending');
export const createStore = (payload) => api.post('/stores', payload);
export const updateStore = (id, payload) => api.patch(`/stores/${id}`, payload);
export const updateStoreKycStatus = (id, status) =>
  api.patch(`/stores/${id}/status`, { status });
export const toggleStoreStatus = (storeId) =>
  api.patch(`/stores/${storeId}/toggle-status`);

// --- Products ---
export const getProducts = (params = {}) => api.get('/products', { params });
export const getProductComparison = (productId, params = {}) =>
  api.get(`/products/${productId}/compare-stores`, { params });
export const createProduct = (payload) => api.post('/products', payload);
export const updateProduct = (id, payload) => api.patch(`/products/${id}`, payload);
export const deleteProduct = (id) => api.delete(`/products/${id}`);
export const getPendingProducts = () => api.get('/products/pending');
export const patchProductApproval = (id, approvalStatus, reason) =>
  api.patch(`/products/${id}/approval`, {
    approvalStatus,
    ...(reason ? { reason, decisionNote: reason } : {})
  });
export const upsertPricingMatrix = (payload) =>
  api.post('/products/pricing-matrix', payload);
export const updateStorePricing = (payload) =>
  api.patch('/products/pricing', payload);

// --- Seller panel ---
export const getMyStore = (params = {}) => api.get('/seller/my-store', { params });
export const getSellerDashboard = (params) => api.get('/seller/dashboard', { params });
export const getSellerReports = (params) => api.get('/seller/reports', { params });
export const getSellerProducts = (params) => api.get('/seller/products', { params });
export const getSupportRequests = (params = {}) => api.get('/support-requests', { params });
export const createSupportRequest = (payload) => api.post('/support-requests', payload);
export const updateSupportRequest = (id, payload) =>
  api.patch(`/support-requests/${id}`, payload);
export const getNotifications = (params = {}) => api.get('/notifications', { params });
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
export const getReviews = (params = {}) => api.get('/reviews', { params });
export const createReview = (payload) => api.post('/reviews', payload);

// --- Services ---
export const getServices = (params = {}) => api.get('/services', { params });
export const createService = (payload) => api.post('/services', payload);
export const updateService = (id, payload) => api.patch(`/services/${id}`, payload);
export const deleteService = (id) => api.delete(`/services/${id}`);

// --- Locations ---
export const getLocations = (params = {}) => api.get('/locations', { params });
export const reverseGeocode = (lat, lng) =>
  api.get('/locations/reverse', { params: { lat, lng }, timeout: 20000 });
export const createLocation = (payload) => api.post('/locations', payload);

// --- Riders ---
export const getRiders = (params = {}) => api.get('/riders', { params });
export const getPendingRiders = () => api.get('/riders/pending');
export const createRider = (payload) => api.post('/riders', payload);
export const updateRiderStatus = (id, status) =>
  api.patch(`/riders/${id}/status`, { status });
export const updateRiderDuty = (id, payload) =>
  api.patch(`/riders/${id}/duty`, payload);

// --- Orders ---
export const placeOrder = (orderData) => api.post('/orders', orderData);
export const getOrders = (params = {}) => api.get('/orders', { params });
export const updateOrderStatus = (orderIdOrNumber, status, extra = {}) =>
  api.patch(`/orders/${orderIdOrNumber}/status`, { status, ...extra });

// --- Payments (Razorpay) ---
export const getRazorpayConfig = () => api.get('/payments/razorpay/config');
export const createRazorpayOrder = (payload) =>
  api.post('/payments/razorpay/create-order', payload);
export const verifyRazorpayPayment = (payload) =>
  api.post('/payments/razorpay/verify', payload);

// --- Delivery ---
export const trackDelivery = (orderNumber) =>
  api.get(`/delivery/track/${orderNumber}`);
export const updateDeliveryLocation = (payload) =>
  api.post('/delivery/update-location', payload);
export const verifyDeliveryOtp = (payload) =>
  api.post('/delivery/verify-otp', payload);

// --- Public site ---
export const getPublicSettings = () => api.get('/public/settings');
export const getPublicBanners = (params = {}) => api.get('/public/banners', { params });

// --- Admin panel (superadmin) ---
export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAdminCustomers = () => api.get('/admin/customers');
export const getAdminCustomer = (id) => api.get(`/admin/customers/${id}`);
export const patchAdminCustomer = (id, payload) => api.patch(`/admin/customers/${id}`, payload);
export const getAdminSellers = (params = {}) => api.get('/admin/sellers', { params });
export const getAdminSeller = (id) => api.get(`/admin/sellers/${id}`);
export const patchAdminSeller = (id, payload) => api.patch(`/admin/sellers/${id}`, payload);
export const getAdminDeliveryPartners = (params = {}) =>
  api.get('/admin/delivery-partners', { params });
export const patchAdminDeliveryPartner = (id, payload) =>
  api.patch(`/admin/delivery-partners/${id}`, payload);
export const getAdminFranchises = () => api.get('/admin/franchises');
export const createAdminFranchise = (payload) => api.post('/admin/franchises', payload);
export const patchAdminFranchise = (id, payload) => api.patch(`/admin/franchises/${id}`, payload);
export const addFranchisePayment = (id, payload) =>
  api.post(`/admin/franchises/${id}/payments`, payload);
export const getAdminProducts = (params = {}) => api.get('/admin/products', { params });
export const getAdminOrders = (params = {}) => api.get('/admin/orders', { params });
export const patchAdminOrder = (id, payload) => api.patch(`/admin/orders/${id}`, payload);
export const getAdminPayments = (params = {}) => api.get('/admin/payments', { params });
export const getAdminCommission = (params = {}) => api.get('/admin/commission', { params });
export const patchAdminCommissionConfig = (payload) =>
  api.patch('/admin/commission/config', payload);
export const markCommissionPaid = (orderIds) =>
  api.post('/admin/commission/mark-paid', { orderIds });
export const getAdminReports = (params = {}) => api.get('/admin/reports', { params });
export const downloadAdminReportCsv = async (params = {}) => {
  const token = getStoredToken();
  const qs = new URLSearchParams({ ...params, format: 'csv' }).toString();
  const res = await fetch(`${API_BASE}/admin/reports?${qs}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' }
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `japto-${params.type || 'sales'}-${params.range || 'monthly'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
export const getAdminComplaints = (params = {}) => api.get('/admin/complaints', { params });
export const createAdminComplaint = (payload) => api.post('/admin/complaints', payload);
export const replyAdminComplaint = (id, payload) => api.patch(`/admin/complaints/${id}`, payload);
export const getAdminSettings = () => api.get('/admin/settings');
export const patchAdminSettings = (payload) => api.patch('/admin/settings', payload);
export const getAdminCoupons = () => api.get('/admin/coupons');
export const createAdminCoupon = (payload) => api.post('/admin/coupons', payload);
export const patchAdminCoupon = (id, payload) => api.patch(`/admin/coupons/${id}`, payload);
export const deleteAdminCoupon = (id) => api.delete(`/admin/coupons/${id}`);
export const getAdminBanners = () => api.get('/admin/banners');
export const createAdminBanner = (payload) => api.post('/admin/banners', payload);
export const patchAdminBanner = (id, payload) => api.patch(`/admin/banners/${id}`, payload);
export const deleteAdminBanner = (id) => api.delete(`/admin/banners/${id}`);
export const getAdminNotifications = () => api.get('/admin/notifications');
export const sendAdminNotification = (payload) => api.post('/admin/notifications', payload);
export const getAdminAlerts = () => api.get('/admin/alerts');
export const markAdminAlertRead = (id) => api.patch(`/admin/alerts/${id}/read`);
export const markAllAdminAlertsRead = () => api.post('/admin/alerts/read-all');
export const getAdminBadges = () => api.get('/admin/badges');
export const getAdminCities = () => api.get('/admin/cities');
export const createAdminCity = (payload) => api.post('/admin/cities', payload);
export const patchAdminCity = (id, payload) => api.patch(`/admin/cities/${id}`, payload);
export const getAdminDeliveryCharges = () => api.get('/admin/delivery-charges');
export const saveAdminDeliveryCharges = (payload) =>
  api.put('/admin/delivery-charges', payload);
export const getAdminTax = () => api.get('/admin/tax');
export const patchAdminTax = (payload) => api.patch('/admin/tax', payload);
export const getAdminEmailSettings = () => api.get('/admin/email-settings');
export const patchAdminEmailSettings = (payload) => api.patch('/admin/email-settings', payload);
export const getAdminEmailQueue = () => api.get('/admin/email-queue');
export const processAdminEmailQueue = () => api.post('/admin/email-queue/process');

// --- Delivery Boy panel ---
export const sendRiderOtp = (payload) => api.post('/delivery-boy/auth/send-otp', payload);
export const registerDeliveryBoy = (payload) => api.post('/delivery-boy/auth/register', payload);
export const loginRiderOtp = (payload) => api.post('/delivery-boy/auth/login-otp', payload);
export const loginRiderEmail = (payload) => api.post('/delivery-boy/auth/login-email', payload);
export const getRiderProfile = () => api.get('/delivery-boy/me');
export const patchRiderProfile = (payload) => api.patch('/delivery-boy/me', payload);
export const setRiderDutyApi = (payload) => api.patch('/delivery-boy/duty', payload);
export const getAvailableDeliveries = () => api.get('/delivery-boy/orders/available');
export const getMyDeliveries = (params = {}) => api.get('/delivery-boy/deliveries', { params });
export const acceptDeliveryApi = (id) => api.post(`/delivery-boy/deliveries/${id}/accept`);
export const rejectDeliveryApi = (id, reason) =>
  api.post(`/delivery-boy/deliveries/${id}/reject`, { reason });
export const patchDeliveryStatusApi = (id, status) =>
  api.patch(`/delivery-boy/deliveries/${id}/status`, { status });
export const confirmPickupApi = (id) => api.post(`/delivery-boy/deliveries/${id}/pickup`);
export const verifyDeliveryOtpApi = (id, otp) =>
  api.post(`/delivery-boy/deliveries/${id}/verify-otp`, { otp });
export const getRiderStats = () => api.get('/delivery-boy/stats');
export const getRiderNotifications = () => api.get('/delivery-boy/notifications');
export const markRiderNotificationRead = (id) =>
  api.patch(`/delivery-boy/notifications/${id}/read`);
export const markAllRiderNotificationsRead = () =>
  api.patch('/delivery-boy/notifications/read-all');
export const getRiderRequests = () => api.get('/delivery-boy/requests');
export const createRiderRequest = (payload) => api.post('/delivery-boy/requests', payload);

// --- Franchise panel ---
export const getFranchisePublicInfo = () => api.get('/franchise/public-info');
export const submitFranchiseApplication = (payload) => api.post('/franchise/apply', payload);
export const sendFranchiseOtp = (payload) => api.post('/franchise/auth/send-otp', payload);
export const loginFranchiseApi = (payload) => api.post('/franchise/auth/login', payload);
export const changeFranchisePassword = (payload) =>
  api.post('/franchise/auth/change-password', payload);
export const getFranchiseDashboard = () => api.get('/franchise/dashboard');
export const getFranchiseMe = () => api.get('/franchise/me');
export const patchFranchiseMe = (payload) => api.patch('/franchise/me', payload);
export const getFranchisePartners = () => api.get('/franchise/partners');
export const addFranchisePartner = (payload) => api.post('/franchise/partners', payload);
export const getFranchisePins = () => api.get('/franchise/pins');
export const requestFranchisePin = (payload) => api.post('/franchise/pins/request', payload);
export const getFranchiseCommission = () => api.get('/franchise/commission');
export const getFranchisePayments = () => api.get('/franchise/payments');
export const getFranchiseBank = () => api.get('/franchise/bank');
export const requestFranchiseBankChange = (payload) =>
  api.post('/franchise/bank/change-request', payload);
export const getFranchiseNotices = () => api.get('/franchise/notices');
export const markFranchiseNoticeRead = (id) => api.patch(`/franchise/notices/${id}/read`);
export const markAllFranchiseNoticesRead = () => api.patch('/franchise/notices/read-all');
export const contactFranchiseHeadOffice = (payload) =>
  api.post('/franchise/contact-head-office', payload);

export const isApiOnline = () => lastOnline;
export { API_BASE, TOKEN_KEY };

export default api;
