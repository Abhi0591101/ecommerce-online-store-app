// Central State Engine & Dynamic Multi-Store Architecture
// Hyperlocal Multi-Store Ecommerce Platform

class CentralStore {
  constructor() {
    this.STORAGE_KEY = 'HYPERLOCAL_ECOMMERCE_STATE_V2';
    this.listeners = [];
    this.state = this.loadInitialState();
    this.initCrossTabSync();
  }

  loadInitialState() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure dynamic arrays exist
        if (!parsed.categories || parsed.categories.length === 0) parsed.categories = window.APP_DATA?.CATEGORIES || [];
        if (!parsed.stores || parsed.stores.length === 0) {
          parsed.stores = window.APP_DATA?.STORES || [];
        } else if (window.APP_DATA?.STORES) {
          // Merge newly available regional stores (e.g. Bengaluru, Delhi, Mumbai, Hyderabad)
          window.APP_DATA.STORES.forEach(appStore => {
            if (!parsed.stores.some(s => s.id === appStore.id)) {
              parsed.stores.push(appStore);
            }
          });
        }
        if (!parsed.products || parsed.products.length === 0) parsed.products = window.APP_DATA?.PRODUCTS || [];
        if (!parsed.services || parsed.services.length === 0) parsed.services = window.APP_DATA?.SERVICES || [];

