// HyperLocal Frontend-to-Backend REST API Bridge
// Fully connected with MariaDB/MySQL Database (Port 3307) & PHP REST Backend

class ApiService {
  constructor() {
    this.BASE_URL = 'api';
    this.isBackendAvailable = true;
  }

  async request(endpoint, options = {}) {
    try {
      const url = `${this.BASE_URL}/${endpoint.replace(/^\//, '')}`;
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      const response = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorBody.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (err) {
      console.warn(`[ApiService] Request to ${endpoint} failed, falling back to reactive state:`, err.message);
      return null;
    }
  }

  // --- Categories ---
  async getCategories() {
    return await this.request('categories');
  }

  async createCategory(categoryData) {
    return await this.request('categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  }

  // --- Stores ---
  async getStores(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`stores${query ? '?' + query : ''}`);
  }

  async createStore(storeData) {
    return await this.request('stores', {
      method: 'POST',
      body: JSON.stringify(storeData)
    });
  }

  async toggleStoreStatus(storeId) {
    return await this.request(`stores/${storeId}/toggle-status`, {
      method: 'PATCH'
    });
  }

  // --- Products & Comparison Matrix ---
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`products${query ? '?' + query : ''}`);
  }

  async getProductComparison(productId) {
    return await this.request(`products/${productId}/compare-stores`);
  }

  async createProduct(productData) {
    return await this.request('products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  }

  // --- Services ---
  async getServices() {
    return await this.request('services');
  }

  async createService(serviceData) {
    return await this.request('services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
  }

  // --- Orders & Checkout ---
  async placeOrder(orderData) {
    return await this.request('orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`orders${query ? '?' + query : ''}`);
  }

  async updateOrderStatus(orderId, status) {
    return await this.request(`orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  // --- Live GPS Rider Tracking ---
  async trackDelivery(orderNumber) {
    return await this.request(`delivery/track/${orderNumber}`);
  }
}

window.apiService = new ApiService();