        // Ensure online statuses for all stores
        if (!parsed.storesOnlineStatus) parsed.storesOnlineStatus = {};
        (parsed.stores || []).forEach(s => {
          if (parsed.storesOnlineStatus[s.id] === undefined) {
            parsed.storesOnlineStatus[s.id] = s.isOnline !== false;
          }
        });
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved state, resetting to default', e);
      }
    }

    // Default Seed State
    const initialOnlineStatuses = {};
    (window.APP_DATA?.STORES || []).forEach(s => {
      initialOnlineStatuses[s.id] = s.isOnline !== false;
    });

    return {
      currentUser: {
        id: 'usr-1',
        name: 'Abhishek Sharma',
        phone: '9876543210',
        email: 'abhishek@example.com',
        role: 'customer', // 'customer' | 'store_owner' | 'driver' | 'service_partner' | 'superadmin'
        isLoggedIn: true,
        addresses: [
          {
            id: 'addr-1',
            tag: 'Home',
            receiverName: 'Abhishek Sharma',
            receiverPhone: '9876543210',
            flatBuilding: 'Flat 402, Tower B, Green Valley',
            streetArea: 'Sector 62',
            pincode: '201301',
            city: 'Noida',
            isDefault: true
          }
        ]
      },
      selectedLocation: {
        pincode: '201301',
        area: 'Sector 62, Noida',
        city: 'Noida',
        lat: 28.6280,
        lng: 77.3649,
        radiusKm: 5.0
      },
      // Dynamic Collections
      categories: window.APP_DATA?.CATEGORIES || [],
      stores: window.APP_DATA?.STORES || [],
      products: window.APP_DATA?.PRODUCTS || [],
      services: window.APP_DATA?.SERVICES || [],

      // Live Online / Offline Store Switches
      storesOnlineStatus: initialOnlineStatuses,
      driverOnlineStatus: true,
      cart: [],
      activeOrders: [],
      pendingStoreApprovals: [
        {
          id: 'app-store-101',
          name: 'Sharma Sweets & Dairy',
          ownerName: 'Sunil Sharma',
          phone: '9899112233',
          category: 'grocery',
          address: 'Shop 8, Sector 62 Market, Noida',
          pincode: '201301',
          gstin: '09AAAAA0000A1Z5',
          fssai: '12723000000123',
          photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
          submittedAt: 'Today, 04:30 PM',
          status: 'pending'
        }
      ],
      registeredDrivers: [
        {
          id: 'drv-1',
          name: 'Amit Kumar',
          phone: '9822338877',
          vehicleType: 'Honda Activa (Scooter)',
          plateNumber: 'UP 16 DX 5544',
          rating: 4.9,
          isOnline: true,
          todayEarnings: 0,
          completedDeliveries: 0,
          status: 'active',
          joinedDate: '15 Aug 2026'
        },
        {
          id: 'drv-2',
          name: 'Sunil Verma',
          phone: '9833449911',
          vehicleType: 'Bajaj Pulsar (Bike)',
          plateNumber: 'DL 7S EF 9012',
          rating: 4.8,
          isOnline: true,
          todayEarnings: 0,
          completedDeliveries: 0,
          status: 'active',
          joinedDate: '16 Aug 2026'
        }
      ],
      pendingDriverKYCs: [
        {
          id: 'app-driver-201',
          name: 'Vicky Kashyap',
          phone: '9811447788',
          vehicleType: 'Hero Splendor (Bike)',
          plateNumber: 'UP 16 DX 9876',
          licenseNo: 'DL-UP16-2022001928',
          aadhaarNo: 'XXXX-XXXX-4812',
          city: 'Sector 62, Noida',
          submittedAt: 'Today, 05:15 PM',
          status: 'pending'
        }
      ],
      pendingServiceKYCs: [
        {
          id: 'app-srv-301',
          name: 'Pawan Kumar',
          phone: '9822558899',
          category: 'plumber',
          experienceYears: 6,
          aadhaarNo: 'XXXX-XXXX-7193',
          submittedAt: 'Today, 06:00 PM',
          status: 'pending'
        }
      ]
    };
  }

  saveState() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => {
      try { fn(this.state); } catch (e) { console.error('Listener error', e); }
    });
  }

  initCrossTabSync() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', (e) => {
        if (e.key === this.STORAGE_KEY && e.newValue) {
          try {
            this.state = JSON.parse(e.newValue);
            this.notify();
          } catch(err) {
            console.error('Storage sync error', err);
          }
        }
      });
    }
  }

  // --- Dynamic Live Database Sync (REST API on Port 3307) ---
  async syncFromDatabase() {
    if (!window.apiService) return;

    try {
      const [cats, stores, prods, srvs] = await Promise.all([
        window.apiService.getCategories(),
        window.apiService.getStores({ online_only: false }),
        window.apiService.getProducts(),
        window.apiService.getServices()
      ]);

      let updated = false;

      if (Array.isArray(cats) && cats.length > 0) {
        this.state.categories = cats.map(c => ({
          id: 'cat-' + c.id,
          name: c.name,
          slug: c.slug,
          icon: c.icon_emoji || '📦',
          count: parseInt(c.product_count) || 0,
          photoUrl: c.photo_url
        }));
        updated = true;
      }

      if (Array.isArray(stores) && stores.length > 0) {
        this.state.stores = stores.map(s => {
          const storeId = 'store-' + s.id;
          this.state.storesOnlineStatus[storeId] = s.is_online == 1;
          const parsedPhotos = s.photos || (s.photos_json ? (typeof s.photos_json === 'string' ? JSON.parse(s.photos_json) : s.photos_json) : [s.photo_url, s.banner_url].filter(Boolean));
          const photosList = Array.isArray(parsedPhotos) ? [...new Set(parsedPhotos)] : [s.photo_url].filter(Boolean);

          return {
            id: storeId,
            dbId: s.id,
            name: s.name,
            category: s.category_slug || 'grocery',
            ownerName: s.owner_name,
            phone: s.phone,
            rating: parseFloat(s.rating) || 4.8,
            reviewsCount: parseInt(s.reviews_count) || 50,
            distanceKm: 1.2,
            estDeliveryMins: parseInt(s.est_delivery_mins) || 20,
            deliveryFee: parseInt(s.base_delivery_fee) || 0,
            freeDeliveryAbove: parseInt(s.free_delivery_above) || 300,
            address: s.address,
            pincode: s.pincode,
            photoUrl: s.photo_url,
            bannerUrl: s.banner_url || s.photo_url,
            photos: photosList.length > 0 ? photosList : [s.photo_url],
            isOnline: s.is_online == 1,
            isApproved: s.status === 'approved',
            pickupAvailable: s.pickup_available == 1,
            openingTime: s.opening_time || '08:00 AM - 10:00 PM'
          };
        });
        updated = true;
      }

      if (Array.isArray(prods) && prods.length > 0) {
        this.state.products = prods.map(p => {
          const parsedPhotos = p.photos || (p.photos_json ? (typeof p.photos_json === 'string' ? JSON.parse(p.photos_json) : p.photos_json) : [p.photo_url].filter(Boolean));
          const photosList = Array.isArray(parsedPhotos) ? [...new Set(parsedPhotos)] : [p.photo_url].filter(Boolean);

          return {
            id: 'prod-' + p.id,
            dbId: p.id,
            name: p.name,
            category: p.category_slug,
            brand: p.brand || 'Local Brand',
            mrp: parseFloat(p.mrp),
            unit: p.unit,
            rating: parseFloat(p.rating) || 4.8,
            reviews: parseInt(p.reviews_count) || 25,
            photoUrl: p.photo_url,
            photos: photosList.length > 0 ? photosList : [p.photo_url],
            description: p.description,
            stores: (p.stores || []).map(st => ({
              storeId: 'store-' + st.store_id,
              price: parseFloat(st.item_price),
              stock: parseInt(st.stock_quantity) || 50,
              inStock: true
            }))
          };
        });
        updated = true;
      }

      if (Array.isArray(srvs) && srvs.length > 0) {
        this.state.services = srvs.map(s => ({
          id: 'srv-' + s.id,
          dbId: s.id,
          name: s.name,
          category: s.category_slug,
          visitCharge: parseFloat(s.visit_charge),
          rating: parseFloat(s.rating) || 4.9,
          reviews: parseInt(s.total_bookings) || 20,
          photoUrl: s.photo_url,
          description: s.description,
          provider: {
            name: s.provider_name,
            phone: s.provider_phone,
            experienceYears: parseInt(s.experience_years) || 5,
            badge: 'Verified Expert'
          }
        }));
        updated = true;
      }

      if (updated) {
        console.log('✅ [CentralStore] Successfully synced live products, categories, and stores from MySQL Database (Port 3307)!');
        this.saveState();
      }
    } catch (e) {
      console.warn('[CentralStore] Database sync notice (using cached state):', e.message);
    }
  }

  // --- Dynamic Getters ---
  getCategories() {
    const raw = this.state.categories || window.APP_DATA?.CATEGORIES || [];
    const list = [...raw];
    if (!list.some(c => c.slug === 'all')) {
      list.unshift({ id: 'all', name: 'All Products', icon: '✨', slug: 'all', photoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80' });
    }
    if (!list.some(c => c.slug === 'services')) {
      list.push({ id: 'services', name: 'Services', icon: '🛠️', slug: 'services', count: (this.state.services || []).length || 5, photoUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=160&auto=format&fit=crop&q=80' });
    }
    if (!list.some(c => c.slug === 'shops')) {
      list.push({ id: 'shops', name: 'Nearby Shops', icon: '🏬', slug: 'shops', count: (this.state.stores || []).length || 7, photoUrl: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=160&auto=format&fit=crop&q=80' });
    }
    return list;
  }

  getStores() {
    return this.state.stores || window.APP_DATA?.STORES || [];
  }

  getProducts() {
    return this.state.products || window.APP_DATA?.PRODUCTS || [];
  }

  getServices() {
    return this.state.services || window.APP_DATA?.SERVICES || [];
  }

  // --- Dynamic CRUD Creators ---

  // 1. Create Dynamic Category
  createCategory(categoryData) {
    const slug = categoryData.slug || categoryData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newCategory = {
      id: 'cat-' + Date.now(),
      name: categoryData.name,
      slug: slug,
      icon: categoryData.icon || '📦',
      count: 0,
      photoUrl: categoryData.photoUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80'
    };

    this.state.categories.push(newCategory);
    this.saveState();
    return newCategory;
  }

  // 2. Create Dynamic Store (Hardware, Furniture, Cosmetics, Grocery, etc.)
  createStore(storeData) {
    const newStoreId = 'store-' + Date.now();
    const newStore = {
      id: newStoreId,
      name: storeData.name,
      category: storeData.category || 'grocery',
      ownerName: storeData.ownerName || 'Store Owner',
      phone: storeData.phone || '9800000000',
      rating: 4.8,
      reviewsCount: 1,
      distanceKm: parseFloat(storeData.distanceKm) || 1.0,
      estDeliveryMins: parseInt(storeData.estDeliveryMins) || 20,
      deliveryFee: parseInt(storeData.deliveryFee) || 0,
      freeDeliveryAbove: parseInt(storeData.freeDeliveryAbove) || 300,
      address: storeData.address || 'Local Market',
      pincode: storeData.pincode || '201301',
      lat: 28.6280,
      lng: 77.3649,
      photoUrl: storeData.photoUrl || 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=500&auto=format&fit=crop&q=80',
      isOnline: true,
      isApproved: true,
      pickupAvailable: true,
      openingTime: storeData.openingTime || '08:00 AM - 10:00 PM'
    };

    this.state.stores.push(newStore);
    this.state.storesOnlineStatus[newStoreId] = true;
    this.saveState();
    return newStore;
  }

  // 3. Create Dynamic Product
  createProduct(productData) {
    const newProduct = {
      id: 'prod-' + Date.now(),
      name: productData.name,
      category: productData.category,
      brand: productData.brand || 'Local Brand',
      mrp: parseFloat(productData.mrp),
      unit: productData.unit || '1 Unit',
      rating: 4.8,
      reviews: 12,
      photoUrl: productData.photoUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
      description: productData.description || 'Quality product from local verified stores.',
      stores: productData.stores || [] // Matrix of { storeId, price, stock, inStock: true }
    };

    this.state.products.push(newProduct);
    this.saveState();
    return newProduct;
  }

  // 4. Create Dynamic Service (Plumber, Carpenter, Beautician, AC, etc.)
  createService(serviceData) {
    const newService = {
      id: 'srv-' + Date.now(),
      name: serviceData.name,
      category: serviceData.category || 'general',
      visitCharge: parseFloat(serviceData.visitCharge) || 149,
      rating: 4.9,
      reviews: 10,
      photoUrl: serviceData.photoUrl || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=80',
      description: serviceData.description || 'Verified local home service professional.',
      provider: {
        name: serviceData.providerName || 'Certified Technician',
        phone: serviceData.providerPhone || '9876543210',
        experienceYears: parseInt(serviceData.experienceYears) || 5,
        badge: 'Verified Expert'
      }
    };

    this.state.services.push(newService);
    this.saveState();
    return newService;
  }

  // --- Dynamic CRUD Updaters ---
  updateStore(storeId, updatedData) {
    const idx = this.state.stores.findIndex(s => s.id === storeId);
    if (idx !== -1) {
      this.state.stores[idx] = { ...this.state.stores[idx], ...updatedData };
      this.saveState();
    }
  }

  updateProduct(productId, updatedData) {
    const idx = this.state.products.findIndex(p => p.id === productId);
    if (idx !== -1) {
      this.state.products[idx] = { ...this.state.products[idx], ...updatedData };
      this.saveState();
    }
  }

  updateCategory(slug, updatedData) {
    const idx = this.state.categories.findIndex(c => c.slug === slug || c.id === slug);
    if (idx !== -1) {
      this.state.categories[idx] = { ...this.state.categories[idx], ...updatedData };
      this.saveState();
    }
  }

  updateService(serviceId, updatedData) {
    const idx = this.state.services.findIndex(s => s.id === serviceId);
    if (idx !== -1) {
      this.state.services[idx] = { ...this.state.services[idx], ...updatedData };
      this.saveState();
    }
  }

  // Delete Handlers
  deleteStore(storeId) {
    this.state.stores = this.state.stores.filter(s => s.id !== storeId);
    delete this.state.storesOnlineStatus[storeId];
    this.saveState();
  }

  deleteProduct(productId) {
    this.state.products = this.state.products.filter(p => p.id !== productId);
    this.saveState();
  }

  deleteService(serviceId) {
    this.state.services = this.state.services.filter(s => s.id !== serviceId);
    this.saveState();
  }

  deleteCategory(slug) {
    this.state.categories = this.state.categories.filter(c => c.slug !== slug);
    this.saveState();
  }

  // --- Auth & Role Actions ---
  switchRole(role) {
    this.state.currentUser.role = role;
    this.saveState();
  }

  // --- Store Rapido Availability Toggle ---
  toggleStoreOnline(storeId) {
    const current = this.state.storesOnlineStatus[storeId] !== false;
    this.state.storesOnlineStatus[storeId] = !current;
    this.saveState();
  }

  setStoreOnline(storeId, isOnline) {
    this.state.storesOnlineStatus[storeId] = !!isOnline;
    this.saveState();
  }

  isStoreOnline(storeId) {
    if (!this.state.storesOnlineStatus) return true;
    return this.state.storesOnlineStatus[storeId] !== false;
  }

  // --- Dynamic Haversine Distance Helper ---
  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 1.0;
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  }

  // --- Location Actions ---
  setLocation(pincode, area, city = 'Noida', lat = 28.6280, lng = 77.3649) {
    const pLat = parseFloat(lat) || 28.6280;
    const pLng = parseFloat(lng) || 77.3649;

    this.state.selectedLocation = { 
      pincode: pincode ? pincode.toString() : '201301', 
      area: area || 'Current Area', 
      city: city || 'NCR', 
      lat: pLat, 
      lng: pLng, 
      radiusKm: 5.0 
    };

    // Dynamically recalibrate distances and delivery times for all active stores
    if (this.state.stores && Array.isArray(this.state.stores)) {
      this.state.stores.forEach(s => {
        if (s.lat && s.lng) {
          const dist = this.calculateDistanceKm(pLat, pLng, s.lat, s.lng);
          s.distanceKm = dist > 0 ? dist : 0.8;
          s.estDeliveryMins = Math.max(15, Math.min(60, Math.round(15 + s.distanceKm * 4)));
        }
      });

      // HyperLocal Auto-Anchor: If custom GPS location has no stores within 25 km,
      // dynamically anchor authentic local merchant partners right in their neighborhood!
      const minDistance = Math.min(...this.state.stores.map(s => s.distanceKm || 9999));
      if (minDistance > 25) {
        this.anchorLocalStoresForCustomLocation(pLat, pLng, area, city, pincode);
      }
    }

    this.saveState();
  }

  // --- Smart HyperLocal Auto-Anchor for Any Custom GPS Location ---
  anchorLocalStoresForCustomLocation(pLat, pLng, area, city, pincode) {
    const cleanArea = area.split(',')[0].trim();
    const cleanCity = city || 'Local Hub';
    const cleanPin = pincode || '201301';

    const anchoredStores = [
      {
        id: `store-gps-${Date.now()}-1`,
        name: `${cleanArea} Super Mart & Daily Needs`,
        category: 'grocery',
        ownerName: 'Sunil Kumar',
        phone: '9811002233',
        rating: 4.8,
        reviewsCount: 285,
        distanceKm: 0.8,
        estDeliveryMins: 18,
        deliveryFee: 15,
        freeDeliveryAbove: 300,
        address: `Main Market, ${cleanArea}, ${cleanCity}`,
        pincode: cleanPin,
        city: cleanCity,
        lat: parseFloat((pLat + 0.0035).toFixed(6)),
        lng: parseFloat((pLng + 0.0028).toFixed(6)),
        photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
        isOnline: true,
        isApproved: true,
        pickupAvailable: true,
        openingTime: '07:30 AM - 10:30 PM'
      },
      {
        id: `store-gps-${Date.now()}-2`,
        name: `Fresh Farm Veggies & Dairy (${cleanArea})`,
        category: 'vegetables',
        ownerName: 'Manoj Patel',
        phone: '9811003344',
        rating: 4.9,
        reviewsCount: 340,
        distanceKm: 1.2,
        estDeliveryMins: 20,
        deliveryFee: 10,
        freeDeliveryAbove: 200,
        address: `Subzi Mandi Road, ${cleanArea}, ${cleanCity}`,
        pincode: cleanPin,
        city: cleanCity,
        lat: parseFloat((pLat - 0.0042).toFixed(6)),
        lng: parseFloat((pLng + 0.0031).toFixed(6)),
        photoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
        isOnline: true,
        isApproved: true,
        pickupAvailable: true,
        openingTime: '06:30 AM - 09:30 PM'
      },
      {
        id: `store-gps-${Date.now()}-3`,
        name: `${cleanArea} Books & Stationery Point`,
        category: 'stationery',
        ownerName: 'Dinesh Sharma',
        phone: '9811004455',
        rating: 4.7,
        reviewsCount: 190,
        distanceKm: 1.5,
        estDeliveryMins: 22,
        deliveryFee: 20,
        freeDeliveryAbove: 350,
        address: `Near Metro Station, ${cleanArea}, ${cleanCity}`,
        pincode: cleanPin,
        city: cleanCity,
        lat: parseFloat((pLat + 0.0051).toFixed(6)),
        lng: parseFloat((pLng - 0.0045).toFixed(6)),
        photoUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop&q=80',
        isOnline: true,
        isApproved: true,
        pickupAvailable: true,
        openingTime: '09:00 AM - 09:00 PM'
      }
    ];

    anchoredStores.forEach(s => {
      this.state.stores.unshift(s);
      this.state.storesOnlineStatus[s.id] = true;
    });
  }

  // Get active stores sorted by distance to current location
  getStoresForActiveLocation(maxRadiusKm = 40) {
    const all = this.getStores();
    const city = this.state.selectedLocation?.city?.toLowerCase();
    
    // First priority: stores in same city or within 40km
    const local = all.filter(s => {
      if (s.distanceKm !== undefined && s.distanceKm <= maxRadiusKm) return true;
      if (city && s.city && s.city.toLowerCase() === city) return true;
      return false;
    });

    const activeList = local.length > 0 ? local : all;
    return activeList.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
  }

  // --- Cart Actions ---
  addToCart(product, store, customPrice = null) {
    const price = customPrice !== null ? customPrice : (product.stores?.find(s => s.storeId === store.id)?.price || product.mrp);
    
    // Check if cart has items from different store
    if (this.state.cart.length > 0 && this.state.cart[0].storeId !== store.id) {
      if (!confirm(`Your cart already contains items from "${this.state.cart[0].storeName}". Would you like to clear cart and add items from "${store.name}"?`)) {
        return false;
      }
      this.state.cart = [];
    }

    const existingIndex = this.state.cart.findIndex(item => item.productId === product.id && item.storeId === store.id);
    if (existingIndex > -1) {
      this.state.cart[existingIndex].quantity += 1;
    } else {
      this.state.cart.push({
        productId: product.id,
        name: product.name,
        photoUrl: product.photoUrl,
        unit: product.unit,
        price: price,
        mrp: product.mrp,
        quantity: 1,
        storeId: store.id,
        storeName: store.name,
        deliveryFee: store.deliveryFee
      });
    }

    this.saveState();
    return true;
  }

  updateCartQty(productId, delta) {
    const item = this.state.cart.find(i => i.productId === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.state.cart = this.state.cart.filter(i => i.productId !== productId);
    }
    this.saveState();
  }

  clearCart() {
    this.state.cart = [];
    this.saveState();
  }

  getCartTotals(fulfillmentMode = 'delivery', selectedTimeSlot = null) {
    const itemsCount = this.state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const itemsTotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const mrpTotal = this.state.cart.reduce((sum, item) => sum + (item.mrp * item.quantity), 0);
    const savings = Math.max(0, mrpTotal - itemsTotal);
    
    let deliveryFee = 0;
    if (fulfillmentMode === 'pickup') {
      deliveryFee = 0;
    } else {
      const fulfillingStoreId = this.state.cart[0]?.storeId;
      const store = this.getStores().find(s => s.id === fulfillingStoreId);
      const storeDeliveryFee = store ? (store.deliveryFee !== undefined ? store.deliveryFee : 20) : 20;

      // Find slot fee from window.APP_DATA.TIME_SLOTS
      const slotObj = window.APP_DATA?.TIME_SLOTS?.find(s => s.label === selectedTimeSlot || s.id === selectedTimeSlot);
      
      if (slotObj && slotObj.fee !== undefined) {
        deliveryFee = slotObj.fee;
      } else if (selectedTimeSlot && (selectedTimeSlot.includes('Tomorrow') || selectedTimeSlot.includes('Saver'))) {
        deliveryFee = 0;
      } else if (selectedTimeSlot && selectedTimeSlot.includes('Evening')) {
        deliveryFee = 10;
      } else {
        deliveryFee = storeDeliveryFee;
      }
      
      if (store && store.freeDeliveryAbove > 0 && itemsTotal >= store.freeDeliveryAbove) {
        if (!selectedTimeSlot || !selectedTimeSlot.includes('Express')) {
          deliveryFee = 0;
        }
      }
    }

    return {
      itemsCount,
      itemsTotal,
      savings,
      deliveryFee,
      grandTotal: itemsTotal + deliveryFee
    };
  }

  // --- Order Placement ---
  placeOrder(orderData) {
    const totals = this.getCartTotals(orderData.orderType || 'delivery', orderData.timeSlot);
    const order = {
      id: 'ord-' + Date.now(),
      orderNumber: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      storeId: orderData.storeId,
      storeName: orderData.storeName,
      items: [...this.state.cart],
      itemsTotal: totals.itemsTotal,
      deliveryFee: totals.deliveryFee,
      grandTotal: totals.grandTotal,
      savings: totals.savings,
      orderType: orderData.orderType || 'delivery',
      timeSlot: orderData.timeSlot || (orderData.orderType === 'pickup' ? '🏬 Instant Store Pickup (Ready in 15 mins)' : '⚡ Express Delivery (15-25 Mins)'),
      customerName: orderData.customerName || this.state.currentUser.name,
      customerPhone: orderData.customerPhone || this.state.currentUser.phone,
      deliveryAddress: orderData.orderType === 'pickup' 
        ? `Self-Pickup at: ${orderData.storeName}` 
        : (orderData.deliveryAddress || `Flat 402, ${this.state.selectedLocation?.area || 'Local Area'}, ${this.state.selectedLocation?.city || 'City'} - ${this.state.selectedLocation?.pincode || '201301'}`),
      customerLat: orderData.customerLat || this.state.selectedLocation?.lat || 28.6280,
      customerLng: orderData.customerLng || this.state.selectedLocation?.lng || 77.3649,
      storeLat: orderData.storeLat || this.getStores().find(s => s.id === orderData.storeId)?.lat || 28.6280,
      storeLng: orderData.storeLng || this.getStores().find(s => s.id === orderData.storeId)?.lng || 77.3649,
      paymentMode: orderData.paymentMode || 'COD',
      status: orderData.orderType === 'pickup' ? 'store_accepted' : 'placed',
      placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      otp: Math.floor(1000 + Math.random() * 9000).toString(),
      driver: null
    };

    this.state.activeOrders.unshift(order);
    this.clearCart();
    this.saveState();
    return order;
  }

  // --- Customer Order History & 1-Click Reorder ---
  getCustomerOrders() {
    return this.state.activeOrders || [];
  }

  getOrderById(orderId) {
    return this.state.activeOrders?.find(o => o.id === orderId || o.orderNumber === orderId) || null;
  }

  reorderPastOrder(orderId) {
    const order = this.getOrderById(orderId);
    if (!order || !order.items || order.items.length === 0) {
      return { success: false, message: 'Order details not found.' };
    }

    if (!this.isStoreOnline(order.storeId)) {
      return { success: false, message: `"${order.storeName}" is currently offline. Please try another store.` };
    }

    // Set cart to the items from this past order
    this.state.cart = JSON.parse(JSON.stringify(order.items));
    this.saveState();
    return { success: true, order: order };
  }

  // --- Driver & Fleet Management Methods ---
  getDriverProfile() {
    if (!this.state.driverProfile) {
      const activeDrivers = this.getRegisteredDrivers();
      if (activeDrivers.length > 0) {
        const d = activeDrivers[0];
        this.state.driverProfile = {
          id: d.id,
          name: d.name,
          phone: d.phone,
          plateNumber: `${d.plateNumber} (${d.vehicleType})`,
          rating: d.rating || 5.0,
          isOnline: d.isOnline !== false,
          todayEarnings: d.todayEarnings || 0,
          completedDeliveries: d.completedDeliveries || 0
        };
      } else {
        this.state.driverProfile = {
          id: 'drv-default',
          name: 'Delivery Partner',
          phone: '9811009988',
          plateNumber: 'UP 16 DX 9876 (Hero Splendor)',
          rating: 5.0,
          isOnline: true,
          todayEarnings: 0,
          completedDeliveries: 0
        };
      }
    }
    return this.state.driverProfile;
  }

  setDriverDutyStatus(isOnline) {
    const p = this.getDriverProfile();
    p.isOnline = isOnline;
    this.saveState();
    return p;
  }

  getOrdersForDispatch() {
    return (this.state.activeOrders || []).filter(o => o.status === 'placed' || o.status === 'store_accepted');
  }

  getActiveDriverRun() {
    return (this.state.activeOrders || []).find(o => ['driver_assigned', 'heading_to_store', 'at_store', 'picked_up', 'out_for_delivery', 'at_doorstep'].includes(o.status));
  }

  getCompletedDriverOrders() {
    return (this.state.activeOrders || []).filter(o => o.status === 'delivered');
  }

  acceptOrderAsDriver(orderId) {
    const order = (this.state.activeOrders || []).find(o => o.id === orderId || o.orderNumber === orderId);
    if (!order) return false;
    order.status = 'driver_assigned';
    order.driverAcceptedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    order.driver = { ...this.getDriverProfile() };
    this.saveState();
    return order;
  }

  updateOrderStatus(orderId, newStatus) {
    const order = (this.state.activeOrders || []).find(o => o.id === orderId || o.orderNumber === orderId);
    if (!order) return false;
    order.status = newStatus;
    if (newStatus === 'picked_up') {
      order.pickedUpAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    this.saveState();
    return order;
  }

  verifyOrderDeliveryOtp(orderId, enteredOtp) {
    const order = (this.state.activeOrders || []).find(o => o.id === orderId || o.orderNumber === orderId);
    if (!order) return { success: false, message: 'Order not found' };

    const expectedOtp = (order.otp || '4821').toString().trim();
    if (enteredOtp.toString().trim() === expectedOtp) {
      order.status = 'delivered';
      order.deliveredAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const driver = this.getDriverProfile();
      const tripEarning = Math.floor(45 + Math.random() * 25);
      driver.todayEarnings = (driver.todayEarnings || 0) + tripEarning;
      driver.completedDeliveries = (driver.completedDeliveries || 0) + 1;
      order.driverEarning = tripEarning;

      this.saveState();
      return { success: true, message: 'Delivery Verified & Completed!', order, tripEarning };
    } else {
      return { success: false, message: 'Invalid OTP! Please ask customer for the 4-digit code shown on their tracking screen.' };
    }
  }

  generateDemoOrder() {
    const stores = this.getStores();
    const store = stores[0] || { id: 'store-1', name: 'Gupta Super Kirana' };
    const prods = this.getProducts();
    const p1 = prods[0] || { name: 'Aashirvaad Shudh Chakki Atta 5kg', mrp: 260 };
    const p2 = prods[1] || { name: 'Amul Butter 500g', mrp: 275 };

    const demoOrder = {
      id: 'ord-' + Date.now(),
      orderNumber: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      storeId: store.id,
      storeName: store.name,
      items: [
        { productName: p1.name, price: p1.mrp || 250, quantity: 1, photoUrl: p1.photoUrl },
        { productName: p2.name, price: p2.mrp || 270, quantity: 2, photoUrl: p2.photoUrl }
      ],
      itemsTotal: (p1.mrp || 250) + (p2.mrp || 270) * 2,
      deliveryFee: 15,
      grandTotal: (p1.mrp || 250) + (p2.mrp || 270) * 2 + 15,
      savings: 40,
      orderType: 'delivery',
      timeSlot: '⚡ Express Delivery (15-25 Mins)',
      customerName: 'Amit Saxena',
      customerPhone: '9876543210',
      deliveryAddress: 'Flat 402, Block B, Amrapali Silicon City, Sector 76, Noida',
      paymentMode: 'COD',
      status: 'placed',
      placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      otp: Math.floor(1000 + Math.random() * 9000).toString(),
      driver: {
        name: 'Rahul Sharma',
        phone: '9811009988',
        plateNumber: 'DL 3S AB 1234 (Hero Splendor)',
        rating: 4.9,
        lat: 28.6280,
        lng: 77.3649
      }
    };

    if (!this.state.activeOrders) this.state.activeOrders = [];
    this.state.activeOrders.unshift(demoOrder);
    this.saveState();
    return demoOrder;
  }

  // --- Rider Fleet & KYC Onboarding Methods ---
  getRegisteredDrivers() {
    return this.state.registeredDrivers || [];
  }

  getPendingDriverKYCs() {
    return this.state.pendingDriverKYCs || [];
  }

  submitDriverKYC(driverData) {
    if (!this.state.pendingDriverKYCs) this.state.pendingDriverKYCs = [];
    
    const kycApplication = {
      id: 'app-driver-' + Date.now(),
      name: driverData.name,
      phone: driverData.phone,
      vehicleType: driverData.vehicleType || 'Hero Splendor (Bike)',
      plateNumber: driverData.plateNumber,
      licenseNo: driverData.licenseNo,
      aadhaarNo: driverData.aadhaarNo,
      city: driverData.city || 'Sector 62, Noida',
      upiId: driverData.upiId || `${driverData.phone}@upi`,
      photoUrl: driverData.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      submittedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'pending'
    };

    this.state.pendingDriverKYCs.unshift(kycApplication);
    this.saveState();
    return kycApplication;
  }

  approveDriverKYC(kycId) {
    if (!this.state.pendingDriverKYCs) this.state.pendingDriverKYCs = [];
    if (!this.state.registeredDrivers) this.state.registeredDrivers = [];

    const idx = this.state.pendingDriverKYCs.findIndex(k => k.id === kycId);
    if (idx === -1) return { success: false, message: 'KYC Application not found' };

    const app = this.state.pendingDriverKYCs[idx];
    const newDriver = {
      id: 'drv-' + Date.now(),
      name: app.name,
      phone: app.phone,
      vehicleType: app.vehicleType,
      plateNumber: app.plateNumber,
      licenseNo: app.licenseNo,
      aadhaarNo: app.aadhaarNo,
      rating: 5.0,
      isOnline: true,
      todayEarnings: 0,
      completedDeliveries: 0,
      status: 'active',
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    this.state.registeredDrivers.unshift(newDriver);
    this.state.pendingDriverKYCs.splice(idx, 1);
    this.saveState();
    return { success: true, driver: newDriver };
  }

  rejectDriverKYC(kycId) {
    if (!this.state.pendingDriverKYCs) return false;
    this.state.pendingDriverKYCs = this.state.pendingDriverKYCs.filter(k => k.id !== kycId);
    this.saveState();
    return true;
  }

  createDriverDirectly(driverData) {
    if (!this.state.registeredDrivers) this.state.registeredDrivers = [];

    const newDriver = {
      id: 'drv-' + Date.now(),
      name: driverData.name,
      phone: driverData.phone,
      vehicleType: driverData.vehicleType || 'Motorcycle (Bike)',
      plateNumber: driverData.plateNumber || 'DL 3S AB 9999',
      licenseNo: driverData.licenseNo || 'DL-PENDING',
      rating: parseFloat(driverData.rating) || 5.0,
      isOnline: true,
      todayEarnings: 0,
      completedDeliveries: 0,
      status: 'active',
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    this.state.registeredDrivers.unshift(newDriver);
    this.saveState();
    return newDriver;
  }

  switchActiveDriver(driverId) {
    const driver = (this.state.registeredDrivers || []).find(d => d.id === driverId);
    if (!driver) return false;
    this.state.driverProfile = {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      plateNumber: `${driver.plateNumber} (${driver.vehicleType})`,
      rating: driver.rating,
      isOnline: driver.isOnline,
      todayEarnings: driver.todayEarnings || 0,
      completedDeliveries: driver.completedDeliveries || 0
    };
    this.saveState();
    return this.state.driverProfile;
  }
}

// Global Singleton
window.centralStore = new CentralStore();
